# Cloudflare Worker secrets — production

`secrets.production.local.json` is a keys-only template for uploading the
Worker's runtime secrets in one shot with `wrangler secret bulk`.

> **Never commit the filled file.** It holds plaintext secrets. It matches
> `secrets.production.local.json` in `.gitignore` (and the `*.local` pattern),
> so git ignores it. Delete it after upload.

## Fill it, then upload

1. Open `secrets.production.local.json` and paste each value between the quotes.
   Leave any key you don't use as an empty string and delete that line, an
   empty value would overwrite a real one with blank.
2. Upload from the build output folder (where the generated `wrangler.json` is):

   ```powershell
   cd .output/server
   npx wrangler secret bulk ../../secrets.production.local.json
   ```

3. Confirm (names only, never values):

   ```powershell
   npx wrangler secret list
   ```

4. Delete the plaintext file:

   ```powershell
   Remove-Item ../../secrets.production.local.json
   ```

## Per-key notes

- **SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_PUBLISHABLE_KEY** — from
  Supabase → Project Settings → API. Use the **production** project's values.
- **SUPABASE_ANON_KEY** — the cron/webhook hooks compare the incoming apikey
  against this (falling back to the publishable key). Set it equal to
  `SUPABASE_PUBLISHABLE_KEY`.
- **TELNYX_SIP_CREDENTIAL_ID** — the telephony *credential* UUID
  (`ff1e5027-...`), NOT the Call Control App ID.
- **GEMINI_API_KEY** — Google AI Studio key for Companion chat + prescription OCR.
- **LOVABLE_API_KEY** — auth transactional email.
- **DODO_PAYMENTS_ENV** — `test` or `live`. If `test`, set the `DODO_TEST_*`
  keys instead of the `DODO_LIVE_*` ones (add them to the JSON).
- **GOOGLE_CALENDAR_REDIRECT_URI** — must be
  `https://www.someonenear.com/api/public/google-calendar/callback` and also
  added to the OAuth client's allowed redirect URIs in Google Cloud.

## NOT secrets — do not put these here

The `VITE_*` values (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, …)
are compiled into the browser bundle at **build time**, not read at runtime.
Set them in the environment before `pnpm build`; don't upload them as secrets.

## Optional Telnyx tuning (only if used; sensible code defaults otherwise)

`TELNYX_SMS_SHORT_CODE`, `TELNYX_SMS_SENDER_ID`, `TELNYX_MESSAGING_PROFILE_ID`,
`TELNYX_RECORD_CALLS`, `TELNYX_MAX_CALL_SECONDS`, `TELNYX_RING_SECONDS`.
