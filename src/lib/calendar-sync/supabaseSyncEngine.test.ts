import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/integrations/supabase/client.server', () => {
  return {
    supabaseAdmin: {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              if (table === 'profiles') {
                return { data: { display_name: 'Grandma Sharma', timezone: 'Asia/Kolkata' }, error: null };
              }
              if (table === 'family_members') {
                return { data: { family_id: 'fam-123' }, error: null };
              }
              return { data: null, error: null };
            }),
            in: vi.fn(() => ({
              // for familyMembers
              data: [{ user_id: 'guardian-456', role: 'adult' }],
              error: null,
            })),
          })),
        })),
      })),
      auth: {
        admin: {
          getUserById: vi.fn(async (userId: string) => ({
            data: { user: { email: `${userId}@example.com` } },
            error: null,
          })),
        },
      },
    },
  };
});

import {
  getCalendarSyncConfig,
  resolveAttendeeDetails,
} from './supabaseSyncEngine.server';

// ---------------------------------------------------------------------------
// Supabase Sync Engine Tests
// ---------------------------------------------------------------------------

describe('SupabaseSyncEngine Configuration', () => {
  it('loads default config when env vars are unset', () => {
    const config = getCalendarSyncConfig();

    expect(config.organizer.name).toBe('SomeoneNear Care');
    expect(config.organizer.email).toBe('calendar@someonenear.com');
    expect(config.domain).toBe('someonenear.com');
    expect(config.debounceMs).toBe(5000);
    expect(config.smtp.port).toBe(587);
  });
});

describe('resolveAttendeeDetails', () => {
  it('resolves member name, email, timezone, and family guardians from Supabase', async () => {
    const details = await resolveAttendeeDetails('mock-user-123');

    // Should return valid structure
    expect(details.primary).toBeDefined();
    expect(details.primary.name).toBe('Grandma Sharma');
    expect(details.primary.email).toBe('mock-user-123@example.com');
    expect(details.timezone).toBe('Asia/Kolkata');
    expect(Array.isArray(details.guardians)).toBe(true);
  });
});
