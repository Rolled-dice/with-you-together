import { CalendarSyncJobPayload, CalendarAction, CalendarSyncResult } from "./types";

// Minimal inline BullMQ type definitions to avoid dependency errors if not installed
export interface BullJob<T = unknown> {
  id?: string;
  name: string;
  data: T;
  attemptsMade: number;
}

export interface BullQueue<T = unknown> {
  add(name: string, data: T, opts?: Record<string, unknown>): Promise<BullJob<T>>;
  close(): Promise<void>;
}

export interface BullWorker {
  close(): Promise<void>;
  on(event: "failed", callback: (job: BullJob | undefined, error: Error) => void): void;
}

interface BullModule {
  Queue: new (
    name: string,
    options: { connection: { url: string } },
  ) => BullQueue<CalendarSyncJobPayload>;
  Worker: new (
    name: string,
    processor: (job: BullJob<CalendarSyncJobPayload>) => Promise<CalendarSyncResult>,
    options: { connection: { url: string }; concurrency: number },
  ) => BullWorker;
}

/**
 * CalendarSyncQueue
 * Module 3: Queue & Debounce Worker
 * Provides a debounced, queue-based processor for calendar sync events.
 */
export class CalendarSyncQueue {
  private redisUrl?: string;
  private debounceMs: number;
  private debounceMap: Map<string, { timer: NodeJS.Timeout; events: Map<string, CalendarAction> }> =
    new Map();
  private queue?: BullQueue<CalendarSyncJobPayload>;
  private worker?: BullWorker;
  private fallbackMode: boolean = false;
  private isInitialized: boolean = false;
  private initPromise?: Promise<void>;

  // Per-externalUid (or eventId) lock to ensure strict serial execution
  private locks: Map<string, Promise<void>> = new Map();

  /**
   * Creates a new CalendarSyncQueue
   * @param redisUrl - Optional Redis URL for BullMQ. If not provided or inaccessible, runs in fallback mode.
   * @param debounceMs - Delay in milliseconds to debounce events per user (default: 5000)
   */
  constructor(redisUrl?: string, debounceMs: number = 5000) {
    this.redisUrl = redisUrl;
    this.debounceMs = debounceMs;
  }

  /**
   * Attempts to dynamically import BullMQ
   */
  private async getBullMQ() {
    try {
      // Use variable indirection to prevent Vite's static import analysis from
      // failing at build time when bullmq is not installed.
      const moduleName = "bull" + "mq";
      const bullmq: BullModule = await import(/* @vite-ignore */ moduleName);
      return bullmq;
    } catch (e) {
      return null;
    }
  }

  /**
   * Lazily initializes BullMQ Queue and Worker on first use
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const bullmq = await this.getBullMQ();

      if (!bullmq || !this.redisUrl) {
        console.warn(
          `[calendar-sync-queue] BullMQ or redisUrl not available. Running in fallback mode (synchronous processing).`,
        );
        this.fallbackMode = true;
        this.isInitialized = true;
        return;
      }

      try {
        const connection = { url: this.redisUrl };

        this.queue = new bullmq.Queue("calendar-sync", { connection });

        this.worker = new bullmq.Worker(
          "calendar-sync",
          async (job: BullJob<CalendarSyncJobPayload>) => {
            const result = await this.processJob(job);
            if (!result.success) throw new Error(result.error ?? "Calendar delivery failed");
            return result;
          },
          { connection, concurrency: 5 },
        );

        this.worker?.on("failed", (job: BullJob | undefined, err: Error) => {
          console.error(`[calendar-sync-queue] Job ${job?.id} failed:`, err);
        });

        this.fallbackMode = false;
        console.log(`[calendar-sync-queue] BullMQ initialized successfully.`);
      } catch (err) {
        console.warn(
          `[calendar-sync-queue] Error initializing BullMQ, falling back to sync mode:`,
          err,
        );
        this.fallbackMode = true;
      }

      this.isInitialized = true;
    })();

    return this.initPromise;
  }

  /**
   * Enqueues a sync job with debouncing per user.
   * @param userId - The user ID
   * @param eventId - The event ID
   * @param action - The calendar action (e.g., CREATE, UPDATE, DELETE)
   */
  public async enqueueSyncJob(
    userId: string,
    eventId: string,
    action: CalendarAction,
  ): Promise<void> {
    await this.initialize();

    let userDebounce = this.debounceMap.get(userId);

    if (userDebounce) {
      clearTimeout(userDebounce.timer);
    } else {
      userDebounce = {
        timer: setTimeout(() => {}, 0),
        events: new Map(),
      };
      this.debounceMap.set(userId, userDebounce);
    }

    // Deduplication: keep the latest action for the eventId
    userDebounce.events.set(eventId, action);

    // In fallback mode (e.g. serverless Cloudflare Workers where background setTimeout is frozen after request return),
    // process immediately.
    if (this.fallbackMode || this.debounceMs <= 0) {
      await this.flushUser(userId);
      return;
    }

    userDebounce.timer = setTimeout(() => {
      this.flushUser(userId).catch((err) => {
        console.error(`[calendar-sync-queue] Error flushing user ${userId}:`, err);
      });
    }, this.debounceMs);
  }

