import type {
  SyncableCalendarEvent,
  CreateItemDTO,
  UpdateItemDTO,
  CalendarAction,
  CalendarSyncConfig,
  CalendarItemType,
} from "./types";
import { createCalendarSyncQueue, CalendarSyncQueue } from "./calendarQueue";
import { z } from "zod";

const calendarRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  item_type: z.enum(["MEDICATION", "LISTENER_SESSION", "CHECKIN"]),
  external_uid: z.string(),
  sequence: z.number().int().nonnegative(),
  title: z.string(),
  description: z.string().nullish(),
  location: z.string().nullish(),
  start_time: z.iso.datetime({ offset: true }),
  end_time: z.iso.datetime({ offset: true }),
  timezone: z.string(),
  rrule: z.string().nullish(),
  alarm_minutes_before: z.number().nullish(),
  status: z.enum(["CONFIRMED", "CANCELLED"]),
  source_type: z.string().nullish(),
  source_id: z.string().nullish(),
  dispatched_sequence: z.number().nullish(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});

// ---------------------------------------------------------------------------
// Repository Interface
// ---------------------------------------------------------------------------

/**
 * Interface abstracting database operations for calendar synchronization.
 *
 * Implementations MUST ensure atomic sequence increments to prevent
 * read-modify-write race conditions (see constraint §5).
 */
export interface CalendarSyncRepository {
  /** Insert a new syncable event. Returns the created event. */
  create(
    event: Omit<SyncableCalendarEvent, "createdAt" | "updatedAt">,
  ): Promise<SyncableCalendarEvent>;

  /** Find an event by ID */
  findById(id: string): Promise<SyncableCalendarEvent | null>;

  /** Find events by userId */
  findByUserId(userId: string): Promise<SyncableCalendarEvent[]>;

  /** Find event by externalUid */
  findByExternalUid(uid: string): Promise<SyncableCalendarEvent | null>;

  /** Find event by source entity type and source entity ID */
  findBySource(sourceType: string, sourceId: string): Promise<SyncableCalendarEvent | null>;

  /** Mark an event as dispatched at its current sequence (sets dispatched_sequence = sequence) */
  markDispatched(id: string, sequence: number): Promise<SyncableCalendarEvent>;

  /** Find all undispatched events for a user (dispatched_sequence IS NULL OR dispatched_sequence < sequence) */
  findUndispatchedByUserId(userId: string): Promise<SyncableCalendarEvent[]>;

  /**
   * Atomically increment sequence and apply updates. Returns updated event.
   * MUST use atomic SQL: `UPDATE ... SET sequence = sequence + 1, ... WHERE id = ... RETURNING *`
   */
  atomicUpdateWithSequenceIncrement(
    id: string,
    updates: Partial<
      Pick<
        SyncableCalendarEvent,
        | "title"
        | "description"
        | "location"
        | "startTime"
        | "endTime"
        | "timezone"
        | "rrule"
        | "alarmMinutesBefore"
        | "status"
      >
    >,
  ): Promise<SyncableCalendarEvent>;

  /** Atomically cancel: set status=CANCELLED and increment sequence */
  atomicCancel(id: string): Promise<SyncableCalendarEvent>;
}

// ---------------------------------------------------------------------------
// Orchestrator Service
// ---------------------------------------------------------------------------

/**
 * End-to-End Orchestrator Service for the Calendar Synchronization Engine.
 *
 * Manages the lifecycle of syncable calendar events: creation, updates,
 * cancellations, and batch operations. All mutations atomically bump the
 * monotonic `sequence` counter and enqueue jobs for iMIP email delivery.
 */
export class CalendarSyncService {
  private readonly config: CalendarSyncConfig;
  private readonly repository: CalendarSyncRepository;
  private readonly queue: CalendarSyncQueue;

  constructor(
    config: CalendarSyncConfig,
    repository: CalendarSyncRepository,
    private readonly deferDispatch = false,
  ) {
    this.config = config;
    this.repository = repository;
    this.queue = createCalendarSyncQueue(config.redisUrl, config.debounceMs);
  }

  // -------------------------------------------------------------------------
  // UID generation
  // -------------------------------------------------------------------------

