> Latest update: Companion, PhotoMed, private uploads/playback and password authentication are verified on the connected test_front Worker. See [5 November deployment report](connected-worker-deployment-2026-11-05.md). Earlier audit rows below describe their inspection-time state.

# Backend readiness and notification repair — 5 November 2026

The notification repair is implemented locally. The backend is partly connected; the new launch catalog and provider journeys are not production-complete. This audit used the confirmed Supabase project `jflufaxdwzrohslviqeb`, the existing Cloudflare prototype Worker, local code/configuration, read-only provider requests and the authenticated local preview. No live notification was marked read/deleted, no customer data was changed, no call/payment/message was sent, and no migration or deployment was performed.

## Notification repair

- The bell, Family updates label and count are one accessible button. The count sits in the layout instead of overlapping the icon. Values above 99 display `99+` while the accessible label retains the exact total.
- Added a separate exact, owner-scoped unread count, independent of the latest 30 displayed rows. List and count use the same eligibility filters; the previous suppression of disabled calling/SLA notifications remains intact.
- The inbox has loading, error/retry and empty states, an explicit close button, visible unread labels, and disabled dismiss controls while saving.
- Bulk action says **Mark shown as read** and submits only displayed unread IDs. Its server validation now rejects empty/omitted ID arrays instead of falling through to an unrestricted owner-wide update. Ownership remains enforced server-side and by RLS.
- Existing Realtime subscription plus visibility/online recovery and polling remain. The UI states clearly that this is an in-app inbox; device push is not enabled.
- The latest-30 preview is still bounded; this pass does not add a full paginated notification archive or enable phone push.

## Connection evidence and limits

| Area | Evidence | Still needed |
| --- | --- | --- |
| Supabase/Auth | Project ACTIVE_HEALTHY. Auth settings HTTP 200; email and Google enabled, Apple disabled. Authenticated dashboard and notification inbox render. | Test signup/recovery email delivery, Google callback and session expiry against the intended deployed origin; Apple only if required. |
| App database | HTTP 200 zero-row server reads for profiles, family membership, reminders, medications, conversations/messages, Companion memory, subscriptions, listener bookings, scheduled messages and calendar events. Relevant inspected tables have RLS enabled. | Actual create/update/delete journeys and cross-account isolation tests; read access does not prove every mutation or policy is correct. |
| Notifications | Table is in the Realtime publication. Owner UPDATE/DELETE policies include `user_id = auth.uid()`; SELECT permits owner or admin. Server inbox also explicitly scopes to the actor. | A controlled multi-session event-delivery check. No real account's unread history was changed during this audit. |
| Telnyx | Authenticated read-only balance request HTTP 200. Voice environment variables are present locally. | Confirm application/caller-number/SIP configuration, signed webhooks and full call lifecycle; outbound booking/escalation gates remain closed. |
| Dodo | India Care test product HTTP 200: INR 300000 minor units (₹3,000/month), seven-day trial. Test API/webhook secrets present locally. | Fulfill the approved launch products through verified, idempotent webhook events; trial/first charge/renewal/cancellation/refund tests; live keys/products only for production promotion. KWD/BHD/OMR remain unavailable per prior sandbox product checks. |
| Launch entitlements | Launch migration `20261104061149` is absent from live migration history; no `launch_%` tables exist. | Reconcile/apply the additive ledger after backup/rollback preparation; connect shared 15/30 calls, trial 4/7 calls and 2/5 people. Local family acceptance still contains a hard-coded four-person cap, and other code retains legacy catalog semantics. Preserve existing subscribers' purchased terms. |
| AI Companion | Gemini generation, Bedrock ApplyGuardrail and DynamoDB runtime operations verified with synthetic diagnostics. Local hybrid adapter implemented. | Authenticated browser journey, deployment secrets and audit retention/account erasure. See current Companion connection report. |
| Uploads/PhotoMed | Private Supabase send-later and prescriptions upload/sign/fetch/delete verified with disposable objects. Send Later now uses Supabase directly. | Authenticated cross-account playback tests. PhotoMed OCR still uses the old gateway and needs separate replacement. No S3 required. |
| Google Calendar | Client ID/secret, callback URL and token encryption material present locally; calendar event table is readable. | Actual OAuth consent/callback, refresh-token encryption/rotation and event write/retry tests. Calendar-file download needs no OAuth but importing it in an external app was not tested. |
| Scheduled work | Four active cron jobs: family reminders every minute, Send Later/SLA every five minutes, Calendar every fifteen. Recorded runs succeeded. Jobs target `https://www.someonenear.com`; retained HTTP results were JSON HTTP 200, not HTML fallbacks. | Confirm each handler's delivered/failed/retried results and that the deployed origin/secrets match the target app. Scheduler success is not proof that a particular recipient received anything. |
| Cloudflare | Existing `test_front` Worker settings readable with HTTP 200. Its returned binding list is empty. The user-token verification endpoint returned 401, but direct account-scoped Worker access succeeds; that 401 alone is not evidence the Worker token is unusable. | Configure secrets for the actual backend deployment separately from local `.env.local`; verify server routes, domains and provider webhook URLs after deployment. The prototype is not proof of backend readiness. |
| Email/support | `care@someonenear.com` is shown as an enquiry mail link. | Confirm the mailbox is provisioned and receiving mail; verify application SMTP/invitation/recovery delivery independently. A mail link does not configure email delivery. |
| Browser push/WhatsApp/ASSIST | Capability gates for push, voice dispatch, transcription, outbound booking, escalation, family vault sharing, local-day doses and production purchases remain false. | Decide required channels, then add consent, credentials/subscriptions, service worker/VAPID if using Web Push, protected dispatch, retry/idempotency and delivery outcomes before enabling each feature. |