  /**
   * Immediately flushes any pending debounced events for a user
   * @param userId - The user ID
   */
  public async flushUser(userId: string): Promise<void> {
    await this.initialize();

    const userDebounce = this.debounceMap.get(userId);
    if (!userDebounce) return;

    clearTimeout(userDebounce.timer);
    this.debounceMap.delete(userId);

    const eventsToProcess = Array.from(userDebounce.events.entries()).map(([eventId, action]) => ({
      eventId,
      action,
    }));

    if (eventsToProcess.length === 0) return;

    const payload: CalendarSyncJobPayload = {
      userId,
      events: eventsToProcess,
      enqueuedAt: Date.now(),
    };

    if (this.fallbackMode) {
      console.log(`[calendar-sync-queue] Processing job synchronously for user ${userId}`);
      // In fallback mode, bypass BullMQ and process the job inline
      const result = await this.processJob({ data: payload });
      if (!result.success) throw new Error(result.error ?? "Calendar delivery failed");
    } else if (this.queue) {
      console.log(`[calendar-sync-queue] Enqueueing job to BullMQ for user ${userId}`);
      await this.queue.add("sync", payload, {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: true,
      });
    }
  }

  /**
   * Acquires a mutex lock for a specific event ID to ensure strict serial execution
   */
  private async acquireLock(eventId: string): Promise<() => void> {
    const existingLock = this.locks.get(eventId);
    let releaseLock: () => void = () => {};

    const newLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    if (existingLock) {
      const waitPromise = existingLock.then(() => newLock);
      this.locks.set(eventId, waitPromise);
      await existingLock;
    } else {
      this.locks.set(eventId, newLock);
    }

    return () => {
      const current = this.locks.get(eventId);
      if (current === newLock) {
        this.locks.delete(eventId);
      }
      releaseLock();
    };
  }

  /**
   * Internal processor for the synced jobs, invoked by BullMQ Worker or fallback runner.
   */
  private async processJob(job: { data: CalendarSyncJobPayload }): Promise<CalendarSyncResult> {
    console.log(
      `[calendar-sync-queue] Processing job for user ${job.data.userId} with ${job.data.events.length} events`,
    );

    let eventsProcessed = 0;
    let messageId: string | null = null;
    const errors: string[] = [];

    const { resolveAttendeeDetails, getMailDispatcher } =
      await import("./supabaseSyncEngine.server");
    const { SupabaseCalendarSyncRepository } = await import("./calendarSyncService");
    const { primary: attendee, guardians } = await resolveAttendeeDetails(job.data.userId);
    if (!attendee.email) throw new Error("Calendar recipient email unavailable");
    const repository = new SupabaseCalendarSyncRepository();
    const dispatcher = getMailDispatcher();

    for (const item of job.data.events) {
      // Use a per-externalUid (eventId) lock to ensure strict serial execution
      const release = await this.acquireLock(item.eventId);

      try {
        let attempt = 0;
        const maxAttempts = 3;
        let success = false;

        while (attempt < maxAttempts && !success) {
          attempt++;
          try {
            const syncEvent =
              (await repository.findById(item.eventId)) ??
              (await repository.findByExternalUid(item.eventId));
            if (!syncEvent) throw new Error("Calendar event not found");
            for (const recipient of [attendee, ...guardians]) {
              const result = await dispatcher.sendCalendarEvent(syncEvent, item.action, recipient);
              if (!result.success) throw new Error("Calendar invitation delivery failed");
              if (result.messageId) messageId = result.messageId;
            }
            await repository.markDispatched(syncEvent.id, syncEvent.sequence);
            success = true;
            eventsProcessed++;
          } catch (err) {
            console.error(
              `[calendar-sync-queue] Attempt ${attempt} failed for event ${item.eventId}:`,
              err,
            );
            if (attempt >= maxAttempts) {
              errors.push(
                `Error processing event ${item.eventId} after ${maxAttempts} attempts: ${err instanceof Error ? err.message : "Delivery failed"}`,
              );
            } else {
              // Exponential backoff
              await new Promise((res) => setTimeout(res, 1000 * Math.pow(2, attempt - 1)));
            }
          }
        }
      } finally {
        release();
      }
    }

    return {
      success: errors.length === 0,
      messageId,
      error: errors.length > 0 ? errors.join("; ") : null,
      eventsProcessed,
    };
  }

  /**
   * Flushes all pending debounce timers and closes queues/workers for graceful shutdown
   */
  public async shutdown(): Promise<void> {
    console.log(`[calendar-sync-queue] Shutting down...`);

    // Flush all pending debounce timers immediately
    const pendingUsers = Array.from(this.debounceMap.keys());
    await Promise.all(pendingUsers.map((userId) => this.flushUser(userId)));

    if (this.worker) {
      await this.worker.close();
    }

    if (this.queue) {
      await this.queue.close();
    }

    console.log(`[calendar-sync-queue] Shutdown complete.`);
  }
}

/**
 * Factory function to create a new CalendarSyncQueue instance
 */
export function createCalendarSyncQueue(redisUrl?: string, debounceMs?: number): CalendarSyncQueue {
  return new CalendarSyncQueue(redisUrl, debounceMs);
}
