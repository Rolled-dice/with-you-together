/**
 * WhatsApp bot conversation engine — provider agnostic.
 *
 * Takes a normalised inbound message and drives a small, elder-friendly state
 * machine: number-linking, booking a listener call, logging medicine doses, and
 * adding medicines from a prescription photo. Replies are queued through the
 * outbox so the bot is fully testable before a provider is connected.
 */
import type { Json } from "@/integrations/supabase/types";
import { enqueueMessage, normalizePhone } from "./provider.server";

type Inbound = {
  phone: string;
  body?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
};

type Session = {
  phone: string;
  flow: string;
  step: string;
  context: Record<string, unknown>;
};

const MENU = [
  "How can I help?",
  "",
  "1  Book a call with a listener",
  "2  My medicines for today",
  "3  Add a medicine from a photo",
  "4  Talk to a human / help",
  "",
  "Reply with a number, or send a photo of a prescription any time.",
].join("\n");

const DEFAULT_TZ = "Asia/Kolkata";

export async function handleInbound(raw: Inbound) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const phone = normalizePhone(raw.phone);
  if (!phone) return { ok: false, error: "invalid phone" };

  const text = (raw.body ?? "").trim();
  const lower = text.toLowerCase();

  await supabaseAdmin.from("whatsapp_messages").insert({
    phone,
    direction: "inbound",
    body: text || null,
    media_url: raw.mediaUrl ?? null,
    media_type: raw.mediaType ?? null,
  });

  // ---- contact ----
  const { data: contact } = await supabaseAdmin
    .from("whatsapp_contacts")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (!contact) {
    await supabaseAdmin.from("whatsapp_contacts").insert({ phone, opted_in: true });
  }
  await supabaseAdmin
    .from("whatsapp_contacts")
    .update({ last_inbound_at: new Date().toISOString() })
    .eq("phone", phone);

  const reply = async (body: string, kind = "reply") => {
    await enqueueMessage({ phone, body, kind });
  };

  // ---- opt-out / opt-in ----
  if (["stop", "unsubscribe"].includes(lower)) {
    await supabaseAdmin.from("whatsapp_contacts").update({ opted_in: false }).eq("phone", phone);
    await reply("You're unsubscribed. Reply START any time to hear from BesideU again.");
    return { ok: true };
  }
  if (["start", "resume"].includes(lower)) {
    await supabaseAdmin.from("whatsapp_contacts").update({ opted_in: true }).eq("phone", phone);
    await reply("Welcome back. " + MENU);
    return { ok: true };
  }

  // ---- linking ----
  if (!contact?.verified_at || !contact?.user_id) {
    return linkFlow({ phone, text, reply });
  }

  const userId = contact.user_id as string;
  const session = await loadSession(phone);

  // Global escapes
  if (["menu", "hi", "hello", "hey", "help", "0"].includes(lower)) {
    await saveSession(phone, "idle", "start", {});
    await reply(MENU);
    return { ok: true };
  }
  if (["cancel", "stop flow", "back"].includes(lower)) {
    await saveSession(phone, "idle", "start", {});
    await reply("No problem, I've stopped that. " + MENU);
    return { ok: true };
  }

  // A photo always starts the prescription flow.
  if (raw.mediaUrl) {
    return prescriptionFlow({ phone, userId, mediaUrl: raw.mediaUrl, reply });
  }

  if (session.flow === "book") return bookFlow({ phone, userId, text, session, reply });
  if (session.flow === "meds") return medsFlow({ phone, userId, text, session, reply });
  if (session.flow === "prescription") {
    return prescriptionConfirm({ phone, userId, text, session, reply });
  }

  // Idle: menu selection
  if (lower === "1" || lower.startsWith("book")) {
    await saveSession(phone, "book", "ask_day", {});
    await reply(
      [
        "Let's book a call with a listener.",
        "",
        "Which day? Reply with:",
        "• TODAY",
        "• TOMORROW",
        "• or a date like 24-08",
      ].join("\n"),
    );
    return { ok: true };
  }
  if (lower === "2" || lower.includes("medicine") || lower.includes("medicines")) {
    return medsList({ phone, userId, reply });
  }
  if (lower === "3" || lower.includes("photo") || lower.includes("prescription")) {
    await reply("Please send a clear photo of the prescription and I'll read it for you.");
    return { ok: true };
  }
  if (lower === "4") {
    await reply(
      "I've let our care team know you'd like to talk to a person. Someone will reach out. If this is an emergency, please call your local emergency number right away.",
    );
    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      kind: "whatsapp_human_request",
      severity: "warning",
      title: "WhatsApp: member asked for a human",
      body: `${phone} requested to speak with someone.`,
    });
    return { ok: true };
  }

  await reply("Sorry, I didn't catch that.\n\n" + MENU);
  return { ok: true };
}

