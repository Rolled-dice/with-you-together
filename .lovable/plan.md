# Plan: Remove Journal + Care, split Listeners out, Twilio calling, CRM panel, WhatsApp bot

## Phase 0 — Cleanups (safe, immediate)

**Remove Journal**
- Delete the Journal page, its server functions, its PDF export, and the Journal docs page.
- Remove Journal from the sidebar/mobile nav, dashboard cards, homepage "What's Inside", docs index and FAQ links.
- Insights currently uses mood/journal data — it will fall back to the remaining signals (reminders, sessions, companion check-ins) instead of mood charts.
- Database: the `journal_entries` table stays in place for now (no data loss). Say the word and I'll drop it in a separate migration.

**Remove the Care tab (medicines move to WhatsApp)**
- Remove the Care page and its nav entry, dashboard tiles, and homepage/doc references.
- Keep the `medications`, `medication_schedules`, `dose_logs`, `reminders` tables and the prescription storage bucket — the WhatsApp bot will write to exactly these, so nothing has to be rebuilt.

**Separate Companion and Listener**
- Companion becomes purely the AI chat: remove the "Human Listener" cross-promo card from the Companion page.
- Listeners becomes its own top-level tab (already routed at `/listeners`), restyled as a standalone product surface: book a call, upcoming/past calls, agent info, SLA status.

## Phase 1 — Listener calling on Twilio (replaces LiveKit)

- Remove LiveKit token/room code from the app; calls become **phone calls**, not browser video.
- One shared Twilio international number is used as caller ID for every outbound call (your cost-safety requirement).
- Agents work from a web console (Amazon Connect or the built-in agent panel below) and the system dials the member's mobile.
- Booking rules enforced server-side:
  - A call must be scheduled **at least 2 hours ahead**; earlier slots are rejected with a clear message.
  - Reschedules inside the 2h window keep the existing "session marked used" behaviour.

## Phase 2 — Call CRM + Admin panel (new section in the app)

New admin-only area (role-gated, same `user_roles`/`has_role` pattern already in the app):
- **Queue board** — all bookings by state: requested → assigned → confirmed → in-call → completed / missed / escalated.
- **Assignment engine** — agents get a skills/tags list, a timezone, working hours and a max concurrent load. Scoring picks the best available agent: skill match, timezone overlap, current load, recent-call fairness, and honours the 2h lead time. Unassignable bookings are flagged rather than silently dropped.
- **SLA + escalation** — every booking carries target start time and SLA deadline; breaches surface as red rows plus an admin alert record.
- **Flags** — agents or the system can raise a flag (safety concern, no-show, abusive call, tech failure) that lands in an admin inbox with severity and audit trail.

## Phase 3 — Notification / SLA warning ladder

A scheduled job runs every few minutes and, per booking:
- **T-1.5h** — reminder to member + assigned agent (amber).
- **T-1h** — second, stronger warning (amber, escalated in the CRM).
- **Past SLA** — red state, admin notified with high priority, booking flagged as breached.

Channels: in-app notification centre + WhatsApp message to the member + admin panel banner. SMS can be added but each SMS costs money, so it's off by default.

## Phase 4 — WhatsApp bot (medicines + appointment booking)

One WhatsApp number, one bot, two jobs:

**Medicines (replaces the Care tab)**
- "Add medicine" conversation: name → dose → times per day → start/end date. Written to the existing medication tables.
- Photo of a prescription → stored in the private prescriptions bucket → read by AI → bot asks the member to confirm the parsed medicines before saving.
- Daily dose reminders at the scheduled times; replying "taken" / "skip" logs the dose.

**Appointment booking (for elders with no web access)**
- "Book a call" conversation: preferred day → preferred time → confirm. Bot enforces the same 2h rule and returns the assigned agent and time.
- "My appointments", "reschedule", "cancel" all supported in chat.
- Number is linked to an account by verifying the phone already stored on the profile; unknown numbers get an onboarding link.

## What I need from you

1. **Twilio account** — an Account SID and an API key/secret with permission to send/list messages **and read message media** (needed for prescription photos). I'll open a secure form when you're ready.
2. **Twilio phone number** — the one international number you want to buy/use as caller ID.
3. **WhatsApp sender** — either a Twilio WhatsApp sender (needs Meta business verification of your business, usually 1–3 days) or the Twilio WhatsApp sandbox to test immediately. Sandbox is fine for building; production needs the verified sender plus approved message templates for the reminders.
4. **Agent web console** — Amazon Connect was only your reference for the experience, so we won't use it. The agent console is built inside this app: the agent clicks "Call", Twilio dials the member's cell phone, and the agent talks in the browser. Nothing needed from you beyond the Twilio credentials above.
5. **Agent roster** — names, phone/email, timezones, working hours, and skills for the routing algorithm. A CSV or a list in chat is fine.
6. **Escalation contacts** — who gets the red SLA/flag alerts (email or WhatsApp).

## Technical notes

- Calling and messaging run through the Twilio connector gateway from server functions; no credentials in browser code.
- WhatsApp inbound arrives at a public server route (`/api/public/hooks/whatsapp`) with signature verification; conversation state is stored in a new `whatsapp_sessions` table so the bot is stateless.
- New tables: `agents`, `agent_availability`, `call_events`, `call_flags`, `notifications`, `whatsapp_sessions` — each with GRANTs, RLS scoped to owner/admin, and updated_at triggers.
- Scheduling ladder runs via `pg_cron` → `pg_net` → `/api/public/hooks/call-sla`.
- LiveKit code and env usage are removed once Twilio calling lands, so the "LiveKit not configured" error disappears.

## Suggested order

Phase 0 first (removals, immediately visible), then Phase 2 CRM schema + admin panel, then Twilio calling, then notifications, then the WhatsApp bot. I can start Phase 0 without any credentials from you.
