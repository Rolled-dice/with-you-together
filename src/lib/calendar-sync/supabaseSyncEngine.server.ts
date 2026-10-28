import type {
  CalendarSyncConfig,
  CalendarAction,
  AttendeeDetails,
  SyncableCalendarEvent,
} from "./types";
import { CalendarSyncService, SupabaseCalendarSyncRepository } from "./calendarSyncService";
import { CalendarMailDispatcher, createMailDispatcher } from "./mailDispatcher";

const WINDOW_DAYS_DEFAULT = 7;

/**
 * Loads calendar synchronization configuration from environment variables.
 */
export function getCalendarSyncConfig(): CalendarSyncConfig {
  const host = process.env.SMTP_HOST || "smtp-relay.brevo.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER || process.env.BREVO_API_KEY || "";
  const pass = process.env.SMTP_PASS || process.env.BREVO_API_KEY || "";
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  return {
    smtp: {
      host,
      port,
      secure,
      auth: { user, pass },
      pool: true,
      maxConnections: 5,
    },
    organizer: {
      name: process.env.CALENDAR_ORGANIZER_NAME || "SomeoneNear Care",
      email:
        process.env.CALENDAR_ORGANIZER_EMAIL || process.env.SMTP_USER || "calendar@someonenear.com",
    },
    domain: process.env.CALENDAR_DOMAIN || "someonenear.com",
    debounceMs: parseInt(process.env.CALENDAR_DEBOUNCE_MS || "5000", 10),
    redisUrl: process.env.REDIS_URL || "",
  };
}

let _syncService: CalendarSyncService | null = null;
let _repository: SupabaseCalendarSyncRepository | null = null;
let _mailDispatcher: CalendarMailDispatcher | null = null;

export function getCalendarSyncService(): CalendarSyncService {
  if (!_syncService) {
    const config = getCalendarSyncConfig();
    _repository = new SupabaseCalendarSyncRepository();
    _syncService = new CalendarSyncService(config, _repository);
  }
  return _syncService;
}

export function getMailDispatcher(): CalendarMailDispatcher {
  if (!_mailDispatcher) {
    const config = getCalendarSyncConfig();
    _mailDispatcher = createMailDispatcher(config.smtp, config.organizer);
  }
  return _mailDispatcher;
}

/**
 * Helper to get the untyped Supabase admin client.
 */
