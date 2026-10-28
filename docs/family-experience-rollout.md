# SomeoneNear Family Experience Release

## Product rules

- Care is individual: INR 3,999 / USD 49 monthly, 18 fifteen-minute calls.
- Care Plus is family: INR 6,499 / USD 79 monthly, 30 shared calls, five people including the owner. Unexpired pending invitations reserve places.
- AI allowances stay at Free 5/day, Care 40/day, and Care Plus unlimited. Accepted invitations do not inherit benefits until staff verification activates membership.
- Existing Care families remain connected but cannot expand. Existing accounts, subscriptions, bookings, and personal medicines are retained.
- Reminder receiving, completion sharing, and health sharing are separate recipient-controlled choices, initially off. Family membership never grants access to Companion chats.
- Withdrawing reminder receiving, leaving, or removal cancels pending family-created reminders and their push retries. Personal reminders and historical records remain. Turning sharing back on does not revive cancelled reminders.
- A technical call failure does not consume a verification attempt. Three unanswered calls close the request; refusal stops immediately. Only support can reopen after documenting the recipient's request.
- Extra-call checkout stays off. Prices and purchase/refund terms are not assumed. Dodo approval has been reported by the business owner; retain that approval with the launch records.

## Database First

Use a staging Supabase project with a backup and the existing application migrations applied. Never run test fixtures against production.

1. Apply these five migrations in order, once:
   `20261003100000_family_consent_and_verification.sql`
   `20261003110000_family_reminder_occurrences.sql`
   `20261003120000_atomic_call_credits.sql`
   `20261003130000_family_delivery.sql`
   `20261003140000_family_identity_guards.sql`
2. Run `supabase/tests/family_permissions.sql` as the database administrator. It must return `Family permissions verified` without exceptions.
3. Retain the earlier calendar restriction migration and run `supabase/tests/calendar_rpc_permissions.sql` too. Browser roles must not regain calendar mutation access.
4. Deploy the matching app immediately after the migration window. The old app cannot perform membership/reminder writes after their browser privileges are removed. Keep the old app out of that window.

The migrations are not reset scripts. Do not rerun a previously applied file. Migration rollback requires a reviewed compatibility release, not simply redeploying the old app. Prefer rolling forward; do not restore permissive family-data policies.

## Stage 1: Invitations And Consent

- Set `APP_URL` to the final HTTPS origin, `BREVO_API_KEY`, and a verified `FAMILY_EMAIL_FROM`. Auth emails still use Supabase Auth's own configuration.
- Keep `FAMILY_SMS_ENABLED_IN`, `FAMILY_SMS_ENABLED_US`, `FAMILY_PHONE_LOGIN_ENABLED`, and `FAMILY_PUSH_ENABLED` set to `false` initially.
- Email/SMS "Sent" means the delivery provider accepted the request, not that the recipient has read it. Failed delivery remains visible and can be retried after five minutes. Resending does not reset verification attempts. Creating invitations is limited to 20 per owner per day.
- Check a real owner -> email invitation -> sign-in/onboarding -> recipient acceptance -> listener claims request -> consent confirmation -> activation journey.
- In the listener console, verification calls currently use the contact's phone link and staff-recorded outcomes. They do not create paid listener bookings or consume subscription sessions. Confirm the team's calling setup before enabling live onboarding.
- Check a wrong account, duplicate contact, expired/revoked invitation, refusal, three no-answers, support reopening, permission withdrawal, and removal.

## Stage 2: Phone Sign-In

- Configure the Telnyx sender/messaging profile and complete sender approval and delivery tests separately for India and the US. Do not enable a region merely because the API accepts its number format.
- Enable Supabase Auth's phone provider and configure its HTTPS Send SMS Hook at `/api/public/auth-sms`. Put the hook signing secret in `SUPABASE_SEND_SMS_HOOK_SECRET`; it is not the service-role key or cron secret.
- Enable only the tested region flags, then `FAMILY_PHONE_LOGIN_ENABLED`. Verify real OTP delivery, retry/rate limits, and wrong-code handling.
- Recipient matching uses the confirmed email/phone in Supabase Auth. A matching profile phone alone never merges accounts or accepts an invitation.

Reference: [Supabase Send SMS Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook).

## Stage 3: Reminder Delivery

