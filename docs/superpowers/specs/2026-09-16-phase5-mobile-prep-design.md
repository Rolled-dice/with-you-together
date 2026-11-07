# Phase 5: Mobile & Cross-Platform Prep — design

## Why

SomeoneNear is a web app (TanStack Start SSR on Cloudflare Workers) with the
Harbor design system freshly shipped. Phase 5 makes the existing web app feel
more app-like on mobile and establishes a loose-coupling convention that would
ease a *future* Expo/React Native port — without adopting Material 3 (which
would replace Harbor) or starting an Expo migration now (a separate codebase).

Approved scope (from brainstorming, option A + defaults):
- **Not** Material 3 adoption. Harbor stays the design system. We apply
  mobile-app-ui-design *principles* (tap targets, thumb zone, touch feedback,
  safe areas) within Harbor's existing tokens.
- **Not** an Expo migration. `expo-web-to-native` is treated as forward-looking
  guidance; we establish a documented presentational-vs-platform coupling
  convention + one reference refactor, not a codebase-wide restructure.
- Surface: **shared chrome + core primitives** (Q1→a). Everything inherits it.
- Expo-readiness deliverable: **documented convention + one reference refactor**
  (Q2→a).
- Runs on a **fresh branch** (`phase5-mobile-prep`) off the updated `main`.

## Current state (verified, not assumed)

- App shell (`src/components/app-shell.tsx`) already has: mobile bottom nav with
  `env(safe-area-inset-bottom)`, 64px (`min-h-16`) nav tap targets, `min-h-dvh`,
  a mobile top bar, and desktop sidebar. Baseline is decent.
- **Gap — tap targets below 44px:** `Button` default `h-9` (36px), `sm` `h-8`
  (32px), `lg` `h-10` (40px); `Input` `h-9`; `SelectTrigger` `h-9`. All under
  the 44×44pt minimum from mobile-app-ui-design.
- **Gap — no touch feedback:** primitives only style `:hover` (a no-op on
  touch). No active-press (`:active`) affordance, so taps feel dead on mobile.
- **Gap — text-size zoom on iOS:** inputs use `md:text-sm` but base `text-base`
  (16px) — good, that already avoids iOS focus-zoom. Keep it.
- Desktop-only interaction code (`SomeoneNearCursor`, `usePointerParallax`,
  `useCardInteractions`) is already correctly gated to `(pointer: fine)` +
  no-reduced-motion, so it no-ops on touch. Not a defect; it IS a clean example
  of platform-coupled code to name in the convention doc.

## What changes

### 1. Tap-target-safe primitives (Harbor tokens preserved)

Raise interactive primitives to a ≥44px touch target on coarse pointers, while
keeping the current compact sizing on fine pointers (desktop) so the desktop
density Harbor established isn't lost. Approach: use a coarse-pointer media
query so the same component adapts, rather than globally enlarging (which would
bloat desktop).

- Add a `@custom-variant coarse (@media (pointer: coarse))` (or use Tailwind's
  arbitrary `[@media(pointer:coarse)]:` variant inline) so components can bump
  their min-height only on touch devices.
- **Button:** base/`sm`/`lg`/`icon` sizes gain a coarse-pointer `min-h-11`
  (44px) and `icon`/`icon-sm` gain `min-w-11`. Visual height on desktop is
  unchanged. `rounded-brand`, colors, variants all unchanged.
- **Input / Textarea / SelectTrigger:** coarse-pointer `min-h-11`. Keep
  `text-base` (16px) base size (prevents iOS zoom). Radius/colors unchanged.
- **Active-press feedback (touch app-likeness):** add an `active:` state to
  `Button` (a subtle `active:scale-[0.98]` + slightly deeper bg, quick, respects
  the "gentle, not bouncy" Harbor motion principle) and to the shell nav items.
  This is the single biggest "feels like an app" win — taps get immediate
  visual acknowledgement. Gate the scale under no-reduced-motion.
- All within the 8-point grid: 44px = `min-h-11` (Tailwind 11 = 44px, on-grid).

### 2. App-shell mobile polish

