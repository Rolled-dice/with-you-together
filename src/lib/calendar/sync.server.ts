import { resolveHolder, type ConnectedHolder, type FamilyAdultLink } from "./holder";
import {
  buildDoseEvent, buildReminderEvent, diffEvents,
  type DesiredEvent, type ExistingLink,
} from "./events";
import { decryptSecret } from "./crypto.server";
import { refreshAccessToken, insertEvent, patchEvent, deleteEvent } from "./google-api.server";

const WINDOW_DAYS_DEFAULT = 7;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

// Return a valid access token for a holder, refreshing if needed. null if not connected/enabled.
export async function getFreshAccessToken(
  holderUserId: string,
): Promise<{ accessToken: string; calendarId: string } | null> {
  const mod = await import("@/integrations/supabase/client.server");
  // New tables aren't in the generated Supabase types yet; use an untyped client
  // (matches the repo convention of `supabase: any` in server helpers).
  const supabaseAdmin = mod.supabaseAdmin as any;
  const { data: cred } = await supabaseAdmin
    .from("google_calendar_credentials")
    .select("*")
    .eq("user_id", holderUserId)
    .maybeSingle();
  if (!cred || !cred.sync_enabled) return null;

  const notExpired =
    cred.access_token &&
    cred.access_token_expires_at &&
    new Date(cred.access_token_expires_at).getTime() > Date.now() + 60_000;
  if (notExpired) return { accessToken: cred.access_token as string, calendarId: cred.calendar_id };

  const refreshToken = await decryptSecret(cred.encrypted_refresh_token, env("CALENDAR_TOKEN_ENC_KEY"));
  const tokens = await refreshAccessToken({
    refreshToken,
    clientId:
      process.env["GOOGLE_CALENDAR_CLIENT_ID"] ?? env("GOOGLE_OAUTH_CLIENT_ID"),
    clientSecret:
      process.env["GOOGLE_CALENDAR_CLIENT_SECRET"] ?? env("GOOGLE_OAUTH_CLIENT_SECRET"),
  });
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await supabaseAdmin
    .from("google_calendar_credentials")
    .update({ access_token: tokens.access_token, access_token_expires_at: expiresAt })
    .eq("user_id", holderUserId);
  return { accessToken: tokens.access_token, calendarId: cred.calendar_id };
}

// Load connected holders and family-admin links for holder resolution.
async function loadResolutionInputs(supabaseAdmin: any): Promise<{
  connected: ConnectedHolder[];
  familyAdults: FamilyAdultLink[];
}> {
  const { data: creds } = await supabaseAdmin
    .from("google_calendar_credentials")
    .select("user_id, calendar_id, sync_enabled")
    .eq("sync_enabled", true);
  const connected: ConnectedHolder[] = (creds ?? []).map((c: any) => ({
    user_id: c.user_id,
    calendar_id: c.calendar_id,
  }));

  // Build (admin, member) links from family_members: owners/adults are admins over every member.
  const { data: fm } = await supabaseAdmin
    .from("family_members")
    .select("family_id, user_id, role");
  const byFamily = new Map<string, { user_id: string; role: string }[]>();
  for (const row of fm ?? []) {
    const list = byFamily.get(row.family_id) ?? [];
    list.push({ user_id: row.user_id, role: row.role });
    byFamily.set(row.family_id, list);
  }
  const familyAdults: FamilyAdultLink[] = [];
  for (const members of byFamily.values()) {
    const admins = members.filter((m) => m.role === "owner" || m.role === "adult");
    for (const a of admins) {
      for (const m of members) {
        if (m.user_id !== a.user_id) {
          familyAdults.push({ admin_user_id: a.user_id, member_user_id: m.user_id });
        }
      }
    }
  }
  return { connected, familyAdults };
}

