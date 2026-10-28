/**
 * Legacy Calendar Sync entrypoint — bridged to the zero-OAuth iMIP Calendar Synchronization Engine.
 *
 * This completely replaces external Google Calendar API and OAuth dependencies with
 * RFC 5545, RFC 5546, and RFC 6047 transactional calendar synchronization.
 */

export {
  runCalendarSyncWindow,
  syncNow,
  resolveAttendeeDetails,
} from '@/lib/calendar-sync';
