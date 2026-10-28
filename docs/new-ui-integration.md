# Family globe redesign

Update, 27 October 2026: the user requested the latest full UI as a frontend-only stage. The branch homepage is now that preview. See [frontend-preview.md](frontend-preview.md) for its behavior and limits. The connected homepage described below is preserved at `/connected-home`; the authenticated screens remain available through their existing routes. This document's connected integration and previous verification results refer to that earlier implementation.

Branch: `feature/new-ui`. Visual reference: the supplied `someonenear_family_globe_ui_figma_prototype.tsx`.

## Connected experiences

The public homepage uses a labelled illustration, never private family data. Feature links preserve their destination through the existing authentication flow. The shared theme applies the reference's cream, navy, coral and gold palette, with a higher-contrast orange for small text. Theme choices persist across pages and respect device preference.

The signed-in family globe displays actual membership and recipient-approved reminder updates through `getMyFamily` and `getFamilyToday`. Member selection opens actual sharing details. Avatar selections retain existing profile identifiers and save through `updateMyProfile`. The existing invitation form, delivery configuration, recipient response, staff verification and capacity rules are unchanged.

Today, My sharing, Health and Calls retain their existing server functions and database policies. Care actions navigate to those real tools, personal reminders, prescription review, Send Later, listener booking and Companion. Personal reminders explicitly select `view=everyday`; prescriptions select `view=medication`. Companion keeps its microphone, editable dictation, consent and authenticated transcription. No action is executed from an inferred voice command.

Chatak-Patak is a browser-only bubble activity in the public and signed-in Calm spaces. Sounds are initially off, synthesised locally after user interaction, and stopped when the page is hidden. No worries or activity history are uploaded. All activities remain keyboard accessible.

## Preserved business rules

- Care and Care Plus prices and inclusions still come from `PLAN_DISPLAY`.
- Existing Dodo checkout and verified payment events remain authoritative. The prototype's alternative currencies, prices, seven-day trial and pretend checkout are not used.
- Payment never bypasses member consent or shares private chats.
- SMS, push and extra-call flags retain their production values. No providers or senders are newly enabled.
- No schema migration, account reset or bulk data update is needed for this visual integration.

## Not implemented by this UI integration

The prototype's expiring family photo/video feed, permanent vault, reaction delivery, downloadable post archives, simulated call approvals, and automatic voice-command execution are not production services. They are not exposed as working controls. Existing text, voice and video messages continue through Send Later, with its actual recipient eligibility, attachments and scheduled release controls. A new general-purpose family media feed requires separate storage policies, retention/deletion jobs, recipient permissions and delivery tests.

## Verification

- TypeScript and production Cloudflare Worker build.
- `tests/e2e/new-ui.spec.ts`: desktop/mobile, both themes, WebGL pixel checks, navigation, Chatak-Patak.
- Family journey and voice-composer browser suites, including consent and avatar persistence.
- Family database, avatar-sharing and delivery unit suites plus voice tests.
- `scripts/check-new-ui.mjs`: real test-account sign-in, prescription navigation, all family tabs, refresh, mobile layout and server-error checks. Credentials are environment variables, never stored in the script.

## Deployment

Verification on 26 October 2026: production Worker build and TypeScript succeeded; 80 backend/voice unit tests passed. Six homepage layout/theme checks, sixteen family browser checks, five existing voice browser checks and the two new public action/activity checks passed across the final runs. The real test-account sign-in and family-screen check passed without creating invitations, bookings, prescriptions or payments.

The current live baseline is Cloudflare version `49b83b6f-f8c5-42ee-9599-b7b7c3d31678` from 8 October. It has not been replaced. Release is held pending the user's choice between deploying this connected redesign first and waiting for the additional media-feed/automatic-voice services described above.

Build with the existing production environment, verify the Supabase project matches the live site, then deploy the generated `.output/server/wrangler.json` with `--keep-vars`. This retains the production feature flags and provider configuration. Record the previous deployment version before deployment and run the same read-only test-account check against `https://www.someonenear.com` afterward. Do not run seeding, create real invitations, place calls or make test payments during this check.
