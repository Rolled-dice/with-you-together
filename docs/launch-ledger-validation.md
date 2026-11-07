# Launch call ledger — prepared, not deployed

AWS/Bedrock integration is deferred at the user's request. This change prepares billing and family enforcement independently.

The CLI-generated migration `20261104061149_launch_shared_call_ledger.sql` is additive. It contains 38 immutable market/plan prices matching `launch-catalog.ts`, version-bound billing accounts, separate trial/paid grants and shared call reservations. The migration has **not** been applied to hosted Supabase, and no purchase or booking capability has been enabled.

## Behavior covered

- Care: two people including owner, four seven-day trial calls and fifteen paid-period calls. Care Plus: five people, seven trial calls and thirty paid-period calls.
- Billing account rows reference immutable catalog terms; existing subscriptions and calendar-month session pools are untouched.
- Grant issuance and reservation changes serialize using a billing-account row lock. Repeated event/booking IDs do not replenish or double-spend calls. Distinct delivery IDs for the same billing period reuse its existing grant.
- Reservation release is idempotent and cannot release a consumed call. Reusing a released booking is rejected. Authorized callbacks can finish an existing reservation after its grant expires.
- An expired trial grants no new booking access. The first successful paid charge starts a fresh full paid pool. Refund eligibility ends 168 hours after that actual charge; a later renewal cannot move the timestamp forward.
- New live catalog accounts activate database seat checks on family membership and invitations. Pending, unexpired `pending`/`verification_pending` invitations reserve seats. Member insertion supports the existing verification transaction's insert-before-accept ordering. Legacy families without a launch account are unaffected.
- Tables have RLS and explicit server-only grants/policies. Public RPCs use SECURITY INVOKER and are executable only by service_role; actor IDs must come from authenticated server context. The family-capacity SECURITY DEFINER trigger lives in a non-exposed schema, has an empty search path and no browser execution grant.

## Local verification

Eighteen checks pass against isolated PostgreSQL using pinned PGlite 0.5.15. The fixture models the live table columns used by the migration; it is not a full copy of the live schema. No environment file is read and no network/database/provider request is made by this suite.

All 33 focused catalog, Dodo signature/status and Dodo environment/configuration regression tests also pass. The original-artwork/legacy-backend guard passes, with this additive migration explicitly allowed and untracked backend files included in its check.

From the repository, with Node 22:

```powershell
node --experimental-strip-types scripts/test-launch-ledger.mjs ../work/billing-sql-tests/node_modules/@electric-sql/pglite/dist/index.js
```

The temporary package is installed outside app dependencies. Alternatively install `@electric-sql/pglite@0.5.15` into an isolated tooling folder and pass its `dist/index.js` path.

The checks cover all catalog rows, browser role denials, RLS, immutable terms, family ownership, exhausted pools, idempotent replay, consume/release behavior, cross-user authorization, trial expiry, delayed first payment, renewal overlap, owner-inclusive 2/5 seat caps, pending reservations, legacy-family preservation and test/live account separation.

PGlite uses a single exclusive database connection. The queued-request test proves bounded sequential execution, **not** independent-connection contention/deadlock behavior. Run real parallel PostgreSQL transactions and the complete existing family-command integration before enabling the capability.

## Payment product inspection

Read-only GETs for all four configured Dodo test products returned HTTP 200. USD products are $49/$79. INR products remain the legacy ₹3,999/₹6,499. All four products report zero trial days, zero built-in discount, and required trial payment methods. No product was modified and no checkout was created.

Keep legacy product IDs unchanged. The new launch needs a separately verified mapping for each market and plan, seven-day trial authorization and a single paid-cycle 30% discount. The refund window must use the verified successful payment timestamp, not subscription activation or browser return parameters. Dodo documentation confirms that subscription-cycle discounts need an explicit cycle count; omitting it allows recurring discounts: https://docs.dodopayments.com/api-reference/discounts/create-discount

## Remaining rollout work

1. Reconcile the migration with the complete live schema and test independent-connection locking, member removal, account-family binding, cancellation and existing consent verification commands. The existing live family command still gates creation/invites to Care Plus; adapt it for versioned Care eligibility before enabling the new offer. Admission when binding an already-populated family also needs validation in that integration.
2. Integrate authenticated server wrappers and transactional booking creation/reservation. Call the ledger only from verified callbacks and authenticated context; browser-provided actor IDs or payment claims are insufficient. Define staff settlement and cancellation/refund consumption rules explicitly in that integration.
3. Add durable provider-event processing, out-of-order reconciliation, refunds/disputes and product/version matching. The existing webhook's retry behavior is not repaired by this migration. A historical event must not reactivate canceled/suspended access through an unreviewed handler.
4. Rotate the previously committed Dodo test API key and webhook secret, then verify new product mappings, mandate/trial behavior and first-paid discount in provider test mode.
5. Verify backup/restore and rollback against the selected live project before applying. After applying, run advisors and role/isolation tests with designated accounts. Keep capability gates closed until these checks pass.

Before the ledger is used, rollback is removal of its two family triggers, two public functions, four launch tables and the isolated `launch_internal` schema. After any real purchases, preserve/export the ledger and reconcile entitlements before rollback; dropping it would discard purchased call records.