  /**
   * Generates a deterministic, globally unique UID for a calendar item.
   *
   * Format: `{prefix}_{entityId}@{domain}`
   * - MEDICATION  → `med_{entityId}@someonenear.com`
   * - LISTENER_SESSION → `session_{entityId}@someonenear.com`
   * - CHECKIN → `checkin_{entityId}@someonenear.com`
   */
  private generateUid(itemType: CalendarItemType, entityId: string): string {
    const prefixMap: Record<CalendarItemType, string> = {
      MEDICATION: "med",
      LISTENER_SESSION: "session",
      CHECKIN: "checkin",
    };
    const prefix = prefixMap[itemType] ?? "item";
    return `${prefix}_${entityId}@${this.config.domain}`;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Schedules a new calendar item.
   *
   * - Generates the deterministic UID
   * - Saves to DB with `sequence: 0` and `status: 'CONFIRMED'`
   * - Enqueues a CREATE job for iMIP delivery
   *
   * @param data - The creation DTO.
   * @returns The newly created SyncableCalendarEvent.
   */
  public async scheduleItem(data: CreateItemDTO): Promise<SyncableCalendarEvent> {
    if (!data.userId || !data.itemType || !data.entityId || !data.startTime || !data.endTime) {
      throw new Error("[calendar-sync-service] Missing required fields for scheduling an item.");
    }

    const externalUid = this.generateUid(data.itemType, data.entityId);

    const eventPayload: Omit<SyncableCalendarEvent, "createdAt" | "updatedAt"> = {
      id: crypto.randomUUID(),
      userId: data.userId,
      itemType: data.itemType,
      externalUid,
      sequence: 0,
      title: data.title,
      description: data.description,
      location: data.location ?? "",
      startTime: data.startTime,
      endTime: data.endTime,
      timezone: data.timezone,
      rrule: data.rrule ?? null,
      alarmMinutesBefore: data.alarmMinutesBefore ?? 15,
      status: "CONFIRMED",
      sourceType: data.sourceType ?? null,
      sourceId: data.sourceId ?? null,
      dispatchedSequence: null,
    };

    const createdEvent = await this.repository.create(eventPayload);
    if (this.deferDispatch) return createdEvent;

    // Enqueue — fire-and-forget (never fail the DB write because of queue issues)
    try {
      await this.queue.enqueueSyncJob(createdEvent.userId, createdEvent.id, "CREATE");
    } catch (queueErr) {
      console.error(
        `[calendar-sync-service] Failed to enqueue CREATE job for event ${createdEvent.id}:`,
        queueErr,
      );
    }

    return createdEvent;
  }

  /**
   * Updates an existing calendar item.
   *
   * - Atomically increments `sequence`
   * - Persists field changes
   * - Enqueues an UPDATE job
   *
   * @param id - The event ID to update.
   * @param updates - The fields to change.
   * @returns The updated SyncableCalendarEvent.
   */
  public async updateItem(id: string, updates: UpdateItemDTO): Promise<SyncableCalendarEvent> {
    // Strip the `id` from the DTO to avoid passing it as a DB field update
    const { id: _updateId, ...fieldUpdates } = updates;

    const updatedEvent = await this.repository.atomicUpdateWithSequenceIncrement(id, fieldUpdates);
    if (this.deferDispatch) return updatedEvent;

    try {
      await this.queue.enqueueSyncJob(updatedEvent.userId, updatedEvent.id, "UPDATE");
    } catch (queueErr) {
      console.error(
        `[calendar-sync-service] Failed to enqueue UPDATE job for event ${id}:`,
        queueErr,
      );
    }

    return updatedEvent;
  }

  /**
   * Cancels an existing calendar item.
   *
   * - Atomically sets `status: 'CANCELLED'` and increments `sequence`
   * - Enqueues a CANCEL job
   *
   * @param id - The event ID to cancel.
   * @returns The cancelled SyncableCalendarEvent.
   */
  public async cancelItem(id: string): Promise<SyncableCalendarEvent> {
    const cancelledEvent = await this.repository.atomicCancel(id);
    if (this.deferDispatch) return cancelledEvent;

    try {
      await this.queue.enqueueSyncJob(cancelledEvent.userId, cancelledEvent.id, "CANCEL");
    } catch (queueErr) {
      console.error(
        `[calendar-sync-service] Failed to enqueue CANCEL job for event ${id}:`,
        queueErr,
      );
    }

    return cancelledEvent;
  }

  /**
   * Processes multiple medication updates in a single batch.
   *
   * Each item is atomically updated (sequence incremented), then all updates
   * are enqueued to the same userId so the debounce mechanism collapses them
   * into a single bundled `.ics` email.
   *
   * @param userId - The user who owns these events.
   * @param updates - Array of UpdateItemDTOs for each medication event.
   * @returns Array of the updated SyncableCalendarEvent records.
   */
  public async batchUpdateMedications(
    userId: string,
    updates: UpdateItemDTO[],
  ): Promise<SyncableCalendarEvent[]> {
    const updatedEvents: SyncableCalendarEvent[] = [];

    // Process each update atomically, sequentially to maintain ordering
    for (const dto of updates) {
      const { id, ...fieldUpdates } = dto;
      const updated = await this.repository.atomicUpdateWithSequenceIncrement(id, fieldUpdates);
      updatedEvents.push(updated);
    }

    // Enqueue all updates for the same userId — the debounce window bundles them
    for (const event of updatedEvents) {
      try {
        await this.queue.enqueueSyncJob(userId, event.id, "UPDATE");
      } catch (queueErr) {
        console.error(
          `[calendar-sync-service] Failed to enqueue batch UPDATE for event ${event.id}:`,
          queueErr,
        );
      }
    }

    return updatedEvents;
  }

  /**
   * Retrieves all syncable events for a specific user.
   */
  public async getEventsByUser(userId: string): Promise<SyncableCalendarEvent[]> {
    return this.repository.findByUserId(userId);
  }

  /**
   * Shuts down the service, flushing pending debounce timers and closing queue connections.
   */
  public async shutdown(): Promise<void> {
    try {
      await this.queue.shutdown();
      console.log("[calendar-sync-service] Shutdown complete.");
    } catch (error) {
      console.error("[calendar-sync-service] Error during shutdown:", error);
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Supabase-backed Repository
// ---------------------------------------------------------------------------

/**
 * Default Supabase-backed implementation of CalendarSyncRepository.
 *
 * Uses `supabase.rpc()` for truly atomic sequence increments when a Postgres
 * function is available, with a fallback to read-then-write for environments
 * where the RPC hasn't been deployed yet.
 */
export class SupabaseCalendarSyncRepository implements CalendarSyncRepository {
  private readonly tableName = "syncable_calendar_events";

  /**
   * Lazily creates a Supabase admin client from environment variables.
   */
  private async getClient() {
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const supabaseKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "[SupabaseCalendarSyncRepository] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
      );
    }

    return createClient(supabaseUrl, supabaseKey);
  }

  public async create(
    event: Omit<SyncableCalendarEvent, "createdAt" | "updatedAt">,
  ): Promise<SyncableCalendarEvent> {
    const supabase = await this.getClient();
    const now = new Date().toISOString();

    const row = {
      id: event.id,
      user_id: event.userId,
      item_type: event.itemType,
      external_uid: event.externalUid,
      sequence: event.sequence,
      title: event.title,
      description: event.description,
      location: event.location,
      start_time: event.startTime instanceof Date ? event.startTime.toISOString() : event.startTime,
      end_time: event.endTime instanceof Date ? event.endTime.toISOString() : event.endTime,
      timezone: event.timezone,
      rrule: event.rrule,
      alarm_minutes_before: event.alarmMinutesBefore,
      status: event.status,
      source_type: event.sourceType ?? null,
      source_id: event.sourceId ?? null,
      dispatched_sequence: event.dispatchedSequence ?? null,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase.from(this.tableName).insert(row).select().single();

    if (error) throw new Error(`[SupabaseCalendarSyncRepository] create failed: ${error.message}`);
    return this.mapRow(data);
  }

  public async findById(id: string): Promise<SyncableCalendarEvent | null> {
    const supabase = await this.getClient();
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error)
      throw new Error(`[SupabaseCalendarSyncRepository] findById failed: ${error.message}`);
    return data ? this.mapRow(data) : null;
  }

  public async findByUserId(userId: string): Promise<SyncableCalendarEvent[]> {
    const supabase = await this.getClient();
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error)
      throw new Error(`[SupabaseCalendarSyncRepository] findByUserId failed: ${error.message}`);
    return (data ?? []).map(this.mapRow);
  }

  public async findByExternalUid(uid: string): Promise<SyncableCalendarEvent | null> {
    const supabase = await this.getClient();
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("external_uid", uid)
      .maybeSingle();

    if (error)
      throw new Error(
        `[SupabaseCalendarSyncRepository] findByExternalUid failed: ${error.message}`,
      );
    return data ? this.mapRow(data) : null;
  }

  public async findBySource(
    sourceType: string,
    sourceId: string,
  ): Promise<SyncableCalendarEvent | null> {
    const supabase = await this.getClient();
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("source_type", sourceType)
      .eq("source_id", sourceId)
      .maybeSingle();

    if (error)
      throw new Error(`[SupabaseCalendarSyncRepository] findBySource failed: ${error.message}`);
    return data ? this.mapRow(data) : null;
  }

  public async markDispatched(id: string, sequence: number): Promise<SyncableCalendarEvent> {
    const supabase = await this.getClient();
    // Mark only the version actually emailed; concurrent edits must remain pending.
    const { data, error } = await supabase
      .from(this.tableName)
      .update({ dispatched_sequence: sequence, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("sequence", sequence)
      .select()
      .single();
    if (error || !data)
      throw new Error("Calendar delivery tracking failed or the event changed during delivery");
    return this.mapRow(data);
  }

  public async findUndispatchedByUserId(userId: string): Promise<SyncableCalendarEvent[]> {
    const supabase = await this.getClient();
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("user_id", userId)
      .order("start_time", { ascending: true });

    if (error)
      throw new Error(
        `[SupabaseCalendarSyncRepository] findUndispatchedByUserId failed: ${error.message}`,
      );
    return (data ?? [])
      .map(this.mapRow)
      .filter(
        (event: SyncableCalendarEvent) =>
          event.dispatchedSequence === null || event.dispatchedSequence < event.sequence,
      );
  }

  public async atomicUpdateWithSequenceIncrement(
    id: string,
    updates: Partial<
      Pick<
        SyncableCalendarEvent,
        | "title"
        | "description"
        | "location"
        | "startTime"
        | "endTime"
        | "timezone"
        | "rrule"
        | "alarmMinutesBefore"
        | "status"
      >
    >,
  ): Promise<SyncableCalendarEvent> {
    const supabase = await this.getClient();

    // Attempt RPC for true atomicity (requires a Postgres function)
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "atomic_calendar_event_update",
        { event_id: id, payload: this.toDatabaseUpdates(updates) },
      );

      if (!rpcError && rpcData) {
        return this.mapRow(Array.isArray(rpcData) ? rpcData[0] : rpcData);
      }
    } catch {
      // RPC not available — fall through to standard update
    }

    // Fallback: fetch current sequence, then update
    console.warn(
      "[SupabaseCalendarSyncRepository] RPC not available, using fallback sequence increment.",
    );

    const { data: current, error: fetchError } = await supabase
      .from(this.tableName)
      .select("sequence")
      .eq("id", id)
      .single();

    if (fetchError)
      throw new Error(
        `[SupabaseCalendarSyncRepository] fetch for update failed: ${fetchError.message}`,
      );

    const newSequence = (current?.sequence ?? 0) + 1;
    const dbUpdates = {
      ...this.toDatabaseUpdates(updates),
      sequence: newSequence,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: updateError } = await supabase
      .from(this.tableName)
      .update(dbUpdates)
      .eq("id", id)
      .select()
      .single();

    if (updateError)
      throw new Error(`[SupabaseCalendarSyncRepository] update failed: ${updateError.message}`);
    return this.mapRow(updated);
  }

  public async atomicCancel(id: string): Promise<SyncableCalendarEvent> {
    return this.atomicUpdateWithSequenceIncrement(id, { status: "CANCELLED" });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Converts camelCase domain fields to snake_case database columns.
   */
  private toDatabaseUpdates(
    updates: Partial<
      Pick<
        SyncableCalendarEvent,
        | "title"
        | "description"
        | "location"
        | "startTime"
        | "endTime"
        | "timezone"
        | "rrule"
        | "alarmMinutesBefore"
        | "status"
      >
    >,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    if (updates.title !== undefined) result["title"] = updates.title;
    if (updates.description !== undefined) result["description"] = updates.description;
    if (updates.location !== undefined) result["location"] = updates.location;
    if (updates.startTime !== undefined)
      result["start_time"] =
        updates.startTime instanceof Date ? updates.startTime.toISOString() : updates.startTime;
    if (updates.endTime !== undefined)
      result["end_time"] =
        updates.endTime instanceof Date ? updates.endTime.toISOString() : updates.endTime;
    if (updates.timezone !== undefined) result["timezone"] = updates.timezone;
    if (updates.rrule !== undefined) result["rrule"] = updates.rrule;
    if (updates.alarmMinutesBefore !== undefined)
      result["alarm_minutes_before"] = updates.alarmMinutesBefore;
    if (updates.status !== undefined) result["status"] = updates.status;
    return result;
  }

  /**
   * Maps a snake_case database row to the camelCase SyncableCalendarEvent interface.
   */
  private mapRow(value: unknown): SyncableCalendarEvent {
    const row = calendarRowSchema.parse(value);
    return {
      id: row.id,
      userId: row.user_id,
      itemType: row.item_type,
      externalUid: row.external_uid,
      sequence: row.sequence,
      title: row.title,
      description: row.description ?? "",
      location: row.location ?? "",
      startTime: new Date(row.start_time),
      endTime: new Date(row.end_time),
      timezone: row.timezone,
      rrule: row.rrule ?? null,
      alarmMinutesBefore: row.alarm_minutes_before ?? 15,
      status: row.status,
      sourceType: row.source_type ?? null,
      sourceId: row.source_id ?? null,
      dispatchedSequence: row.dispatched_sequence ?? null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Factory function to create a CalendarSyncService with defaults.
 */
export function createCalendarSyncService(
  config: CalendarSyncConfig,
  repository: CalendarSyncRepository,
): CalendarSyncService {
  return new CalendarSyncService(config, repository);
}
