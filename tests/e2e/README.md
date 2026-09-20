# End-to-End Smoke Tests

Playwright smoke tests covering sign-in, companion messaging, checkout,
settings, and the admin feedback screen.

## Setup (once)

```bash
bun add -D @playwright/test        # already in package.json
bunx playwright install chromium
```

## Run

Against the local dev server (default `http://localhost:8080`):

```bash
# start the app in one terminal
bun run dev

# in another terminal
TEST_EMAIL=you@example.com TEST_PASSWORD='...' bunx playwright test
```

Against a deployed preview:

```bash
PLAYWRIGHT_BASE_URL=https://project--<id>.lovable.app \
TEST_EMAIL=you@example.com TEST_PASSWORD='...' \
bunx playwright test
```

Public tests (landing page, auth form render, protected-route redirect)
always run. Authenticated tests are automatically **skipped** when
`TEST_EMAIL` / `TEST_PASSWORD` are not set.

## What is covered

- **Public**: `/` loads, `/auth` renders the sign-in form, `/dashboard`
  redirects to `/auth` when signed out.
- **Sign-in**: email + password sign-in redirects to `/dashboard`.
- **Messaging**: opens `/companion`, sends a message, verifies the message
  appears in the transcript.
- **Checkout**: `/checkout?plan=care&currency=usd` mounts without crashing.
- **Settings**: `/settings` renders a heading.
- **Admin feedback**: `/admin/feedback` shows either the inbox or the
  "Admins only" gate (both are valid — proves the route works).

## Test accounts

`scripts/seed-dev-users.mjs` creates three accounts, one per capability, so
every authenticated surface can be exercised without hand-editing tables.

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
$env:SEED_PASSWORD="<at least 12 chars>"
npm run seed:users -- --yes-write-to-hosted
```

| Account | Email | Gets | Unlocks |
| --- | --- | --- | --- |
| admin | `admin@someonenear.test` | `user_roles` role `admin` | `/admin/calls`, `/admin/feedback`, `/admin/whatsapp` |
| listener | `listener@someonenear.test` | active `call_agents` row linked by `user_id` | `/agent/console` softphone |
| member | `member@someonenear.test` | `care_tier = 'care_plus'` | companion, listeners, family, reminders, send-later |

All three get `onboarding_completed = true` so they land straight in the app.

Remove them again:

```powershell
npm run seed:users:destroy -- --yes-write-to-hosted
```

### If sign-in says the password is wrong

Check it from the command line first — this signs in exactly the way the browser
does, and needs no service-role key:

```powershell
$env:SEED_PASSWORD='<what you think it is>'
npm run seed:users:verify
```

Both the seed and the verify print a `sha256=` fingerprint of the password they
received. **If the two fingerprints differ, your shell altered the value, not the
script.**

The usual culprit is PowerShell interpolating inside double quotes:

```powershell
$env:SEED_PASSWORD="Pa$$w0rd1234"   # node receives Pa}w0rd1234  — broken
$env:SEED_PASSWORD='Pa$$w0rd1234'   # node receives Pa$$w0rd1234 — correct
```

Use **single quotes** for any password containing `$`, `` ` `` or `!`.

Also note the password is only ever written during a seed run. Changing
`SEED_PASSWORD` without re-seeding will always fail.

### Things worth knowing

- **Admin and listener are different mechanisms.** The CRM is gated on the
  `admin` role; the softphone is gated on an active `call_agents` row whose
  `user_id` matches. `app_role` has no listener value — it is only
  `('admin','moderator','user')`. For one login that does both, give the
  listener user an `admin` role row too.
- **`upsertCallAgent` cannot create a usable listener.** It does not accept or
  write `user_id`, so agents added through the admin UI never satisfy
  `is_call_agent()` and cannot open the softphone. The seed sets the link
  directly, which is why it exists.
- **The safety gate is deliberate.** There is no local Supabase in this project,
  so `SUPABASE_URL` points at the hosted database and these writes are real.
  The script refuses to run without `--yes-write-to-hosted`, and there is no
  default password — `SEED_PASSWORD` must be supplied per run so no credential
  is ever committed. These accounts must never exist in production.
- `@someonenear.test` uses a reserved non-routable TLD (RFC 2606), so the
  addresses cannot receive mail or collide with a real customer.

For Playwright, point `TEST_EMAIL` / `TEST_PASSWORD` at the seeded admin account
so the admin feedback assertion reaches the inbox rather than the gate.
