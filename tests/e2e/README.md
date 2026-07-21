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

## Test account

Create a dedicated test account through the normal sign-up flow. For the
admin feedback assertion to hit the inbox (not the gate), grant that user
the `admin` role in the `user_roles` table.
