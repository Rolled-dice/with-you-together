# WithU — Motion, Voice & Listener Rules Pass

Bringing the landing-page energy into every authenticated screen, giving the Companion its own visual identity, adding a signature cursor, sprinkling WithU-voice slogans across sections, and rewriting the Listeners flow around the real in-house team + SLA rules.

---

## 1. Motion system (site-wide)

Extend the animation vocabulary already in `styles.css` and apply it uniformly.

- New shared utilities: `animate-fade-up`, `animate-pop-in`, `animate-float-slow`, `animate-shimmer-text`, `animate-orbit-slow`, `stagger-*` delay classes.
- Global parallax hook `usePointerParallax()` extracted from the landing page into `src/hooks/use-pointer-parallax.ts` so `data-parallax` works on every page.
- Route-level entrance: each authenticated page fades/slides its hero block in on mount, then staggers cards below.
- Hover choreography: cards lift, gradients shift, icons wiggle; reduced-motion respected via `@media (prefers-reduced-motion)`.
- Applied to:  Companion, Journal, Insights, Listeners, Family, Safety, Settings, Admin Feedback.

## 2. Signature cursor

A soft, on-brand cursor that reinforces the "gentle heartbeat" feel — desktop only, disabled on touch and for reduced-motion users.

- Component: `src/components/withu-cursor.tsx` mounted once in the auth layout and landing.
- Two layers: a small coral dot that tracks the pointer 1:1 and a larger peach ring that eases behind with spring-like damping.
- Interactive states:
  - Over buttons/links → ring expands, dot hides.
  - Over inputs/textareas → ring becomes an I-beam pill.
  - On press → ring pulses once.
- Native cursor kept visible as fallback (never `cursor: none` on inputs) so accessibility isn't broken.

## 3. WithU voice — slogans in every section

Short, warm one-liners layered into headers and empty states. Rotated per page so the app never feels repetitive.

Examples per surface:

- Dashboard hero: "Love, on the same page."
- Companion header: "A quiet room, whenever you need one."
- Journal header: "Your pages. Your pace."
- Insights header: "Small patterns, big kindness."
- Listeners header: "A real voice, on your side."
- Family header: "Closer, even from far."
- Safety header: "You are not alone tonight."
- Settings header: "Made just for you."

Rendered as the small uppercase tracked eyebrow above each page title, matching the landing page's "LOVE, ON THE SAME PAGE." treatment.

## 4. Companion redesign

Give the AI Companion its own space — closer to the reference: a calm, focused chat room with an identity, not a generic bubble list.

- New two-pane layout on desktop, single column on mobile.
- Left rail: companion identity card (name, soft avatar, "here for you" status dot), quick prompt chips ("Rough evening", "Vent for 2 min", "Help me sleep", "Something happy"), and today's usage ring.
- Right: conversation surface built on AI Elements primitives already installed (`Conversation`, `Message`, `MessageResponse`, `PromptInput`), assistant bubbles token-streamed with markdown, user bubbles in coral/foreground pair.
- Empty state: warm illustration + slogan + prompt chips instead of a blank screen.
- Composer: rounded, warm shadow, submit button as a heart-pulse icon; quota banner slides in above when < 20% remaining.
- Keeps existing quota + memory backend untouched — pure UI + motion pass.

## 5. Listeners rewrite (in-house team + SLA)

Replace the current directory/booking flow with the real workflow.

### 5a. Data model (migration)

- `listener_bookings` gains: `preferred_day date`, `preferred_time time`, `time_zone text`, `booking_type text check in ('scheduled','emergency_callback')`, `sla_state text`, `reschedule_count int default 0`, `last_reschedule_at timestamptz`, `assigned_at timestamptz`, `assigned_by uuid`.
- New table `listener_callback_requests` for emergency callbacks (user_id, reason, requested_at, status: `pending|assigned|completed|declined`, assigned_listener_id, assigned_at, note).
- `listeners` table repurposed as internal in-house roster: `is_active`, `shift_start`, `shift_end`, `weekly_capacity`, `specialties`, `avatar_url`. Public sign-up removed.
- GRANTs + RLS: users can read active listener names/avatars only, insert their own bookings and callback requests, read their own; internal ops role (`ops`) added to `app_role` enum with full manage rights.

### 5b. Auto-assignment

- Server fn `requestBooking({ preferredDay, preferredTime, timeZone })` in `src/lib/listeners.functions.ts`:
  - Validates plan-based monthly quota (Together = 2, Family = unlimited within pool).
  - Converts to UTC, finds next active listener with capacity in that window (round-robin by least-loaded).
  - Inserts booking with `sla_state='confirmed'`, returns confirmation with assigned listener name + slot.
- Server fn `rescheduleBooking({ bookingId, newDay, newTime })`:
  - Allowed only if `scheduled_at - now() > 2h` AND `reschedule_count < plan_limit`.
  - Within 2h → returns error and marks original slot as `used` so ops can reallocate.
- Server fn `requestEmergencyCallback({ reason })`:
  - Subscribers only. Inserts `pending` callback, returns "Ops has your request — a listener will reach out shortly. Not guaranteed immediately."
  - Ops assigns via admin panel; user gets confirmation card on next dashboard load.

### 5c. Listeners UI (`/listeners`)

- Hero with slogan "A real voice, on your side." and a 3-step how-it-works strip (Pick day → We match → Get the call).
- Booking form: preferred day (date picker), preferred time (slot buttons: morning/afternoon/evening/night), timezone (auto-detected, editable).
- Confirmation card shows assigned in-house listener's first name + avatar + slot + reschedule button.
- "Booking rules" collapsible panel restating the policy (advance booking, 2h reschedule window, plan limits).
- Prominent but calm "Request emergency callback" secondary card with the SLA disclaimer and workflow diagram.
- Upcoming + past sessions list with reschedule / feedback actions.

### 5d. Ops admin (`/admin/listeners`)

- Role-gated (`ops` or `admin`).
- Views: today's queue, emergency callback inbox, in-house roster with active toggle + capacity, reallocation of freed slots.

## 6. Rollout order

1. Motion utilities + cursor + parallax hook + slogans wiring.
2. Companion redesign.
3. Listeners migration + server fns + UI + ops panel.
4. Sweep remaining pages (Journal, Insights, Family, Safety, Settings) for the same entrance/hover polish.
5. Publish.

## Technical notes (skip if not relevant)

- All animations gated behind `@media (prefers-reduced-motion: reduce)`.
- Cursor uses `pointer:fine` media query; hidden on touch/coarse pointers.
- Emergency callback and reschedule policies stored server-side; UI is only a mirror.
- Time-zone conversion uses `Intl.DateTimeFormat().resolvedOptions().timeZone` on the client; server stores everything in UTC.
- No changes to Stripe, quota, or auth flows.