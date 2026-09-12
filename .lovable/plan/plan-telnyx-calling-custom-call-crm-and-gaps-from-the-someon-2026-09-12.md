# Plan: Telnyx calling, custom call CRM, and gaps from the SomeoneNear book

## What the book has that the app doesn't yet

From your SomeoneNear spec document, these are the real gaps:

1. **Send It Later** — schedule a text, voice or video message to be delivered to someone on a future date. Compose, choose recipient, pick date/time, list of scheduled messages with edit / reschedule / cancel, plus preset occasion cards ("Happy Birthday", "Listen when you miss me", "For a difficult day"). This is the biggest missing product surface.
2. **Voice mode for the companion** — talk to the companion instead of typing, with "SomeoneNear is talking…", mute / speaker / end / switch-to-text controls.
3. **Reminders as a user-facing screen** — medicine, water, sleep, call family. Reminder cards with time + repeat + edit. (The data already exists; the screen was removed with the Care tab.)
4. **Wellness / calm library** — small set of short guided exercises with illustration, title, duration, start button. Deliberately small so the app stays about connection.
5. **Onboarding flow from the book** — how you'd like to be checked in on (chat / voice / both), when (morning / afternoon / evening / night), tone (gentle / friendly / short / conversational).
6. **Public pages** — How it works, Features, About ("Because everyone deserves someone near."), plus the footer legal set (Privacy, Terms, Safety).
7. **Design system alignment** — the book specifies a warm charcoal dark mode + warm cream light mode (coral #F49A7A, warm yellow, lavender, muted green, warm off-white text, 20/28px card radii, Nunito headings + Inter body) and hand-drawn doodle accents. Current theme is close in spirit but not on these values, and there's no dark mode.

## WhatsApp — parked

All WhatsApp code stays in place but goes out of sight: the WhatsApp card in settings, the admin WhatsApp console, and the nav entry get hidden, and the reminder/inbound webhooks stop being advertised. Nothing is deleted, so it can be switched back on later. Medication reminders move to in-app + email/notification instead of WhatsApp.

## Telnyx calling (replaces LiveKit / Chime)

Model: **agent talks in the browser over WebRTC, the member is dialled on their phone.**

- Agent side: Telnyx WebRTC in the agent console (browser mic/speaker, mute, hold, hangup, live call timer).
- Member side: outbound PSTN call from your Telnyx number to the member's phone; the two legs are bridged.
- Call control via Telnyx Call Control: dial, answer, bridge, transfer, hangup, recording, DTMF.
- Webhooks land on a public route that verifies Telnyx's signature and writes every event (`initiated`, `answered`, `bridged`, `hangup`, `recording.saved`) into the call timeline.
- Existing LiveKit + Chime packages and code are removed once Telnyx is live, so the "LiveKit not configured" path disappears.

Also supported without extra work: click-to-call from the CRM, callback on a missed call, and recording links attached to the booking.

## Custom call CRM (built out, not bolted on)

Extending the existing `/admin/calls` into a full agent + supervisor workspace:

**Agent workspace**
- Softphone dock (always visible): register / go available, incoming ring, mute, hold, transfer, hangup, dial pad.
- Screen-pop: on connect, the member's card opens — profile, family circle, recent check-ins, past calls, notes, flags.
- Disposition on hangup: outcome, follow-up needed, safety flag, free notes. Wrap-up timer.
- My queue: assigned bookings with SLA colour, next-up highlight.

**Supervisor / admin**
- Live board: agents (available / on call / wrap-up / offline), live calls with duration, queue depth.
- Routing rules: skills, timezone, working hours, max concurrent, fairness — editable in the UI instead of hardcoded.
- SLA ladder as today (T-90 amber, T-60 orange, past = red + escalation + urgent flag), now delivered in-app and by email.
- Flag inbox with severity and audit trail.
- Recordings + full event timeline per call, with consent banner preserved.
- Metrics: answer rate, average talk time, abandonment, SLA breach rate, per-agent volume.

## Suggested build order

1. Park WhatsApp, restore the Reminders screen.
2. Telnyx: credentials, agent softphone, outbound dial + bridge, webhooks, event timeline.
3. CRM: agent workspace (screen-pop, disposition, wrap-up), then supervisor live board, routing rules UI, metrics.
4. Send It Later (text → voice → video).
5. Companion voice mode.
6. Design system pass: warm dark mode + light mode from the book, Nunito/Inter, doodle accents.
7. Public pages: How it works, Features, About, Privacy/Terms/Safety.

## What I need from you

- **Telnyx**: API key (V2), the SIP Connection / Credential Connection ID used for WebRTC, a Call Control Application ID, and the phone number to use as caller ID. I'll open a secure form when you're ready.
- **Recording consent**: confirm calls are recorded by default (banner already says so), and which region you want recordings stored in.
- **Agent roster**: names, emails, timezones, working hours, skills.
- **Escalation contacts** for red SLA / safety flags.

## Technical notes

- Telnyx WebRTC SDK loads client-side only (dynamic import behind a hydration gate) so SSR isn't broken.
- Call control calls run from server functions; the API key never reaches the browser. Agent WebRTC tokens are minted per session, short-lived, server-side.
- Webhooks at `src/routes/api/public/hooks/telnyx` with Ed25519 signature verification before any write.
- New tables: `call_legs`, `call_recordings`, `agent_presence`, `call_dispositions`, `routing_rules` — each with GRANTs, RLS scoped to agent/admin, and updated_at triggers. Existing `call_agents`, `call_events`, `call_flags`, `listener_bookings` are reused.
- Send It Later needs `scheduled_messages` plus a private storage bucket for voice/video and a pg_cron delivery job.
