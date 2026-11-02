# Frontend implementation status — 2 November 2026

Branch: `feature/frontend-production`, based on main `64bbe18`. This branch is a reviewable implementation, not an approved production release. No deployment or backend/provider change was performed.

## Implemented

- Recovered original TSX reference archived at `docs/reference/original-integrated-platform.tsx.txt`, with a SHA-256 and SVG geometry preservation check. The later deployed integration remains unavailable; this is not represented as an exact recovery of that build.
- Responsive public landing page, original illustrated avatars, locked warm cream/navy tokens, local licensed Figtree font, public navigation and existing authenticated sidebar/bottom navigation. Small-screen menu waits for hydration before enabling interaction.
- Dashboard connected to main's profile, family and reminder functions, with runtime response schemas and loading/error/empty states. Existing connected Family, Medication, Companion, Settings and Insights views retain main's contracts and gain targeted error/retry, privacy and timezone corrections.
- Validated, source-controlled capability flags default off for shared Vault media, instant Assist dispatch, Companion transcription, push check-in, outbound booking, escalation, unsupported local-day dose controls and new purchases. Protected route gates block checkout/listener entry. Existing billing IDs, amounts, subscription management, staff operations and backend functions are preserved.
- Branded bootstrap/skeleton states, shared inline retry feedback, route/session boundaries, immediate cache clearing on sign-out/account change, same-user refresh handling and generation guards for new async adapters. Journal rollback cannot repopulate a previous account's cache.
- Notification permission visibility in Dashboard and Settings. It accurately distinguishes browser permission from unavailable background push delivery. Notifications use a scoped query and one authenticated Realtime channel owner with coalesced foreground/network reconciliation.
- Send Later uses real scheduled-message contracts, validated family recipients, supported recording MIME negotiation, matching file extensions, size checks, owned playback URLs and cleanup on cancellation/error/unmount/late permission grant. Scheduled delivery is never presented as instant Assist dispatch or as an OS delivery receipt.
- IANA-zone scheduling conversion rejects ambiguous/nonexistent DST wall times. Reminders and Insights use explicit timezone formatting. The backend's unsupported local-day dose query is gated, not rewritten.
- Public metadata, manifest, response security/cache configuration, and readiness CI. CSP is report-only pending staging checks; no claim of enforced strict CSP is made.
- Fixed the existing dependency installation/lockfile mismatch and made the `entities@4.5.0` requirement already used by Vite explicit for npm installation.

## Verification completed

| Check | Result |
| --- | --- |
| Production Cloudflare-target build | Passed |
| TypeScript, including Nitro configuration | Passed |
| Unit tests | 84 passed across 17 suites |
| Targeted changed-frontend ESLint | Passed, no warnings in the checked implementation modules |
| Public Playwright navigation at 320/390/768/1440 px | Passed; no horizontal overflow or application page errors in tested journeys |
| Signed-out deep-link recovery | Passed; `/send-later` redirects to sign-in |
| Original avatar geometry/reference hash | Passed |
| Protected backend diff against main | No changes to function/server modules, API routes, migrations or generated integrations |
| `git diff --check` | Passed |
| Repository-wide ESLint | **Fails:** 2,526 errors and 29 warnings, predominantly existing formatting plus existing lint debt. Do not suppress this release gate. |

Browser screenshots from verification: `/tmp/sn-production-320.png`, `/tmp/sn-production-390.png`, `/tmp/sn-production-768.png`, `/tmp/sn-production-1440.png`. Automated recording tests use browser mocks; they are not evidence of real-device codec compatibility. No field Core Web Vitals, screen-reader certification or live provider delivery claim is made.

## Outstanding production gates

1. **Staging configuration:** both active environment readiness and its configuration draft still expose only Cloudflare secrets. `TEST_EMAIL` and `TEST_PASSWORD` are absent. Existing local Supabase configuration has not been confirmed as staging. Use a dedicated staging project/base URL and test accounts; do not post passwords in chat. Live writes and signed-in end-to-end checks have not been performed.
2. **Real sessions:** verify sign-in/OAuth, account A→B, cross-tab sign-out, role restrictions, family/invites, permissions, message persistence/playback, calendar, subscription management and error/retry behavior using isolated accounts.
3. **Devices:** test recording, microphone revocation, backgrounding/reconnect and reduced motion on actual iOS Safari and Android Chrome; complete keyboard/screen-reader and automated accessibility audits.
4. **Deployment:** verify generated headers on actual Worker HTML/RPC responses, finalize nonce/hash-based strict CSP from staging evidence, rehearse rollback and assess the deployed Worker size against the account limits. Do not promote the earlier static design preview as proof of backend integration.
5. **Repository debt:** address existing lint failures through an agreed follow-up that respects the backend freeze. Build output still includes existing backend `inputValidator` deprecations and dependency/tooling notices; these were not hidden or fixed by editing backend contracts.
6. **Performance and completeness:** measure LCP/INP/CLS and bundle budgets under mobile throttling, complete the remaining application-wide strict-type/schema/error-state audit, and verify every contract-matrix row before enabling any new capability. The current pass is not a claim that every legacy view has been fully refactored.

Run `npm run typecheck`, `npm run test`, `npm run build`, and `npm run verify:frontend-contracts` locally. The existing `npm run lint` remains the full-repository gate. Public browser checks are in `tests/e2e/production-frontend.spec.ts`; signed-in checks require the staging configuration above.
