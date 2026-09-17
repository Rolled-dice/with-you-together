# Phase 4 Motion & Empathy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Also consult the gsap-react and gsap-scrolltrigger skills.

**Goal:** Add restrained, calming GSAP motion to the SomeoneNear landing page (`src/routes/index.tsx`) only: unify the scroll-reveal onto GSAP ScrollTrigger, add a count-up settle to the live-stats numbers, and add gentle lift-on-hover to the trust cards and primary CTAs. All reduced-motion-safe and SSR-safe.

**Architecture:** All motion is landing-page-scoped. A single new `useGSAP` block in `index.tsx`'s `Landing` component replaces the existing plain-CSS `IntersectionObserver` reveal (`useEffect`) and its `[data-reveal]` CSS rules in `styles.css`. GSAP (`gsap@3.15.0`, `@gsap/react@2.1.2`) and `ScrollTrigger` are already installed and already used by `ai-snippet-preview.tsx` — this plan follows that file's established pattern (`gsap.registerPlugin(useGSAP, ScrollTrigger)` at module scope, `gsap.matchMedia()` for reduced-motion). No new dependencies. No shared primitive (`Button`/`Card`) is modified — hover motion is attached to the landing page's specific element instances via refs + `contextSafe` handlers.

**Tech Stack:** React 19, TanStack Start (SSR, file-based routing), GSAP 3.15 + @gsap/react 2.1 + ScrollTrigger, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-16-phase4-motion-empathy-design.md`

## Global Constraints

- Every animation MUST be gated by `gsap.matchMedia()` with a `reduceMotion: "(prefers-reduced-motion: reduce)"` condition. Under reduced motion: sections render final/visible immediately, numbers show final values (no count-up), hovers produce no movement. This matches the current CSS reveal's reduced-motion behavior exactly.
- All GSAP runs client-only inside `useGSAP` (which uses an isomorphic layout effect) — never at module scope during render. `gsap.registerPlugin(...)` at module top is fine.
- Only `src/routes/index.tsx` and `src/styles.css` are modified. No component files, no authenticated screens, no shared primitives.
- The reveal stays one-per-section and gentle (fade + ~16px rise, `power2.out`, `once: true`). No re-animation on scroll-back. No parallax/pin/scrub/storytelling.
- Do not modify `CallCardPreview` or `AiSnippetPreview` — their existing self-contained GSAP is correct and must keep working.
- Run `npx tsc --noEmit -p tsconfig.json` and `bun run build` after changes; only the 2 pre-existing `vite.config.ts` errors are acceptable. Then verify reduced-motion + full-motion behavior via Chromium screenshots.
- SSR flash guard: because sections are server-rendered visible, GSAP must set the hidden initial state (`autoAlpha: 0`) synchronously inside `useGSAP` before paint, and the reduced-motion branch must never hide anything. Verify no flash-of-hidden-then-revealed on first load and no flash-of-visible-then-hidden.

---

## File Structure

- **Modify:** `src/routes/index.tsx` — replace the `IntersectionObserver` `useEffect` with a `useGSAP` block (reveal via `ScrollTrigger.batch()` + stats count-up + CTA/trust hover handlers). Add refs to the stats section, the 3 trust cards, and the CTA buttons. Add GSAP imports.
- **Modify:** `src/styles.css` — remove the now-unused `[data-reveal]` / `[data-reveal].in-view` / reduced-motion reveal CSS block (GSAP now owns reveal). Leave everything else untouched.
- No new files, no deleted files, no new dependencies.

---

## Task 1: Replace the CSS reveal with a unified GSAP ScrollTrigger reveal

**Files:**
- Modify: `src/routes/index.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `gsap`, `useGSAP` from `@gsap/react`, `ScrollTrigger` from `gsap/ScrollTrigger`.
- Produces: the same visual reveal (fade + rise, once per section) driven by GSAP instead of CSS+IO. The `[data-reveal]` attribute stays on every section it's on today (no section markup removed).

- [ ] **Step 1: Add GSAP imports and plugin registration**

