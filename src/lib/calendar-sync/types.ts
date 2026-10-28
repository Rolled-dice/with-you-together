/**
 * Represents the type of a calendar item.
 */
export type CalendarItemType = 'MEDICATION' | 'LISTENER_SESSION' | 'CHECKIN';

/**
 * Represents the current status of a calendar event.
 */
export type CalendarEventStatus = 'CONFIRMED' | 'CANCELLED';

/**
 * Represents an action to be performed on a calendar event during synchronization.
 */
export type CalendarAction = 'CREATE' | 'UPDATE' | 'CANCEL';

/**
 * Represents a calendar event that can be synchronized via iMIP.
 */
export interface SyncableCalendarEvent {
  /** The database primary key */
  id: string;
  /** The owner user ID */
  userId: string;
  /** The type of the calendar item */
  itemType: CalendarItemType;
  /** The RFC 5545 UID, immutable, e.g., 'med_metformin_66f12a8bc9@someonenear.com' */
  externalUid: string;
  /** Monotonic version counter, starts at 0 */
  sequence: number;
  /** The title of the event */
  title: string;
  /** The description of the event */
  description: string;
  /** The location of the event (can be empty) */
  location: string;
  /** The start time of the event */
  startTime: Date;
  /** The end time of the event */
  endTime: Date;
  /** The IANA timezone, e.g., 'Asia/Kolkata' */
  timezone: string;
  /** The RFC 5545 RRULE, optional */
  rrule: string | null;
  /** The number of minutes before the event to trigger a VALARM */
  alarmMinutesBefore: number;
  /** The status of the event */
  status: CalendarEventStatus;
  /** Optional source entity type (e.g., 'dose', 'reminder', 'listener_session') */
  sourceType?: string | null;
  /** Optional source entity primary key ID */
  sourceId?: string | null;
  /** The sequence number at which this event was last emailed. NULL = never dispatched. */
  dispatchedSequence: number | null;
  /** When the event was created */
  createdAt: Date;
  /** When the event was last updated */
  updatedAt: Date;
}

/**
 * Details of the organizer sending the calendar invitation.
 */
export interface OrganizerDetails {
  /** The name of the organizer */
  name: string;
  /** The email address of the organizer */
  email: string;
}

/**
 * Details of an attendee receiving the calendar invitation.
 */
export interface AttendeeDetails {
  /** The name of the attendee */
  name: string;
  /** The email address of the attendee */
  email: string;
  /** Whether RSVP is requested (default true) */
  rsvp: boolean;
}

/**
 * Data Transfer Object for creating a new syncable calendar event.
 */
export interface CreateItemDTO {
  /** The user ID creating the event */
  userId: string;
  /** The type of the calendar item */
  itemType: CalendarItemType;
  /** The domain entity ID used to build the deterministic UID */
  entityId: string;
  /** The title of the event */
  title: string;
  /** The description of the event */
  description: string;
  /** The location of the event */
  location?: string;
  /** The start time of the event */
  startTime: Date;
  /** The end time of the event */
  endTime: Date;
  /** The IANA timezone */
  timezone: string;
  /** The RFC 5545 RRULE */
  rrule?: string | null;
  /** The number of minutes before the event to trigger a VALARM */
  alarmMinutesBefore?: number;
  /** Optional source entity type (e.g., 'dose', 'reminder', 'listener_session') */
  sourceType?: string | null;
  /** Optional source entity primary key ID */
  sourceId?: string | null;
}

/**
 * Data Transfer Object for updating an existing syncable calendar event.
 */
export interface UpdateItemDTO {
  /** The syncable event ID to update */
  id: string;
  /** The updated title */
  title?: string;
  /** The updated description */
  description?: string;
  /** The updated location */
  location?: string;
  /** The updated start time */
  startTime?: Date;
  /** The updated end time */
  endTime?: Date;
  /** The updated IANA timezone */
  timezone?: string;
  /** The updated RFC 5545 RRULE */
  rrule?: string | null;
  /** The updated number of minutes before the event to trigger a VALARM */
  alarmMinutesBefore?: number;
}

/**
 * Payload structure for a BullMQ calendar sync job.
 */
export interface CalendarSyncJobPayload {
  /** The user ID for the sync job */
  userId: string;
  /** The events to process and their actions */
  events: Array<{ eventId: string; action: CalendarAction }>;
  /** The Date.now() timestamp when the job was enqueued */
  enqueuedAt: number;
}

/**
 * Result of a calendar sync operation.
 */
export interface CalendarSyncResult {
  /** Whether the sync was successful */
  success: boolean;
  /** The message ID of the sent email, if applicable */
  messageId: string | null;
  /** Error message if the sync failed */
  error: string | null;
  /** The number of events processed */
  eventsProcessed: number;
}

/**
 * Configuration for the SMTP server used to send iMIP emails.
 */
export interface SmtpConfig {
  /** SMTP host */
  host: string;
  /** SMTP port */
  port: number;
  /** Whether to use a secure connection */
  secure: boolean;
  /** Authentication credentials */
  auth: { user: string; pass: string };
  /** Whether to use connection pooling */
  pool?: boolean;
  /** Maximum number of connections in the pool */
  maxConnections?: number;
}

/**
 * Configuration for the calendar synchronization engine.
 */
export interface CalendarSyncConfig {
  /** SMTP configuration */
  smtp: SmtpConfig;
  /** Organizer details */
  organizer: OrganizerDetails;
  /** Canonical domain for UIDs, e.g., 'someonenear.com' */
  domain: string;
  /** Debounce delay in milliseconds (default 5000) */
  debounceMs: number;
  /** URL for the Redis connection used by BullMQ */
  redisUrl: string;
}
