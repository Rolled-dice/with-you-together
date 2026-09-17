# Harbor Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SomeoneNear's warm sand-and-clay visual identity with Harbor — a minimal, muted-teal-and-amber system with Fraunces/Hanken Grotesk typography and Phosphor icons — applied to the design tokens, core shadcn primitives, `app-shell.tsx`, and three reference screens (landing, dashboard, listeners).

**Architecture:** Token changes live entirely in `src/styles.css` (Tailwind v4 CSS-first config, no `tailwind.config.js`) and `src/routes/__root.tsx` (font links). The Lucide→Phosphor icon swap is a mechanical, codebase-wide replacement (every file, not just the 3 reference screens) done as its own task so the icon language never forks mid-migration. Core shadcn primitives (Button, Card, Badge, Input, Select, Accordion) are edited in place. The 3 reference screens and `app-shell.tsx` are then visually rebuilt against the new tokens. Utility classes consumed by out-of-scope screens (`gradient-*`, `card-tilt`, `card-glow`, `card-hover`, `card-lift`) are left defined in `styles.css` — only their *usage* is removed from the in-scope files.

**Tech Stack:** React 19, TanStack Start (file-based routing), Tailwind CSS v4 (CSS-first, `@theme inline` blocks in `src/styles.css`), shadcn/ui (style "new-york", `cssVariables: true`), `@phosphor-icons/react` (replacing `lucide-react`), Google Fonts (Fraunces + Hanken Grotesk, replacing Outfit + Figtree).

**Spec:** `docs/superpowers/specs/2026-09-16-harbor-design-system-design.md`

## Global Constraints

- Every color in `src/styles.css` must be expressed as `oklch(...)`, matching the existing token convention — never raw hex in the CSS variable definitions.
- `components.json` `iconLibrary` must read `"phosphor"` after Task 2; `baseColor`, `style`, `rsc`, `tsx`, `cssVariables`, `prefix`, and `aliases` are unchanged.
- Never delete or rename a CSS custom property that a file outside this plan's scope still consumes (`--color-sand`, `--color-clay`, `--color-sunrise-*`, `--color-sage`, `--color-coral`, `--color-blush`, `--color-sky`, `--color-lilac`, `--color-mint`, `--color-amber-soft`, and every `gradient-*`/`card-tilt`/`card-glow`/`card-hover`/`card-lift` utility) — these stay defined, only their usage in the 3 reference screens + `app-shell.tsx` is removed.
- Body text is never smaller than `text-base` (16px). Fraunces (`font-display`) is only applied to `h1` elements and any explicit `font-display` usage at 24px/`text-2xl` or larger — never to `h2`–`h6` by default and never below 24px.
- `rounded-full` is only used for genuinely circular/pill elements (avatars, status dots, badge pills) in code touched by this plan — not for rectangular buttons or cards.
- Every icon migration keeps the same semantic icon choice (a phone icon stays a phone icon) unless the spec's mapping table (Task 3) says otherwise.
- Run `npx tsc --noEmit -p tsconfig.json` and `bun run build` (or `npm run build`) after every task that touches `.tsx`/`.ts` files and confirm no new errors before committing. Pre-existing `vite.config.ts` type errors (unrelated to this plan) are expected and not a regression.
- Never introduce a dependency without pinning an exact version consistent with the rest of `package.json` (which uses `^` ranges — match that convention).

---

## File Structure

- **Modify:** `src/styles.css` — new Harbor color tokens (light + dark), new `--font-display`/`--font-sans`, tightened `--radius`/`--radius-brand`. Existing raw hex palette + gradient/card-interaction utilities stay, untouched.
- **Modify:** `src/routes/__root.tsx` — swap the Google Fonts `<link>` from Outfit/Figtree to Fraunces/Hanken Grotesk.
- **Modify:** `components.json` — `iconLibrary: "lucide"` → `"phosphor"`.
- **Modify (icon swap, codebase-wide):** every file currently importing from `lucide-react` (51 files total, enumerated in Task 3) — imports and JSX usages become `@phosphor-icons/react` equivalents.
- **Modify:** `src/components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`, `textarea.tsx`, `select.tsx`, `accordion.tsx` — rebuilt against new tokens (radius/shadow changes; `select.tsx`/`accordion.tsx` also get their icon swap as part of the codebase-wide Task 3, verified again here).
- **Modify:** `src/components/app-shell.tsx` — nav icon set (via Task 3), sidebar chrome flattened (no shadow, tightened radius), `PageHeader` typography adjusted (H1 gets `font-display`, eyebrow loses tracked-uppercase treatment).
- **Modify:** `src/routes/index.tsx` — landing page rebuilt: left-aligned hero, flat Harbor-tinted icon badges, campaign banner de-gradiented, features grid hover simplified.
- **Modify:** `src/routes/_authenticated/dashboard.tsx` — dashboard rebuilt: hero banner flattened (orbit animation + avatar row removed), stat tiles become hairline-divided flat rows, quick-access tiles lose pointer-tilt.
- **Modify:** `src/routes/_authenticated/listeners.tsx` — booking form/emergency card de-gradiented, booking history moves to hairline-divided rows.
- No new files are created; no files are deleted. No test files — this is a visual/presentational change with no new business logic (matching the precedent set by the earlier landing-page redesign work in this repo). Verification is via `tsc`, `vite build`, grep checks, and the existing Playwright smoke test.

---

## Task 1: Rewrite design tokens in `src/styles.css`

**Files:**
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: nothing (pure CSS token definitions).
- Produces: `--background`, `--surface`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--brand-primary`, `--brand-secondary`, `--brand-accent`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--border`, `--input`, `--ring`, `--sidebar*` (all unchanged variable *names*, new oklch values), plus `--font-display`, `--font-sans`, `--radius`. All later tasks style against these same variable names — no consumer needs to change for token values, only for the handful of hardcoded oversized-radius/gradient classes covered in Tasks 6-8.

- [ ] **Step 1: Replace the light-mode (`:root`) token block**

Open `src/styles.css` and find the `:root { ... }` block (currently starting with the comment `/* Soft sand & clay ... */`). Replace its entire contents with:

```css
:root {
  --radius: 0.625rem;

  /* Harbor — mist paper, deep muted teal, warm amber warmth */
  --background: oklch(0.975 0.002 145.6);
  --surface: oklch(0.949 0.004 157.2);
  --foreground: oklch(0.254 0.009 173.5);

  --card: oklch(0.99 0.001 145.6);
  --card-foreground: oklch(0.254 0.009 173.5);
  --popover: oklch(0.99 0.001 145.6);
  --popover-foreground: oklch(0.254 0.009 173.5);

  /* Brand: Harbor teal primary, mist-deep secondary, ember warmth accent */
  --brand-primary: oklch(0.439 0.054 188.4);
  --brand-secondary: oklch(0.949 0.004 157.2);
  --brand-accent: oklch(0.55 0.1 65);

  --primary: oklch(0.439 0.054 188.4);
  --primary-foreground: oklch(0.975 0.002 145.6);
  --secondary: oklch(0.949 0.004 157.2);
  --secondary-foreground: oklch(0.254 0.009 173.5);
  --muted: oklch(0.94 0.004 157.2);
  --muted-foreground: oklch(0.5 0.012 173.5);
  --accent: oklch(0.926 0.015 181.8);
  --accent-foreground: oklch(0.254 0.009 173.5);
  /* Muted signal red, never alarm-bright */
  --destructive: oklch(0.543 0.141 27.5);
  --destructive-foreground: oklch(0.98 0.004 27.5);

  --border: oklch(0.922 0.004 157.2);
  --input: oklch(0.9 0.004 157.2);
  --ring: oklch(0.439 0.054 188.4);

  --sidebar: oklch(0.955 0.004 157.2);
  --sidebar-foreground: oklch(0.254 0.009 173.5);
  --sidebar-primary: oklch(0.439 0.054 188.4);
  --sidebar-primary-foreground: oklch(0.975 0.002 145.6);
  --sidebar-accent: oklch(0.926 0.015 181.8);
  --sidebar-accent-foreground: oklch(0.254 0.009 173.5);
  --sidebar-border: oklch(0.922 0.004 157.2);
  --sidebar-ring: oklch(0.439 0.054 188.4);
}
```

Note: `--brand-accent` (0.55 0.1 65 ≈ `#8F5720`, "Ember Text" from the spec) is deliberately darker/more saturated than the raw Ember fill color, since `--brand-accent` in this codebase is used as *text* color (see `PageHeader` eyebrow/slogan in `app-shell.tsx`, Task 7) — the lighter Ember fill (`#C98A3E`) is introduced separately in Task 8 as a one-off inline color only where it's used as an icon/fill, never as text on a light background.