At the top of `src/routes/index.tsx`, after the existing imports, add:
```tsx
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
```
(Note: `useEffect`/`useState` are already imported from `react` at the top — check the existing `import { useEffect, useState, type ComponentType } from "react"` line and add `useRef` to it rather than duplicating the `react` import. Adjust to a single combined import.)

Then after all imports, at module scope:
```tsx
gsap.registerPlugin(useGSAP, ScrollTrigger);
```

- [ ] **Step 2: Remove the IntersectionObserver useEffect**

In the `Landing` component, delete the entire `useEffect` block that queries `[data-reveal]`, checks `prefers-reduced-motion`, and runs the `IntersectionObserver` (the block starting `useEffect(() => { if (typeof window === "undefined") return; const els = document.querySelectorAll<HTMLElement>("[data-reveal]"); ...`). It will be replaced by the `useGSAP` block in Step 3.

- [ ] **Step 3: Add a scope ref and the useGSAP reveal**

Add a scope ref to the `Landing` component (near the top, with the other hooks):
```tsx
const rootRef = useRef<HTMLDivElement>(null);
```
Attach it to the outermost `<div className="min-h-screen overflow-x-hidden bg-background text-foreground">` — change it to `<div ref={rootRef} className="...">`.

Add the reveal `useGSAP` (after the existing auth `useEffect`s, replacing the deleted IO effect):
```tsx
useGSAP(
  () => {
    const mm = gsap.matchMedia();
    mm.add(
      {
        reduceMotion: "(prefers-reduced-motion: reduce)",
        fullMotion: "(prefers-reduced-motion: no-preference)",
      },
      (context) => {
        const { reduceMotion } = context.conditions as { reduceMotion: boolean };
        const sections = gsap.utils.toArray<HTMLElement>("[data-reveal]");
        if (!sections.length) return;

        if (reduceMotion) {
          gsap.set(sections, { autoAlpha: 1, y: 0 });
          return;
        }

        // Own the hidden initial state synchronously (useGSAP runs in a
        // layout effect, before paint) so SSR-visible sections don't flash.
        gsap.set(sections, { autoAlpha: 0, y: 16 });

        ScrollTrigger.batch(sections, {
          start: "top 88%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              autoAlpha: 1,
              y: 0,
              duration: 0.5,
              ease: "power2.out",
              stagger: 0.08,
              overwrite: true,
            }),
        });

        // Sections already above the fold on load won't fire onEnter for a
        // "top 88%" start if they're already past it, so reveal any that
        // start in view immediately.
        ScrollTrigger.refresh();
      },
    );
    return () => mm.revert();
  },
  { scope: rootRef },
);
```

Note on the above: `ScrollTrigger.batch` with `start: "top 88%"` and `once: true` will fire `onEnter` for elements that are below the 88% line at load and animate them in as they scroll up into view; elements already within/above the viewport at load fire `onEnter` on the first refresh. Verify in Step 6 that the hero (top of page, above the fold) reveals on load rather than staying hidden. If the hero does NOT auto-reveal (because it's already above the `start` line at load and batch doesn't fire onEnter for it), adjust by either (a) giving the hero `start: "top bottom"` semantics via a slightly higher start, or (b) explicitly animating the first section in on mount. Prefer the simplest fix that makes the hero reliably appear on load; document which you used in the report.

- [ ] **Step 4: Remove the `[data-reveal]` CSS block from styles.css**

