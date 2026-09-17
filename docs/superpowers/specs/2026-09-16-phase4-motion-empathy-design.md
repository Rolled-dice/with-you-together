# Phase 4: Motion & Empathy — landing page motion pass

## Why

The landing page (`src/routes/index.tsx`) is SomeoneNear's first-impression
surface. Phase 4 adds subtle, calming motion that reinforces the warm,
trustworthy Harbor identity — without tipping into the "scattered motion on
every card" effect the Harbor design spec was explicitly written to avoid.

This pass is deliberately restrained. It does NOT add scroll-driven
"storytelling" choreography (pinning, scrubbed timelines, parallax). It
does three focused things: unify the existing scroll-reveal onto GSAP for
smoother easing, add a calm settle to the one genuine loading/data surface
(live stats), and add gentle hover feedback to the trust signals and CTAs.

Approved scope (from brainstorming):
- Option (b) on the restraint question: stay within the Harbor spec's "one
  deliberate moment per screen, gentle only" rule. No new storytelling.
- Q2 → (a): landing page (`index.tsx`) only. No authenticated app screens,
  no shared primitives (Button/Card) globally — the calm restraint on the
  authenticated app stays intact.
- Q3 → (a): replace the existing plain-CSS `data-reveal` IntersectionObserver
  reveal with a GSAP + ScrollTrigger equivalent, unifying on one animation
  system.
- Hover taste (controller ruling, "ok" from user): a hybrid — a very subtle
  lift (~2px translateY) plus a soft shadow/border settle, quick (~0.25s,
  `power2.out`). Reads gentle and responsive without being bouncy. Easy to
  flip to color-only later if the movement reads wrong in-browser.

## Binding constraints (carried from the Harbor spec + existing conventions)

- **Reduced motion is non-negotiable.** Every animation added here MUST be
  wrapped in `gsap.matchMedia()` with a `reduceMotion:
  "(prefers-reduced-motion: reduce)"` condition. When reduced motion is
  requested, content renders in its final state instantly (no fade, no
  rise, no count-up, no hover movement) — matching how the current CSS
  reveal already behaves.
- **SSR safety.** This is a TanStack Start SSR app. All GSAP/ScrollTrigger
  code runs client-only, inside `useGSAP()` — never at module scope during
  render. `gsap.registerPlugin(useGSAP, ScrollTrigger)` at module top is
  fine (matches the existing `ai-snippet-preview.tsx` pattern).
- **One reveal per section, gentle.** The reveal stays exactly as restrained
  as today: one fade+rise per section as it enters, `once: true` (never
  re-animates on scroll-back), short distance (~16px), calm ease
  (`power2.out`), ~0.5s. No per-child staggering of every card within a
  section beyond what already exists inside the preview components.
- **Cleanup.** `useGSAP` with a `scope` handles revert automatically; the
  hover handlers use `contextSafe` so they're cleaned up too. No manual
  ScrollTrigger leaks.
- **Do not touch** the two components that already own their own GSAP
  (`CallCardPreview`'s breathing dot, `AiSnippetPreview`'s line stagger) —
  they're correct and self-contained.
- **24px Fraunces floor** and all other Harbor type/color rules still apply
  — this pass adds no new text, only motion.

## What changes

### 1. Unified scroll reveal (replaces the CSS IntersectionObserver)

Current: `index.tsx` has a `useEffect` that runs an `IntersectionObserver`
over every `[data-reveal]` element, adding an `.in-view` class; the actual
fade+rise is defined by the `[data-reveal]` / `[data-reveal].in-view` rules
in `src/styles.css`.

New: replace that `useEffect` with a `useGSAP` block that uses
`ScrollTrigger.batch()` over the same `[data-reveal]` elements, animating a
gentle fade + rise as each enters, `once: true`. The `[data-reveal]`
attribute stays on the same sections (no JSX section changes needed beyond
possibly setting an initial hidden state) — only the mechanism changes.

- Batch reveal: `gsap.from(batch, { autoAlpha: 0, y: 16, duration: 0.5,
  ease: "power2.out", stagger: 0.08, overwrite: true })` on `onEnter`, with
  `start: "top 88%"` (close to the current `rootMargin` behavior).
- Reduced motion: inside the `reduceMotion` branch, `gsap.set("[data-reveal]",
  { autoAlpha: 1, y: 0 })` immediately and create no ScrollTriggers.