// ---------------------------------------------------------------- linking

async function linkFlow({
  phone,
  text,
  reply,
}: {
  phone: string;
  text: string;
  reply: (b: string) => Promise<void>;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const code = text.replace(/\D/g, "");

  if (code.length === 6) {
    const { data: match } = await supabaseAdmin
      .from("whatsapp_contacts")
      .select("id, user_id, link_code_expires_at")
      .eq("link_code", code)
      .maybeSingle();

    const expired =
      !match?.link_code_expires_at || new Date(match.link_code_expires_at).getTime() < Date.now();

    if (match?.user_id && !expired) {
      // Move the verified link onto the number that actually messaged us.
      await supabaseAdmin.from("whatsapp_contacts").delete().eq("phone", phone).is("user_id", null);
      await supabaseAdmin
        .from("whatsapp_contacts")
        .update({
          phone,
          verified_at: new Date().toISOString(),
          link_code: null,
          link_code_expires_at: null,
          opted_in: true,
        })
        .eq("id", match.id);
      await reply("You're connected to BesideU. " + MENU);
      return { ok: true };
    }
    await reply(
      "That code didn't work — it may have expired. Open BesideU on the web, go to Settings → WhatsApp, and tap “Get a new code”.",
    );
    return { ok: true };
  }

  await reply(
    [
      "Hello, this is BesideU. 💙",
      "",
      "To keep things private I need to connect this number to your account.",
      "Open BesideU on the web → Settings → WhatsApp → Get code, then send me the 6-digit code.",
    ].join("\n"),
  );
  return { ok: true };
}

// ---------------------------------------------------------------- booking

async function bookFlow({
  phone,
  userId,
  text,
  session,
  reply,
}: {
  phone: string;
  userId: string;
  text: string;
  session: Session;
  reply: (b: string) => Promise<void>;
}) {
  const ctx = session.context as { day?: string; time?: string };

  if (session.step === "ask_day") {
    const day = parseDay(text);
    if (!day) {
      await reply("I couldn't read that day. Reply TODAY, TOMORROW, or a date like 24-08.");
      return { ok: true };
    }
    await saveSession(phone, "book", "ask_time", { day });
    await reply(
      "What time works? Reply like 4pm, 16:00 or 9:30am.\n(Calls need at least 2 hours' notice.)",
    );
    return { ok: true };
  }

  if (session.step === "ask_time") {
    const time = parseTime(text);
    if (!time) {
      await reply("Sorry, I couldn't read that time. Try 4pm or 16:00.");
      return { ok: true };
    }
    await saveSession(phone, "book", "ask_note", { ...ctx, time });
    await reply(
      "In a few words, what would you like to talk about? (Or reply SKIP.)",
    );
    return { ok: true };
  }

  if (session.step === "ask_note") {
    const note = /^skip$/i.test(text.trim()) ? "Booked via WhatsApp" : text.slice(0, 500);
    const tz = await userTimezone(userId);
    const whenIso = combineToUtc(ctx.day!, ctx.time!, tz);
    const result = await createBooking({ userId, whenIso, note, tz });
    await saveSession(phone, "idle", "start", {});

    if (!result.ok) {
      await reply(result.message);
      return { ok: true };
    }
    await reply(
      [
        "All set. 💙",
        `A listener will call this number on ${formatWhen(whenIso, tz)}.`,
        "",
        "Reply MENU any time for other options.",
      ].join("\n"),
    );
    return { ok: true };
  }

  await saveSession(phone, "idle", "start", {});
  await reply(MENU);
  return { ok: true };
}

async function createBooking({
  userId,
  whenIso,
  note,
  tz,
}: {
  userId: string;
  whenIso: string;
  note: string;
  tz: string;
}): Promise<{ ok: boolean; message: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (new Date(whenIso).getTime() - Date.now() < 2 * 60 * 60 * 1000) {
    return {
      ok: false,
      message:
        "Calls need at least 2 hours' notice so we can find the right listener. Reply MENU and pick a later time.",
    };
  }

  const { data: listeners } = await supabaseAdmin
    .from("listeners")
    .select("id")
    .eq("is_active", true);
  if (!listeners?.length) {
    return { ok: false, message: "Our listeners are fully booked right now. Please try another day." };
  }

  const { data: existing } = await supabaseAdmin
    .from("listener_bookings")
    .select("listener_id")
    .in("status", ["requested", "confirmed"]);
  const counts = new Map<string, number>(listeners.map((l) => [l.id, 0]));
  for (const b of existing ?? []) counts.set(b.listener_id, (counts.get(b.listener_id) ?? 0) + 1);
  const assigned = [...counts.entries()].sort((a, b) => a[1] - b[1])[0][0];

  const { error } = await supabaseAdmin.from("listener_bookings").insert({
    user_id: userId,
    listener_id: assigned,
    requested_at: whenIso,
    duration_minutes: 30,
    note: `[TZ:${tz}][WHATSAPP] ${note}`,
    status: "confirmed",
    crm_state: "requested",
    sla_deadline: whenIso,
  });
  if (error) return { ok: false, message: "Something went wrong booking that. Please try again." };
  return { ok: true, message: "booked" };
}

// ---------------------------------------------------------------- medicines

async function medsList({
  phone,
  userId,
  reply,
}: {
  phone: string;
  userId: string;
  reply: (b: string) => Promise<void>;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const { data: doses } = await supabaseAdmin
    .from("dose_logs")
    .select("id, scheduled_at, status, medications(name, dosage)")
    .eq("for_user_id", userId)
    .gte("scheduled_at", start.toISOString())
    .lt("scheduled_at", end.toISOString())
    .order("scheduled_at", { ascending: true });

  if (!doses?.length) {
    await saveSession(phone, "idle", "start", {});
    await reply("You have no medicines scheduled for today. Reply MENU for other options.");
    return { ok: true };
  }

  const tz = await userTimezone(userId);
  const lines = doses.map((d, i) => {
    const med = (d.medications ?? {}) as { name?: string; dosage?: string };
    const mark = d.status === "taken" ? "✅" : d.status === "skipped" ? "⏭️" : "⬜";
    const time = new Date(d.scheduled_at).toLocaleTimeString("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    });
    return `${i + 1}. ${mark} ${time} — ${med.name ?? "Medicine"}${med.dosage ? ` (${med.dosage})` : ""}`;
  });

  await saveSession(phone, "meds", "await_action", { ids: doses.map((d) => d.id) });
  await reply(
    ["Today's medicines:", "", ...lines, "", "Reply TAKEN 1 or SKIP 1 to update one."].join("\n"),
  );
  return { ok: true };
}

async function medsFlow({
  phone,
  userId,
  text,
  session,
  reply,
}: {
  phone: string;
  userId: string;
  text: string;
  session: Session;
  reply: (b: string) => Promise<void>;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ids = (session.context as { ids?: string[] }).ids ?? [];
  const m = text.trim().match(/^(taken|took|yes|done|skip|skipped|no)\s*(\d+)?$/i);

  if (!m) {
    await reply("Reply TAKEN 1 or SKIP 1 (using the number from the list), or MENU to go back.");
    return { ok: true };
  }

  const status = /^(skip|skipped|no)$/i.test(m[1]) ? "skipped" : "taken";
  const index = m[2] ? parseInt(m[2], 10) - 1 : 0;
  const doseId = ids[index];
  if (!doseId) {
    await reply("I couldn't find that item. Reply 2 to see today's list again.");
    return { ok: true };
  }

  await supabaseAdmin
    .from("dose_logs")
    .update({ status, logged_at: new Date().toISOString(), logged_by: userId })
    .eq("id", doseId)
    .eq("for_user_id", userId);

  await reply(
    status === "taken"
      ? "Marked as taken. Well done. 💙 Reply 2 to see the rest."
      : "Marked as skipped. Reply 2 to see the rest.",
  );
  return { ok: true };
}

// ---------------------------------------------------------------- prescription photo

async function prescriptionFlow({
  phone,
  userId,
  mediaUrl,
  reply,
}: {
  phone: string;
  userId: string;
  mediaUrl: string;
  reply: (b: string) => Promise<void>;
}) {
  await reply("Thank you — reading the prescription now, one moment…");

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    await reply("I can't read photos right now. Please add the medicine on the BesideU website.");
    return { ok: true };
  }

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a careful medical assistant. Extract medications from a prescription image. " +
              'Return STRICT JSON: { "medications": [{ "name": string, "dosage": string|null, "form": string|null, "instructions": string|null, "times_per_day": number, "when_to_take": string[] }] }. ' +
              "when_to_take values are morning, afternoon, evening or night. Never invent medications you cannot read.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract all medications from this prescription:" },
              { type: "image_url", image_url: { url: mediaUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`gateway ${res.status}`);
    const json = await res.json();
    const parsed = JSON.parse(json?.choices?.[0]?.message?.content ?? "{}");
    const meds = Array.isArray(parsed?.medications) ? parsed.medications.slice(0, 8) : [];

    if (!meds.length) {
      await reply(
        "I couldn't read any medicines from that photo. Could you send a clearer, well-lit picture?",
      );
      return { ok: true };
    }

    const lines = meds.map(
      (m: Record<string, unknown>, i: number) =>
        `${i + 1}. ${m.name}${m.dosage ? ` — ${m.dosage}` : ""}${
          m.times_per_day ? ` (${m.times_per_day}× a day)` : ""
        }`,
    );
    await saveSession(phone, "prescription", "confirm", { meds });
    await reply(
      ["I found:", "", ...lines, "", "Shall I add these with reminders? Reply YES or NO."].join("\n"),
    );
    return { ok: true };
  } catch (e) {
    console.error("whatsapp prescription parse failed", e);
    await reply("Sorry, I couldn't read that photo. Please try again in a moment.");
    return { ok: true };
  }
}

const TIME_FOR_SLOT: Record<string, string> = {
  morning: "08:00:00",
  afternoon: "13:00:00",
  evening: "19:00:00",
  night: "21:30:00",
};

async function prescriptionConfirm({
  phone,
  userId,
  text,
  session,
  reply,
}: {
  phone: string;
  userId: string;
  text: string;
  session: Session;
  reply: (b: string) => Promise<void>;
}) {
  const lower = text.trim().toLowerCase();
  if (!/^(y|yes|ok|okay|haan|sure)$/i.test(lower)) {
    if (/^(n|no)$/i.test(lower)) {
      await saveSession(phone, "idle", "start", {});
      await reply("Okay, I haven't added anything. Reply MENU for other options.");
      return { ok: true };
    }
    await reply("Please reply YES to add these medicines, or NO to discard.");
    return { ok: true };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const meds = ((session.context as { meds?: Record<string, unknown>[] }).meds ?? []).slice(0, 8);
  let added = 0;

  for (const m of meds) {
    const { data: med } = await supabaseAdmin
      .from("medications")
      .insert({
        for_user_id: userId,
        added_by: userId,
        name: String(m.name ?? "Medicine").slice(0, 200),
        dosage: m.dosage ? String(m.dosage).slice(0, 100) : null,
        form: m.form ? String(m.form).slice(0, 60) : null,
        instructions: m.instructions ? String(m.instructions).slice(0, 500) : null,
        start_date: new Date().toISOString().slice(0, 10),
        notes: "Added via WhatsApp from a prescription photo",
        is_active: true,
      })
      .select("id")
      .maybeSingle();
    if (!med) continue;
    added += 1;

    const slots = Array.isArray(m.when_to_take)
      ? (m.when_to_take as string[])
      : typeof m.when_to_take === "string"
        ? [m.when_to_take]
        : ["morning"];
    const times = slots
      .map((s) => TIME_FOR_SLOT[String(s).toLowerCase()])
      .filter(Boolean)
      .slice(0, 4);
    const finalTimes = times.length ? times : ["08:00:00"];
    for (const t of finalTimes) {
      await supabaseAdmin.from("medication_schedules").insert({
        medication_id: med.id,
        time_of_day: t,
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
        with_food: false,
      });
    }
  }

  await saveSession(phone, "idle", "start", {});
  await reply(
    added
      ? `Added ${added} medicine${added > 1 ? "s" : ""} with daily reminders. I'll message you when it's time. 💙`
      : "I couldn't save those. Please add them on the BesideU website.",
  );
  return { ok: true };
}

// ---------------------------------------------------------------- helpers

async function loadSession(phone: string): Promise<Session> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("whatsapp_sessions")
    .select("phone, flow, step, context, expires_at")
    .eq("phone", phone)
    .maybeSingle();

  if (!data || new Date(data.expires_at).getTime() < Date.now()) {
    return { phone, flow: "idle", step: "start", context: {} };
  }
  return {
    phone,
    flow: data.flow,
    step: data.step,
    context: (data.context ?? {}) as Record<string, unknown>,
  };
}

async function saveSession(
  phone: string,
  flow: string,
  step: string,
  context: Record<string, unknown>,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("whatsapp_sessions").upsert(
    {
      phone,
      flow,
      step,
      context: context as unknown as Json,
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "phone" },
  );
}

async function userTimezone(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();
  return data?.timezone || DEFAULT_TZ;
}

export function parseDay(input: string): string | null {
  const t = input.trim().toLowerCase();
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (t === "today" || t === "aaj") return iso(now);
  if (t === "tomorrow" || t === "kal") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return iso(d);
  }
  const full = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (full) return t;
  const dm = t.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?$/);
  if (dm) {
    const day = Number(dm[1]);
    const month = Number(dm[2]);
    let year = dm[3] ? Number(dm[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

export function parseTime(input: string): string | null {
  const t = input.trim().toLowerCase().replace(/\s+/g, "");
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const mer = m[3];
  if (minute > 59) return null;
  if (mer === "pm" && hour < 12) hour += 12;
  if (mer === "am" && hour === 12) hour = 0;
  if (!mer && hour < 8) hour += 12; // "4" almost always means the afternoon
  if (hour > 23) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Interprets `YYYY-MM-DD` + `HH:mm` in the given IANA zone and returns UTC ISO. */
export function combineToUtc(day: string, time: string, timeZone: string): string {
  const naive = new Date(`${day}T${time}:00Z`);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(naive).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const asIfTz = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === "24" ? "00" : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offset = asIfTz - naive.getTime();
  return new Date(naive.getTime() - offset).toISOString();
}

function formatWhen(iso: string, tz: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
