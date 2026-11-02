# SomeoneNear frontend production-readiness plan

Prepared 1 November 2026. Scope: plan and source audit only; no application refactor or deployment performed.

Updated after the Engineering Addendum. The [contract audit and resolution matrix](frontend-contract-audit.md) records the work on the three initial findings, source-recovery evidence, proposed disabled flags and exact backend limits. Its deterministic rules supersede earlier suggestions to wait for product interpretation or invent replacement behavior.

## Objective and verified baseline

Turn the supplied prototype into the production frontend while preserving the original avatars, established visual identity, existing user journeys, and the backend contracts on main. Apply the attached Principal Frontend Architect brief to frontend work; backend changes require a separate scope.

Fetched and inspected these repository revisions:

- `origin/main`: `64bbe188a672367014431441cecb50e77ea4f31c`.
- `feature/new-ui`: `6b2077e948c0396df8e9bcd07e605dbc8d2b65bf`.
- Current checkout `work` matches the fetched main revision. The feature branch was read without switching branches.

The fetched UI branch contains `src/components/frontend-preview/`, not the `integrated-platform` source and three-second assistive-button/loading changes from the latest preview discussed in chat. The original integrated TSX upload has now been recovered and hashed; the exact later deployed integration was not found in available files, Git recovery data or any of the four remote branch tips. Source recovery is therefore partial. Recover and commit that exact preview source before claiming a faithful migration. Prior deployment success does not establish that its source exists in this checkout. Main's source was reviewed; live services and production credentials were not exercised.

## Findings and release implications

| Priority | Verified evidence | Required response |
| --- | --- | --- |
| P0 | Feature branch differs from main across 266 files, including server logic and migrations. | Start the release integration from pinned main and port reviewed frontend changes. A wholesale merge could alter the finalized backend. |
| P0 | `docs/frontend-preview.md` explicitly describes simulated accounts, local bookings, local file URLs, disabled checkout and reset-on-reload state. | Replace simulations with existing authenticated contracts, one journey at a time. Never treat a demo confirmation as persisted success. |
| P0 | Main's `listeners.functions.ts`, `sla-ladder.server.ts`, `telnyx*.server.ts` and `currency.ts` describe actual phone calls and call entitlements. | Exclude call-backed customer triggers via disabled flags, remove prohibited copy, and preserve backend contracts. Do not relabel phone booking as a notification action. |
| P0 | `notifications.functions.ts` and the notification bell support authenticated in-app notifications and Realtime. No browser-push subscription/delivery contract was established in this review. | Verify deployed push capability, recipient scope, permission and delivery behavior before promising notifications outside an open app. In-app Realtime is not proof of background push. |
| P1 | `frontend-preview/prototype.jsx` has 5,390 lines; its `.d.ts` only declares the outer component. TS config includes TS/TSX; the major ESLint configuration targets TS/TSX. | Incrementally extract typed feature modules; the declaration file does not type-check the JSX implementation. |
| P1 | `themeMode`, `isDark`, dark CSS variants and theme controls occur throughout the prototype. | Lock warm light surfaces and navy text; remove theme controls and migrate old stored theme preferences. |
| P1 | Prototype has combo streaks, fireworks and a “Mega Chatak Wave.” | Remove high-stimulation mechanics; preserve existing calm activities in their existing location. Keep games off the landing page. |
| P1 | Preview workspace uses local view state; existing authenticated routes run separately. | Make TanStack routes the navigation source of truth, preserving direct links, back/forward, refresh and auth redirects. |
| P1 | Feature homepage sets `ssr: false`, with phone-call promises in its metadata. | Render public landing content for crawlers and revise copy/metadata to the agreed notification workflow. |
| P1 | Main's `memories.functions.ts` stores private Companion text memories. | Do not assume it implements a shared photo/voice Family Vault. Verify a matching authorized media contract first. |
| P2 | Preview already has a top-level error boundary; main already has authentication gates, Zod validators, public metadata and icons. | Extend and consolidate existing solutions instead of introducing duplicate systems. |

The evidence above is a source audit, not a measured accessibility or performance score. Build, lint and browser verification are implementation release gates, not claimed outcomes of this planning task.

## Non-negotiable design and product contract

