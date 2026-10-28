/**
 * Calendar Sync Engine — Public API barrel export.
 *
 * @module @/lib/calendar-sync
 */

// Types
export type {
  CalendarItemType,
  CalendarEventStatus,
  CalendarAction,
  SyncableCalendarEvent,
  OrganizerDetails,
  AttendeeDetails,
  CreateItemDTO,
  UpdateItemDTO,
  CalendarSyncJobPayload,
  CalendarSyncResult,
  SmtpConfig,
  CalendarSyncConfig,
} from './types';

// ICS Builder
export { IcsBuilder, icsBuilder } from './icsBuilder';

// Queue
export { CalendarSyncQueue, createCalendarSyncQueue } from './calendarQueue';

// Mail Dispatcher
export { CalendarMailDispatcher, createMailDispatcher } from './mailDispatcher';

// Orchestrator Service
export {
  CalendarSyncService,
  createCalendarSyncService,
  SupabaseCalendarSyncRepository,
} from './calendarSyncService';
export type { CalendarSyncRepository } from './calendarSyncService';

// Supabase Data Sync Engine (Server-side)
export {
  runCalendarSyncWindow,
  syncNow,
  getCalendarSyncService,
  getCalendarSyncConfig,
  resolveAttendeeDetails,
} from './supabaseSyncEngine.server';

