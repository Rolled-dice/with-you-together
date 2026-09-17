# Expo readiness — component coupling convention

SomeoneNear is a web app (TanStack Start SSR on Cloudflare Workers). This doc
records a **loose-coupling convention** so that *if* the app is later ported to
a native Expo / React Native app, the port is a gradual "strangle" (per the
`expo-web-to-native` guidance) rather than a rewrite — you carry the portable
core over and rewrite only the web-coupled shell.

This is forward-looking guidance, not an active migration. Nothing here adopts
React Native or Expo today. It exists so new components are written in a way
that keeps a future port cheap, and so the existing platform-coupled code is
named and isolated rather than leaking into portable components.

## The three tiers

Classify every component (and hook) into one of three tiers. Keep tiers
**separated into different files** where a component currently mixes them —
the presentational core in its own file, the coupling in a thin container.

### Tier 1 — Presentational (portable)

Props in, JSX out. **No** `window`/`document`/DOM APIs, **no** router imports,
**no** data fetching, **no** Supabase, **no** `env()` CSS, **no** pointer/mouse
event wiring. Reports user intent upward via callback props.

These port to React Native with a thin adapter (or NativeWind for the Tailwind
classes) and are the core worth preserving.

Examples in this codebase:
- `src/components/notifications/notification-list.tsx` — the reference split
  (see below). Pure list renderer; parent supplies data + `onDismiss`.
- `src/components/ui/*` shadcn primitives (`button.tsx`, `card.tsx`,
  `badge.tsx`, `input.tsx`, `textarea.tsx`) — mostly Tier 1 already: they take
  props and render, with no data/router/DOM coupling. (Radix-based ones like
  `select.tsx`/`dialog.tsx` depend on Radix web primitives, so they are Tier 1
  in intent but need native equivalents on port — noted per-file below.)
- `src/components/trust-badge.tsx`, `src/components/gentle-nudge.tsx`,
  `src/components/empty-state.tsx`, `src/components/quiet-empty-state.tsx`.

### Tier 2 — Platform-coupled (web-only)

Uses the DOM, `window`, pointer/mouse events, `IntersectionObserver`, GSAP DOM
tweens, CSS `env()` safe-area insets, `scrollIntoView`, etc. These are the
"leave in the webview / rewrite natively" bucket. Keep them out of Tier 1
components so portability isn't contaminated.

Examples in this codebase:
- `src/components/someonenear-cursor.tsx` — custom cursor; pure web, dropped
  entirely on native (no cursor on touch).
- `src/hooks/use-pointer-parallax.ts`, `src/hooks/use-card-interactions.ts` —
  pointer-driven decorative effects; web-only, dropped on native.
- The landing page GSAP motion in `src/routes/index.tsx` (ScrollTrigger reveal,
  count-up, hover) — web motion; native uses Reanimated/Moti instead.
- `src/components/app-shell.tsx` — uses `env(safe-area-inset-*)`,
  `scrollIntoView`, and web nav chrome. Native replaces this wholesale with
  `expo-router` navigation (NativeTabs) + `react-native-safe-area-context`.

### Tier 3 — Data / route coupled

`createServerFn` / `useServerFn`, TanStack Router (`Link`, `useRouterState`,
`useNavigate`), the Supabase browser client, React Query wired to the above.

On a native port these become the RN data layer (`expo-data-fetching` /
React Query against the same HTTP backend) and `expo-router`. Keep them in
container components that wrap Tier 1 presentational children.

Examples: `src/components/notification-bell.tsx` (container), all
`src/lib/*.functions.ts`, every `src/routes/**` route component.

## Reference refactor: NotificationBell → NotificationList

`NotificationBell` previously mixed all three tiers in one file: Supabase
realtime + server-fns (Tier 3), a web dropdown/popover + `window`-relative
sizing (Tier 2), and the notification thread rendering (Tier 1).

It was split:
- **`notifications/notification-list.tsx`** (Tier 1) — pure renderer:
  `items` + `onDismiss` props, no data, no Supabase, no router. Portable as-is.
- **`notification-bell.tsx`** (Tier 2/3 container) — keeps the realtime
  subscription, server-fns, unread logic, and the web popover chrome; delegates
  thread rendering to `<NotificationList>`.

The rendered output is unchanged — this is a structural demonstration of the
convention, not a redesign. A future native port rewrites `NotificationBell`
(native data + a bottom sheet or dedicated screen) while `NotificationList`
carries over with near-identical props.

## Web → native mapping notes (for the eventual port)

| Web idiom (here) | Native equivalent |
|---|---|
| Tailwind utility classes | NativeWind, or RN `StyleSheet` |
| `env(safe-area-inset-*)` (app-shell) | `react-native-safe-area-context` |
| TanStack Router `Link` / `useRouterState` / `useNavigate` | `expo-router` (`Link`, `usePathname`, `useRouter`), NativeTabs |
| `@phosphor-icons/react` | `@phosphor-icons/react-native` |
| Supabase browser client | `@supabase/supabase-js` with RN storage adapter |
| `createServerFn` server functions | keep backend deployed; native app is an HTTP client (or EAS Hosting) |
| GSAP + ScrollTrigger (landing motion) | Reanimated / Moti |
| Custom cursor, pointer parallax, card tilt | dropped (no cursor/hover on touch) |
| shadcn/Radix primitives | `@expo/ui` (real SwiftUI/Compose) first, RN primitives for custom layouts |
| CSS `@media (pointer: coarse)` tap-target bumps | native tap targets are already touch-sized; the `coarse:` bumps are web-only |

## Rules for new components

1. Default to Tier 1. If a component needs data, router, or the DOM, put that in
   a container and keep a presentational child that could be rendered from
   anywhere.
2. Never import `window`/`document`/Supabase/router into a Tier 1 file.
3. Name Tier 2/3 coupling explicitly (a short comment at the top of the file,
   as done in `notification-list.tsx` and `notification-bell.tsx`).
4. This is a convention, not a framework — apply it to new work and when
   touching a mixed component, not as a big-bang refactor of the whole app.