- Warm Cream `#F7F0E5` / existing light alabaster surfaces, Deep Navy `#102F50` text and primary controls. Existing coral `#F36D89`, burnt orange `#D95732` and gold `#EAB84B` remain restrained accents, not alternate themes.
- Put palette values in semantic tokens. All promotional and alert banner backgrounds remain light; meaning must also be conveyed by text and icons.
- Preserve original avatar SVG geometry, images, colors and identity exactly. Extraction may change a module boundary, not its artwork. Record asset hashes and visual baselines before changes; do not optimize avatar assets destructively.
- Desktop sidebar and mobile bottom navigation after sign-in; public marketing navigation before sign-in. Use only existing destinations.
- Remove outbound-call and automated Safety Net promises from the released customer experience. Preserve backend implementation and staff workflows; hide incompatible customer triggers behind disabled flags. Frontend wording must match the operation actually performed.
- For verified, enabled Assist voice capabilities, preserve the existing interaction: hold three seconds to begin voice mode, without an extra application confirmation screen. Unbacked voice capabilities remain hidden behind disabled flags. Browser microphone permission remains browser-controlled. Provide keyboard and accessible activation, cancellation, visible recording state and a text fallback.
- Calm activities only, optional sound, reduced-motion support, no games on the landing page, no new product features.

## Phase 0 — Establish the source and contract baseline

1. Recover the exact latest integrated prototype and compare it with the fetched UI branch and deployed preview. Archive visual baselines for landing, signed-in desktop/mobile, avatars and Assist.
2. Create a frontend release branch from pinned main. Port frontend files selectively; preserve published history. Do not import feature-branch backend changes incidentally.
3. Produce a route/action inventory: UI action, existing function, request/response schema, authentication, role, recipient rules, error cases and persistence check.
4. Classify each existing capability as connected, frontend integration pending, or backend contract missing. Read source and test with isolated accounts before calling it production-ready.
5. Apply the deterministic contract rule: unverified capabilities are hidden behind flags that default to false, including all alternate entry points. Remove customer-facing call/Telnyx/Safety Net copy while preserving backend plan IDs and RPC signatures. No UI check-in may invoke call booking or escalation. Missing contracts do not block unrelated verified features.

Exit: one reproducible source revision and a contract matrix with an explicit enable/disable disposition for every surface. Source fidelity and live integration validation remain prerequisites; missing contracts are handled by exclusion rather than guessed replacements.

## Phase 1 — Modular frontend foundation and brand lock

Keep React, TanStack Start/Router, React Query, Tailwind, Radix and Zod. No framework migration, second router, or replacement authentication system.

Proposed organization (modules, not new product pages):

```text
src/
  routes/                     # Existing public, auth and protected routes
  components/
    brand/                    # Original artwork, unchanged
    layout/                   # Public header/footer, app sidebar/bottom nav
    feedback/                 # Skeleton, empty/error/status components
    ui/                       # Existing accessible primitives
  features/
    family/ reminders/ companion/ send-later/
    insights/ settings/ assist/ # Views, hooks, schemas, API adapters
  lib/
    api/                      # HTTP transport, error normalization
    query/                    # Query keys, cache and mutation policy
    env/                      # Separate public/server environment schemas
    *.functions.ts            # Existing server-function contracts preserved
    *.server.ts               # Existing backend implementation preserved
  styles.css                  # Locked semantic design tokens
tests/
  contracts/                  # Frontend adapter/schema tests
  e2e/                        # Existing journeys and regression coverage
```

- Extract the prototype by feature, preserving rendered appearance and interactions at each step. Use strict TS with `unknown` plus validation at boundaries; no handwritten `any` or suppression-based conversions in frontend modules.
- Use React Query for remote data, local component state for ephemeral controls, and a small provider only for shared UI preferences. Supabase remains the session authority.
- Keep route generation automatic. Use route search parameters where view/filter state should survive a refresh.
- Reuse the branded loader for app bootstrap; use dimension-matched skeletons inside data views rather than replacing the whole page on every request. No artificial loading delay.
- Add route error boundaries and isolated boundaries around globe, charts and voice widgets. Errors must leave navigation usable and provide a safe retry.

Exit: typed shell, real route navigation, immutable avatar baselines, locked theme and functional loading/error/empty/success primitives.

## Phase 2 — Connect existing journeys to main