Local environment presence and safe HTTP results are recorded in `../outputs/backend-connectivity-audit.json`. That artifact contains no credential values. Presence is not provider validation; a local secret is not automatically a deployed secret. Previously exposed test assignments in tracked files were already removed in earlier work; rotating any historically committed credential remains advisable.

## Security work before launch

- Cron handlers in this checkout compare incoming credentials to the **public Supabase anon/publishable key**. Replace that gate with a dedicated server-only scheduler secret and verify signature/secret handling at the actual deployed target. Do not rely on a public client key to authorize global delivery jobs.
- Supabase advisors report leaked-password protection disabled. [Password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Advisors flag public-schema `pg_net`, executable SECURITY DEFINER functions and three RLS-enabled tables without policies. Some functions/policy omissions may be intentional; review their definitions and intended roles before changing them. [Function grant guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [RLS policy guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- Notifications also have broad table-level grants including TRUNCATE for anon/authenticated. Review and remove privileges the API roles do not need; RLS ownership predicates do not govern TRUNCATE. No grants or policies were changed by this audit.

## Recommended completion order

1. Finish launch ledger/payment fulfillment and consistent family limits while production purchases/calling remain gated.
2. Resume direct Bedrock/S3 and PhotoMed adapters when AWS is ready.
3. Secure scheduler endpoints and test reminder/calendar/message delivery outcomes.
4. Test Telnyx calls and signed callbacks; configure email delivery and optional push/WhatsApp.
5. Resolve security advisories, configure deployment secrets and run authenticated/provider acceptance journeys before production promotion.

Validation: exact-count/owner-scope/error tests, button count/read-ID tests and Realtime-recovery tests pass. The real popover is checked in the browser; its behavior is stubbed in the focused component harness because the full overlay harness stalled in this environment. TypeScript and the Cloudflare production build pass. No live write-action or paid-provider journey is claimed by these checks.

## Corrected AWS architecture (5 November 2026)

The lowercase AWS variables were present; the earlier uppercase-only check missed them. The user confirmed Gemini generation, Bedrock Guardrails only, DynamoDB summary/safety tables and Supabase uploads. The earlier Nova Lite model and S3 proposal are superseded. Actual runtime permissions succeeded; no administrator access or additional listing permissions are required. See [current connection report](aws-companion-connection.md) for the implemented flow, service diagnostics and remaining deployment checks.