async function getSupabaseAdmin() {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

/**
 * Resolves attendee profile information (name, email, timezone) for a user.
 * Also checks if the member is part of a Family Circle with adult/owner guardians.
 */
export async function resolveAttendeeDetails(
  userId: string,
): Promise<{ primary: AttendeeDetails; timezone: string; guardians: AttendeeDetails[] }> {
  const supabaseAdmin = await getSupabaseAdmin();

  // 1. Fetch profile
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("display_name, full_name, timezone")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw profileError;

  // 2. Fetch email from auth
  let email = "";
  try {
    const { data: authData, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error) throw error;
    email = authData?.user?.email ?? "";
  } catch (err) {
    console.warn(`[calendar-sync] Could not load auth email for ${userId}:`, err);
    throw err;
  }

  const name = profile?.display_name || profile?.full_name || "SomeoneNear Member";
  const timezone = profile?.timezone || "Asia/Kolkata";

  // 3. Check for Family Circle guardians (adult/owner)
  const guardians: AttendeeDetails[] = [];
  try {
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("family_members")
      .select("family_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (membershipError) throw membershipError;

    if (membership?.family_id) {
      const { data: familyMembers, error: familyError } = await supabaseAdmin
        .from("family_members")
        .select("user_id, role")
        .eq("family_id", membership.family_id)
        .in("role", ["owner", "adult"]);
      if (familyError) throw familyError;

      for (const m of familyMembers ?? []) {
        if (m.user_id !== userId) {
          const { data: gProfile, error: guardianProfileError } = await supabaseAdmin
            .from("profiles")
            .select("display_name, full_name")
            .eq("id", m.user_id)
            .maybeSingle();
          if (guardianProfileError) throw guardianProfileError;

          const { data: gAuth, error: guardianAuthError } =
            await supabaseAdmin.auth.admin.getUserById(m.user_id);
          if (guardianAuthError) throw guardianAuthError;
          if (gAuth?.user?.email) {
            guardians.push({
              name: gProfile?.display_name || gProfile?.full_name || "Family Guardian",
              email: gAuth.user.email,
              rsvp: true,
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[calendar-sync] Family lookup error for ${userId}:`, err);
    throw err;
  }

  return {
    primary: { name, email, rsvp: true },
    timezone,
    guardians,
  };
}

/**
 * Runs a rolling window synchronization across all active Supabase entities:
 * - Dose logs (medications)
 * - Everyday reminders
 * - Listener bookings
 *
 * Compares current DB state against `syncable_calendar_events`.
 * Automatically increments sequence versions and enqueues RFC 5545 iMIP emails.
 */
export async function runCalendarSyncWindow(opts?: {
  windowDays?: number;
  userId?: string;
  forceSend?: boolean;
}): Promise<{
  processed: number;
  created: number;
  updated: number;
  cancelled: number;
  dispatched: number;
  failed: number;
}> {
  const supabaseAdmin = await getSupabaseAdmin();
  const repository = new SupabaseCalendarSyncRepository();
  const service = new CalendarSyncService(getCalendarSyncConfig(), repository, true);

  const windowDays = opts?.windowDays ?? WINDOW_DAYS_DEFAULT;
  const now = new Date();
  const horizon = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

  let created = 0;
  let updated = 0;
  let cancelled = 0;
  let processed = 0;
  let dispatched = 0;
  let failed = 0;
  const userIds = new Set<string>(opts?.userId ? [opts.userId] : []);

  // -------------------------------------------------------------------------
  // 1. Synchronize Medication Doses from `dose_logs`
  // -------------------------------------------------------------------------
  try {
    let query = supabaseAdmin
      .from("dose_logs")
      .select(
        "id, scheduled_at, status, for_user_id, medications(id, name, dosage, form, instructions, is_active)",
      )
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", horizon.toISOString());
    if (opts?.userId) query = query.eq("for_user_id", opts.userId);
    const { data: doses, error: doseErr } = await query;

    if (doseErr) {
      failed++;
      console.error("[calendar-sync] Error fetching dose_logs:", doseErr);
    } else {
      for (const d of doses ?? []) {
        processed++;
        const forUserId = d.for_user_id;
        if (forUserId) userIds.add(forUserId);
        const med = d.medications;
        if (!forUserId || !med) continue;

        const isCancelled = d.status === "skipped" || med.is_active === false;
        const startTime = new Date(d.scheduled_at);
        const endTime = new Date(startTime.getTime() + 15 * 60 * 1000); // 15 min dose slot
        const dosageStr = med.dosage ? ` (${med.dosage})` : "";
        const title = `\u{1F48A} Take ${med.name}${dosageStr}`;
        const description = med.instructions || `Scheduled dose of ${med.name}`;

        const existing = await repository.findBySource("dose", d.id);

        if (!existing) {
          if (!isCancelled) {
            const { timezone } = await resolveAttendeeDetails(forUserId);
            await service.scheduleItem({
              userId: forUserId,
              itemType: "MEDICATION",
              entityId: `dose_${d.id}`,
              title,
              description,
              location: "Home",
              startTime,
              endTime,
              timezone,
              alarmMinutesBefore: 15,
              sourceType: "dose",
              sourceId: d.id,
            });
            created++;
          }
        } else {
          // Check for modifications
          const timeChanged = existing.startTime.getTime() !== startTime.getTime();
          const titleChanged = existing.title !== title;
          const statusChanged = (existing.status === "CANCELLED") !== isCancelled;

          if (isCancelled && existing.status !== "CANCELLED") {
            await service.cancelItem(existing.id);
            cancelled++;
          } else if (!isCancelled && (timeChanged || titleChanged || statusChanged)) {
            await service.updateItem(existing.id, {
              id: existing.id,
              title,
              description,
              startTime,
              endTime,
            });
            updated++;
          }
          // NOTE: Removed forceSend for individual events — dispatch is now handled
          // by the unified "dispatch undispatched" phase below.
        }
      }
    }
  } catch (err) {
    failed++;
    console.error("[calendar-sync] Medication doses sync failed:", err);
  }

  // -------------------------------------------------------------------------
  // 2. Synchronize Everyday Reminders from `reminders`
  // -------------------------------------------------------------------------
  try {
    let query = supabaseAdmin
      .from("reminders")
      .select("id, title, description, category, due_at, status, recurrence, for_user_id")
      .in("status", ["pending", "snoozed", "done"])
      .gte("due_at", now.toISOString())
      .lte("due_at", horizon.toISOString());
    if (opts?.userId) query = query.eq("for_user_id", opts.userId);
    const { data: reminders, error: remErr } = await query;

    if (remErr) {
      failed++;
      console.error("[calendar-sync] Error fetching reminders:", remErr);
    } else {
      for (const r of reminders ?? []) {
        processed++;
        const forUserId = r.for_user_id;
        if (forUserId) userIds.add(forUserId);
        if (!forUserId) continue;

        const isCancelled = r.status === "done";
        const startTime = new Date(r.due_at);
        const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 min reminder
        const title = r.title;
        const description = r.description || "";

        // Map recurrence to RFC 5545 RRULE
        let rrule: string | null = null;
        if (r.recurrence === "daily") rrule = "FREQ=DAILY";
        else if (r.recurrence === "weekly") rrule = "FREQ=WEEKLY";
        else if (r.recurrence === "monthly") rrule = "FREQ=MONTHLY";
        else if (r.recurrence === "yearly") rrule = "FREQ=YEARLY";

        const existing = await repository.findBySource("reminder", r.id);

        if (!existing) {
          if (!isCancelled) {
            const { timezone } = await resolveAttendeeDetails(forUserId);
            await service.scheduleItem({
              userId: forUserId,
              itemType: "CHECKIN",
              entityId: `rem_${r.id}`,
              title,
              description,
              startTime,
              endTime,
              timezone,
              rrule,
              alarmMinutesBefore: 15,
              sourceType: "reminder",
              sourceId: r.id,
            });
            created++;
          }
        } else {
          const timeChanged = existing.startTime.getTime() !== startTime.getTime();
          const titleChanged = existing.title !== title;
          const rruleChanged = existing.rrule !== rrule;

          if (isCancelled && existing.status !== "CANCELLED") {
            await service.cancelItem(existing.id);
            cancelled++;
          } else if (!isCancelled && (timeChanged || titleChanged || rruleChanged)) {
            await service.updateItem(existing.id, {
              id: existing.id,
              title,
              description,
              startTime,
              endTime,
              rrule,
            });
            updated++;
          }
        }
      }
    }
  } catch (err) {
    failed++;
    console.error("[calendar-sync] Reminders sync failed:", err);
  }

  // -------------------------------------------------------------------------
  // 3. Synchronize Listener Sessions from `listener_bookings`
  // -------------------------------------------------------------------------
  try {
    let query = supabaseAdmin
      .from("listener_bookings")
      .select("id, user_id, requested_at, duration_minutes, note, status, listeners(name)")
      .gte("requested_at", now.toISOString())
      .lte("requested_at", horizon.toISOString());
    if (opts?.userId) query = query.eq("user_id", opts.userId);
    const { data: bookings, error: bookErr } = await query;

    if (bookErr) {
      failed++;
      console.error("[calendar-sync] Error fetching listener_bookings:", bookErr);
    } else {
      for (const b of bookings ?? []) {
        processed++;
        const userId = b.user_id;
        if (userId) userIds.add(userId);
        if (!userId) continue;

        const isCancelled = b.status === "cancelled";
        const startTime = new Date(b.requested_at);
        const duration = b.duration_minutes || 45;
        const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
        const listenerName = b.listeners?.name ? ` with ${b.listeners.name}` : "";
        const title = `\u{1F91D} SomeoneNear Listener Session${listenerName}`;
        const description = b.note
          ? `Your confidential conversation session with SomeoneNear.\nNote: ${b.note}`
          : "Your confidential conversation session with SomeoneNear.";

        const existing = await repository.findBySource("listener_session", b.id);

        if (!existing) {
          if (!isCancelled) {
            const { timezone } = await resolveAttendeeDetails(userId);
            await service.scheduleItem({
              userId,
              itemType: "LISTENER_SESSION",
              entityId: `session_${b.id}`,
              title,
              description,
              location: "SomeoneNear Private Voice Room",
              startTime,
              endTime,
              timezone,
              alarmMinutesBefore: 30,
              sourceType: "listener_session",
              sourceId: b.id,
            });
            created++;
          }
        } else {
          const timeChanged = existing.startTime.getTime() !== startTime.getTime();
          const titleChanged = existing.title !== title;

          if (isCancelled && existing.status !== "CANCELLED") {
            await service.cancelItem(existing.id);
            cancelled++;
          } else if (!isCancelled && (timeChanged || titleChanged)) {
            await service.updateItem(existing.id, {
              id: existing.id,
              title,
              description,
              startTime,
              endTime,
            });
            updated++;
          }
        }
      }
    }
  } catch (err) {
    failed++;
    console.error("[calendar-sync] Listener sessions sync failed:", err);
  }

  // Dispatch once, after reconciliation; pending versions remain retryable on failure.
  for (const userId of userIds) {
    try {
      const pending = await repository.findUndispatchedByUserId(userId);
      if (!pending.length) continue;
      const { primary, guardians } = await resolveAttendeeDetails(userId);
      if (!primary.email) throw new Error("Calendar recipient email unavailable");
      const dispatcher = getMailDispatcher();
      const groups = new Map<string, SyncableCalendarEvent[]>();
      for (const event of pending) {
        const key =
          event.itemType === "MEDICATION"
            ? `${event.status}:${event.startTime.toISOString().slice(0, 16)}`
            : event.id;
        groups.set(key, [...(groups.get(key) ?? []), event]);
      }
      for (const events of groups.values()) {
        try {
          const bundle = events.map((event) => ({
            event,
            action: event.status === "CANCELLED" ? ("CANCEL" as const) : ("CREATE" as const),
          }));
          for (const attendee of [primary, ...guardians]) {
            const result =
              bundle.length === 1
                ? await dispatcher.sendCalendarEvent(bundle[0].event, bundle[0].action, attendee)
                : await dispatcher.sendBundledCalendarEvents(bundle, attendee);
            if (!result.success) throw new Error("Calendar invitation delivery failed");
          }
          for (const event of events) await repository.markDispatched(event.id, event.sequence);
          dispatched++;
        } catch (error) {
          failed++;
          console.error("[calendar-sync] Invitation dispatch failed:", error);
        }
      }
    } catch (error) {
      failed++;
      console.error("[calendar-sync] User dispatch failed:", error);
    }
  }
  try {
    await service.shutdown();
  } catch (error) {
    failed++;
    console.error("[calendar-sync] Queue shutdown failed:", error);
  }
  return { processed, created, updated, cancelled, dispatched, failed };
}

export async function triggerCalendarSyncForUser(userId: string) {
  try {
    const result = await runCalendarSyncWindow({ windowDays: 7, userId });
    return {
      ...result,
      ok: result.failed === 0,
      message: result.failed
        ? "Some calendar updates could not be sent. Please try again shortly."
        : result.dispatched
          ? "Calendar invitations sent. Check your inbox and accept them in your calendar app."
          : "No new calendar invitations to send.",
    };
  } catch (error) {
    console.error("[calendar-sync] Manual sync failed:", error);
    return {
      ok: false,
      message: "Calendar synchronization is temporarily unavailable. Please try again shortly.",
    };
  }
}

/**
 * Fire-and-forget sync helper for on-write hooks. Never throws.
 */
export async function syncNow(): Promise<void> {
  try {
    await runCalendarSyncWindow();
  } catch (err) {
    console.error("[calendar-sync] syncNow failed:", err);
  }
}