- The `[data-reveal]` / `.in-view` CSS rules in `styles.css` are removed
  (or the JSX stops relying on them) so there is exactly one reveal system,
  not two. Because GSAP now sets the initial hidden state via `autoAlpha`,
  the CSS opacity:0 default must not fight it — the cleanest approach is to
  have GSAP own both the initial hidden state and the reveal, and delete the
  `[data-reveal]{opacity:0;...}` CSS block. This must be verified carefully:
  with SSR, the section is server-rendered visible; GSAP sets it hidden on
  mount then reveals on scroll. To avoid a flash-of-visible-then-hidden on
  first paint, GSAP's initial `gsap.set([data-reveal], { autoAlpha: 0 })`
  runs synchronously inside `useGSAP` (which uses `useIsomorphicLayoutEffect`),
  before browser paint — acceptable and standard. The reduced-motion branch
  never hides, so reduced-motion users never risk a flash.

### 2. Calm settle on the live-stats numbers (the one real "loading state")

The live-stats section (`People here / Listener calls held / Check-ins
shared`) is SSR-loaded (numbers present on first paint) then polled every
20s via `useLiveStats`. So there is no spinner-style loading state — the
appropriate "polished loading" motion here is a **count-up settle** when the
section first reveals: the numbers count from a lower value up to the real
value once, as the section scrolls into view.

- On the stats section's reveal (tied into the same batch, or its own
  ScrollTrigger with `once: true`), animate each number from 0 (or a value
  ~30% below target) up to its real value using a GSAP tween on a proxy
  object with `onUpdate` writing the formatted number, ease `power2.out`,
  ~1s. Respect the existing `formatCount` formatting (the "k+" suffix logic).
- Reduced motion: show the final numbers immediately, no count-up.
- The number must remain correct if `useLiveStats` updates it later (poll):
  the count-up only runs once on first reveal; subsequent live updates just
  set the value directly (no re-animation on every poll — that would be the
  "scattered motion" the spec forbids). This means the count-up reads the
  target from the current `stats` value at reveal time.

### 3. Gentle hover on trust signals + CTAs

Targets (landing page only):
- The 3 "Who answers, and how it works" trust cards.
- The primary CTA buttons (hero "Start your journey" / "Open SomeoneNear",
  and the campaign-banner "Bring someone near" button).

Behavior: on pointer-enter, a subtle lift (`y: -2`, ~0.25s, `power2.out`)
plus a soft shadow settle (e.g. tween a `--tw`-independent boxShadow, or add
a shadow via GSAP); on pointer-leave, settle back (`y: 0`, shadow off).
Implemented with `contextSafe`-wrapped handlers so cleanup is automatic.

- Only attach on devices with a fine pointer and no reduced-motion
  preference — reuse the `gsap.matchMedia` conditions
  (`(hover: hover) and (pointer: fine)` + `(prefers-reduced-motion:
  no-preference)`). On touch / reduced-motion, no hover motion is attached
  at all (the elements still have their normal CSS `:hover` color states
  from Harbor, which are untouched).
- The lift is small and quick by design — this is "gentle and responsive,"
  not a bouncy card-tilt (the spec explicitly removed `card-tilt`/`card-glow`
  in the Harbor pass; we are not reintroducing those).

## Explicitly out of scope

- Any authenticated app screen (dashboard, listeners, companion, etc.).
- Shared primitives (`Button`, `Card`) as global components — the hover
  motion is attached on the landing page's specific instances only, not
  baked into the `Button`/`Card` components (which render app-wide and must
  stay calm per the spec).
- Scroll pinning, scrubbed timelines, parallax, horizontal scroll, or any
  "storytelling" choreography.
- New copy, new sections, new colors, new fonts.
- The two self-contained preview components' existing animations.

## Verification

- Build: `bun run build` succeeds; `npx tsc --noEmit` shows only the 2
  pre-existing `vite.config.ts` errors.
- Reduced motion: with `prefers-reduced-motion: reduce` emulated, every
  section is visible immediately, numbers show final values with no
  count-up, and hovering a CTA/trust card produces no movement. Verify via a
  Playwright/Chromium screenshot run with `reducedMotion: "reduce"` (the
  same technique already used to verify the Harbor landing page).
- Full motion: with motion allowed, sections fade+rise once on scroll-in,
  stats count up once, CTA/trust hovers lift gently. Verify no
  flash-of-hidden-content on first paint (SSR), and no re-animation on
  scroll-back-up (`once: true`).
- No regressions: the two preview components still animate as before; the
  Playwright public smoke test still passes (landing loads, title renders).
- One-reveal-system check: grep confirms the old `[data-reveal]` CSS reveal
  rules and the `IntersectionObserver` are gone from `styles.css` and
  `index.tsx` respectively, replaced by the single GSAP system.

Full accessibility validation (screen reader, AT walkthrough) remains a
manual expert task out of scope for automated verification here.