- [ ] **Step 2: Replace the dark-mode (`.dark`) token block**

Immediately below, replace the entire `.dark { ... }` block with:

```css
.dark {
  /* Harbor at night — same teal/ember relationship, dimmed on a warm-cool charcoal */
  --background: oklch(0.214 0.005 173.9);
  --surface: oklch(0.252 0.006 179.2);
  --foreground: oklch(0.95 0.003 165.1);
  --card: oklch(0.264 0.006 179.2);
  --card-foreground: oklch(0.95 0.003 165.1);
  --popover: oklch(0.264 0.006 179.2);
  --popover-foreground: oklch(0.95 0.003 165.1);
  --brand-primary: oklch(0.675 0.06 187.4);
  --brand-secondary: oklch(0.3 0.01 173.9);
  --brand-accent: oklch(0.773 0.106 67.9);
  --primary: oklch(0.675 0.06 187.4);
  --primary-foreground: oklch(0.214 0.005 173.9);
  --secondary: oklch(0.3 0.01 173.9);
  --secondary-foreground: oklch(0.95 0.003 165.1);
  --muted: oklch(0.29 0.008 173.9);
  --muted-foreground: oklch(0.72 0.01 165.1);
  --accent: oklch(0.322 0.028 188.6);
  --accent-foreground: oklch(0.95 0.003 165.1);
  --destructive: oklch(0.675 0.119 26.4);
  --destructive-foreground: oklch(0.96 0.008 26.4);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 14%);
  --ring: oklch(0.675 0.06 187.4);
  --sidebar: oklch(0.24 0.007 173.9);
  --sidebar-foreground: oklch(0.95 0.003 165.1);
  --sidebar-primary: oklch(0.675 0.06 187.4);
  --sidebar-primary-foreground: oklch(0.214 0.005 173.9);
  --sidebar-accent: oklch(0.3 0.01 173.9);
  --sidebar-accent-foreground: oklch(0.95 0.003 165.1);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.675 0.06 187.4);
}
```

- [ ] **Step 3: Update font variables in the first `@theme inline` block**

Find the first `@theme inline { ... }` block (near the top of the file, containing `--font-sans` and `--font-display`). Change only these two lines:

```css
  --font-sans: "Hanken Grotesk", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Fraunces", "Hanken Grotesk", ui-serif, serif;
```

(Leave every other line in that block — `--radius-sm`, `--radius-md`, `--color-background`, etc. — exactly as-is; they reference `var(--radius)`/`var(--background)` etc. and inherit the new values automatically.)

- [ ] **Step 4: Update `--radius-brand`**

In the same first `@theme inline` block, find:
```css
  --radius-brand: 24px;
```
Change to:
```css
  --radius-brand: 16px;
```

- [ ] **Step 5: Narrow the global heading font rule**

Find this rule inside the `@layer base { ... }` block near the bottom of the file:
```css
  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-display);
    letter-spacing: -0.015em;
  }
```
Replace with:
```css
  h1 {
    font-family: var(--font-display);
    letter-spacing: -0.01em;
    line-height: 1.15;
  }

  h2, h3, h4, h5, h6 {
    font-family: var(--font-sans);
    letter-spacing: -0.01em;
  }
```

- [ ] **Step 6: Verify the build picks up the new tokens**

Run: `npx vite build 2>&1 | tail -n 40`
Expected: build succeeds (client + SSR + nitro steps all complete, same as any other successful build in this repo — no new errors attributable to `styles.css`).

- [ ] **Step 7: Commit**

```bash
git add src/styles.css
git commit -m "feat(harbor): rewrite design tokens for Harbor color, type, and radius scale"
```

---

## Task 2: Swap font loading and `components.json` icon library declaration

**Files:**
- Modify: `src/routes/__root.tsx`
- Modify: `components.json`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Fraunces` and `Hanken Grotesk` become available as loaded web fonts referenced by `var(--font-display)`/`var(--font-sans)` from Task 1. `components.json`'s `iconLibrary` field becomes `"phosphor"`, which Task 3 depends on being correct before doing the mechanical icon swap.

- [ ] **Step 1: Update the Google Fonts link in `__root.tsx`**

In `src/routes/__root.tsx`, find:
```tsx
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Figtree:wght@400;500;600&display=swap",
      },
```
Replace with:
```tsx
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Hanken+Grotesk:wght@400;500;600;700&display=swap",
      },
```

- [ ] **Step 2: Update `components.json`**

In `components.json`, change:
```json
  "iconLibrary": "lucide",
```
to:
```json
  "iconLibrary": "phosphor",
```

- [ ] **Step 3: Install `@phosphor-icons/react`**

Run: `bun add @phosphor-icons/react@^2.1.10`
Expected: package added to `package.json` dependencies and `bun.lock` updated, no install errors.

Then run: `npm install --package-lock-only` to keep `package-lock.json` in sync (this repo tracks both lockfiles — confirmed by `git ls-files | grep lock` showing both `bun.lock` and `package-lock.json` are tracked).
Expected: `package-lock.json` updated, exit code 0.

- [ ] **Step 4: Verify fonts load and package installs correctly**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | tail -n 20`
Expected: no new errors (the 2 pre-existing `vite.config.ts` errors are unrelated and expected).

Run: `bun pm ls | Select-String phosphor` (PowerShell) or `bun pm ls | grep phosphor`
Expected: `@phosphor-icons/react@2.1.10` listed.

- [ ] **Step 5: Commit**

```bash
git add src/routes/__root.tsx components.json package.json package-lock.json bun.lock
git commit -m "feat(harbor): load Fraunces/Hanken Grotesk fonts, switch iconLibrary to phosphor"
```

---

## Task 3: Codebase-wide Lucide → Phosphor icon migration

**Files:**
- Modify (icon imports/usages only, no other logic changes): all 51 files listed below.

**Interfaces:**
- Consumes: `@phosphor-icons/react` installed in Task 2.
- Produces: zero remaining `from "lucide-react"` imports anywhere in `src/`. Every icon component used elsewhere in this plan (Tasks 5-9) is assumed to already be migrated by this task — later tasks reference Phosphor names directly (e.g. `PhoneCallIcon`, not `PhoneCall`).

**Icon name mapping** (Lucide name → Phosphor import name; Phosphor's current API deprecates bare names in favor of an `Icon` suffix — confirmed against `@phosphor-icons/react@2.1.10`'s type declarations, e.g. `export declare const Heart: Icon; /** @deprecated Use HeartIcon */` — so every mapping below uses the non-deprecated `*Icon` name):