| Surface | Existing main integration | Preservation/verification requirement |
| --- | --- | --- |
| Sign-in, onboarding, settings | Supabase Auth, `_authenticated/route.tsx`, `profile.functions.ts` | Refresh, expiry, OAuth callbacks, redirect validation and admin/agent/member gates. Never trust a local demo login flag. |
| Family and invites | `family.functions.ts`, family-session functions | Existing invite acceptance, ownership, removal and sharing permissions; no automatic consent. |
| Dashboard and notifications | `notifications.functions.ts`, Realtime, existing dashboard queries | Derive status from real data; unsubscribe on unmount; isolate queries by user; avoid triggering the call SLA fallback in a notification-only check-in. |
| Medication/reminders | `medications.functions.ts`, `reminders.functions.ts` | Keep dose-log semantics and recipient constraints; handle timezone/date boundaries; distinguish saved reminder from delivered push. |
| Companion | `/api/chat`, `conversations.functions.ts`, `quota.functions.ts` | Preserve streaming, cancellation, history, quota and privacy. Do not assume voice/transcription code present only in the UI branch is deployed on main. |
| Send Later | `send-later.functions.ts` | Match existing FormData fields, schedule/cancellation semantics, contacts and authorized media retrieval; uploaded content must persist. |
| Family Vault / voice sharing | Contract verification required | Companion text memories do not equal family media sharing; do not invent storage permissions or recipient mapping. |
| Insights | Existing mood functions and insight queries | Use actual allowed aggregates; no fabricated progress, counts or health values. |
| Billing | `dodo.functions.ts`, `currency.ts`, existing checkout/return routes | Preserve plan IDs, prices and server-confirmed entitlements. Resolve call-based plan bullets before publishing notification-only claims. |
| Calendar | `google-calendar.functions.ts`, existing callback route | Preserve connect/disconnect state, scope and server-side credential handling. |
| Listener/safety surfaces | Existing call and escalation contracts | Hide incompatible customer triggers behind disabled flags, remove prohibited copy, and preserve server/staff behavior. Never route a push action into Telnyx. |

For each connected journey:

1. Load real state with a scoped query key and validated response.
2. Implement loading, error/retry, empty and success states.
3. Validate input with Zod and accessible field messages.
4. Disable duplicate submissions while pending; use existing idempotency support where available. Debouncing alone is insufficient.
5. Optimistically update only safe, reversible actions with rollback. For money, recipients, scheduling and media delivery, wait for authoritative confirmation.
6. Invalidate the affected queries; refresh/re-login to prove persistence. Clear private caches on logout and account switches.

The API layer should standardize error mapping and request behavior while retaining TanStack server-function transport and the official Supabase client. Centralize raw HTTP calls; do not funnel Realtime, streaming or framework RPC through a generic JSON fetch wrapper. Handle 401, 403, 404, 429 and 5xx distinctly; honor Retry-After, cancel obsolete requests, and never automatically retry non-idempotent mutations. Preserve the existing bearer-token middleware contract.

Exit: every released action has a verified backend mapping, failure behavior and persistence proof. Production runtime cannot silently fall back to mocks.

## Phase 3 — Accessibility, mobile and performance

- Verify 320, 375, 390, 430, 768 and 1440+ pixel widths, portrait/landscape and browser zoom. Fix intrinsic grid/flex sizing and long text; do not hide inaccessible overflow with a blanket CSS rule.
- Keep bottom navigation clear of safe-area insets, Assist and the onscreen keyboard. Target at least 44×44 CSS-pixel touch areas.
- Verify WCAG 2.1 AA contrast, semantic landmarks, skip navigation, focus visibility, dialog focus trapping/return, labels and status announcements. Test keyboard-only use, Android TalkBack and iOS VoiceOver on key journeys.
- Keep a static accessible family list alongside the globe. Pause animation offscreen/backgrounded, clean up rendering/audio resources and respect reduced motion. No autoplay audio.
- Split at route/feature boundaries and dynamically load heavy globe, chart, recorder and secondary-modal code. Public landing visitors should not download all authenticated features.
- Reserve dimensions for media and skeletons; self-host/preload only primary fonts with swap and suitable fallbacks. Optimize non-avatar imagery, lazy-load below-fold media and limit eager hero resources.
- Target zero avoidable layout shift in scripted journeys. Field release targets at p75: LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1. Absolute CLS=0 on every device cannot be guaranteed; report measured results rather than promise it.
- Set bundle budgets after baseline measurement and gate regressions in CI. Validate low-end mobile behavior on throttled networks, not just desktop Lighthouse.

Exit: no serious/critical automated accessibility findings, manual journey checks pass, and measured performance meets the agreed budgets.