- **Bottom nav is horizontally scrollable today** (`overflow-x-auto`) because
  there are 9 member nav items — on a phone that's a scrolling strip, which
  isn't app-like (native apps show ~5 fixed tabs + "More"). Two options
  considered; chosen: keep all items reachable but make the active item
  auto-scroll into view on route change (so the current tab is always visible),
  and add `[scrollbar-width:none]` + momentum (`-webkit-overflow-scrolling:
  touch`) so the strip feels native rather than showing a scrollbar. (A true
  5-tab + More redesign is noted as a possible follow-up but is out of scope —
  it changes IA, not just polish.)
- Add active-press feedback to nav items (per §1).
- Ensure the mobile top bar respects `env(safe-area-inset-top)` (currently
  only the bottom nav handles safe area; notched devices can clip the top bar
  under the status bar in standalone/PWA display mode).

### 3. Loose-coupling convention for future Expo portability (docs + 1 refactor)

Establish, as a durable steering doc, the presentational-vs-platform split that
`expo-web-to-native` says makes a port a "strangle," not a rewrite:

- **Doc:** `docs/architecture/expo-readiness.md` (and a short steering pointer)
  defining three component tiers:
  1. **Presentational** — props in, JSX out, no `window`/`document`/DOM APIs, no
     router imports, no data fetching. Portable to RN as-is (or via a thin
     adapter). Harbor primitives mostly already are.
  2. **Platform-coupled (web-only)** — uses DOM/`window`, pointer events,
     `IntersectionObserver`, GSAP DOM tweens, CSS `env()`, etc. Named explicitly
     (`SomeoneNearCursor`, `use-pointer-parallax`, `use-card-interactions`, the
     landing GSAP motion). These are the "leave in the webview / rewrite native"
     bucket — kept isolated so they don't leak into presentational components.
  3. **Data/route-coupled** — `createServerFn`, `useServerFn`, TanStack Router,
     Supabase browser client. Named so a future port knows these become the
     RN data layer (`expo-data-fetching`) + `expo-router` mappings.
  - The doc records the web→native mapping notes actually relevant here
    (Tailwind classes → RN styles/NativeWind; `env(safe-area-inset-*)` →
    `react-native-safe-area-context`; `Link`/router → `expo-router`; Phosphor
    web icons → `@phosphor-icons/react-native`; the desktop-only interaction
    code is web-only and would simply be dropped natively).
- **One reference refactor:** pick a currently-mixed component and split it into
  a presentational core + a thin web-coupled wrapper, as the worked example the
  doc points to. Candidate: the stats tiles or a small card that currently mixes
  presentation with a web concern. Decided at implementation time based on which
  gives the clearest, smallest demonstrative split. The refactor must not change
  rendered output — it's a structural demonstration, not a redesign.

## Explicitly out of scope

- Material 3 tokens/components (`@material/web`, MD3 color/type/shape). Harbor
  stays.
- Any Expo/React Native scaffolding, `create-expo-app`, or actual migration.
- Redesigning the bottom-nav IA to 5-tab-plus-More (noted as possible follow-up).
- Broad per-screen mobile rebuilds (this is chrome + primitives + one refactor).
- New colors, fonts, or copy.

## Verification

- Build: `bun run build` succeeds; `npx tsc --noEmit` shows only the 2
  pre-existing `vite.config.ts` errors.
- Tap targets: confirm Button/Input/Select/Textarea render ≥44px min-height
  under an emulated coarse pointer (Chromium mobile device emulation
  screenshot), and remain compact under fine pointer (desktop unchanged).
- Touch feedback: active-press state visibly fires on tap (device-emulation
  interaction or a short recording).
- Safe areas: top bar + bottom nav respect insets (visual check with an
  emulated notched device / inset overlay).
- No desktop regression: existing desktop screenshots of key screens unchanged
  in layout (the coarse-pointer variants must not affect fine-pointer rendering).
- Reduced motion: active-press scale is suppressed under
  `prefers-reduced-motion: reduce`.
- Convention doc reviewed for accuracy against the actual codebase (the tiers
  must list real files, not invented ones).
- Playwright public smoke test still passes.

Full accessibility validation (screen readers, real-device touch testing)
remains a manual expert pass out of scope for automated verification.