- Generate VAPID keys locally with `node scripts/generate-web-push-keys.mjs`. Keep the output private; set `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, and `WEB_PUSH_SUBJECT` (a monitored `mailto:` contact). Do not rotate keys without a device resubscription plan.
- Set `CRON_HOOK_SECRET` to a random private value of at least 32 characters. Store the same value in Supabase Vault as `someonenear_cron_hook_secret`. Never use a browser-visible publishable/anon key.
- After the matching app is deployed, run `supabase/cron-production.sql`. Family reminders run every minute; Send Later runs every five minutes. For staging/local tunnels, use `supabase/cron-localhost.sql` with the staging hostname instead, never the production database's jobs.
- The in-app inbox works with push off. Enable `FAMILY_PUSH_ENABLED` only after HTTPS device registration and delivery checks pass.
- Confirm background delivery on a real supported Android browser and an iPhone Home Screen installation. On iPhone/iPad, the app shows installation guidance before requesting notification permission.
- Check denied permissions, device disable/sign-out, duplicate scheduler runs, completed/snoozed reminders, expired push endpoints, provider failures, and retries. Queues use leases and notification tags; network-provider delivery cannot be guaranteed exactly once.
- Notification previews contain no appointment title, medicine name, or update text. Reminder details remain authenticated. The service worker does not cache private pages.
- Check recurring reminders across India/US timezones and daylight-saving transitions. Nonexistent or repeated local appointment times require another chosen time. No response is shown as "No update yet", never an assumed missed visit.
- Voice updates must remain editable before sending. They must not silently complete reminders or change a medication schedule. Test transcription failure with typed text retained.

Reference: [WebKit Home Screen web push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

## Extra Calls: Keep Disabled

Keep `EXTRA_CALLS_ENABLED=false` and `EXTRA_CALL_TERMS_READY=false`. The disabled purchase surface and separate balance are prepared, but no price is invented.

Before sales: configure positive minor-unit prices in `EXTRA_CALL_AMOUNT_INR/USD`, matching one-time Dodo products in `DODO_TEST_PRODUCT_EXTRA_CALL_INR/USD` and later `DODO_LIVE_PRODUCT_EXTRA_CALL_INR/USD`, and finalize purchase/refund terms. Test the real signed Dodo payload and product-cart shape in sandbox before enabling either flag.

Each purchase awards one fifteen-minute credit, once, after a verified payment. Expiry is fixed to the reviewed subscription billing-period end. The whole call must finish before expiry; rescheduling cannot extend it. Delayed payments for already expired orders enter `review` and do not create spendable credits. Support must review those payments. Renewal does not extend older purchases.

## Verification Evidence

Local verification on 3 October 2026: 268 automated tests passed, 14 Edge browser checks passed, TypeScript passed, and the production build passed. Focused lint passed for the new family implementation. Browser checks covered 1280, 390, and 320 pixel viewports, both themes, reduced-motion preference, large text, and the existing voice composer. Live delivery and independent-connection races below have not been performed.

Commands from the repository root:

```powershell
pnpm test
pnpm exec tsc --noEmit
pnpm build
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:8082'
$env:PLAYWRIGHT_BROWSER_CHANNEL='msedge'
pnpm exec playwright test tests/e2e/family-experience.spec.ts tests/e2e/voice-composer.spec.ts
```

The database tests apply the actual family migrations to a local PostgreSQL WASM instance with Supabase infrastructure fixtures. Browser fixtures exercise the actual components with isolated test responses. These do not prove remote Auth/provider delivery or independent PostgreSQL connection concurrency.

Before production, run these races with separate clients against staging and inspect committed rows:

- With four places occupied/reserved, submit two invitations together. Exactly one can reserve the final place.
- Two listeners claim one pending verification: one assignment wins. Retrying a saved attempt UUID adds no second attempt or member.
- Accept/activate one recipient in two families together. Only one membership can commit.
- With one call available, book two different slots together. Only one reservation commits; no negative quota or extra booking remains.
- Retry the same verified payment concurrently: one purchase credit, one payment ID. Cancel the same booking concurrently: one restoration only.
- Withdraw receiving while an owner schedules a reminder: no pending family-created reminder survives withdrawal. Any provider request already in flight can still deliver a private preview; no further retries may proceed.

Also verify desktop/mobile, light/dark, large text, keyboard/focus, reduced motion, existing Companion voice/chat and booking flows, prescription review before saving, and Send Later text/voice/video release plus removed-recipient denial.

## Current Release Boundary

Local implementation and automated verification are available. Remote migrations, production deployment, sender configuration, real SMS/email/push delivery, independent-connection races, and Dodo sandbox purchase events require staging release verification. Do not describe them as tested until they are performed and recorded.