In `src/styles.css`, delete this block (around lines 283-298):
```css
/* Scroll-triggered reveal — opt in with data-reveal. Toggled by IO in Landing. */
[data-reveal] {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1),
              transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity, transform;
}
[data-reveal].in-view {
  opacity: 1;
  transform: translateY(0);
}
@media (prefers-reduced-motion: reduce) {
  [data-reveal] { opacity: 1; transform: none; transition: none; }
}
```
GSAP now owns both the hidden initial state and the reveal, so these rules are obsolete and would otherwise double-hide (CSS `opacity:0` fighting GSAP's `autoAlpha`). Removing them means the section is SSR-rendered visible, then GSAP's `gsap.set(..., {autoAlpha:0})` in the layout effect hides it before paint (full-motion) or leaves it visible (reduced-motion). Do NOT remove any other CSS (the `stagger-*` utilities right below, the orbit/hero-motion rules, etc. all stay).

- [ ] **Step 5: TypeScript check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | Select-Object -Last 15`
Expected: only the 2 pre-existing `vite.config.ts` errors, nothing from `index.tsx`.

- [ ] **Step 6: Build + visual verification**

Run: `bun run build 2>&1 | Select-Object -Last 20` — expect success.

Then run a Chromium screenshot check (dev server on :8080) in BOTH motion modes:
- Full motion: load `/`, scroll through, confirm each section fades+rises once, hero is visible on load (not stuck hidden), no flash-of-hidden-then-shown at the top, no re-hide on scroll-back-up.
- Reduced motion (`reducedMotion: "reduce"`): load `/`, confirm all sections are visible immediately with no motion and no flash.

Record which hero-reveal approach was needed (per Step 3's note) in the report.

- [ ] **Step 7: Commit**

```bash
git add src/routes/index.tsx src/styles.css
git commit -m "feat(motion): unify landing scroll reveal onto GSAP ScrollTrigger"
```

---

## Task 2: Count-up settle on the live-stats numbers

**Files:**
- Modify: `src/routes/index.tsx`

**Interfaces:**
- Consumes: the `stats` object from `useLiveStats(Route.useLoaderData())` (already in the component), `formatCount` (already defined in the file), GSAP.
- Produces: a one-time count-up of the 3 stat numbers when the stats section first reveals. Live poll updates after that set the value directly with no re-animation.

**Design notes:**
- The stats section currently maps an inline array of `{ label, value: formatCount(stats.xxx) }` into 3 tiles. To count up, the animation needs the raw numeric targets (`stats.members`, `stats.sessions`, `stats.checkins`), not the pre-formatted strings, and must write formatted output via `formatCount` on each tween update.
- The count-up runs ONCE, tied to the stats section entering view. Subsequent `useLiveStats` polls update `stats`; the displayed number should then reflect the new value without re-running the count-up (re-animating on every 20s poll is the "scattered motion" the spec forbids).
- Simplest robust approach: give each stat number its own `ref`, and in the reveal `useGSAP` (or a dedicated one) tween a proxy `{ val: 0 }` up to the target read from `stats` at reveal time, writing `el.textContent = formatCount(Math.round(proxy.val))` on update. After the count-up completes (or on any later `stats` change), a small `useEffect` keyed on `stats` writes the current formatted value directly to each ref so live updates stay correct. Guard the count-up so it only runs once (a `useRef(false)` "hasCounted" flag).
- Reduced motion: skip the count-up entirely; the `useEffect` that writes the formatted value directly already produces the correct final number on first render.

- [ ] **Step 1: Give the stats section and each number a ref**

In the "Quiet live numbers" section, refactor so each number `<p>` can be targeted. Add refs:
```tsx
const statsSectionRef = useRef<HTMLElement>(null);
const statValueRefs = useRef<Array<HTMLParagraphElement | null>>([]);
```
Change the stats `<section data-reveal className="grid gap-4 sm:grid-cols-3">` to also carry `ref={statsSectionRef}`. Keep `data-reveal` (it still gets the fade+rise from Task 1). Change the mapped array to expose raw numeric targets, e.g.:
```tsx
{[
  { label: "People here", value: stats.members },
  { label: "Listener calls held", value: stats.sessions },
  { label: "Check-ins shared", value: stats.checkins },
].map((s, i) => (
  <div key={s.label} className="rounded-xl border border-border bg-surface px-6 py-7 text-center">
    <p
      ref={(el) => { statValueRefs.current[i] = el; }}
      className="font-display text-2xl font-semibold"
    >
      {formatCount(s.value)}
    </p>
    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">{s.label}</p>
  </div>
))}
```
(The initial `{formatCount(s.value)}` server-renders the correct number so there's no blank/zero on first paint or under reduced motion.)

- [ ] **Step 2: Add the count-up (once) + live-sync effect**

Add a `hasCountedRef`:
```tsx
const hasCountedRef = useRef(false);
```

Add a dedicated `useGSAP` for the count-up (keep it separate from Task 1's reveal for clarity), scoped to `rootRef`:
```tsx
useGSAP(
  () => {
    const mm = gsap.matchMedia();
    mm.add(
      {
        reduceMotion: "(prefers-reduced-motion: reduce)",
        fullMotion: "(prefers-reduced-motion: no-preference)",
      },
      (context) => {
        const { reduceMotion } = context.conditions as { reduceMotion: boolean };
        if (reduceMotion || !statsSectionRef.current) return;

        const targets = [stats.members, stats.sessions, stats.checkins];
        ScrollTrigger.create({
          trigger: statsSectionRef.current,
          start: "top 85%",
          once: true,
          onEnter: () => {
            if (hasCountedRef.current) return;
            hasCountedRef.current = true;
            targets.forEach((target, i) => {
              const el = statValueRefs.current[i];
              if (!el) return;
              const proxy = { val: Math.round(target * 0.7) };
              gsap.to(proxy, {
                val: target,
                duration: 1,
                ease: "power2.out",
                onUpdate: () => {
                  el.textContent = formatCount(Math.round(proxy.val));
                },
              });
            });
          },
        });
      },
    );
    return () => mm.revert();
  },
  { scope: rootRef, dependencies: [] },
);
```
Note: `dependencies: []` so this doesn't re-create on every `stats` poll (which would re-arm the count-up). The count-up reads `stats.*` at the time the ScrollTrigger's `onEnter` fires via closure over the initial render's `stats`; that's acceptable because Step 3's live-sync effect keeps the displayed value correct afterward regardless. If the closure staleness is a concern, read the targets inside `onEnter` from a `statsRef` that a tiny effect keeps current — but the simpler closure approach is fine given the numbers move slowly and the live-sync effect is authoritative after count-up.

- [ ] **Step 3: Add the live-sync effect so polls stay correct after count-up**

Add a `useEffect` keyed on `stats` that, once the count-up has run (or under reduced motion where it never runs), writes the current formatted values directly to the refs so 20s poll updates are reflected without re-animating:
```tsx
useEffect(() => {
  if (!hasCountedRef.current) return; // before first count-up, JSX already shows correct value
  const values = [stats.members, stats.sessions, stats.checkins];
  values.forEach((v, i) => {
    const el = statValueRefs.current[i];
    if (el) el.textContent = formatCount(v);
  });
}, [stats]);
```
Under reduced motion, `hasCountedRef.current` stays `false`, so this effect no-ops and the JSX-rendered `{formatCount(s.value)}` (which re-renders naturally on `stats` change since it's in the render body) stays correct. Confirm this interplay in verification: under reduced motion the numbers must still update on poll (they will, because the JSX binding is live when the count-up path never overwrites textContent).

Wait — there's a subtlety to verify: once Task 2 Step 1 keeps `{formatCount(s.value)}` in the JSX, React controls that text node. GSAP/manual `el.textContent =` writes fight React on the next re-render. Under full motion after count-up, a `stats` poll triggers a React re-render that resets textContent to the new `{formatCount(s.value)}` anyway — which is actually correct and makes the Step 3 effect partly redundant. The real conflict is only DURING the 1s count-up: if a poll lands mid-count, React re-render would overwrite the counting text. Given polls are 20s apart and the count is 1s, collision is unlikely but possible.

**Resolution for the implementer:** prefer letting React own the final value (keep `{formatCount(s.value)}` in JSX) and have GSAP only animate during the count-up window. Accept that a mid-count poll (rare) would snap to the polled value — harmless. Drop the Step 3 `useEffect` entirely IF testing shows React's natural re-render already keeps polled values correct after count-up (it should, since the JSX binding is live). Only keep a manual sync if verification shows a stale value. Document the final approach in the report.

- [ ] **Step 4: TypeScript check + build**

Run `npx tsc --noEmit -p tsconfig.json` (expect only the 2 known errors) and `bun run build` (expect success).

- [ ] **Step 5: Visual verification**

Chromium check on :8080:
- Full motion: scroll to the stats section; numbers count up once from ~70% to the real value, then hold. Scroll away and back — no re-count (`once: true` + `hasCountedRef`).
- Reduced motion: numbers show final values immediately, no count-up.
- Leave the tab and return / wait for a poll if feasible; confirm the number stays correct (doesn't reset to a stale or zero value).

- [ ] **Step 6: Commit**

```bash
git add src/routes/index.tsx
git commit -m "feat(motion): gentle count-up settle on landing live-stats"
```

---

## Task 3: Gentle lift-on-hover for trust cards and primary CTAs

**Files:**
- Modify: `src/routes/index.tsx`

**Interfaces:**
- Consumes: `useGSAP`'s `contextSafe` (from the hook callback's second arg), GSAP, `gsap.matchMedia`.
- Produces: pointer-enter/leave lift+shadow on the 3 trust cards and the primary CTA buttons, fine-pointer + no-reduced-motion only. No change to the components themselves.

**Design notes:**
- Targets: the 3 "Who answers, and how it works" trust cards (currently 3 sibling `<div className="rounded-xl border border-border bg-surface p-6">`), and the primary CTA buttons (hero primary button, campaign-banner "Bring someone near" button). The hero has a primary and a ghost button — apply to the primary only. Skip the header nav CTA (small, and hover-color is enough there) to keep the effect focused on the marketing trust/conversion moments per the spec.
- Motion: `y: -2`, `boxShadow: "0 12px 24px -12px rgb(43 92 88 / 0.25)"` (a soft Harbor-teal-tinted shadow using the primary hue) on enter, ~0.25s `power2.out`; reverse on leave (`y: 0`, `boxShadow: "none"` or the element's resting shadow). Keep it subtle — this is "gentle and responsive," not a bouncy tilt.
- Gate with matchMedia conditions `hoverable: "(hover: hover) and (pointer: fine)"` + `fullMotion: "(prefers-reduced-motion: no-preference)"`. Only attach listeners when BOTH match. On touch/reduced-motion, attach nothing (the existing Harbor CSS `:hover` color states remain and are untouched).
- Use `contextSafe` to wrap the handlers and remember to remove the listeners in the returned cleanup (per the gsap-react skill's contextSafe pattern).

- [ ] **Step 1: Add refs to the hover targets**

Add:
```tsx
const trustCardsRef = useRef<HTMLDivElement>(null); // wraps the 3 trust cards' grid
```
Attach `ref={trustCardsRef}` to the `<div className="grid gap-4 sm:grid-cols-3">` that contains the 3 trust cards in the "Who answers" section. (Querying its children inside the handler is cleaner than 3 separate refs.)

For the CTA buttons: the primary CTAs are shadcn `<Button asChild>` wrapping a `<Link>`. Add a shared class hook rather than refs to keep it simple — add `data-cta-lift` to the two primary CTA buttons (hero primary + campaign banner). e.g. the hero primary `<Button asChild size="lg" className="w-full sm:w-auto">` becomes `<Button asChild size="lg" data-cta-lift className="w-full sm:w-auto">`, and likewise the campaign banner button. (`data-*` attributes pass through shadcn's Button to the underlying element.) Do NOT add it to the ghost "See how it works" button or the header nav buttons.

- [ ] **Step 2: Add the hover useGSAP with contextSafe handlers**

```tsx
useGSAP(
  (_context, contextSafe) => {
    const mm = gsap.matchMedia();
    mm.add(
      {
        hoverable: "(hover: hover) and (pointer: fine)",
        fullMotion: "(prefers-reduced-motion: no-preference)",
      },
      (context) => {
        const { hoverable, fullMotion } = context.conditions as {
          hoverable: boolean;
          fullMotion: boolean;
        };
        if (!hoverable || !fullMotion || !contextSafe) return;

        const cards = trustCardsRef.current
          ? Array.from(trustCardsRef.current.children)
          : [];
        const ctas = gsap.utils.toArray<HTMLElement>("[data-cta-lift]");
        const targets = [...cards, ...ctas] as HTMLElement[];
        if (!targets.length) return;

        const enter = contextSafe((e: Event) =>
          gsap.to(e.currentTarget as HTMLElement, {
            y: -2,
            boxShadow: "0 12px 24px -12px rgb(43 92 88 / 0.25)",
            duration: 0.25,
            ease: "power2.out",
          }),
        );
        const leave = contextSafe((e: Event) =>
          gsap.to(e.currentTarget as HTMLElement, {
            y: 0,
            boxShadow: "0 0px 0px 0px rgb(43 92 88 / 0)",
            duration: 0.25,
            ease: "power2.out",
          }),
        );

        targets.forEach((t) => {
          t.addEventListener("pointerenter", enter);
          t.addEventListener("pointerleave", leave);
        });
        return () => {
          targets.forEach((t) => {
            t.removeEventListener("pointerenter", enter);
            t.removeEventListener("pointerleave", leave);
          });
        };
      },
    );
    return () => mm.revert();
  },
  { scope: rootRef },
);
```
Note: the hex `rgb(43 92 88 / ...)` is the Harbor primary teal (`#2B5C58`) — a hardcoded shadow color is acceptable here since GSAP animates boxShadow (which can't reference a CSS var mid-tween as cleanly). If the reviewer prefers, read the computed `--primary` and build the shadow string, but the hardcoded Harbor teal is fine and matches the spec's palette. Keep the leave-state shadow as a transparent same-size shadow (not `"none"`) so GSAP can tween it smoothly rather than snapping.

- [ ] **Step 3: TypeScript check + build**

`npx tsc --noEmit -p tsconfig.json` (only the 2 known errors) and `bun run build` (success).

- [ ] **Step 4: Visual verification**

Chromium check on :8080 (desktop viewport, fine pointer):
- Full motion: hover each trust card and each primary CTA — subtle 2px lift + soft teal shadow appears (~0.25s), settles back on leave. No jitter, no layout shift of neighbors (y-transform + boxShadow don't reflow).
- Reduced motion: hovering produces NO movement (only the existing CSS color hover, if any).
- Touch emulation: no JS hover listeners attached (can't easily assert, but confirm no errors and the page works).

- [ ] **Step 5: Commit**

```bash
git add src/routes/index.tsx
git commit -m "feat(motion): gentle lift-on-hover for landing trust cards and CTAs"
```

---

## Task 4: Final verification

**Files:** none modified (checks only).

- [ ] **Step 1: One-reveal-system check**

Confirm the old system is fully gone:
- `Select-String -Path src/styles.css -Pattern "data-reveal"` → no matches.
- `Select-String -Path src/routes/index.tsx -Pattern "IntersectionObserver"` → no matches.
- `Select-String -Path src/routes/index.tsx -Pattern "useGSAP"` → present.

- [ ] **Step 2: Preview components untouched**

`git diff --stat <plan-base>..HEAD` shows only `src/routes/index.tsx` and `src/styles.css` changed — NOT `call-card-preview.tsx` or `ai-snippet-preview.tsx`.

- [ ] **Step 3: Full build + typecheck**

`npx tsc --noEmit -p tsconfig.json` (only 2 pre-existing `vite.config.ts` errors) and `bun run build` (success, no new warnings tied to index.tsx).

- [ ] **Step 4: Playwright public smoke test**

Start the dev server, run `bun run test:e2e -- tests/e2e/smoke.spec.ts --reporter=list`. Expect the 3 public tests to pass (landing loads, title renders, protected redirect); the 5 authenticated tests skip without credentials — that's expected, not a failure.

- [ ] **Step 5: Reduced-motion + full-motion screenshot pass**

Chromium full-page screenshots of `/` at 1280px in both `reducedMotion: "reduce"` and default. Confirm: reduced-motion shows all content visible, no motion; full-motion reveals correctly with no first-paint flash. Save screenshots to the SDD workspace for the record.

- [ ] **Step 6: Report results (no commit)**

Summarize pass/fail per step. If any fails, fix in the relevant task's file and re-run before declaring complete.

---

## Explicitly Out of Scope

- Authenticated app screens, shared `Button`/`Card` primitives, any non-landing route.
- Scroll pinning, scrubbed timelines, parallax, horizontal scroll, storytelling choreography.
- The two self-contained preview components' existing animations.
- New copy/sections/colors/fonts.
