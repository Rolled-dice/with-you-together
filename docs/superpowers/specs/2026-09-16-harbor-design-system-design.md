# Harbor: a minimalist design system for SomeoneNear

## Why

SomeoneNear currently uses a warm sand-and-clay identity (cream background,
terracotta primary, soft blob gradients, pill-shaped buttons, heavy
`card-lift`/`card-tilt`/`card-glow` hover choreography). It works, but it
also sits close to a recognizable "AI-generated design" tell (warm cream +
terracotta accent + serif-adjacent display font), and its heavy decoration
(gradients on every dashboard tile, animated orbiting avatars, pointer-tilt
cards) works against the calm, trustworthy feel the brand is going for.

This spec replaces it with **Harbor**: a deliberately minimal, highly
accessible system grounded in the product's actual subject matter — a
family checking in on someone they love, a real person answering, a light
left on. Steady and watchful rather than bubbly and marketing-bright.

Approved direction (from brainstorming): full visual overhaul (new palette,
type, icon library), applied app-wide, delivered foundation-first — tokens
+ core primitives + 3 reference screens in this pass, remaining ~20 routes
in a follow-up pass.

## Color

Named base palette (hex, converted to `oklch()` in implementation to match
the existing token convention in `src/styles.css`):

| Name | Hex | Role |
|---|---|---|
| Mist | `#F6F7F6` | Background — a barely-cool off-white paper, not cream, not sterile white |
| Mist Deep | `#ECEFED` | Secondary surface (sidebar, subtle section backgrounds) |
| Ink | `#1E2422` | Primary text — warm-cool near-black, never pure `#000` |
| Harbor | `#2B5C58` | Primary / trust accent — deep muted teal |
| Harbor Soft | `#DCEAE7` | Tint of Harbor for badges, hover states, subtle fills |
| Ember | `#C98A3E` | Secondary accent — muted amber/gold, used sparingly (reminders, "someone's available" indicators, warm emphasis) |
| Ember Soft | `#F3E4CC` | Tint of Ember for the same sparing use-cases |
| Line | `#E3E6E4` | Hairline borders and dividers |
| Signal Red | `#B3483F` | Destructive/error only — muted, not alarm-red |

Dark mode: invert lightness while preserving hue relationships (Harbor
lightens to remain the accent against a dark ink background; Mist becomes
a warm-cool charcoal, not pure black). Exact oklch values computed at
implementation time following the existing light/dark pairing pattern in
`styles.css`.

Semantic token mapping (replacing current `--background`/`--primary`/etc.
in `src/styles.css`, same variable names so no consuming component needs
to change):

- `--background` / `--surface` → Mist / Mist Deep
- `--foreground` → Ink
- `--primary` / `--brand-primary` → Harbor
- `--accent` → Harbor Soft (was rose/clay tint)
- `--brand-accent` → Ember (secondary warmth, used for reminders/nudges only — was clay-soft)
- `--border` / `--input` → Line
- `--destructive` → Signal Red

The existing raw hex palette block (`--color-sand`, `--color-clay`,
`--color-sunrise-*`, `--color-sage`, `--color-coral`, `--color-blush`,
`--color-sky`, `--color-lilac`, `--color-mint`, `--color-amber-soft`) and
every `gradient-*` utility built on it (`gradient-sunrise`, `gradient-peach`,
`gradient-sage`, `gradient-blush`, `gradient-sky`, `gradient-lilac`,
`gradient-mint`, `gradient-animated`) are removed. Harbor uses flat
semantic-token fills, not decorative gradients. Any screen currently
choosing a gradient utility per-tile (dashboard stat tiles, hero banner,
campaign banner) instead uses a flat surface color with a single-color
icon accent.

## Type

- **Display (Fraunces)** — serif, used only for hero/marketing headlines at
  32px and above (landing page H1, campaign banner headline). Never used
  below 24px, where serif legibility drops for older readers — a real
  constraint given the app's audience includes elders. Weight 500-600,
  tight tracking (`-0.01em`), line-height 1.15.
- **Sans (Hanken Grotesk)** — used for everything else: all H2-H6, body
  text, UI labels, buttons, nav. Humanist grotesk, rounded terminals, calm
  and highly legible at small sizes. Weight 400 body / 500-600 headings.
- Both loaded the same way Figtree/Outfit are today: Google Fonts
  `<link>` tags in `src/routes/__root.tsx` (`preconnect` + stylesheet
  `Fraunces:opsz,wght@9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700`).
- `--font-display: "Fraunces", "Hanken Grotesk", ui-serif, serif` and
  `--font-sans: "Hanken Grotesk", ui-sans-serif, system-ui, sans-serif` in
  `src/styles.css`.
