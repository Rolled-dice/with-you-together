# Run SomeoneNear on localhost (own Supabase Free project)

This guide gets the full app running locally against a Supabase Free project you
own, with every feature working **except WhatsApp** (which stays in simulation).

Locked decisions for this setup:

- Email verification = **6-digit OTP code** (not a magic link).
- Cron = **public tunnel + pg_cron** (Supabase's cloud pg_net calls your tunnel URL).
- AI = **your own Gemini key** for both Companion chat and prescription OCR.
- Storage = **Supabase Storage** (prescriptions + send-later media).

> Paths below are relative to the project root: `with-you-together/`.

---

## 0. Prerequisites

- Node + the package manager this repo uses (pnpm — see `package.json` `pnpm.overrides`).
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`supabase`) for migrations.
- A tunnel tool: [ngrok](https://ngrok.com/) or `cloudflared`.
- A Google Cloud project (for Calendar OAuth) and a Dodo Payments test account.

---

## 1. Local env file

```powershell
Copy-Item .env.local.example .env.local
```

Fill values as you complete each section below. `.env.local` is gitignored.

Generate the calendar encryption key (`CALENDAR_TOKEN_ENC_KEY`):

```powershell
# 48 random bytes as base64 — paste the output as the value
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Max 256 }))
```

> **Rotate the old Dodo test secrets.** `.env.development` is committed and still
> contains the previous `DODO_TEST_API_KEY` / `DODO_TEST_WEBHOOK_SECRET`. Rotate
> them in the Dodo dashboard and put the new values only in `.env.local`.

---

## 2. Create the Supabase Free project + apply migrations

1. Create a project at https://supabase.com/dashboard (Free plan).
2. **Project Settings -> API**: copy Project URL, project ref, publishable/anon
   key, and the `service_role` key into `.env.local` (section 1).
3. Apply all migrations to your new project:

   ```powershell
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

   (Or paste each file in `supabase/migrations/` into the SQL editor, in
   filename order.)
4. Verify:

   ```sql
   select public.get_public_stats();               -- returns JSON
   select proname from pg_proc where proname='has_role';
   ```

---

## 3. Auth: email/password + email verification (OTP code)

In **Authentication -> Providers -> Email**:

- Enable **Confirm email**.

In **Authentication -> URL Configuration**:

- **Site URL**: `http://localhost:8080` (the port `vite dev` binds to).
- **Redirect URLs**: add `http://localhost:8080/**`.

In **Authentication -> Email Templates -> Confirm signup**, replace the body so it
sends the numeric code (Supabase exposes it as `{{ .Token }}`):

```html
<h2>Confirm your email</h2>
<p>Your SomeoneNear verification code is:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>Enter this code in the app to finish creating your account.</p>
```

> Supabase Free includes a limited built-in email sender for testing. For
> reliable delivery, add your own SMTP under **Authentication -> Emails -> SMTP**.

The signup form (`src/components/auth/sign-up-form.tsx`) shows a code-entry step
after sign-up and calls `verifyOtp({ email, token, type: 'signup' })`.

---

## 4. Storage buckets

A migration in this repo ensures the `prescriptions` and `send-later` buckets
exist with RLS policies. After `db push`, confirm under **Storage** that both
buckets are present and **private**.

---

## 5. Google Calendar OAuth (production mode)

Google Cloud Console -> **APIs & Services**:

1. Enable **Google Calendar API**.
2. **OAuth consent screen**: set publishing status to **In production**.
3. **Credentials -> Create OAuth client ID -> Web application**:
   - Authorized redirect URI:
     `http://localhost:8080/api/public/google-calendar/callback`
4. Put client ID/secret and the redirect URI into `.env.local` (section 3).

---

## 6. Gemini AI

Put your key in `GEMINI_API_KEY`. It powers `/api/chat` (Companion) and the
prescription OCR path (migrated off the Lovable gateway).

---

## 7. Dodo test webhook via tunnel

1. Start the app (`pnpm dev`) and a tunnel to the dev port:
   ```powershell
   ngrok http 8080
   ```
2. In the Dodo **test** dashboard, add a webhook endpoint:
   `https://<tunnel-host>/api/public/payments/dodo-webhook?env=test`
3. Copy the signing secret (`whsec_...`) into `DODO_TEST_WEBHOOK_SECRET`.
4. Keep `DODO_PAYMENTS_ENV=test` and `VITE_DODO_MODE=test`.

---

## 8. Cron via tunnel + pg_cron

Supabase's cloud pg_cron/pg_net cannot reach `localhost`, so the scheduled jobs
must call your **tunnel URL**. A migration in this repo reschedules the jobs;
you must supply your tunnel host and publishable key by running the provided
`supabase/cron-localhost.sql` helper (see that file's header) in the SQL editor.

Jobs: `send-later` (*/5), `calendar-sync` (*/15), `call-sla` (*/5). The
WhatsApp-reminders job stays **unscheduled** (WhatsApp is in simulation).

---

## 9. Run + verify

```powershell
pnpm install
pnpm dev
```

Verify: signup + OTP code, login, Companion chat (Gemini), prescription photo
OCR + Supabase Storage, reminders + live notification bell, Google Calendar
connect, Dodo test checkout + webhook, and cron output. WhatsApp remains
simulation.
