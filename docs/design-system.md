# SomeoneNear Design System — "Soft Sand & Clay"

Emotional brief: comforting, non-judgemental, quiet, safe. Nothing on screen should
demand, rank, or alarm. No photographic imagery — warmth comes from colour,
typography, generous space, and hand-simple SVG marks.

## 1. Colour

Tokens live in `src/styles.css` (`:root` / `.dark`, oklch). Components use semantic
classes only (`bg-surface`, `text-muted-foreground`, `bg-primary`) — never raw hex.

| Role | Light | Dark |
| --- | --- | --- |
| Background (sand) | `#FBF6EF` | warm charcoal `oklch(0.24 0.014 55)` |
| Surface (deep sand) | `#F3E7D8` | `oklch(0.28 0.016 55)` |
| Primary (clay) | `#C9714F` | softened clay `oklch(0.72 0.11 44)` |
| Ink / foreground | `#4A403A` | `#F0EAE4`-equivalent |
| Muted text | `oklch(0.52 0.02 55)` | `oklch(0.76 0.02 70)` |
| Border | `oklch(0.89 0.018 72)` | `white / 10%` |
| Destructive | desaturated clay-red `oklch(0.58 0.11 32)` — used sparingly, never for notifications |

Accent scale utilities: `sand`, `sand-deep`, `clay`, `clay-soft`, `ink`, plus soft
`sage`, `blush`, `sky`, `mint` for category tints.

## 2. Typography

- Headings: **Outfit** (`font-display`), weights 500–600, tracking `-0.015em`.
- Body: **Figtree** (`font-sans`), weight 400–500, line-height 1.6+.
- Loaded via `<link>` in `src/routes/__root.tsx`; never `@import` a font URL in CSS.

Hierarchy (conversational, not authoritative):

| Use | Size |
| --- | --- |
| Hero | `text-4xl sm:text-5xl` / 600 |
| Section title | `text-3xl` / 600 |
| Card title | `text-base` / 500 |
| Body | `text-base`–`text-lg`, muted for secondary |
| Eyebrow | `text-xs uppercase tracking-[0.18em]` muted |

## 3. Shape, shadow, space

- Radius: base `--radius: 1.25rem`. Cards `rounded-3xl`, feature panels
  `rounded-[2.5rem]`, buttons `rounded-2xl`/`rounded-full`.
- Shadows are presence, not elevation: `shadow-gentle` (default),
  `shadow-soft`, `shadow-glow` (rare, clay-tinted). No hard drop shadows.
- Space: single calm column, `max-w-2xl`, `space-y-20` between sections,
  `p-6`–`p-12` inside surfaces. One idea per block.
- Motion: 500–700ms ease-out fades and 8px rises (`animate-gentle-rise`,
  `[data-reveal]`). No bounce, no attention-grabbing loops. All motion respects
  `prefers-reduced-motion`.

## 4. Notification system — "gentle nudges"

`src/components/gentle-nudge.tsx`

- `<NudgeDot />` — a clay dot with a slow 3.6s breathing halo
  (`animate-gentle-breathe`). This replaces every red badge/dot in the product.
- `<GentleNudge title body action />` — sand surface card, soft radius,
  `shadow-gentle`, rises in once. Copy is a sentence, never a command.
- `gentleToast(title, description)` — quiet Sonner toast (5s, no colour coding,
  no icons shouting success/error).
- `gentleProblem(title, description)` — for real failures; still calm, always ends
  with a way forward ("Nothing is lost. You can try again whenever you're ready.").

Toaster is configured once in `__root.tsx`: top-centre, `rounded-3xl`, sand
surface, `richColors` deliberately off.

## 5. Empty states

`src/components/quiet-empty-state.tsx`

`<QuietEmptyState quote title body action variant />`

- `QuietMark` SVG (`breath` | `note` | `circle`) instead of illustration or photo.
- Optional `quote` renders the brand line in italics above the title, e.g.
  "That moment when you want to tell someone about your day — and realise there's
  no one to tell."
- Action is always low-pressure ("Say the first thing", not "Get started now").

## 6. Voice — lines to reuse

Hero, onboarding, loading and empty screens draw from:

- "Who do you call when you don't know who to call?"
- "Talk when you want. Get a check-in when you need one. Find someone when you don't want to be alone."
- "'I'm fine' is sometimes just easier than explaining what's actually going on."
- "Some people aren't alone. They just don't have anyone available when they need them."
- "Sometimes the hardest part isn't being alone. It's not knowing who to call."
- "You can't always be there. But what if someone could?"