- Body text never below 16px (`text-base`). Paragraph line-height 1.6–1.7.
  Sentence case everywhere — no tracked-out uppercase labels, no
  middle-dot-joined meta strings, no em-dash-labeled buttons.
- `h1`–`h6` global selector in `styles.css` keeps `font-family:
  var(--font-display)` for H1 only (the current rule applies display font
  to all headings 1-6; Harbor narrows this so H2 and below use
  `var(--font-sans)` with a slightly heavier weight instead, since serif at
  20px reads worse than a well-weighted sans).

## Layout & shape

- Corner radius tightens from the current `--radius: 1.25rem` (20px base,
  producing very rounded/pill-like controls) to `--radius: 0.625rem` (10px
  base). This cascades through the existing `--radius-sm/md/lg/xl` scale
  automatically. `--radius-brand` (used for buttons/cards via
  `rounded-brand`) drops from 24px to 16px.
- Hardcoded oversized radii sprinkled directly in route files
  (`rounded-3xl`, `rounded-2xl`, `rounded-full` on non-pill elements) are
  replaced with `rounded-lg`/`rounded-xl`/`rounded-brand` as appropriate
  during the per-screen rebuild — these bypass the token system today and
  won't inherit the new scale automatically.
- `rounded-full` is kept only for genuinely circular/pill elements: avatar
  images, status dots, badge pills. Primary/secondary buttons move from
  pill-shaped to `rounded-brand` (16px) rectangles — steadier, more
  product-like, less "consumer marketing site."
- Landing page hero and marketing sections move from centered, blob-heavy
  layout to left-aligned text blocks (faster to scan for someone anxious or
  in a hurry). Dashboard/authenticated screens were already left-aligned
  and keep that.
- Cards are reserved for genuinely card-like content (a listener's profile,
  a stat, a feature). Lists — the booking history, the settings sections —
  move from stacked identical bordered boxes to hairline-divided rows
  (`divide-y divide-border`), reducing the "identical SaaS card everywhere"
  effect called out in the frontend-design guidance.
- One deliberate motion moment per screen (e.g. the landing hero's
  `data-reveal` entrance), not scattered fade-ups on every card. Dashboard's
  orbiting-avatar hero animation, per-tile pointer-tilt (`card-tilt`), and
  glow-follow-cursor effects (`card-glow`, `card-hover`, `card-lift`) are
  removed in favor of a single calm entrance and ordinary `:hover` states
  (border color shift + 1px lift, no radial glow, no perspective tilt).
  `prefers-reduced-motion` handling stays exactly as rigorous as today.

## Icons

Lucide (`lucide-react`) is fully replaced by **Phosphor Icons**
(`@phosphor-icons/react`), regular weight by default, `weight="fill"`
reserved for active/selected states (active nav item, selected toggle).

- `components.json`: `"iconLibrary": "lucide"` → `"iconLibrary":
  "phosphor"`.
- Every one of the 35 distinct Lucide icons identified across the app
  (full list gathered from `index.tsx`, `dashboard.tsx`, `listeners.tsx`,
  `app-shell.tsx`, plus `select.tsx`/`accordion.tsx`) gets a named Phosphor
  equivalent, e.g. `Heart`→`Heart`, `PhoneCall`→`PhoneCall`,
  `ShieldCheck`→`ShieldCheck`, `Loader2`→`SpinnerGap` (with a manual
  `animate-spin` class, since Phosphor has no built-in spinning variant),
  `ChevronDown`/`ChevronUp`/`Check`/`X`→ Phosphor's equivalents. Exhaustive
  mapping table is produced during implementation (mechanical, one pass
  across the whole codebase, not just the 3 reference screens — icon
  imports fork the visual language if left half-migrated).
- Two shadcn primitives (`select.tsx`, `accordion.tsx`) have hardcoded
  Lucide imports for their internal chevron/check glyphs; these get
  updated in the same pass since they're small, shared, universally used
  components.
- Icon stroke/fill weight stays visually consistent (Phosphor's "regular"
  weight ≈ Lucide's default stroke width, so swapping doesn't change
  perceived icon size/weight app-wide).

## Component rebuild (foundation primitives)

Rebuilt against the new tokens in this pass — `Button`, `Card`, `Badge`,
`Input`, `Select`, plus the two Lucide-coupled primitives above:

- **Button**: `rounded-brand` (was `rounded-md`, i.e. the `--radius-md`
  token; the app's `Button` usages mostly add `rounded-full` inline —
  those call sites lose the manual override and rely on the component
  default). `default` variant: `bg-primary text-primary-foreground`
  (Harbor), no `shadow` (drop the current `shadow`/`shadow-sm` on
  buttons — flat, no elevation drama per Harbor's restraint principle).
  `hover:bg-primary/90` stays as the interaction model (simple opacity
  shift, no scale/translate).
- **Card**: `rounded-xl` (was `rounded-xl` already off the `--radius-lg`
  token, so this inherits the new tighter scale for free), `shadow`
  dropped in favor of a `border border-border` with no shadow by default
  — shadow only appears in the rare "raised" case (e.g. an active/current
  item), not on every card. This directly removes the "same soft grey
  shadow under every card" pattern.
- **Badge**: kept mostly as-is (already token-driven, no icon deps) —
  radius follows the tightened scale automatically.
- **Input / Textarea**: kept mostly as-is (already token-driven), radius
  follows the tightened scale.
- **Select / Accordion**: icon imports swapped to Phosphor; radius/shadow
  follow the tightened scale.

## Reference screens (this pass)

1. **Landing page** (`src/routes/index.tsx`) — marketing/first-impression
   surface. Custom header/hero move to left-aligned layout, Fraunces H1,
   flat Harbor-tinted icon badges (no `gradient-sunrise` campaign banner —
   replaced with a flat Harbor or Ember surface block), features grid
   loses the per-card hover-translate flourish in favor of a plain border
   hover, FAQ accordion re-skinned with Phosphor chevron.
2. **Dashboard** (`src/routes/_authenticated/dashboard.tsx`) — the most
   heavily decorated screen today (5 different `gradient-*` tiles, orbiting
   avatar hero, pointer-tilt quick-access cards). This is the clearest
   demonstration of Harbor's restraint principle: hero banner becomes a
   flat Harbor-tinted surface with the greeting + quote + two CTAs. The
   orbiting-avatar animation is removed; the family avatars are dropped
   from the hero entirely (the greeting text + quote + CTAs carry the
   section on their own — re-adding a static avatar row is a candidate
   for a later pass if the section reads as too empty once built, but is
   not part of this spec). Stat tiles become plain bordered/hairline-
   divided rows instead of 4 different colored gradients; quick-access
   tiles keep their grid but lose `card-tilt`/pointer-parallax in favor of
   a simple border/background hover.
3. **Listeners** (`src/routes/_authenticated/listeners.tsx`) — forms and
   status display. Booking form and emergency-callback card keep their
   two-column structure but move to the tightened radius and flat Harbor
   accent (emergency card's `gradient-sunrise` border treatment becomes a
   solid `border-primary/40` or `border-ember/40` treatment instead).
   Booking history list moves from stacked `Card`s to hairline-divided
   rows.

`app-shell.tsx` (nav sidebar, mobile nav, `PageHeader`) is also rebuilt in
this pass, since every authenticated reference screen composes through it
and it drives the icon set for all in-app navigation — leaving it on the
old system would make the 3 reference screens visually inconsistent with
their own chrome.

## Explicitly out of scope for this pass

- The remaining ~20 authenticated/admin/public routes not listed above
  (companion, insights, family, settings, admin.calls, agent.console,
  send-later, reminders, safety, docs, checkout, auth, etc.) — follow-up
  pass after this one is reviewed.
- Any change to underlying data, business logic, or server functions.
- Any change to the Telnyx calling UI/architecture (separate, already
  cleaned up in prior work).
- Dark mode exact oklch tuning — direction is specified (invert lightness,
  preserve hue relationships) but final values are picked during
  implementation and are expected to need a quick visual pass.

## Verification

- Visual: screenshot the 3 reference screens (and app-shell nav) at
  mobile (375px), tablet (768px), and desktop (1280px) before/after.
- Accessibility: verify text/background contrast ratios meet WCAG AA for
  body text (4.5:1) and large text/headings (3:1) using the new Harbor/Ink/
  Mist combinations, both light and dark. Verify visible keyboard focus
  rings on all interactive elements (buttons, links, form controls, nav
  items). Verify `prefers-reduced-motion` still suppresses all decorative
  motion (the single hero entrance included).
- Build: `vite build` succeeds with zero remaining `lucide-react` imports
  anywhere in `src/` (mechanical grep check) and zero remaining
  `gradient-*`/`card-tilt`/`card-glow` utility usages on the 3 rebuilt
  screens.
- Manual smoke test: `tests/e2e/smoke.spec.ts` still passes (landing page
  loads, title renders).

Full accessibility validation (screen reader testing, assistive technology
walkthroughs) is out of scope for automated verification and would need a
manual expert pass separately — noted per standard practice, not something
this implementation claims to fully satisfy on its own.