| Lucide | Phosphor |
|---|---|
| `Heart` | `HeartIcon` |
| `Users` | `UsersIcon` |
| `LineChart` | `ChartLineIcon` |
| `Shield` | `ShieldIcon` |
| `ShieldCheck` | `ShieldCheckIcon` |
| `ShieldAlert` | `ShieldWarningIcon` |
| `PhoneCall` | `PhoneCallIcon` |
| `Phone` | `PhoneIcon` |
| `PhoneOff` | `PhoneDisconnectIcon` |
| `BellRing` | `BellRingingIcon` |
| `Bell` | `BellIcon` |
| `CalendarHeart` | `CalendarHeartIcon` |
| `CalendarClock` | `CalendarDotIcon` |
| `CalendarCheck` | `CalendarCheckIcon` |
| `AlarmClockCheck` | `AlarmIcon` |
| `Check` | `CheckIcon` |
| `CheckCircle2` | `CheckCircleIcon` |
| `ArrowRight` | `ArrowRightIcon` |
| `ArrowLeft` | `ArrowLeftIcon` |
| `ArrowUpRight` | `ArrowUpRightIcon` |
| `Mail` | `EnvelopeSimpleIcon` |
| `MessageSquareHeart` | `ChatCircleTextIcon` |
| `MessageCircleHeart` | `ChatCircleIcon` |
| `MessageCircle` | `ChatCircleIcon` |
| `MessageSquare` | `ChatSquareIcon` (fallback: `ChatIcon` if `ChatSquareIcon` doesn't exist — verify against the installed package's `dist/index.d.ts` during Step 1 below) |
| `Headphones` | `HeadphonesIcon` |
| `Sparkles` | `SparkleIcon` |
| `HeartHandshake` | `HandHeartIcon` |
| `Ear` | `EarIcon` |
| `Flame` | `FireIcon` |
| `Trophy` | `TrophyIcon` |
| `Star` | `StarIcon` |
| `Sun` | `SunIcon` |
| `Moon` | `MoonIcon` |
| `Cloud` | `CloudIcon` |
| `LifeBuoy` | `LifebuoyIcon` |
| `Loader2` | `SpinnerGapIcon` (keep the existing `animate-spin` className at every call site — Phosphor has no built-in spin animation, the CSS class already used for `Loader2` continues to apply) |
| `X` | `XIcon` |
| `LayoutDashboard` | `SquaresFourIcon` |
| `Settings` | `GearIcon` |
| `LogOut` | `SignOutIcon` |
| `Pill` | `PillIcon` |
| `Wand2` | `MagicWandIcon` |
| `RefreshCw` | `ArrowClockwiseIcon` |
| `Flag` | `FlagIcon` |
| `Users2` (not found in current grep, listed defensively — skip if unused) | `UsersIcon` |
| `HeartPulse` | `HeartbeatIcon` |
| `Globe` | `GlobeIcon` |
| `Trash2` | `TrashIcon` |
| `Plus` | `PlusIcon` |
| `NotebookPen` | `NotebookIcon` |
| `TrendingUp` | `TrendUpIcon` |
| `Crown` | `CrownIcon` |
| `Copy` | `CopyIcon` |
| `UserMinus` | `UserMinusIcon` |
| `UserPlus` | `UserPlusIcon` |
| `Mic` | `MicrophoneIcon` |
| `MicOff` | `MicrophoneSlashIcon` |
| `Video` | `VideoCameraIcon` |
| `VideoOff` | `VideoCameraSlashIcon` |
| `Type` | `TextTIcon` |
| `Square` | `StopIcon` |
| `Play` | `PlayIcon` |
| `Pause` | `PauseIcon` |
| `Bug` | `BugIcon` |
| `Lightbulb` | `LightbulbIcon` |
| `Send` | `PaperPlaneRightIcon` |
| `Clock` | `ClockIcon` |
| `Clock3` | `ClockIcon` |
| `AlertCircle` | `WarningCircleIcon` |
| `AlertTriangle` | `WarningIcon` |
| `WifiOff` | `WifiSlashIcon` |
| `Wifi` | `WifiHighIcon` |
| `Filter` | `FunnelIcon` |
| `Inbox` | `TrayIcon` |
| `Camera` | `CameraIcon` |
| `ImagePlus` | `ImageIcon` |
| `MoonStar` | `MoonStarsIcon` |
| `ScanLine` | `ScanIcon` |
| `Sunrise` | `SunHorizonIcon` |
| `Utensils` | `ForkKnifeIcon` |
| `Bot` | `RobotIcon` |
| `CornerDownLeftIcon` → already suffixed, Lucide export is `CornerDownLeft` | `ArrowBendDownLeftIcon` |
| `ImageIcon` (Lucide, already suffixed) | `ImageIcon` (same name) |
| `Monitor` | `MonitorIcon` |
| `PlusIcon` (Lucide) | `PlusIcon` |
| `SquareIcon` (Lucide) | `StopIcon` |
| `XIcon` (Lucide) | `XIcon` |
| `ChevronLeftIcon` | `CaretLeftIcon` |
| `ChevronRightIcon` | `CaretRightIcon` |
| `ArrowDownIcon` | `ArrowDownIcon` |
| `DownloadIcon` | `DownloadIcon` |
| `Loader2Icon` (Lucide, `spinner.tsx`) | `SpinnerGapIcon` |
| `PanelLeft` | `SidebarIcon` |
| `GripVertical` | `DotsSixVerticalIcon` |
| `Circle` | `CircleIcon` |
| `ChevronLeft` | `CaretLeftIcon` |
| `ChevronRight` | `CaretRightIcon` |
| `MoreHorizontal` | `DotsThreeIcon` |
| `ChevronDown` | `CaretDownIcon` |
| `Minus` | `MinusIcon` |
| `ChevronUp` | `CaretUpIcon` |
| `Search` | `MagnifyingGlassIcon` |
| `ChevronDownIcon` (calendar.tsx, Lucide) | `CaretDownIcon` |
| `ChevronLeftIcon` (calendar.tsx) | `CaretLeftIcon` |
| `ChevronRightIcon` (calendar.tsx) | `CaretRightIcon` |
| `Menu` | `ListIcon` |
| `Bug` | `BugIcon` |

Note: the mapping table intentionally lists every icon by its *Lucide import name* seen in the grep results across all 51 files — a given Phosphor icon (e.g. `ChevronDown`/`ChevronRight` used in multiple files) always maps to the same Phosphor name (`CaretDownIcon`/`CaretRightIcon`) for consistency.

**Files to update** (grouped by directory, each gets the same treatment in Step 2):

Routes: `src/routes/index.tsx`, `src/routes/auth.tsx`, `src/routes/checkout.return.tsx`, `src/routes/docs.index.tsx`, `src/routes/_authenticated/settings.tsx`, `src/routes/_authenticated/send-later.tsx`, `src/routes/_authenticated/safety.tsx`, `src/routes/_authenticated/reminders.tsx`, `src/routes/_authenticated/onboarding.tsx`, `src/routes/_authenticated/listeners.tsx`, `src/routes/_authenticated/invite.tsx`, `src/routes/_authenticated/insights.tsx`, `src/routes/_authenticated/family.tsx`, `src/routes/_authenticated/dashboard.tsx`, `src/routes/_authenticated/companion.tsx`, `src/routes/_authenticated/companion.index.tsx`, `src/routes/_authenticated/companion.$threadId.tsx`, `src/routes/_authenticated/checkout.tsx`, `src/routes/_authenticated/agent.console.tsx`, `src/routes/_authenticated/admin.feedback.tsx`, `src/routes/_authenticated/admin.calls.tsx`.

Components: `src/components/app-shell.tsx`, `src/components/ai-snippet-preview.tsx`, `src/components/call-card-preview.tsx`, `src/components/feedback-dialog.tsx`, `src/components/medication-onboarding.tsx`, `src/components/notification-bell.tsx`, `src/components/post-call-feedback-card.tsx`, `src/components/trust-badge.tsx`, `src/components/webhook-events-card.tsx`, `src/components/gentle-nudge.tsx` (uses none currently — skip if grep confirms no lucide import), `src/components/docs/docs-shell.tsx`, `src/components/auth/sign-up-form.tsx`, `src/components/ai-elements/conversation.tsx`, `src/components/ai-elements/message.tsx`, `src/components/ai-elements/prompt-input.tsx`.

shadcn primitives: `src/components/ui/accordion.tsx`, `src/components/ui/breadcrumb.tsx`, `src/components/ui/calendar.tsx`, `src/components/ui/carousel.tsx`, `src/components/ui/checkbox.tsx`, `src/components/ui/command.tsx`, `src/components/ui/context-menu.tsx`, `src/components/ui/dialog.tsx`, `src/components/ui/dropdown-menu.tsx`, `src/components/ui/input-otp.tsx`, `src/components/ui/menubar.tsx`, `src/components/ui/navigation-menu.tsx`, `src/components/ui/pagination.tsx`, `src/components/ui/radio-group.tsx`, `src/components/ui/resizable.tsx`, `src/components/ui/select.tsx`, `src/components/ui/sheet.tsx`, `src/components/ui/sidebar.tsx`, `src/components/ui/spinner.tsx`.

- [ ] **Step 1: Confirm exact export names for ambiguous mappings**

Some Phosphor names in the mapping table above are inferred from `phosphoricons.com` naming conventions and may not exactly match the installed package. Before editing any file, run:

```bash
node -e "const pkg = require('./node_modules/@phosphor-icons/react/dist/index.d.ts'.replace('.d.ts','.js')); " 2>&1 | head -5
```

