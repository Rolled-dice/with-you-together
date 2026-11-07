# Google Calendar Reminder Sync — Design

**Date:** 2026-09-16
**Status:** Approved design, pending implementation plan
**Author:** Kiro + user (brainstorming session)

## Summary

Push SomeoneNear reminders into users' real Google Calendars via the Google
Calendar API using **per-user OAuth** (offline refresh). Two reminder sources
are synced: **medication doses** (`dose_logs`) and **general reminders**
(`reminders`). Google Calendar's own notifications (push/email) then remind the
user. This is additive — existing in-app and WhatsApp notifications are
unchanged.

### Decisions locked during brainstorming

| Question | Decision |
|---|---|
| Integration model | Full per-user OAuth (write directly into the user's real Google Calendar) |
| Sources synced | Medication doses **and** general reminders |
| Calendar holder | Family admin's connected calendar first; else the `for_user_id` person's own connected calendar; else no calendar event |
| Sync trigger | On-write (instant) **plus** a 15-min pg_cron catch-up |
| Materialization window | Rolling **7 days** for recurring doses/reminders |

## Constraints (from the codebase)

- **Runtime is a Cloudflare Worker** — no Node-only packages. The `googleapis`
  SDK is **not** allowed. Use plain `fetch` against the Google REST API and
  **Web Crypto** for token encryption and HMAC state signing.
- The existing Google login is **brokered by Lovable**
  (`src/integrations/lovable/index.ts`) and does **not** request calendar
  scopes or surface a `provider_token` / `provider_refresh_token`. A **separate
  consent flow** is required.
- Server-function rules: `*.functions.ts` files are thin wrappers (imports,
  types, exported `createServerFn` declarations only). Runtime logic and all
  `process.env` reads live in imported `*.server.ts` modules, loaded via
  `await import(...)` inside `.handler()`. Components import `*.functions.ts`
  only, never `*.server.ts`.
- Every new `public` table needs `GRANT`s + `ENABLE ROW LEVEL SECURITY` +
  policies **in the same migration**. Ownership scoped by `user_id =
  auth.uid()`; family sharing via the existing `same_family_as()` /
  `is_family_adult_of()` security-definer helpers; admin override via
  `has_role()`.
- Never edit auto-generated files under `src/integrations/supabase/` or
  `src/routeTree.gen.ts`. Never expose the service-role key or refresh tokens
  to the client.

## Architecture

Four parts:

1. **OAuth connect flow** — dedicated "Connect Google Calendar" action, separate
   from login. Runs Google consent with scope
   `https://www.googleapis.com/auth/calendar.events`, `access_type=offline`,
   `prompt=consent`. Stores an encrypted refresh token per user.
2. **Token + event-mapping store** — two new tables (below).
3. **Calendar service module** (`calendar-sync.server.ts`) — `fetch`-based calls
   to `https://www.googleapis.com/calendar/v3/...` and
   `https://oauth2.googleapis.com/token`; AES-GCM token encryption via Web
   Crypto.
4. **Sync triggers** — on-write hooks in existing mutations + a 15-min
   apikey-verified pg_cron hook that reconciles a rolling 7-day window and
   refreshes expiring tokens.

### Holder resolution

Evaluated per source item using its `for_user_id`:

1. If a **family admin** (owner/adult in that person's family) has a connected,
   `sync_enabled` calendar → use the admin's calendar.
2. Else if the **`for_user_id` person** has connected → use their own.
3. Else → **no calendar event** (in-app / WhatsApp notifications still fire).

The resolved `holder_user_id` + `calendar_id` are persisted on each
`calendar_event_links` row.

## Data model

### `public.google_calendar_credentials` (one row per connected user)

| column | type | notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid NOT NULL UNIQUE | → `auth.users(id) ON DELETE CASCADE` |
| `google_email` | text | consented Google account (display) |
| `encrypted_refresh_token` | text NOT NULL | AES-GCM ciphertext; never returned to client |
| `access_token` | text | short-lived cache |
| `access_token_expires_at` | timestamptz | refresh trigger |
| `scope` | text | granted scope string |
| `calendar_id` | text NOT NULL DEFAULT `'primary'` | target calendar |
| `sync_enabled` | boolean NOT NULL DEFAULT true | user pause switch |
| `last_synced_at` | timestamptz | diagnostics |
| `created_at` / `updated_at` | timestamptz | `set_updated_at` trigger |

**RLS:** user may `SELECT`/`UPDATE`/`DELETE` their own row (`user_id =
auth.uid()`); admin read via `has_role(auth.uid(),'admin')`. **No client
`INSERT`.** Token columns are written/read only server-side via `supabaseAdmin`.
Client-facing reads go through a server fn that returns only non-secret fields
(`connected`, `google_email`, `sync_enabled`, `calendar_id`, `last_synced_at`).
`GRANT SELECT, UPDATE, DELETE ... TO authenticated; GRANT ALL ... TO
service_role;`

### `public.calendar_event_links` (idempotent source → Google-event mapping)

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `holder_user_id` | uuid NOT NULL | resolved holder → `auth.users(id) ON DELETE CASCADE` |
| `source_type` | text NOT NULL | CHECK in (`'dose'`,`'reminder'`) |
| `source_id` | uuid NOT NULL | `dose_logs.id` or `reminders.id` |
| `google_event_id` | text NOT NULL | returned by Google |
| `calendar_id` | text NOT NULL | calendar written to |
| `synced_hash` | text | hash of title/time to gate PATCHes |
| `created_at` / `updated_at` | timestamptz | |

**UNIQUE (`holder_user_id`, `source_type`, `source_id`)** — the idempotency
guarantee (same spirit as `notifications_unique_ladder` / `dose_logs`
`onConflict`). Service-managed: `GRANT ALL ... TO service_role;` (no direct
client writes). RLS enabled; admin read only.

### Env vars (set in Lovable Cloud by the user)

- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `GOOGLE_CALENDAR_REDIRECT_URI`
- `CALENDAR_TOKEN_ENC_KEY` (AES-GCM key material for refresh-token encryption)

All read via `process.env.*` **inside handlers only**.

## OAuth connect flow

1. **Start consent** — server fn `startGoogleCalendarConnect` (auth-gated,
   `.middleware([requireSupabaseAuth])`). Builds the Google auth URL: scope
   `calendar.events`, `access_type=offline`, `prompt=consent`, `redirect_uri` =
   callback route, and `state` = short-lived HMAC-signed token binding the flow
   to `context.userId` (Web Crypto HMAC; verified server-side). Returns the URL;
   client redirects the browser.
2. **Callback** — public file route
   `src/routes/api/public/google-calendar/callback.ts`. Google redirects with
   `code` + `state`. It verifies `state` (HMAC + expiry), recovers `user_id`,
   exchanges `code` at `https://oauth2.googleapis.com/token` via `fetch`,
   encrypts the refresh token (AES-GCM), upserts
   `google_calendar_credentials` via `supabaseAdmin`, and redirects back to the
   reminders page with `?calendar=connected|error`. Cannot use
   `requireSupabaseAuth` (it's a Google redirect with no app auth header) — the
   `state` HMAC is the identity proof.
3. **Token refresh** — `getFreshAccessToken(holderUserId)` in the service
   module: return the cached access token if unexpired, else POST the refresh
   token to Google's token endpoint, update cache + expiry, return it. Refresh
   tokens are decrypted server-side only.
4. **Disconnect** — `disconnectGoogleCalendar` (auth-gated): deletes the
   credential row and best-effort deletes that holder's `calendar_event_links`.
   Already-created Google events are **left in place** (documented behavior).

## Sync engine

### What becomes an event

- **Doses** (`dose_logs`) → 15-min event, title `💊 Take {medication name}
  ({dosage})`, description with instructions / with-food. Taken/skipped doses
  still show; a dismissed/deleted medication removes its future events.
- **Reminders** (`reminders`) → event at `due_at`, title `{title}`, description
  `{description}`, category hint. `done`/`dismissed`/deleted → event removed.

### On-write path

Existing `*.functions.ts` mutations (`addMedication`, `createReminder`,
`completeReminder`, `deleteReminder`, dose logging) call a new
`calendar-sync.server.ts` helper after their DB write. Sync is **best-effort and
non-blocking**: wrapped in try/catch, a calendar failure never breaks the core
action. Recurring doses seed the rolling window immediately so new meds appear
right away.

### Cron path

New public hook `src/routes/api/public/hooks/calendar-sync.ts`, apikey-verified
exactly like `call-sla.ts` (compare header to `SUPABASE_ANON_KEY ??
SUPABASE_PUBLISHABLE_KEY`, 401 on mismatch), driven by pg_cron every 15 min. It:

1. refreshes access tokens expiring soon,
2. for each connected + `sync_enabled` holder, computes the desired event set
   for the **rolling 7-day window** (re-seeding recurring `dose_logs` like the
   existing `seedDoseLogs`, extended to 7 days),
3. diffs against `calendar_event_links` via `synced_hash`, doing create / PATCH
   / delete on Google,
4. updates `last_synced_at`.

### Idempotency & rate handling

- `UNIQUE(holder_user_id, source_type, source_id)` prevents double-create.
- `synced_hash` gates PATCH — only when title/time actually changed.
- Google calls sequential per holder; on 4xx skip + log, on 5xx/429 retry next
  cron.

## UI & client surface

- **Connect/disconnect card** on `src/routes/_authenticated/reminders.tsx`
  (and/or a settings area). Not-connected: blurb + "Connect Google Calendar".
  Connected: shows `google_email`, a "Syncing on" toggle (`sync_enabled`),
  calendar note, `last_synced_at`, "Disconnect". After callback: `?calendar=`
  flag drives a Sonner toast.
- **Family note:** family admin sees "Events for your family members will appear
  on your Google Calendar"; a member whose admin holds the calendar sees a
  "Managed by your family admin" note instead of a connect button.
- **Client-safe server fns** (`google-calendar.functions.ts`, thin wrappers →
  dynamic-import `.server.ts`): `getGoogleCalendarStatus` (non-secret fields
  only), `startGoogleCalendarConnect`, `setCalendarSyncEnabled`,
  `disconnectGoogleCalendar`.
- Semantic design tokens only; no hardcoded color utilities.

## Testing

- Unit-test **holder resolution** and **hash/diff** logic (pure functions, no
  network).
- Structure the service module so the network layer is **injectable/mockable**;
  no live Google calls in tests.
- Extend `tests/e2e/smoke.spec.ts` to assert the connect card renders in
  not-connected and connected states.

## New / changed files (anticipated)

**New**
- `supabase/migrations/<ts>_google_calendar_sync.sql` — both tables, GRANTs,
  RLS, policies, indexes; pg_cron entry for the sync hook.
- `src/lib/google-calendar.functions.ts` — thin server-fn wrappers.
- `src/lib/calendar-sync.server.ts` — token exchange/refresh, encryption,
  Google REST calls, holder resolution, event build/diff, sync runners.
- `src/routes/api/public/google-calendar/callback.ts` — OAuth callback route.
- `src/routes/api/public/hooks/calendar-sync.ts` — apikey-verified cron hook.
- Connect/disconnect UI component (e.g.
  `src/components/google-calendar-card.tsx`).
- Unit tests for holder resolution + hash/diff.

**Changed**
- `src/lib/medications.functions.ts` — best-effort calendar sync after
  add/log/seed.
- `src/lib/reminders.functions.ts` — best-effort calendar sync after
  create/complete/delete.
- `src/routes/_authenticated/reminders.tsx` — mount the connect card + toast.
- `tests/e2e/smoke.spec.ts` — connect-card assertions.

## Out of scope

- Listener call bookings (chosen: doses + reminders only).
- Service-account / invite-by-email model.
- Two-way sync (Google → app). This is one-way app → Google.
- Cleaning up already-created Google events on disconnect.
