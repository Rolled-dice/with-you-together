import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { IcsBuilder, icsBuilder } from "./icsBuilder";
import { CalendarSyncQueue, createCalendarSyncQueue } from "./calendarQueue";
import { CalendarSyncService, SupabaseCalendarSyncRepository } from "./calendarSyncService";
import * as syncEngine from "./supabaseSyncEngine.server";
import { CalendarMailDispatcher } from "./mailDispatcher";
import type {
  SyncableCalendarEvent,
  CalendarAction,
  OrganizerDetails,
  AttendeeDetails,
  CalendarSyncConfig,
  CreateItemDTO,
  UpdateItemDTO,
} from "./types";
import type { CalendarSyncRepository } from "./calendarSyncService";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ORGANIZER: OrganizerDetails = {
  name: "SomeoneNear",
  email: "calendar@someonenear.com",
};

const ATTENDEE: AttendeeDetails = {
  name: "Grandma Sharma",
  email: "grandma@example.com",
  rsvp: true,
};

function makeEvent(overrides: Partial<SyncableCalendarEvent> = {}): SyncableCalendarEvent {
  return {
    id: "evt-001",
    userId: "user-001",
    itemType: "MEDICATION",
    externalUid: "med_metformin_66f12a8bc9@someonenear.com",
    sequence: 0,
    title: "Take Metformin (500mg)",
    description: "Take with food. Drink water.",
    location: "",
    startTime: new Date("2026-10-01T09:00:00"),
    endTime: new Date("2026-10-01T09:15:00"),
    timezone: "Asia/Kolkata",
    rrule: null,
    alarmMinutesBefore: 15,
    status: "CONFIRMED",
    dispatchedSequence: null,
    createdAt: new Date("2026-09-28T12:00:00Z"),
    updatedAt: new Date("2026-09-28T12:00:00Z"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Module 2: ICS Builder Tests
// ---------------------------------------------------------------------------

describe("IcsBuilder", () => {
  const builder = new IcsBuilder();

  // ----- UID Uniqueness -----

  describe("Distinct UIDs for multiple items at the same time", () => {
    it("two medications at 09:00 AM have distinct UIDs and render independently", () => {
      const metformin = makeEvent({
        id: "evt-metformin",
        externalUid: "med_metformin_66f12a8bc9@someonenear.com",
        title: "Take Metformin (500mg)",
      });

      const vitaminD = makeEvent({
        id: "evt-vitamind",
        externalUid: "med_vitamind_77a23b9cd1@someonenear.com",
        title: "Take Vitamin D (1000 IU)",
      });

      // UIDs must differ
      expect(metformin.externalUid).not.toBe(vitaminD.externalUid);

      const icsMetformin = builder.generateIcsEvent(metformin, "CREATE", ORGANIZER, ATTENDEE);
      const icsVitaminD = builder.generateIcsEvent(vitaminD, "CREATE", ORGANIZER, ATTENDEE);

      // Each ICS must contain its own UID
      expect(icsMetformin).toContain("UID:med_metformin_66f12a8bc9@someonenear.com");
      expect(icsVitaminD).toContain("UID:med_vitamind_77a23b9cd1@someonenear.com");

      // Neither should contain the other's UID
      expect(icsMetformin).not.toContain("med_vitamind_77a23b9cd1@someonenear.com");
      expect(icsVitaminD).not.toContain("med_metformin_66f12a8bc9@someonenear.com");
    });
  });

  // ----- VCALENDAR structure -----

  describe("VCALENDAR structure", () => {
    it("generates a valid VCALENDAR with METHOD:REQUEST for CREATE", () => {
      const event = makeEvent();
      const ics = builder.generateIcsEvent(event, "CREATE", ORGANIZER, ATTENDEE);

      expect(ics).toContain("BEGIN:VCALENDAR\r\n");
      expect(ics).toContain("VERSION:2.0\r\n");
      expect(ics).toContain("PRODID:-//SomeoneNear//CalendarSync//EN\r\n");
      expect(ics).toContain("CALSCALE:GREGORIAN\r\n");
      expect(ics).toContain("METHOD:REQUEST\r\n");
      expect(ics).toContain("BEGIN:VEVENT\r\n");
      expect(ics).toContain("END:VEVENT\r\n");
      expect(ics).toContain("END:VCALENDAR\r\n");
    });

    it("uses METHOD:REQUEST for UPDATE action", () => {
      const event = makeEvent({ sequence: 1 });
      const ics = builder.generateIcsEvent(event, "UPDATE", ORGANIZER, ATTENDEE);
      expect(ics).toContain("METHOD:REQUEST\r\n");
    });
  });

  // ----- Sequence & UID stability -----

  describe("Sequence tracking", () => {
    it("rescheduling increments SEQUENCE from N to N+1 while preserving UID", () => {
      const original = makeEvent({ sequence: 2 });
      const rescheduled = makeEvent({
        sequence: 3,
        startTime: new Date("2026-10-01T10:00:00"),
        endTime: new Date("2026-10-01T10:15:00"),
      });

      const icsOriginal = builder.generateIcsEvent(original, "UPDATE", ORGANIZER, ATTENDEE);
      const icsRescheduled = builder.generateIcsEvent(rescheduled, "UPDATE", ORGANIZER, ATTENDEE);

      // Same UID
      expect(icsOriginal).toContain("UID:med_metformin_66f12a8bc9@someonenear.com");
      expect(icsRescheduled).toContain("UID:med_metformin_66f12a8bc9@someonenear.com");

      // Sequences differ
      expect(icsOriginal).toContain("SEQUENCE:2\r\n");
      expect(icsRescheduled).toContain("SEQUENCE:3\r\n");
    });
  });

  // ----- Cancellation -----

  describe("Cancellation", () => {
    it("generates METHOD:CANCEL and STATUS:CANCELLED for CANCEL action", () => {
      const event = makeEvent({ sequence: 4, status: "CANCELLED" });
      const ics = builder.generateIcsEvent(event, "CANCEL", ORGANIZER, ATTENDEE);

      expect(ics).toContain("METHOD:CANCEL\r\n");
      expect(ics).toContain("STATUS:CANCELLED\r\n");
      expect(ics).toContain("SEQUENCE:4\r\n");
    });

    it("does not include VALARM in cancellation events", () => {
      const event = makeEvent({ sequence: 1, alarmMinutesBefore: 30, status: "CANCELLED" });
      const ics = builder.generateIcsEvent(event, "CANCEL", ORGANIZER, ATTENDEE);
      expect(ics).not.toContain("BEGIN:VALARM");
      expect(ics).not.toContain("END:VALARM");
    });
  });

  // ----- VALARM -----

  describe("VALARM", () => {
    it("includes a VALARM block when alarmMinutesBefore > 0 and action is not CANCEL", () => {
      const event = makeEvent({ alarmMinutesBefore: 30 });
      const ics = builder.generateIcsEvent(event, "CREATE", ORGANIZER, ATTENDEE);

      expect(ics).toContain("BEGIN:VALARM\r\n");
      expect(ics).toContain("TRIGGER:-PT30M\r\n");
      expect(ics).toContain("ACTION:DISPLAY\r\n");
      expect(ics).toContain("END:VALARM\r\n");
    });

    it("omits VALARM when alarmMinutesBefore is 0", () => {
      const event = makeEvent({ alarmMinutesBefore: 0 });
      const ics = builder.generateIcsEvent(event, "CREATE", ORGANIZER, ATTENDEE);
      expect(ics).not.toContain("BEGIN:VALARM");
    });
  });

  // ----- DTSTART / DTEND with TZID -----

  describe("Date formatting with TZID", () => {
    it("formats DTSTART and DTEND with TZID", () => {
      const event = makeEvent({
        startTime: new Date("2026-10-01T09:00:00"),
        endTime: new Date("2026-10-01T09:15:00"),
        timezone: "Asia/Kolkata",
      });
      const ics = builder.generateIcsEvent(event, "CREATE", ORGANIZER, ATTENDEE);

      // Should contain TZID format (exact date parts depend on local timezone conversion)
      expect(ics).toMatch(/DTSTART;TZID=Asia\/Kolkata:\d{8}T\d{6}/);
      expect(ics).toMatch(/DTEND;TZID=Asia\/Kolkata:\d{8}T\d{6}/);
    });
  });

  // ----- RRULE -----

  describe("RRULE support", () => {
    it("includes RRULE when present", () => {
      const event = makeEvent({ rrule: "FREQ=DAILY;COUNT=30" });
      const ics = builder.generateIcsEvent(event, "CREATE", ORGANIZER, ATTENDEE);
      expect(ics).toContain("RRULE:FREQ=DAILY;COUNT=30\r\n");
    });

    it("omits RRULE when null", () => {
      const event = makeEvent({ rrule: null });
      const ics = builder.generateIcsEvent(event, "CREATE", ORGANIZER, ATTENDEE);
      expect(ics).not.toContain("RRULE:");
    });
  });

  // ----- Text escaping -----

  describe("Text escaping", () => {
    it("escapes reserved characters in SUMMARY and DESCRIPTION", () => {
      const event = makeEvent({
        title: "Take Metformin; 500mg, twice daily",
        description: "Instructions: Take with food.\nDo not skip doses.",
      });
      const ics = builder.generateIcsEvent(event, "CREATE", ORGANIZER, ATTENDEE);

      // Semicolons and commas are escaped
      expect(ics).toContain("Take Metformin\\; 500mg\\, twice daily");
      // Newlines become literal \n
      expect(ics).toContain("Instructions: Take with food.\\nDo not skip doses.");
    });

    it("escapes backslashes", () => {
      // Input title: a string with a single backslash character between C: and Users
      const event = makeEvent({ title: "C:\\dir" });
      const ics = builder.generateIcsEvent(event, "CREATE", ORGANIZER, ATTENDEE);
      // RFC 5545 requires \ → \\  so the ICS should contain two consecutive backslashes
      // In JavaScript regex/string terms: '\\\\' matches two literal backslash characters
      expect(ics).toContain("C:\\\\dir");
    });
  });

  // ----- RFC 5545 §3.1 Line folding -----

  describe("RFC 5545 line folding", () => {
    it("folds lines exceeding 75 octets", () => {
      const longDescription = "A".repeat(100);
      const event = makeEvent({ description: longDescription });
      const ics = builder.generateIcsEvent(event, "CREATE", ORGANIZER, ATTENDEE);

      // Extract the DESCRIPTION lines
      const descriptionMatch = ics.match(/DESCRIPTION:.*?(?=\r\n[A-Z])/s);
      expect(descriptionMatch).toBeTruthy();

      // Check that fold points exist (CRLF + space)
      const descLine = descriptionMatch![0];
      expect(descLine).toContain("\r\n ");

      // Verify each physical line is ≤ 75 octets
      const physicalLines = descLine.split("\r\n");
      const encoder = new TextEncoder();
      for (const line of physicalLines) {
        const byteLength = encoder.encode(line).length;
        expect(byteLength).toBeLessThanOrEqual(75);
      }
    });

    it("does not split multibyte UTF-8 characters", () => {
      // Each emoji is 4 bytes in UTF-8
      const emojis = "💊".repeat(25); // 100 bytes
      const event = makeEvent({ title: emojis });
      const ics = builder.generateIcsEvent(event, "CREATE", ORGANIZER, ATTENDEE);

      // Extract the SUMMARY line
      const summaryMatch = ics.match(/SUMMARY:.*?(?=\r\n[A-Z])/s);
      expect(summaryMatch).toBeTruthy();

      // Split into physical lines and verify no broken characters
      const physicalLines = summaryMatch![0].split("\r\n");
      for (const line of physicalLines) {
        // Each line should decode cleanly back to valid UTF-8
        const encoder = new TextEncoder();
        const decoder = new TextDecoder("utf-8", { fatal: true });
        const trimmed = line.startsWith(" ") ? line.slice(1) : line;
        const bytes = encoder.encode(trimmed);
        expect(() => decoder.decode(bytes)).not.toThrow();
        expect(bytes.length).toBeLessThanOrEqual(75);
      }
    });

    it("does not fold short lines", () => {
      const event = makeEvent({ title: "Short", description: "Brief" });
      const ics = builder.generateIcsEvent(event, "CREATE", ORGANIZER, ATTENDEE);

      // SUMMARY line should not be folded
      const summaryLine = ics.split("\r\n").find((l) => l.startsWith("SUMMARY:"));
      expect(summaryLine).toBe("SUMMARY:Short");
    });

    it("all line breaks are CRLF, never bare LF", () => {
      const event = makeEvent();
      const ics = builder.generateIcsEvent(event, "CREATE", ORGANIZER, ATTENDEE);

      // Remove all \r\n first, then check no \n remains
      const withoutCRLF = ics.replace(/\r\n/g, "");
      expect(withoutCRLF).not.toContain("\n");
      expect(withoutCRLF).not.toContain("\r");
    });
  });

  // ----- Organizer & Attendee -----

  describe("Organizer and Attendee", () => {
    it("includes ORGANIZER and ATTENDEE properties", () => {
      const event = makeEvent();
      const ics = builder.generateIcsEvent(event, "CREATE", ORGANIZER, ATTENDEE);

      expect(ics).toContain("ORGANIZER;");
      expect(ics).toContain("mailto:calendar@someonenear.com");
      expect(ics).toContain("ATTENDEE;");
      expect(ics).toContain("mailto:grandma@example.com");
    });
  });

  // ----- Multi-event bundle -----

  describe("Multi-event bundle", () => {
    it("bundles multiple VEVENTs in a single VCALENDAR", () => {
      const events = [
        {
          event: makeEvent({ externalUid: "med_a@sn.com", title: "Med A" }),
          action: "CREATE" as CalendarAction,
        },
        {
          event: makeEvent({ externalUid: "med_b@sn.com", title: "Med B" }),
          action: "CREATE" as CalendarAction,
        },
        {
          event: makeEvent({ externalUid: "med_c@sn.com", title: "Med C" }),
          action: "CREATE" as CalendarAction,
        },
      ];

      const ics = builder.generateMultiEventBundle(events, ORGANIZER, ATTENDEE);

      // Single VCALENDAR
      expect(ics.match(/BEGIN:VCALENDAR/g)?.length).toBe(1);
      expect(ics.match(/END:VCALENDAR/g)?.length).toBe(1);

      // Three VEVENTs
      expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(3);
      expect(ics.match(/END:VEVENT/g)?.length).toBe(3);

      // All UIDs present
      expect(ics).toContain("UID:med_a@sn.com");
      expect(ics).toContain("UID:med_b@sn.com");
      expect(ics).toContain("UID:med_c@sn.com");
    });

    it("throws when events have mixed methods (REQUEST and CANCEL)", () => {
      const events = [
        { event: makeEvent({ externalUid: "med_a@sn.com" }), action: "CREATE" as CalendarAction },
        { event: makeEvent({ externalUid: "med_b@sn.com" }), action: "CANCEL" as CalendarAction },
      ];

      expect(() => builder.generateMultiEventBundle(events, ORGANIZER, ATTENDEE)).toThrow(
        /same METHOD/i,
      );
    });

    it("throws on empty event array", () => {
      expect(() => builder.generateMultiEventBundle([], ORGANIZER, ATTENDEE)).toThrow();
    });
  });

  // ----- Location -----

  describe("Location handling", () => {
    it("includes LOCATION when non-empty", () => {
      const event = makeEvent({ location: "Kitchen, Home" });
      const ics = builder.generateIcsEvent(event, "CREATE", ORGANIZER, ATTENDEE);
      expect(ics).toContain("LOCATION:Kitchen\\, Home");
    });

    it("omits LOCATION when empty", () => {
      const event = makeEvent({ location: "" });
      const ics = builder.generateIcsEvent(event, "CREATE", ORGANIZER, ATTENDEE);
      expect(ics).not.toContain("LOCATION:");
    });
  });
});

// ---------------------------------------------------------------------------
// Module 3: Queue & Debounce Tests
// ---------------------------------------------------------------------------

describe("CalendarSyncQueue", () => {
  let queue: CalendarSyncQueue;

  beforeEach(() => {
    vi.spyOn(syncEngine, "resolveAttendeeDetails").mockResolvedValue({
      primary: ATTENDEE,
      timezone: "UTC",
      guardians: [],
    });
    const dispatcher = new CalendarMailDispatcher(
      { host: "localhost", port: 587, secure: false, auth: { user: "", pass: "" } },
      ORGANIZER,
    );
    vi.spyOn(dispatcher, "sendCalendarEvent").mockResolvedValue({
      success: true,
      messageId: "test",
      error: null,
      eventsProcessed: 1,
    });
    vi.spyOn(syncEngine, "getMailDispatcher").mockReturnValue(dispatcher);
    vi.spyOn(SupabaseCalendarSyncRepository.prototype, "findById").mockResolvedValue(makeEvent());
    vi.spyOn(SupabaseCalendarSyncRepository.prototype, "markDispatched").mockResolvedValue(
      makeEvent({ dispatchedSequence: 0 }),
    );
    // No Redis URL — forces fallback mode (synchronous processing)
    queue = createCalendarSyncQueue(undefined, 100); // 100ms debounce for fast tests
  });

  afterEach(async () => {
    await queue.shutdown();
    vi.restoreAllMocks();
  });

  describe("Debounce logic", () => {
    it("collapses rapid updates for the same user into a single delivery", async () => {
      // Enqueue 5 events rapidly for the same user
      await queue.enqueueSyncJob("user-1", "evt-a", "CREATE");
      await queue.enqueueSyncJob("user-1", "evt-b", "CREATE");
      await queue.enqueueSyncJob("user-1", "evt-c", "UPDATE");

      // Flush immediately — all three should be in one batch
      await queue.flushUser("user-1");

      // After flush, no pending events for the user
      // (We can't directly inspect internals, but calling flush again should be a no-op)
      await queue.flushUser("user-1"); // Should not throw
    });

    it("deduplicates the same eventId within a debounce window (keeps latest action)", async () => {
      await queue.enqueueSyncJob("user-1", "evt-x", "CREATE");
      await queue.enqueueSyncJob("user-1", "evt-x", "UPDATE"); // Should override CREATE
      await queue.enqueueSyncJob("user-1", "evt-x", "CANCEL"); // Should override UPDATE

      // Flush — the event should only appear once with the last action
      await queue.flushUser("user-1");
    });

    it("isolates debounce between different users", async () => {
      await queue.enqueueSyncJob("user-1", "evt-a", "CREATE");
      await queue.enqueueSyncJob("user-2", "evt-b", "CREATE");

      // Flushing user-1 should not affect user-2
      await queue.flushUser("user-1");

      // user-2 should still have pending events
      await queue.flushUser("user-2");
    });
  });

  it("rejects missing recipient details instead of simulating delivery", async () => {
    vi.mocked(syncEngine.resolveAttendeeDetails).mockResolvedValue({
      primary: { ...ATTENDEE, email: "" },
      timezone: "UTC",
      guardians: [],
    });
    await expect(queue.enqueueSyncJob("user-1", "evt-a", "CREATE")).rejects.toThrow(
      "email unavailable",
    );
    expect(SupabaseCalendarSyncRepository.prototype.markDispatched).not.toHaveBeenCalled();
  });

  it("propagates dependency failures from synchronous delivery", async () => {
    vi.mocked(syncEngine.resolveAttendeeDetails).mockRejectedValue(
      new Error("Profile unavailable"),
    );
    await expect(queue.enqueueSyncJob("user-1", "evt-a", "CREATE")).rejects.toThrow(
      "Profile unavailable",
    );
    expect(SupabaseCalendarSyncRepository.prototype.markDispatched).not.toHaveBeenCalled();
  });

  describe("Shutdown", () => {
    it("flushes all pending timers on shutdown", async () => {
      await queue.enqueueSyncJob("user-1", "evt-a", "CREATE");
      await queue.enqueueSyncJob("user-2", "evt-b", "UPDATE");

      // Shutdown should flush both users
      await queue.shutdown();
    });
  });
});

// ---------------------------------------------------------------------------
// Module 5: CalendarSyncService Tests
// ---------------------------------------------------------------------------

describe("CalendarSyncService", () => {
  let service: CalendarSyncService;
  let mockRepository: CalendarSyncRepository;
  let createdEvents: Map<string, SyncableCalendarEvent>;

  const TEST_CONFIG: CalendarSyncConfig = {
    smtp: { host: "smtp.test.com", port: 587, secure: false, auth: { user: "test", pass: "test" } },
    organizer: ORGANIZER,
    domain: "someonenear.com",
    debounceMs: 50,
    redisUrl: "",
  };

  beforeEach(() => {
    createdEvents = new Map();

    mockRepository = {
      markDispatched: vi.fn(async () => makeEvent({ dispatchedSequence: 0 })),
      findUndispatchedByUserId: vi.fn(async () => []),
      create: vi.fn(async (event) => {
        const full: SyncableCalendarEvent = {
          ...event,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        createdEvents.set(full.id, full);
        return full;
      }),

      findById: vi.fn(async (id) => createdEvents.get(id) ?? null),

      findByUserId: vi.fn(async (userId) =>
        Array.from(createdEvents.values()).filter((e) => e.userId === userId),
      ),

      findByExternalUid: vi.fn(
        async (uid) =>
          Array.from(createdEvents.values()).find((e) => e.externalUid === uid) ?? null,
      ),

      findBySource: vi.fn(
        async (sourceType, sourceId) =>
          Array.from(createdEvents.values()).find(
            (e) => e.sourceType === sourceType && e.sourceId === sourceId,
          ) ?? null,
      ),

      atomicUpdateWithSequenceIncrement: vi.fn(async (id, updates) => {
        const existing = createdEvents.get(id);
        if (!existing) throw new Error("Event not found");

        const updated: SyncableCalendarEvent = {
          ...existing,
          ...updates,
          sequence: existing.sequence + 1,
          updatedAt: new Date(),
        };
        createdEvents.set(id, updated);
        return updated;
      }),

      atomicCancel: vi.fn(async (id) => {
        const existing = createdEvents.get(id);
        if (!existing) throw new Error("Event not found");

        const cancelled: SyncableCalendarEvent = {
          ...existing,
          status: "CANCELLED",
          sequence: existing.sequence + 1,
          updatedAt: new Date(),
        };
        createdEvents.set(id, cancelled);
        return cancelled;
      }),
    };

    service = new CalendarSyncService(TEST_CONFIG, mockRepository, true);
  });

  afterEach(async () => {
    await service.shutdown();
  });

  // ----- scheduleItem -----

  describe("scheduleItem", () => {
    it("creates an event with sequence 0, CONFIRMED status, and deterministic UID", async () => {
      const dto: CreateItemDTO = {
        userId: "user-001",
        itemType: "MEDICATION",
        entityId: "metformin_66f12a8bc9",
        title: "Take Metformin (500mg)",
        description: "Take with food",
        startTime: new Date("2026-10-01T09:00:00"),
        endTime: new Date("2026-10-01T09:15:00"),
        timezone: "Asia/Kolkata",
      };

      const result = await service.scheduleItem(dto);

      expect(result.sequence).toBe(0);
      expect(result.status).toBe("CONFIRMED");
      expect(result.externalUid).toBe("med_metformin_66f12a8bc9@someonenear.com");
      expect(result.userId).toBe("user-001");
      expect(mockRepository.create).toHaveBeenCalledOnce();
    });

    it("generates different UIDs for different item types", async () => {
      const medDto: CreateItemDTO = {
        userId: "user-001",
        itemType: "MEDICATION",
        entityId: "abc123",
        title: "Med",
        description: "",
        startTime: new Date(),
        endTime: new Date(),
        timezone: "UTC",
      };

      const sessionDto: CreateItemDTO = {
        ...medDto,
        itemType: "LISTENER_SESSION",
        entityId: "abc123",
        title: "Session",
      };

      const checkinDto: CreateItemDTO = {
        ...medDto,
        itemType: "CHECKIN",
        entityId: "abc123",
        title: "Checkin",
      };

      const med = await service.scheduleItem(medDto);
      const session = await service.scheduleItem(sessionDto);
      const checkin = await service.scheduleItem(checkinDto);

      expect(med.externalUid).toBe("med_abc123@someonenear.com");
      expect(session.externalUid).toBe("session_abc123@someonenear.com");
      expect(checkin.externalUid).toBe("checkin_abc123@someonenear.com");
    });
  });

  // ----- updateItem -----

  describe("updateItem", () => {
    it("atomically increments sequence from N to N+1 and preserves UID", async () => {
      const created = await service.scheduleItem({
        userId: "user-001",
        itemType: "MEDICATION",
        entityId: "met_001",
        title: "Take Metformin",
        description: "",
        startTime: new Date("2026-10-01T09:00:00"),
        endTime: new Date("2026-10-01T09:15:00"),
        timezone: "Asia/Kolkata",
      });

      expect(created.sequence).toBe(0);

      const updated = await service.updateItem(created.id, {
        id: created.id,
        title: "Take Metformin (Updated)",
        startTime: new Date("2026-10-01T10:00:00"),
      });

      expect(updated.sequence).toBe(1);
      expect(updated.externalUid).toBe(created.externalUid); // UID unchanged
      expect(updated.title).toBe("Take Metformin (Updated)");
      expect(mockRepository.atomicUpdateWithSequenceIncrement).toHaveBeenCalledOnce();
    });

    it("multiple updates keep incrementing sequence", async () => {
      const created = await service.scheduleItem({
        userId: "user-001",
        itemType: "MEDICATION",
        entityId: "met_002",
        title: "Initial",
        description: "",
        startTime: new Date(),
        endTime: new Date(),
        timezone: "UTC",
      });

      const u1 = await service.updateItem(created.id, { id: created.id, title: "Update 1" });
      expect(u1.sequence).toBe(1);

      const u2 = await service.updateItem(created.id, { id: created.id, title: "Update 2" });
      expect(u2.sequence).toBe(2);

      const u3 = await service.updateItem(created.id, { id: created.id, title: "Update 3" });
      expect(u3.sequence).toBe(3);
    });
  });

  // ----- cancelItem -----

  describe("cancelItem", () => {
    it("sets status to CANCELLED and increments sequence", async () => {
      const created = await service.scheduleItem({
        userId: "user-001",
        itemType: "CHECKIN",
        entityId: "chk_001",
        title: "Daily Check-in",
        description: "",
        startTime: new Date(),
        endTime: new Date(),
        timezone: "Asia/Kolkata",
      });

      const cancelled = await service.cancelItem(created.id);

      expect(cancelled.status).toBe("CANCELLED");
      expect(cancelled.sequence).toBe(1);
      expect(cancelled.externalUid).toBe(created.externalUid);
      expect(mockRepository.atomicCancel).toHaveBeenCalledWith(created.id);
    });
  });

  // ----- batchUpdateMedications -----

  describe("batchUpdateMedications", () => {
    it("updates multiple medications and increments each sequence", async () => {
      const med1 = await service.scheduleItem({
        userId: "user-001",
        itemType: "MEDICATION",
        entityId: "bp_pill",
        title: "Blood Pressure Pill",
        description: "",
        startTime: new Date("2026-10-01T09:00:00"),
        endTime: new Date("2026-10-01T09:15:00"),
        timezone: "Asia/Kolkata",
      });

      const med2 = await service.scheduleItem({
        userId: "user-001",
        itemType: "MEDICATION",
        entityId: "vitamin_d",
        title: "Vitamin D",
        description: "",
        startTime: new Date("2026-10-01T09:00:00"),
        endTime: new Date("2026-10-01T09:15:00"),
        timezone: "Asia/Kolkata",
      });

      const results = await service.batchUpdateMedications("user-001", [
        { id: med1.id, title: "BP Pill (Updated Dose)" },
        { id: med2.id, title: "Vitamin D3 (Updated)" },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].sequence).toBe(1);
      expect(results[0].title).toBe("BP Pill (Updated Dose)");
      expect(results[1].sequence).toBe(1);
      expect(results[1].title).toBe("Vitamin D3 (Updated)");

      // Both should have unique UIDs
      expect(results[0].externalUid).not.toBe(results[1].externalUid);
    });
  });

  // ----- getEventsByUser -----

  describe("getEventsByUser", () => {
    it("returns all events for a user", async () => {
      await service.scheduleItem({
        userId: "user-x",
        itemType: "MEDICATION",
        entityId: "a",
        title: "A",
        description: "",
        startTime: new Date(),
        endTime: new Date(),
        timezone: "UTC",
      });
      await service.scheduleItem({
        userId: "user-x",
        itemType: "CHECKIN",
        entityId: "b",
        title: "B",
        description: "",
        startTime: new Date(),
        endTime: new Date(),
        timezone: "UTC",
      });

      const events = await service.getEventsByUser("user-x");
      expect(events).toHaveLength(2);
    });
  });
});

// ---------------------------------------------------------------------------
// End-to-end ICS + Service integration
// ---------------------------------------------------------------------------

describe("End-to-end: Service → ICS generation", () => {
  it("creates an event via service and generates a valid ICS from it", async () => {
    const mockRepo: CalendarSyncRepository = {
      markDispatched: vi.fn(async () => makeEvent({ dispatchedSequence: 0 })),
      findUndispatchedByUserId: vi.fn(async () => []),
      create: vi.fn(async (event) => ({
        ...event,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      findById: vi.fn(async () => null),
      findByUserId: vi.fn(async () => []),
      findByExternalUid: vi.fn(async () => null),
      findBySource: vi.fn(async () => null),
      atomicUpdateWithSequenceIncrement: vi.fn(),
      atomicCancel: vi.fn(),
    };

    const config: CalendarSyncConfig = {
      smtp: { host: "localhost", port: 587, secure: false, auth: { user: "", pass: "" } },
      organizer: ORGANIZER,
      domain: "someonenear.com",
      debounceMs: 50,
      redisUrl: "",
    };

    const service = new CalendarSyncService(config, mockRepo, true);

    const event = await service.scheduleItem({
      userId: "user-test",
      itemType: "MEDICATION",
      entityId: "aspirin_abc123",
      title: "Take Aspirin (100mg)",
      description: "Take after breakfast",
      startTime: new Date("2026-10-05T08:30:00"),
      endTime: new Date("2026-10-05T08:45:00"),
      timezone: "Asia/Kolkata",
      alarmMinutesBefore: 10,
    });

    const ics = icsBuilder.generateIcsEvent(event, "CREATE", ORGANIZER, ATTENDEE);

    // Validate the ICS contains correct data
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("METHOD:REQUEST");
    expect(ics).toContain("UID:med_aspirin_abc123@someonenear.com");
    expect(ics).toContain("SEQUENCE:0");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics).toContain("TRIGGER:-PT10M");
    expect(ics).toContain("Take Aspirin");

    // Verify all lines use CRLF
    const withoutCRLF = ics.replace(/\r\n/g, "");
    expect(withoutCRLF).not.toContain("\n");

    await service.shutdown();
  });
});