This will fail (it's a `.d.ts`, not runnable) — instead, grep the installed type declarations directly for each uncertain name:

```powershell
Select-String -Path "node_modules/@phosphor-icons/react/dist/index.d.ts" -Pattern "ChatSquare|ChartLine|Fire|HandHeart|Lifebuoy|SquaresFour|SpinnerGap"
```

Expected output confirms which exact names exist (e.g. `Lifebuoy` not `LifeBuoy`, `ChartLineIcon` exported). If any name from the mapping table above is not found, search `node_modules/@phosphor-icons/react/dist/index.d.ts` for the closest semantic match (e.g. if `ChatSquare` doesn't exist, use `ChatIcon` instead) and note the substitution before proceeding to Step 2 — do not guess silently.

- [ ] **Step 2: Update imports and JSX usages file by file**

For each file in the "Files to update" list, open it and:
1. Replace the `import { A, B, C } from "lucide-react";` line with `import { AIcon, BIcon, CIcon } from "@phosphor-icons/react";` using the mapping table (and Step 1's confirmed exact names).
2. Replace every JSX usage `<A .../>` → `<AIcon .../>` (and any bare reference like `icon: A` in a data array, or `typeof Sun` type annotations → `typeof SunIcon`).
3. Leave every className, size prop, and surrounding logic untouched — this step only changes which icon component is rendered, never styling or behavior.

Work through the files in this order (routes first, then components, then shadcn primitives), committing in the batches defined in Step 3 below so no single commit is enormous and unreviewable.

- [ ] **Step 3: Commit in four batches**

Batch A — routes (20 files):
```bash
git add src/routes
git commit -m "feat(harbor): migrate route files from lucide-react to phosphor icons"
```

Batch B — components (15 files):
```bash
git add src/components/app-shell.tsx src/components/ai-snippet-preview.tsx src/components/call-card-preview.tsx src/components/feedback-dialog.tsx src/components/medication-onboarding.tsx src/components/notification-bell.tsx src/components/post-call-feedback-card.tsx src/components/trust-badge.tsx src/components/webhook-events-card.tsx src/components/docs/docs-shell.tsx src/components/auth/sign-up-form.tsx src/components/ai-elements
git commit -m "feat(harbor): migrate shared components from lucide-react to phosphor icons"
```

Batch C — shadcn primitives (19 files):
```bash
git add src/components/ui/accordion.tsx src/components/ui/breadcrumb.tsx src/components/ui/calendar.tsx src/components/ui/carousel.tsx src/components/ui/checkbox.tsx src/components/ui/command.tsx src/components/ui/context-menu.tsx src/components/ui/dialog.tsx src/components/ui/dropdown-menu.tsx src/components/ui/input-otp.tsx src/components/ui/menubar.tsx src/components/ui/navigation-menu.tsx src/components/ui/pagination.tsx src/components/ui/radio-group.tsx src/components/ui/resizable.tsx src/components/ui/select.tsx src/components/ui/sheet.tsx src/components/ui/sidebar.tsx src/components/ui/spinner.tsx
git commit -m "feat(harbor): migrate shadcn primitives from lucide-react to phosphor icons"
```

- [ ] **Step 4: Remove the now-unused `lucide-react` dependency**

Run: `grep -r "lucide-react" src/ ` (or `Select-String -Path src -Pattern "lucide-react" -Recurse` in PowerShell)
Expected: zero matches.

Remove the line `"lucide-react": "^0.575.0",` from `package.json`'s dependencies, then run `bun install` and `npm install --package-lock-only` to sync both lockfiles.

- [ ] **Step 5: Full verification pass**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | tail -n 40`
Expected: no new errors beyond the 2 pre-existing `vite.config.ts` errors.

Run: `bun run build 2>&1 | tail -n 60`
Expected: build completes successfully (client + SSR + nitro), with no `lucide-react` chunk in the output bundle listing.

- [ ] **Step 6: Commit the dependency removal**

```bash
git add package.json package-lock.json bun.lock
git commit -m "chore(harbor): remove unused lucide-react dependency"
```

---

## Task 4: Rebuild `Button` against Harbor tokens

**Files:**
- Modify: `src/components/ui/button.tsx`

**Interfaces:**
- Consumes: `--radius-brand`, `--primary`, `--primary-foreground` from Task 1; `cn`, `cva`, `Slot` (unchanged imports).
- Produces: `Button`, `buttonVariants` — same exported names and same prop signature (`variant`, `size`, `asChild`) as today, so every call site across the app keeps compiling without changes. Only the rendered classes change.

- [ ] **Step 1: Update `buttonVariants`**

In `src/components/ui/button.tsx`, replace the `cva` call's base classes and `default`/`outline`/`secondary` variants:

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-brand text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-brand px-3 text-xs",
        lg: "h-10 rounded-brand px-8",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
```

Changes from the current file: `rounded-md` → `rounded-brand` (base + `sm`/`lg` sizes), all `shadow`/`shadow-sm` removed (flat per Harbor's restraint principle), `focus-visible:ring-1` → `focus-visible:ring-2 ... ring-offset-2 ring-offset-background` (a more visible focus ring — accessibility improvement called for by the "highly accessible" requirement in the original request, and consistent with the ring-offset pattern already used elsewhere in this codebase, e.g. `switch.tsx`).

- [ ] **Step 2: Visually spot-check in isolation**

Run: `bun run build 2>&1 | tail -n 30`
Expected: build succeeds, no type errors (the prop signature is unchanged, so no call site should break).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "feat(harbor): rebuild Button against Harbor tokens (flat, rounded-brand, visible focus ring)"
```

---

## Task 5: Rebuild `Card`, `Badge`, `Input`, `Textarea` against Harbor tokens

**Files:**
- Modify: `src/components/ui/card.tsx`
- Modify: `src/components/ui/badge.tsx`
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/textarea.tsx`

**Interfaces:**
- Consumes: tokens from Task 1.
- Produces: same exported component/prop names as today (`Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`, `Badge`/`badgeVariants`, `Input`, `Textarea`) — no call site changes required.

- [ ] **Step 1: Update `Card`**

In `src/components/ui/card.tsx`, change the `Card` root's className from:
```tsx
"rounded-xl border bg-card text-card-foreground shadow"
```
to:
```tsx
"rounded-xl border border-border bg-card text-card-foreground"
```
(Drops the default `shadow` — cards are flat by default per Harbor's restraint principle; a raised/active state can be added per-usage with `shadow-sm` where genuinely needed, not as the component default.) Leave `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` exactly as they are — their spacing/typography classes don't reference radius or shadow.

- [ ] **Step 2: Update `Badge`**

In `src/components/ui/badge.tsx`, the `badgeVariants` `default` variant currently includes `shadow`. Change:
```tsx
default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
```
to:
```tsx
default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
```
and similarly for `destructive`:
```tsx
destructive:
  "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
```
(`secondary` and `outline` variants already have no shadow — leave unchanged.)

- [ ] **Step 3: Update `Input` and `Textarea`**

In both `src/components/ui/input.tsx` and `src/components/ui/textarea.tsx`, remove `shadow-sm` from the className string (search for `shadow-sm` in each file — it's the only shadow-related class present) and change `focus-visible:ring-1` to `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background` for the same visible-focus-ring accessibility reason as Task 4. Radius (`rounded-md`) is left as-is — it already inherits the tightened `--radius` scale from Task 1 automatically, no hardcoded value to change.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | tail -n 20`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/card.tsx src/components/ui/badge.tsx src/components/ui/input.tsx src/components/ui/textarea.tsx
git commit -m "feat(harbor): flatten Card/Badge/Input/Textarea shadows, improve focus rings"
```

---

## Task 6: Rebuild `Select` and `Accordion` (icon + shadow cleanup)

**Files:**
- Modify: `src/components/ui/select.tsx`
- Modify: `src/components/ui/accordion.tsx`

**Interfaces:**
- Consumes: Phosphor icons from Task 3 (`CaretDownIcon`, `CaretUpIcon`, `CheckIcon` for `select.tsx`; `CaretDownIcon` for `accordion.tsx`).
- Produces: same exported names (`Select`/`SelectTrigger`/etc., `Accordion`/`AccordionItem`/etc.) as today.

- [ ] **Step 1: Confirm Task 3 already updated these files' icon imports**

Task 3 Batch C already replaced `Check, ChevronDown, ChevronUp` (in `select.tsx`) and `ChevronDown` (in `accordion.tsx`) with their Phosphor equivalents. Open both files and confirm the imports read `import { CheckIcon, CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react";` (select.tsx) and `import { CaretDownIcon } from "@phosphor-icons/react";` (accordion.tsx), and every JSX usage matches. If Task 3 was skipped or these two files were missed, apply the same import/usage swap now before continuing.

- [ ] **Step 2: Remove shadow from `SelectTrigger` and `SelectContent`**

In `src/components/ui/select.tsx`, remove `shadow-sm` from `SelectTrigger`'s className and `shadow-md` from `SelectContent`'s className (both currently present). Leave every other class (radius, animation, data-state handling) unchanged.

- [ ] **Step 3: Verify Accordion needs no further changes**

`accordion.tsx` has no shadow classes to remove — confirm this by reading the file; if none are found, no edit is needed for this file beyond the icon swap already covered by Task 3.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | tail -n 20`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/select.tsx src/components/ui/accordion.tsx
git commit -m "feat(harbor): flatten Select shadows, confirm Accordion icon migration"
```

---

## Task 7: Rebuild `app-shell.tsx`

**Files:**
- Modify: `src/components/app-shell.tsx`

**Interfaces:**
- Consumes: Phosphor icons from Task 3, tokens from Task 1.
- Produces: same exports (`AppShell`, `PageHeader`) with the same prop signatures — every route composing `<AppShell><PageHeader .../>...</AppShell>` keeps working unchanged.

- [ ] **Step 1: Flatten the desktop sidebar**

The sidebar `<aside>` currently has no shadow (confirmed by reading the file — only `border-r border-sidebar-border bg-sidebar`), so no shadow removal is needed here. Leave the `<aside>` wrapper classes as-is.

- [ ] **Step 2: Fix the duplicate `Brand` wordmark render**

The `Brand` component currently renders the "SomeoneNear" wordmark in both the `!compact` and `compact` branches (an existing redundant duplicate noted during investigation — lines both render `<span className="text-lg font-semibold tracking-tight text-foreground">SomeoneNear</span>`). Since both branches render the same output today, this is dead complexity worth fixing while already touching this file. Replace:

```tsx
function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-brand bg-brand-primary text-primary-foreground shadow-sm">
        <Heart className="h-5 w-5" strokeWidth={2.4} />
      </span>
      {!compact && (
        <span className="text-lg font-semibold tracking-tight text-foreground">SomeoneNear</span>
      )}
      {compact && (
        <span className="text-lg font-semibold tracking-tight text-foreground">SomeoneNear</span>
      )}
    </Link>
  );
}
```

with:

```tsx
function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-brand bg-primary text-primary-foreground">
        <HeartIcon className="h-5 w-5" weight="fill" />
      </span>
      <span className="font-display text-lg font-medium tracking-tight text-foreground">
        SomeoneNear
      </span>
    </Link>
  );
}
```

(`compact` prop is kept in the signature for call-site compatibility even though both branches now render identically — removing the parameter entirely would touch every call site for no behavioral gain, which is out of scope; this fix only removes the dead duplicate JSX branch. Icon changes from `Heart`/`bg-brand-primary`/`shadow-sm` to `HeartIcon`/`bg-primary`/no-shadow per Harbor's flat, token-consistent styling — `bg-brand-primary` and `bg-primary` currently resolve to the same color, but `bg-primary` is the more conventional semantic token for this use per the shadcn styling rules already followed elsewhere in this codebase.)

- [ ] **Step 3: Flatten `PageHeader`'s eyebrow and slogan treatment**

Per the spec's "no tracked-out uppercase labels" principle, replace:

```tsx
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-brand-accent">
            {eyebrow}
          </p>
        )}
        {slogan && (
          <p className="mt-1 text-[13px] font-medium italic text-brand-accent/80">
            {slogan}
          </p>
        )}
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
```

with:

```tsx
        {eyebrow && (
          <p className="text-sm font-medium text-brand-accent">{eyebrow}</p>
        )}
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {slogan && (
          <p className="mt-1 text-sm text-muted-foreground">{slogan}</p>
        )}
```

(Eyebrow drops uppercase/tracking, sentence case; slogan drops italic and the accent color — italic accent-colored taglines read as a marketing-template tell, plain muted text under the H1 reads calmer; H1 explicitly gets `font-display` now that the global `h1` rule in Task 1 already defaults to it, added here for clarity and to survive if `PageHeader` is ever used outside a page that inherits the global rule.)

Note: `PageHeader`'s call sites pass `slogan` before `title` conceptually but the JSX order changes (slogan now renders after the H1, not before) — this is an intentional layout change per the spec's typographic principles, and does not affect the component's prop interface (still accepts `eyebrow`, `slogan`, `title`, `description`, `children` in any order as props).

- [ ] **Step 4: Verify icon imports in this file already migrated**

Confirm the top-of-file import list reads (from Task 3): `HeartIcon, SquaresFourIcon, ChatCircleIcon, UsersIcon, GearIcon, SignOutIcon, HandHeartIcon, LifebuoyIcon, ChartLineIcon, PhoneCallIcon, PillIcon, HeadphonesIcon, CalendarHeartIcon` — and every `NAV`/`ADMIN_NAV`/`AGENT_NAV` array entry and JSX `<Icon .../>` usage matches. Fix any stragglers now if Task 3 missed this file.

- [ ] **Step 5: Verify**

Run: `bun run build 2>&1 | tail -n 40`
Expected: build succeeds. Since every authenticated route composes through `AppShell`, this is the highest-leverage manual check — visually confirm (via `bun run dev`, manually, since this is a UI change) that the sidebar nav, mobile bottom nav, and page headers render correctly on at least one route (e.g. `/dashboard` after Task 8).

- [ ] **Step 6: Commit**

```bash
git add src/components/app-shell.tsx
git commit -m "feat(harbor): rebuild AppShell nav chrome and PageHeader typography, fix duplicate Brand wordmark"
```

---

## Task 8: Rebuild the dashboard (`src/routes/_authenticated/dashboard.tsx`)

**Files:**
- Modify: `src/routes/_authenticated/dashboard.tsx`

**Interfaces:**
- Consumes: Phosphor icons (Task 3), Harbor tokens (Task 1), `AppShell`/`PageHeader` (Task 7), `Button`/`Skeleton` (unchanged).
- Produces: same route export (`Route`, default component `Dashboard`) — no external consumer of this file besides the router itself.

- [ ] **Step 1: Flatten the hero check-in banner, remove orbit animation and avatar row**

Replace the entire hero `<section>` (from `{/* HERO CHECK-IN */}` through its closing `</section>`, i.e. everything currently inside the `gradient-sunrise`/orbit-ring block) with:

```tsx
      {/* HERO CHECK-IN */}
      <section className="rounded-xl border border-border bg-primary/8 p-6 sm:p-8 md:p-10">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-brand border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <GreetIcon className="h-3.5 w-3.5" />
            {greetText}
          </div>
          <h1 className="mt-4 font-display text-3xl font-medium leading-tight text-foreground sm:text-4xl">
            {greetText}, {firstName}
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            A few minutes for you can make a big difference. Ready for today's check-in?
          </p>
          <blockquote className="mt-3 border-l-2 border-primary/30 pl-3 text-sm italic text-muted-foreground">
            "{quote}"
          </blockquote>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg">
              <Link to="/companion">
                <SparkleIcon className="mr-2 h-4 w-4" /> Start today's check-in
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/insights">
                <ChartLineIcon className="mr-2 h-4 w-4" /> Quick mood check-in
              </Link>
            </Button>
          </div>
        </div>
      </section>
```

This drops: the `gradient-sunrise` background, the two blurred decorative circles, the orbiting family-avatar animation (`hero-orbit-ring`, `orbit-slot`, all 5 avatar images), `heroMug`/`bloomOrb` images, and the emoji (`☀️`) per the frontend-design guidance against decorative emoji. The 5 `avatarGrandma/Dad/Mom/Teen/Kid` imports and `heroMug`/`bloomOrb` imports at the top of the file become unused — remove those import lines in Step 2.

- [ ] **Step 2: Remove now-unused image imports**

Delete these lines from the top of the file:
```tsx
import heroMug from "@/assets/checkin-hero.png";
import bloomOrb from "@/assets/bloom-orb.png";
import avatarGrandma from "@/assets/avatar-grandma.png";
import avatarDad from "@/assets/avatar-dad.png";
import avatarMom from "@/assets/avatar-mom.png";
import avatarTeen from "@/assets/avatar-teen.png";
import avatarKid from "@/assets/avatar-kid.png";
```
Do not delete the underlying `.png` asset files themselves — other code may reference them, and asset cleanup is outside this plan's scope (verify with `grep -r "avatar-grandma\|bloom-orb\|checkin-hero" src/` before assuming it's safe to delete the files; if this plan's execution finds other consumers, leave the files in place regardless).

- [ ] **Step 3: Flatten the stat tiles into hairline-divided rows**

Replace the entire `{/* STATS ROW */}` section (the `<section>` containing 3 `StatTile` calls plus the inline companion-quota tile) with:

```tsx
      {/* STATS ROW */}
      <section className="mt-6 divide-y divide-border rounded-xl border border-border bg-card sm:grid sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
        <StatRow
          icon={<FireIcon className="h-5 w-5 text-primary" />}
          label="Current streak"
          value={`${streak} ${streak === 1 ? "day" : "days"}`}
          hint={streak > 0 ? "Keep it going" : "Start today"}
        />
        <StatRow
          icon={<ChartLineIcon className="h-5 w-5 text-primary" />}
          label="Mood check-ins"
          value={`${checkInCount}`}
          hint="Private and yours"
        />
        <StatRow
          icon={<HandHeartIcon className="h-5 w-5 text-primary" />}
          label="Membership"
          value={tierLabel}
          hint={profile?.care_status ?? "active"}
        />
        <StatRow
          icon={<SparkleIcon className="h-5 w-5 text-primary" />}
          label="Companion quota"
          value={
            quotaLoading || !quota ? "…" : quotaUnlimited ? "Unlimited" : String(quota.remaining)
          }
          hint={quotaUnlimited ? "Chat as much as you need" : `Refills ${resetsAt ?? "daily"}`}
        />
      </section>
```

This removes the `ProgressRing` donut-chart entirely (its gradient-filled SVG doesn't fit Harbor's flat token system) in favor of a plain numeric value, consistent with the other 3 tiles. `ProgressRing` becomes an unused function — remove its definition (Step 4).

- [ ] **Step 4: Remove `ProgressRing`, add `StatRow`**

Delete the entire `ProgressRing` function definition (from `function ProgressRing({` through its closing `}`).

Add a new `StatRow` helper (replacing the old `StatTile` — see Step 6 for its removal) directly above the existing `QuickTile` function definition:

```tsx
function StatRow({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-3 p-4 sm:flex-col sm:items-start sm:gap-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-brand bg-primary/10">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="truncate text-xl font-semibold text-foreground">{value}</div>
        <div className="truncate text-xs text-muted-foreground">{hint}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Simplify quick-access tiles (drop pointer-tilt, flatten background)**

Replace the `{/* QUICK ACCESS TILES */}` section's 4 `QuickTile` calls' `gradient` prop usage — since `QuickTile` itself is being rewritten in Step 6 to no longer take a `gradient` prop, update the call sites to:

```tsx
          <QuickTile
            to="/companion"
            icon={<ChatCircleIcon className="h-6 w-6" />}
            title="AI Companion"
            desc="Talk it through, gently."
          />
          <QuickTile
            to="/listeners"
            icon={<EarIcon className="h-6 w-6" />}
            title="Human Listener"
            desc="A real person, on your schedule."
          />
          <QuickTile
            to="/insights"
            icon={<ChartLineIcon className="h-6 w-6" />}
            title="Mood Insights"
            desc="See your patterns over time."
          />
          <QuickTile
            to="/family"
            icon={<UsersIcon className="h-6 w-6" />}
            title="Family Circle"
            desc="Share only what you choose."
          />
```

Also remove the `[&>*]:animate-fade-up [&>*:nth-child(1)]:[animation-delay:80ms] ...` staggered-delay classes from the wrapping `<div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 ...">` — per the spec's "one deliberate motion moment per screen" principle, the hero's own entrance is the screen's one motion moment; the grid itself renders without a staggered reveal. The wrapping div's className becomes simply `"grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"`.

- [ ] **Step 6: Rewrite `QuickTile`, remove `StatTile`**

Delete the old `StatTile` function entirely (superseded by `StatRow` in Step 4).

Replace the `QuickTile` function with:

```tsx
function QuickTile({
  to,
  icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to as "/companion"}
      className="group relative rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-brand bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="mt-4 text-base font-medium text-foreground">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
      <ArrowUpRightIcon className="absolute right-4 top-4 h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </Link>
  );
}
```

(Drops `data-tilt`/`card-tilt`/`card-hover`, the colored `gradient` prop, and the rotate/scale hover flourish on the icon — replaced with a simple border/background color shift on hover, matching the spec's "ordinary `:hover` states" principle. The small arrow-translate on hover is kept since it's a direct response to the hover action, not ambient decoration.)

- [ ] **Step 7: Flatten achievements grid and side-panel links**

Replace the `badges` array's `tone` values (currently `"gradient-peach"`, `"gradient-sage"`, `"gradient-blush"`, `"gradient-lilac"`) — since achievement tiles no longer use per-badge gradient colors, simplify the array and its consumer. Replace:

```tsx
  const badges = [
    { label: "First check-in", earned: checkInCount >= 1, tone: "gradient-peach" },
    { label: "3-day streak", earned: streak >= 3, tone: "gradient-sage" },
    { label: "Reflective 10", earned: checkInCount >= 10, tone: "gradient-blush" },
    { label: "Guardian", earned: streak >= 7, tone: "gradient-lilac" },
  ];
```

with:

```tsx
  const badges = [
    { label: "First check-in", earned: checkInCount >= 1 },
    { label: "3-day streak", earned: streak >= 3 },
    { label: "Reflective 10", earned: checkInCount >= 10 },
    { label: "Guardian", earned: streak >= 7 },
  ];
```

Then replace the achievements grid's per-badge rendering:

```tsx
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-5 sm:grid-cols-4 sm:gap-3">
            {badges.map((b) => (
              <div
                key={b.label}
                className={`flex flex-col items-center gap-1.5 rounded-brand border p-3 text-center sm:gap-2 sm:p-4 ${
                  b.earned ? "border-primary/30 bg-primary/5" : "border-border bg-muted/40"
                }`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full sm:h-12 sm:w-12 ${
                    b.earned ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <StarIcon className="h-5 w-5 sm:h-6 sm:w-6" weight={b.earned ? "fill" : "regular"} />
                </div>
                <span className="text-xs font-medium leading-tight text-foreground">
                  {b.label}
                </span>
                {b.earned && (
                  <span className="text-[11px] text-primary">Earned</span>
                )}
              </div>
            ))}
          </div>
```

Remove the stray `animate-pop-in`/`style={{ animationDelay: ... }}` per-badge stagger, consistent with Step 5's one-motion-moment principle.

Finally, replace the two side-panel `gradient-sage`/`gradient-blush` `card-hover` links (`/insights` and `/safety`) with flat bordered equivalents:

```tsx
          <Link
            to="/insights"
            className="group flex items-center justify-between rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <div>
              <div className="text-xs font-medium text-muted-foreground">Insights</div>
              <div className="mt-1 text-base font-medium text-foreground">Your mood trends</div>
              <div className="mt-1 text-xs text-muted-foreground">
                See patterns over time. Gently.
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-brand bg-primary/10 text-primary">
              <ChartLineIcon className="h-5 w-5" />
            </div>
          </Link>

          <Link
            to="/safety"
            className="group flex items-center justify-between rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <div>
              <div className="text-xs font-medium text-muted-foreground">Feeling overwhelmed?</div>
              <div className="mt-1 text-base font-medium text-foreground">Safety toolkit</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Grounding, hotlines, one-tap help.
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-brand bg-primary/10 text-primary">
              <LifebuoyIcon className="h-5 w-5" />
            </div>
          </Link>
```

- [ ] **Step 8: Verify icon imports at the top of the file are complete**

Confirm the top-of-file `lucide-react` import (already converted by Task 3) is replaced by a `@phosphor-icons/react` import covering every icon actually still used after Steps 1-7: `SparkleIcon, HandHeartIcon, ChatCircleIcon, EarIcon, ArrowUpRightIcon, FireIcon, TrophyIcon, StarIcon, SunIcon, MoonIcon, CloudIcon, ChartLineIcon, LifebuoyIcon, UsersIcon, PhoneCallIcon`. Remove any import for an icon no longer referenced after this task's rewrites (e.g. if `TrophyIcon` is still used in the achievements header — confirm it is, in the unmodified `<Trophy>`/`<TrophyIcon>` header line — keep it; remove any that truly became unused).

- [ ] **Step 9: Verify**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | tail -n 30`
Expected: no new errors, no unused-import warnings if the linter runs as part of typecheck (this repo's `tsconfig` — verify by checking output).

Run: `bun run build 2>&1 | tail -n 40`
Expected: build succeeds.

Manually verify in a browser (`bun run dev`, navigate to `/dashboard` while signed in) at 375px, 768px, and 1280px widths: hero renders without the orbit/avatar animation, stat row shows 4 items with dividers, quick-access tiles show flat hover states, achievements grid renders, no console errors.

- [ ] **Step 10: Commit**

```bash
git add src/routes/_authenticated/dashboard.tsx
git commit -m "feat(harbor): rebuild dashboard - flat hero, hairline stat rows, simplified quick-access tiles"
```

---

## Task 9: Rebuild the landing page (`src/routes/index.tsx`)

**Files:**
- Modify: `src/routes/index.tsx`

**Interfaces:**
- Consumes: Phosphor icons (Task 3), Harbor tokens (Task 1), `Button`/`Accordion*` (Tasks 4/6), existing sibling components `FeedbackDialog`, `GentleNudge`, `NudgeDot`, `QuietEmptyState`, `CallCardPreview`, `AiSnippetPreview`, `TrustBadge` (all unchanged, consumed as-is).
- Produces: same route export (`Route`, `Landing`) — no external consumer besides the router.

- [ ] **Step 1: Left-align the header and hero**

Replace the `<header>` block:

```tsx
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Heart className="h-5 w-5" strokeWidth={2.2} fill="currentColor" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">SomeoneNear</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <Button asChild variant="ghost" className="rounded-full">
            <Link to="/docs">Docs</Link>
          </Button>
          <Button asChild className="rounded-full">
            <Link to={nextStep}>{signedIn ? "Open app" : "Start gently"}</Link>
          </Button>
        </div>
      </header>
```

with:

```tsx
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-brand bg-primary text-primary-foreground">
            <HeartIcon className="h-4.5 w-4.5" weight="fill" />
          </span>
          <span className="font-display text-lg font-medium tracking-tight">SomeoneNear</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <Button asChild variant="ghost">
            <Link to="/docs">Docs</Link>
          </Button>
          <Button asChild>
            <Link to={nextStep}>{signedIn ? "Open app" : "Start gently"}</Link>
          </Button>
        </div>
      </header>
```

(Buttons drop their `rounded-full` override, relying on `Button`'s new `rounded-brand` default from Task 4.)

Replace the hero `<section>`:

```tsx
        <section className="space-y-8 pt-8 text-center">
          <p className="inline-flex items-center gap-2.5 rounded-full border border-border bg-surface px-4 py-2 text-xs text-muted-foreground">
            <NudgeDot />
            A quiet place to be heard
          </p>
          <h1 className="font-display text-4xl font-semibold leading-[1.15] sm:text-5xl">
            Someone near, whenever you don't know who to call
          </h1>
          <p className="mx-auto max-w-lg text-lg leading-relaxed text-muted-foreground">
            SomeoneNear gives you a caring check-in, a real listener, and someone near in
            the moments when you don't want to be alone.
          </p>
          <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="w-full rounded-2xl px-8 sm:w-auto">
              <Link to={nextStep}>
                {signedIn ? "Open SomeoneNear" : "Start your journey"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="w-full rounded-2xl sm:w-auto">
              <Link to="/docs">See how it works</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            No pressure. No performance. Leave whenever you like.
          </p>
        </section>
```

with:

```tsx
        <section data-reveal className="space-y-6 pt-8">
          <p className="inline-flex items-center gap-2.5 rounded-brand border border-border bg-surface px-4 py-2 text-xs text-muted-foreground">
            <NudgeDot />
            A quiet place to be heard
          </p>
          <h1 className="font-display text-4xl font-medium leading-[1.15] sm:text-5xl">
            Someone near, whenever you don't know who to call
          </h1>
          <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
            SomeoneNear gives you a caring check-in, a real listener, and someone near in
            the moments when you don't want to be alone.
          </p>
          <div className="flex flex-col items-start gap-3 pt-2 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to={nextStep}>
                {signedIn ? "Open SomeoneNear" : "Start your journey"}
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="w-full sm:w-auto">
              <Link to="/docs">See how it works</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            No pressure. No performance. Leave whenever you like.
          </p>
        </section>
```

(Left-aligned per the spec; `data-reveal` added so the hero itself becomes the page's one deliberate motion moment on load, using the existing IntersectionObserver mechanism already wired up later in the file — since the hero is above the fold, it will trigger almost immediately, which is fine and matches "one deliberate entrance.")

- [ ] **Step 2: De-gradient the trust/credibility icon badges and features grid**

The "Trust & credibility", "Check-In", and "Features" sections each render icon badges as `bg-primary/12 text-primary` inside `rounded-2xl` — these already use semantic tokens (`bg-primary`) rather than a hardcoded gradient, so they carry over correctly without changes to color; only the icon components need swapping to Phosphor (via Task 3) and the outer card radius/shadow needs to align with Harbor's flatter style. Replace every occurrence of:
```tsx
              className="rounded-3xl border border-border bg-surface p-6 shadow-gentle"
```
(and its `p-8` variant in the Check-In section) across these three sections with:
```tsx
              className="rounded-xl border border-border bg-surface p-6"
```
(drop `shadow-gentle`, tighten `rounded-3xl` → `rounded-xl`; keep `p-8` where it already exists in the Check-In section, only changing the radius/shadow portion).

Remove the features grid's hover flourish — change:
```tsx
                className="rounded-3xl border border-border bg-surface p-6 shadow-gentle transition-transform duration-500 hover:-translate-y-0.5"
```
to:
```tsx
                className="rounded-xl border border-border bg-surface p-6 transition-colors hover:border-primary/40"
```

- [ ] **Step 3: De-gradient the campaign banner**

Replace:
```tsx
        <section
          data-reveal
          className="space-y-4 rounded-[2.5rem] gradient-sunrise px-8 py-12 text-center shadow-soft"
        >
          <h2 className="font-display text-3xl font-semibold text-ink">
            You can't always be there.
            <br />
            But what if someone could?
          </h2>
          <p className="mx-auto max-w-md leading-relaxed text-ink/75">
            People still care. Life just got busy. SomeoneNear stands in the gap, quietly,
            kindly, whenever it's needed.
          </p>
          <div className="pt-2">
            <Button asChild size="lg" className="rounded-2xl px-8">
              <Link to={nextStep}>Bring someone near</Link>
            </Button>
          </div>
        </section>
```
with:
```tsx
        <section data-reveal className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 px-8 py-12 text-center">
          <h2 className="font-display text-3xl font-medium text-foreground">
            You can't always be there.
            <br />
            But what if someone could?
          </h2>
          <p className="mx-auto max-w-md leading-relaxed text-muted-foreground">
            People still care. Life just got busy. SomeoneNear stands in the gap, quietly,
            kindly, whenever it's needed.
          </p>
          <div className="pt-2">
            <Button asChild size="lg" className="px-8">
              <Link to={nextStep}>Bring someone near</Link>
            </Button>
          </div>
        </section>
```
(Drops the `--color-ink`-specific text colors since this section no longer sits on a light gradient background — `text-foreground`/`text-muted-foreground` work correctly on the new flat `bg-primary/5` surface in both light and dark mode.)

- [ ] **Step 4: Flatten remaining `rounded-3xl`/`shadow-gentle` card instances**

Search the file for every remaining `rounded-3xl` and `shadow-gentle`/`shadow-soft` occurrence (the live-stats tiles, pricing cards, FAQ accordion wrapper if any, safety/feedback rows, footer) and apply the same substitution as Step 2: `rounded-3xl` → `rounded-xl`, drop `shadow-gentle`/`shadow-soft`. This includes:
- The 3 live-stats tiles (`"rounded-3xl border border-border bg-surface px-6 py-7 text-center shadow-gentle"` → `"rounded-xl border border-border bg-surface px-6 py-7 text-center"`)
- Both pricing plan cards (`"relative rounded-3xl border p-6 shadow-gentle ..."` → `"relative rounded-xl border p-6 ..."`, keeping the conditional `border-primary/45 bg-surface` vs `border-border bg-card` logic unchanged)
- The safety/feedback info rows (`"flex items-start gap-4 rounded-3xl border border-border bg-surface p-6 shadow-gentle"` and its sibling → `rounded-xl`, no shadow)

Leave the "Most chosen" pill badge's `rounded-full` unchanged (it's a genuine pill/badge, matching the spec's "keep `rounded-full` for genuinely circular/pill elements" rule).

- [ ] **Step 5: Verify icon imports are complete**

Confirm the top-of-file import (converted by Task 3) covers every icon still referenced after Steps 1-4: `HeartIcon, UsersIcon, ChartLineIcon, ShieldIcon, ShieldCheckIcon, PhoneCallIcon, BellRingingIcon, CalendarHeartIcon, CheckIcon, ArrowRightIcon, EnvelopeSimpleIcon, ChatCircleTextIcon, HeadphonesIcon`.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | tail -n 30`
Expected: no new errors.

Run: `bun run build 2>&1 | tail -n 40`
Expected: build succeeds.

Manually verify in a browser at 375px, 768px, and 1280px: header/hero left-aligned, no gradient backgrounds anywhere on the page, FAQ accordion still expands/collapses correctly (Phosphor caret rotates on open, from Task 3's `accordion.tsx` changes), `data-reveal` sections still fade in on scroll (confirm `prefers-reduced-motion` still suppresses this, per the existing IntersectionObserver logic which is untouched).

- [ ] **Step 7: Commit**

```bash
git add src/routes/index.tsx
git commit -m "feat(harbor): rebuild landing page - left-aligned hero, flat cards, de-gradiented banner"
```

---

## Task 10: Rebuild the listeners page (`src/routes/_authenticated/listeners.tsx`)

**Files:**
- Modify: `src/routes/_authenticated/listeners.tsx`

**Interfaces:**
- Consumes: Phosphor icons (Task 3), Harbor tokens (Task 1), `Card`/`Button`/`Input`/`Select`/`Textarea`/`Badge`/`Skeleton` (Tasks 4-6), `EmptyState`, `PostCallFeedbackCard` (unchanged).
- Produces: same route export — no external consumer besides the router.

- [ ] **Step 1: De-gradient the emergency-callback card**

Replace:
```tsx
        <Card className="rounded-brand border-2 border-brand-primary/40 bg-gradient-to-br from-brand-primary/10 to-brand-accent/5 animate-slide-in-up stagger-2">
```
with:
```tsx
        <Card className="rounded-brand border-2 border-primary/30 bg-primary/5">
```
(Drops the two-color diagonal gradient and the entrance-stagger animation class, consistent with "one deliberate motion moment per screen" — the page's one motion moment is reserved for elsewhere if any; this card renders immediately without a staggered delay.)

Replace both emergency-callback CTA buttons' className:
```tsx
                    className="flex-1 rounded-brand gradient-sunrise text-white"
```
and
```tsx
                className="w-full rounded-brand gradient-sunrise text-white"
```
with (respectively):
```tsx
                    className="flex-1"
```
and
```tsx
                className="w-full"
```
(Both buttons already get `Button`'s default `bg-primary text-primary-foreground` styling from Task 4 — the inline `gradient-sunrise text-white` override is removed entirely, and `rounded-brand` is also removed since it's now the component default.)

- [ ] **Step 2: Remove entrance-stagger animation classes from the booking form card and `RuleTile`**

Replace:
```tsx
        <Card className="rounded-brand border-border bg-card animate-slide-in-up stagger-1">
```
with:
```tsx
        <Card className="rounded-brand border-border bg-card">
```

In the `RuleTile` function, replace:
```tsx
    <div className={`rounded-brand border border-border bg-card p-4 card-lift animate-slide-in-up stagger-${delay}`}>
```
with:
```tsx
    <div className="rounded-brand border border-border bg-card p-4">
```
(The `delay` prop becomes unused inside this function body — but `RuleTile`'s call sites still pass a `delay` prop; leave the prop in the function signature for now since removing it means touching 3 call sites for a prop that's genuinely harmless to keep unused. This matches the "don't propose unrelated refactoring" guidance — the parameter isn't broken, it's just no longer wired to a stagger animation.)

- [ ] **Step 3: Move booking history from stacked cards to hairline-divided rows**

This requires reading the full `BookingRow` function (lines ~370-536, per the context-gatherer's earlier findings) before rewriting it. Since this task's scope note said the booking history list "moves from stacked `Card`s to hairline-divided rows," and `BookingRow` currently renders each booking as its own `<Card>`:

Find the outer wrapper around the mapped bookings (currently `<div className="grid gap-3">` wrapping `{upcoming.map(...)}` and `{past.map(...)}`, per the earlier read of lines 420-440) and change it to:
```tsx
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
```

Inside `BookingRow` itself, change the outer `<Card className="rounded-brand border-border bg-card animate-slide-in-up stagger-${...} ${past ? "opacity-70" : ""}">` wrapper to a plain `<div>` with padding instead of card styling (since the row now sits inside the shared divided container from the change above, not as its own bordered card):
```tsx
    <div className={`p-4 ${past ? "opacity-60" : ""}`}>
```
Remove the `animate-slide-in-up stagger-${Math.min(delay, 6)}` entrance animation (consistent with this task's "no scattered fade-ups" principle) and change `CardContent`'s wrapping to a plain `<div>` if `BookingRow` currently uses `<CardContent>` internally (verify against the actual file content when implementing — if it uses `<CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">`, change to `<div className="flex flex-wrap items-center justify-between gap-3">` since the outer `<div className="p-4">` now supplies the padding).

- [ ] **Step 4: Flatten `RuleTile`'s icon badge and remove gradient text**

If `RuleTile` uses `text-brand-accent` for its icon badge background (`bg-brand-primary/15 text-brand-accent`), leave this as-is — `brand-accent` is now the Ember Text token from Task 1, which is an intentional, accessible warm accent for exactly this kind of small icon-in-circle usage.

- [ ] **Step 5: Verify icon imports are complete**

Confirm the top-of-file import (converted by Task 3) covers every icon still used: `AlarmIcon` (was `AlarmClockCheck`), `CalendarDotIcon` (was `CalendarClock`), `EarIcon`, `HandHeartIcon` (was `HeartHandshake`), `SpinnerGapIcon` (was `Loader2`), `PhoneIcon`, `PhoneCallIcon`, `ShieldCheckIcon`, `XIcon`.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | tail -n 30`
Expected: no new errors.

Run: `bun run build 2>&1 | tail -n 40`
Expected: build succeeds.

Manually verify in a browser (signed in, at `/listeners`) at 375px, 768px, 1280px: booking form and emergency card render without gradients, booking history renders as a single divided list rather than stacked separate cards, reschedule/cancel actions still function (this task doesn't touch any mutation logic, only className/JSX structure).

- [ ] **Step 7: Commit**

```bash
git add src/routes/_authenticated/listeners.tsx
git commit -m "feat(harbor): rebuild listeners page - flat emergency card, hairline-divided booking history"
```

---

## Task 11: Final verification pass

**Files:**
- None modified — this task only runs checks.

**Interfaces:**
- Consumes: the complete state of the repo after Tasks 1-10.
- Produces: a pass/fail verification report (no code artifact).

- [ ] **Step 1: Confirm zero `lucide-react` imports remain**

Run: `Select-String -Path src -Pattern 'from "lucide-react"' -Recurse` (PowerShell) or `grep -r 'from "lucide-react"' src/`
Expected: zero matches.

- [ ] **Step 2: Confirm the 3 reference screens + app-shell no longer use removed utility classes**

Run: `Select-String -Path src/routes/index.tsx,src/routes/_authenticated/dashboard.tsx,src/routes/_authenticated/listeners.tsx,src/components/app-shell.tsx -Pattern "gradient-sunrise|gradient-peach|gradient-sage|gradient-blush|gradient-sky|gradient-lilac|gradient-mint|gradient-animated|card-tilt|card-glow|card-hover|card-lift"`
Expected: zero matches in these 4 files specifically (the utility class *definitions* in `styles.css` and their usage in other, out-of-scope files are expected to remain and are not a failure).

- [ ] **Step 3: Full typecheck and build**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | tail -n 40`
Expected: only the 2 pre-existing `vite.config.ts` errors (confirm by comparing against the count noted in this plan's Global Constraints — no new errors).

Run: `bun run build 2>&1 | tail -n 60`
Expected: full build (client + SSR + nitro) succeeds with no errors, output shows no `lucide-react` chunk, shows a `@phosphor-icons` chunk.

- [ ] **Step 4: Run the existing Playwright smoke test**

Run: `bunx playwright test tests/e2e/smoke.spec.ts --reporter=list`
Expected: passes (landing page loads, title renders) — confirms the landing page rebuild in Task 9 didn't break the baseline smoke assertion.

- [ ] **Step 5: Manual accessibility spot-check**

Using the browser dev tools contrast checker or a tool of choice, verify:
- Body text (`--foreground` on `--background`) contrast in light mode ≥ 4.5:1 (computed in this plan's design phase: 14.69:1 — should pass trivially).
- Primary button text (`--primary-foreground` on `--primary`) contrast ≥ 4.5:1 (computed: 7.57:1 — should pass).
- Every interactive element (buttons, links, nav items, form controls) shows a visible focus ring when tabbed to, on both the landing page and an authenticated page.
- Toggle OS-level "reduce motion" and confirm the landing page's `data-reveal` sections render immediately visible (no fade/slide) and the dashboard's remaining `animate-fade-in`/`animate-pop-in` usages (main content fade-in in `AppShell`, if any surviving stagger) respect the existing global reduced-motion CSS rule in `styles.css`.

- [ ] **Step 6: Report results, no commit**

This task produces no file changes — summarize the verification results (pass/fail per step above) at the end of plan execution. If any step fails, fix the underlying issue in the relevant earlier task's files and re-run this task's checks before considering the plan complete.

---

## Explicitly Out of Scope (carried from the spec)

- The remaining ~20 authenticated/admin/public routes not covered by Tasks 8-10 (companion, insights, family, settings, admin.calls, agent.console, send-later, reminders, safety, docs, checkout, auth, etc.) still visually use the old sand-and-clay gradient/card-interaction system after this plan completes — icons are migrated (Task 3 is codebase-wide) but layout/color treatment is not. This is intentional per the spec's foundation-first rollout and is the subject of a follow-up plan.
- No change to underlying data, business logic, or server functions.
- No change to the Telnyx calling UI/architecture.
- Dark mode oklch values in Task 1 are a best-effort direction-following pass, not exhaustively visually tuned — flagged in the spec as expected to need a follow-up look.