export async function runCalendarSyncWindow(
  opts?: { windowDays?: number },
): Promise<{ holders: number; created: number; updated: number; deleted: number }> {
  const mod = await import("@/integrations/supabase/client.server");
  // Untyped: new tables not yet in generated Supabase types (see getFreshAccessToken).
  const supabaseAdmin = mod.supabaseAdmin as any;
  const windowDays = opts?.windowDays ?? WINDOW_DAYS_DEFAULT;
  const now = new Date();
  const horizon = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000).toISOString();

  const { connected, familyAdults } = await loadResolutionInputs(supabaseAdmin);
  if (connected.length === 0) return { holders: 0, created: 0, updated: 0, deleted: 0 };

  // Gather desired events per holder.
  const desiredByHolder = new Map<string, DesiredEvent[]>();
  const calendarByHolder = new Map<string, string>();
  for (const c of connected) calendarByHolder.set(c.user_id, c.calendar_id);

  // Doses in window (join medication for title/instructions + for_user_id).
  const { data: doses } = await supabaseAdmin
    .from("dose_logs")
    .select("id, scheduled_at, medications(name, dosage, instructions, for_user_id)")
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", horizon);
  for (const d of doses ?? []) {
    const forUser = d.medications?.for_user_id;
    if (!forUser) continue;
    const holder = resolveHolder({ forUserId: forUser, connected, familyAdults });
    if (!holder) continue;
    const ev = buildDoseEvent({
      id: d.id,
      scheduled_at: d.scheduled_at,
      medication: {
        name: d.medications.name,
        dosage: d.medications.dosage ?? null,
        instructions: d.medications.instructions ?? null,
      },
    });
    const list = desiredByHolder.get(holder.user_id) ?? [];
    list.push(ev);
    desiredByHolder.set(holder.user_id, list);
  }

  // Reminders in window (pending/snoozed only).
  const { data: reminders } = await supabaseAdmin
    .from("reminders")
    .select("id, due_at, title, description, category, for_user_id, status")
    .in("status", ["pending", "snoozed"])
    .gte("due_at", now.toISOString())
    .lte("due_at", horizon);
  for (const r of reminders ?? []) {
    const holder = resolveHolder({ forUserId: r.for_user_id, connected, familyAdults });
    if (!holder) continue;
    const ev = buildReminderEvent({
      id: r.id,
      due_at: r.due_at,
      title: r.title,
      description: r.description ?? null,
      category: r.category,
    });
    const list = desiredByHolder.get(holder.user_id) ?? [];
    list.push(ev);
    desiredByHolder.set(holder.user_id, list);
  }

  let created = 0, updated = 0, deleted = 0;

  for (const [holderUserId, desired] of desiredByHolder) {
    // Existing links for this holder.
    const { data: links } = await supabaseAdmin
      .from("calendar_event_links")
      .select("source_type, source_id, google_event_id, synced_hash")
      .eq("holder_user_id", holderUserId);
    const existing: ExistingLink[] = (links ?? []).map((l: any) => ({
      source_type: l.source_type, source_id: l.source_id, synced_hash: l.synced_hash,
    }));
    const eventIdByKey = new Map<string, string>(
      (links ?? []).map((l: any) => [`${l.source_type}:${l.source_id}`, l.google_event_id]),
    );

    const diff = diffEvents(desired, existing);
    if (diff.toCreate.length === 0 && diff.toUpdate.length === 0 && diff.toDeleteKeys.length === 0) continue;

    const token = await getFreshAccessToken(holderUserId);
    if (!token) continue;

    for (const e of diff.toCreate) {
      try {
        const res = await insertEvent({
          accessToken: token.accessToken, calendarId: token.calendarId,
          event: { summary: e.summary, description: e.description, start: e.start, end: e.end },
        });
        await supabaseAdmin.from("calendar_event_links").upsert({
          holder_user_id: holderUserId, source_type: e.source_type, source_id: e.source_id,
          google_event_id: res.id, calendar_id: token.calendarId, synced_hash: e.hash,
        }, { onConflict: "holder_user_id,source_type,source_id" });
        created++;
      } catch (err) { console.error("[calendar-sync] create failed", err); }
    }
    for (const e of diff.toUpdate) {
      const eventId = eventIdByKey.get(`${e.source_type}:${e.source_id}`);
      if (!eventId) continue;
      try {
        await patchEvent({
          accessToken: token.accessToken, calendarId: token.calendarId, eventId,
          event: { summary: e.summary, description: e.description, start: e.start, end: e.end },
        });
        await supabaseAdmin.from("calendar_event_links")
          .update({ synced_hash: e.hash })
          .eq("holder_user_id", holderUserId).eq("source_type", e.source_type).eq("source_id", e.source_id);
        updated++;
      } catch (err) { console.error("[calendar-sync] patch failed", err); }
    }
    for (const k of diff.toDeleteKeys) {
      const eventId = eventIdByKey.get(`${k.source_type}:${k.source_id}`);
      if (!eventId) continue;
      try {
        await deleteEvent({ accessToken: token.accessToken, calendarId: token.calendarId, eventId });
        await supabaseAdmin.from("calendar_event_links")
          .delete()
          .eq("holder_user_id", holderUserId).eq("source_type", k.source_type).eq("source_id", k.source_id);
        deleted++;
      } catch (err) { console.error("[calendar-sync] delete failed", err); }
    }

    await supabaseAdmin.from("google_calendar_credentials")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("user_id", holderUserId);
  }

  return { holders: desiredByHolder.size, created, updated, deleted };
}

// Fire-and-forget wrapper for on-write hooks. Never throws.
export async function syncNow(): Promise<void> {
  try {
    await runCalendarSyncWindow();
  } catch (err) {
    console.error("[calendar-sync] syncNow failed", err);
  }
}