## Phase 4 — Security, metadata and Cloudflare delivery

- Validate public `VITE_` configuration separately from server secrets. This is Vite/TanStack, so do not add Next.js `NEXT_PUBLIC_` configuration. No service-role, payment, AI or deployment secrets in browser assets.
- Render plain text through React escaping; use an allowlist sanitizer only for intended rich HTML. Validate URLs and permitted protocols. Input validation is not a substitute for authorization.
- Scan frontend bundles/source maps and dependencies; remove production mock flags, test endpoints, fabricated ratings and debug logging. Send redacted actionable errors through the existing error-reporting path, excluding voice content, family health data and credentials.
- Apply CSP, frame-ancestors/X-Frame-Options, nosniff and Referrer-Policy at the actual Cloudflare response layer. Build CSP from real OAuth, Supabase, streaming, media, fonts and payment requirements; validate in report-only staging before enforcement. Static asset headers alone do not cover Worker-generated HTML/API responses.
- Render public pages with useful initial HTML and per-page title, description, canonical, OpenGraph image and Twitter cards. Use a confirmed production origin; verify WhatsApp/social previews. Mark authenticated content and previews noindex.
- Reconcile robots, sitemap, existing icons and manifest with real public routes. Do not claim offline delivery or push support from a manifest alone. Review any recovered service worker for update and private-data caching behavior.
- Give hashed static assets immutable caching; HTML revalidates. Private/authenticated responses must not be shared-cacheable.
- Use a staging deployment of the actual TanStack Worker runtime and the same backend contracts. The prior static `test_front` preview is a design preview, not sufficient proof that authenticated SSR/RPC works.

Exit: security headers and metadata verified on deployed responses; authentication, media, chat and checkout continue working under those headers.

## Phase 5 — Release gates and rollout

Run on the recovered/integrated source revision:

```sh
npm ci
npm run lint
npx tsc --noEmit
npm run test
npm run build
npm run test:e2e
```

Use the repository's lockfile-selected package manager if it differs when the source is recovered. Configure browser prerequisites and isolated test accounts explicitly; do not run payment, messaging or destructive tests against real families.

Required evidence:

- Clean build/type/lint results and passing relevant unit, contract and browser tests. Classify pre-existing backend failures separately; do not change the finalized backend to hide them or claim a clean gate while they remain.
- No application console errors, hydration errors or unexplained warnings on covered journeys. Dependency/toolchain warnings must be resolved or explicitly recorded; a build cannot guarantee every runtime condition is warning-free.
- Landing → sign-in → onboarding/dashboard → family/invite → reminder/dose → Companion → Send Later → settings/logout.
- Session expiry, denied roles, permission denial, offline/timeout, empty data, duplicate submission, upload failure, expired media links and cross-user isolation.
- Assist activation at three seconds, early-release cancellation, microphone denied/unsupported, speech fallback, recording cleanup and truthful send confirmation. Automated mocked tests plus real-device browser checks; an actual recipient/storage contract is required for delivery claims.
- Visual comparisons preserving avatars, light banners, desktop sidebar and mobile bottom navigation; no forbidden call/escalation copy or arcade mechanics in released customer surfaces.
- Cloudflare route/deep-link refresh, headers, cache behavior, SEO previews and rollback rehearsal.
- PR diff confirms backend function implementations, database migrations, RLS, provider settings and generated integration files were not changed by frontend hardening.

Rollout: staging validation → internal test accounts → limited release → monitored public launch. Record the previous Worker version and use version rollback if auth, writes, navigation or error rates regress. Monitor failures, request latency and Core Web Vitals with existing telemetry, without collecting sensitive content. Remove demo code only after replacement journeys pass.

## Delivery order and planning estimate

Deliver as reviewable increments: source/contract inventory; light-theme shell; auth/family; reminders/notifications; remaining existing features; accessibility/performance/security; release verification. Do not wait for a single large rewrite to review behavior.

For one experienced frontend engineer, allow approximately 3–5 working weeks after source recovery and contract resolution. This is a planning range, not a commitment; missing push or media backend support is an external dependency. The first milestone is the recovered source plus contract matrix, followed by a fully connected landing → sign-in → dashboard → family → reminder journey.

## Engineering Addendum — Full-Stack Edge Cases & Resolution Rules

These rules are mandatory frontend requirements. They do not authorize backend modifications or production mocks. Integrate them into the phases above, rather than deferring them until final QA.

