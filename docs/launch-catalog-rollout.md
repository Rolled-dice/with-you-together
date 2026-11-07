# November 2026 launch catalog

Work branch: `test-worker-ui`. The earlier frontend is recoverable from `../outputs/frontend-before-launch-catalog.zip`; Git author identity was unavailable, so no checkpoint commit was fabricated. The branch has not been pushed or deployed.

## Implemented preview foundation

- `src/lib/launch-catalog.ts` is the source for all 19 approved market prices. Amounts use integer currency minor units. Market-specific identifiers distinguish Cambodia's USD prices from US prices.
- Catalog version `2026-11-launch` defines Care: 15 shared monthly calls, 2 people, 4 shared trial calls; Care Plus: 30 monthly calls, 5 people, 7 shared trial calls. People include the subscription owner. Both use the same feature list.
- First paid month is quoted at 30% off. Full monthly prices follow. Refund deadlines are seven elapsed days after the first successful charge, including delayed charges.
- Landing, account settings, and billing documentation use the same launch pricing component. Country suggestions use the Cloudflare Request.cf.country property, with a US fallback and manual market selection. These are display suggestions, not checkout authorization.
- Currency precision is checked against Intl data. Euro-area mapping includes Bulgaria; membership checked against https://www.consilium.europa.eu/en/topics/the-euro/ in November 2026.
- The existing currency module, Dodo product keys, membership enforcement and quota records retain their previous semantics. Existing subscriptions have not been migrated. Settings labels these as existing purchased terms.
- Production purchase and outbound-call capability gates remain closed. A separate authenticated test-mode checkout is available for supported launch currencies; unsupported currencies stay unavailable for checkout.

## Prepared backend ledger (not applied)

The additive migration `20261104061149_launch_shared_call_ledger.sql` now contains 38 immutable launch prices, versioned billing accounts, separate trial/paid shared call grants, idempotent booking reservations and a 2/5-person family capacity backstop. Eighteen isolated PostgreSQL checks pass. Existing subscribers and pools are unchanged; the migration is not applied and is not wired into checkout/bookings. See `launch-ledger-validation.md` for behavior, reproducible tests, rollback and integration gaps. AWS/Bedrock work is deferred at the user's request.

Dodo sandbox setup created and read back 32 versioned launch products across 16 markets, preserving all four legacy products unchanged. Each new product has the approved monthly amount and seven-day trial with payment authorization required. A product-restricted 30% discount applies for one paid subscription cycle. The test API rejected KWD, BHD and OMR as unsupported currencies, so those six offers retain the requested display prices with checkout unavailable. Public product IDs and results are recorded in `../outputs/dodo-launch-test-mapping.json`.

`launch-checkout.functions.ts` authenticates the actor and validates plan/market input. Its server helper permits test mode only, independently verifies the selected product and discount, derives the return URL from the request origin, and creates a hosted checkout. A browser journey opened the real India Care test checkout: seven days free, ₹3,000 base monthly price, ₹900 first-cycle discount, then ₹2,100 plus provider-calculated GST. No payment was submitted. Returning from checkout does not activate membership; durable webhook fulfillment and the shared ledger are still pending.

## Authenticated route audit

| Surface | Existing implementation | Remaining verification |
| --- | --- | --- |
| Home, globe, policies, billing guide | Public routes and shared prototype components | Public browser checks |
| Authentication and recovery | Email/password and Google/Apple UI already exist | Real provider callbacks, recovery and session expiry |
| Dashboard, Family, invitations | Existing profiles, membership and invitation server functions | Owner/member access, cross-family isolation, new versioned 2/5 caps and pending-invite reservations |
| Listeners and agent console | Existing booking and Telnyx server functions | Versioned shared call grants, atomic reservations, lifecycle reconciliation and real provider callbacks |
| Reminders and Send Later | Existing authenticated functions and delivery hooks | Staging delivery, timezone/DST and cancellation/retry checks |
| Companion and Insights | Existing authenticated routes and quota functions | Shared launch feature access and retention of legacy terms |
| Settings, checkout and Dodo webhook | Existing test/live configuration and signed webhook handling | New market/version product mapping, trial/discount/refund lifecycle, durable retry semantics |
| Staff tools | Existing admin/agent routes | Role separation with actual isolated accounts |

## Next backend work

1. User confirmed the connected live project with-you-together (jflufaxdwzrohslviqeb) on 4 November 2026. The repository connection is updated and the schema has been inspected read-only. Verify a recoverable backup and rollback plan before production mutations. Use designated test accounts and provider test mode within that approved setup.
2. Add reviewed catalog-version snapshots to purchases; absent version means legacy. Avoid deriving new subscriber terms solely from profiles.care_tier.
3. Implement and test server/database enforcement for plan members, pending invitation reservations, shared trial/paid call pools and atomic consumption. A successful first paid charge starts a full paid monthly pool; trial calls are a separate grant.
4. Supported launch markets are mapped to verified Dodo test products without repointing legacy keys. Confirm full trial/first-charge/renewal/cancellation/refund lifecycle and resolve unsupported currencies before enabling production purchase.
5. Add consent audit records, Telnyx verification jobs, protected ASSIST support submission and authorized memory shortcuts. Apply reviewed migrations to the explicitly selected environment with RLS and explicit grants, after backup and rollback verification.
6. Verify authenticated and provider journeys, then promote individual capability gates. Production promotion remains a reviewed deployment step.

## Backend access still needed

The tracked public environment points to the confirmed live project. Local Supabase server access is verified. All five Telnyx voice variables, Gemini and Calendar credentials are present; presence does not verify provider behavior. AWS/Bedrock work is deferred. Dodo test credentials are present in ignored .env.local and supported launch product mappings are verified. The committed .env.development contained test credentials; working-copy assignments are removed without changing effective settings. The user explicitly requested proceeding with sandbox setup. Live Dodo entries are empty and Turnstile integration is not implemented. Configure deployment secrets separately; do not put them in this document or Git. See live-supabase-connection.md for schema drift and remaining verification.

## Verification

The catalog has 24 unit checks covering every approved price, currency precision, market selection/fallback, market-specific USD identifiers, trial/member/call limits, discounted quotes, legacy preservation and delayed-charge refund deadlines. Public browser journeys cover the market selector and shared pricing UI at 320px and 1440px. Full authenticated and provider journeys remain pending against the user-selected live project with designated accounts and provider test mode.

Validation completed: 24 catalog unit checks, six responsive public browser journeys, targeted lint, production build and artwork/backend contract verification.

Latest backend validation: eighteen isolated PostgreSQL checks and all 33 focused catalog/Dodo/config regression tests pass. The first regression attempt hit a Windows sandbox temporary-cache error; rerunning outside the sandbox with a stable temporary directory passed. The guard now includes untracked backend paths and explicitly permits only this new launch migration in addition to the earlier approved connection/display changes. Generated Supabase CLI cache is ignored.