### 1. Deterministic contract mismatch rule — zero guessing

- A visual surface without an existing verified contract in main stays hidden behind a validated config flag whose production default is false. Cover UI triggers, deep links, keyboard shortcuts and Assist intent dispatch. Invalid or absent configuration fails closed.
- Family Vault sharing, instant Assist voice dispatch and Companion transcription are separate capabilities. Enabling one never implicitly enables another. A generic microphone API or a scheduled-message endpoint does not establish instant delivery or transcription.
- Every PR updates the linked matrix with contract revision, schemas, role/recipient constraints, default flag and verification evidence. No mock data or success simulation may be imported as a production fallback.
- Keep Dodo plan/price IDs, RPC signatures, quotas and server-side entitlements unchanged. Remove customer-facing outbound-call, Telnyx and Safety Net references from Dashboard, Billing, navigation, icons, docs and metadata using frontend presentation. Do not replace these with unverified push entitlements. Keep staff operations separate from customer navigation.
- Never call `runMySlaLadder`, Telnyx or booking/escalation mutations from a notification check-in action. If no verified push contract exists, its trigger remains hidden.
- Acceptance: production flag defaults are tested; direct route/action invocation cannot bypass them; prohibited endpoint calls are absent from customer check-in network traces; existing price IDs and function signatures are unchanged.

### 2. SSR hydration and timezone safety

- Validate explicit IANA timezone values. Use the same timezone, locale and reference instant for SSR and the first client render. Exchange UTC instants at existing API boundaries; convert only for display and form input using the intended zone.
- If explicit timezone data is unavailable to SSR, render a dimension-matched skeleton and format within a client-hydrated boundary. Do not guess a zone from country, use server-local date defaults, or suppress hydration warnings.
- Compute day ranges as half-open intervals in the selected zone, honoring DST. Relative labels use a stable initial timestamp and begin updating after hydration. `datetime-local` inputs need explicit zone conversion; slicing UTC ISO strings does not produce local wall time.
- The current `listTodaysDoses` contract selects server-local day boundaries without a timezone/range parameter. Frontend formatting cannot guarantee complete local-day data. Record this limit and keep unsupported local-day actions/filters off; do not alter the RPC or display a UTC subset as a complete local day.
- Acceptance: medication, reminders, Send Later and insights are checked across UTC midnight, Asia/Kolkata, a DST-observing zone, DST transitions and a browser zone differing from the explicit user zone. SSR/first-client output matches with no hydration warnings or loading layout shift.

### 3. Multi-tab auth isolation and deep-link session recovery

- Extend the existing single global `supabase.auth.onAuthStateChange` owner. Track the previous authenticated user ID. On `SIGNED_OUT` or a different user ID, immediately gate private rendering, call `queryClient.clear()`, abort/cancel old requests, remove prior-user subscriptions and clear ephemeral private state. Do not clear valid caches on ordinary token refresh for the same user.
- Guard asynchronous completion by session generation so old requests cannot repopulate caches after an account switch. Query keys include user/family scope. Cleanup and invalidation must not wait for a slow network request before hiding private content.
- Redirect sign-out to auth with a validated internal return path; redirect account switches through the authenticated role/session gate before showing new-user data. Verify Supabase cross-tab event propagation. Add a single non-secret same-origin event bridge only if testing shows it is needed; never broadcast tokens or payloads.
- Keep auth event handling synchronous/nonblocking; defer additional auth SDK work to avoid callback reentrancy. Register once and unsubscribe on teardown.
- On protected deep-link refresh, display the branded bootstrap loader while resolving/refreshing the session. Only then enable protected queries with the established bearer-token attachment. Server middleware remains the authorization authority. Missing/expired sessions redirect safely without firing unauthorized data requests or flashing private content.
- Acceptance: two-tab sign-out and A→B account switch; in-flight slow response during logout; expired session on a nested URL; browser back/forward; admin/agent/member routing; no stale private content, duplicate global listeners or unhandled refresh races.

### 4. Notification permission and subscription visibility

- Dashboard and Settings use existing feedback components to report real `Notification.permission`: `default`, `granted`, or `denied`; also handle unsupported APIs and insecure contexts without throwing during SSR.
- Permission is separate from subscription and delivery. `granted` means browser permission, not a registered push subscription, a successful device delivery, or proof that OS-level focus/notification settings permit alerts. Where the platform does not expose OS suppression, do not claim it is detectable.
- Inspect a service-worker subscription only if that capability exists; require a verified main contract before registering/saving one. With no contract, show that background push is unavailable and keep its enable/check-in trigger hidden. Existing in-app notifications can continue independently.
- Request permission only following an explicit user gesture and only for a backed capability. For denied permission, show concise browser-settings guidance; do not repeatedly prompt. Refresh status on focus/visibility return because settings can change outside the app.
- Acceptance: default/granted/denied/unsupported, granted-without-subscription, revoked permission and unavailable delivery contract all produce truthful UI with no fake delivered confirmation.

### 5. Cross-browser MediaRecorder and resource cleanup

- For a backed Assist or Send Later action, verify `getUserMedia`, secure context and `MediaRecorder` support. Negotiate formats with `MediaRecorder.isTypeSupported` rather than user-agent detection: probe appropriate audio MP4 and WebM/Opus alternatives, and corresponding video types when applicable.
- Preserve the selected/actual MIME through Blob, File and filename extension. Do not label MP4 bytes as WebM. Validate against `send-later.functions.ts` and `send-later.server.ts`: intended kind, file presence, 25 MiB maximum, recipient fields and supported schedule semantics. The server extension helper is not a formal MIME allowlist; document the distinction and test actual playback/upload compatibility.
- Stop every active stream track on unmount, cancellation, error, logout and completion. Handle a permission request resolving after cancellation by immediately stopping its newly returned tracks. Also clean up when MediaRecorder construction fails after access succeeds.
- Stop recorder/timers safely, remove handlers, prevent late callbacks from updating unmounted state, and revoke each object URL on replacement and disposal. Retain a preview URL only while it is still in use. Release pointer/hold timers on cancellation and route change.
- Unsupported recording gets an existing permitted upload/text fallback; hidden unbacked dispatch remains hidden. A permission grant never enables an otherwise disabled capability.
- Acceptance: real iOS Safari and Android Chrome recordings, selected-MIME upload/playback, denied permission, oversized file, route exit while recording, rapid cancel/restart and late permission grant. Automated mocks alone are insufficient device verification.

### 6. Realtime wake/reconnect recovery

- Own one Realtime subscription lifecycle per authenticated scope. On `visibilitychange` to visible or network `online`, recheck the session, then invalidate only that user's relevant Dashboard, notifications and reminder query keys. Reconcile from authoritative queries because missed Realtime events need not replay.
- Coalesce repeated wake/online signals and avoid parallel reconciliation storms. Use bounded backoff for failed queries. Preserve visible prior data with a stale/reconnecting indicator instead of clearing the UI or reporting an empty result on network failure.
- Let the SDK reconnect existing healthy/reconnecting channels. If replacement is required after terminal failure, remove the old channel before creating another. Unsubscribe on scope change, sign-out and unmount; ignore callbacks from previous session generations.
- Realtime payloads invalidate/query authorized data; they never trigger call escalation, duplicate a mutation or prove push delivery. Coordinate React Query's focus/reconnect behavior with the explicit handler to avoid redundant fetches.
- Acceptance: prolonged backgrounding, airplane-mode recovery, repeated online/visibility events, StrictMode remount, channel error and account switch during reconnect. Latest authorized data returns, and channel count does not grow with each cycle.

## Revised execution sequence and release evidence

1. Finish source recovery/provenance and carry the linked matrix into every PR. Missing contracts now have deterministic disabled dispositions; they do not require guessing or backend rewrites.
2. Implement the warm-theme typed shell plus validated capability flags and the global auth boundary before connecting private views.
3. Connect existing contracts with scoped queries, four-state feedback and deterministic timezone rendering. Introduce permission visibility and Realtime recovery alongside notifications.
4. Integrate MIME negotiation and resource ownership when connecting the existing scheduled Send Later flow. Keep unverified instant Assist/transcription/Vault dispatch hidden.
5. Complete visual, accessibility, performance, security and metadata hardening, then run the existing build/type/lint/test gates plus all six addendum acceptance groups.
6. Deploy the real Worker application to staging, verify with isolated accounts on desktop, iOS Safari and Android Chrome, and release only backed surfaces with a tested rollback.

Updated planning estimate remains 3–5 working weeks after source recovery, subject to measured integration complexity. Missing contracts are excluded through disabled flags, not assigned imaginary backend delivery dates. Public copy must accurately describe the enabled subset; a notification-only product cannot claim background check-ins are live while the push flag remains off.
