<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# SomeoneNear — Agent Guide

SomeoneNear is a family wellbeing app: an AI companion for emotional check-ins, human listener calls, family circles, medication reminders, and a WhatsApp bot for elders without web access. Tagline: "Checking in when they can't."

## Stack

- **Framework**: TanStack Start v1 (React 19, SSR, file-based routing), Vite 7, TypeScript
- **Backend**: Lovable Cloud (Supabase) — Postgres + RLS, Auth (email, Google, Apple OAuth), Realtime, pg_cron + pg_net
- **Server logic**: `createServerFn` from `@tanstack/react-start`; webhooks/cron as file routes under `src/routes/api/public/`
- **Styling**: Tailwind CSS v4 via `src/styles.css` (`@theme` tokens, no tailwind.config.js); shadcn/ui + Radix; Framer Motion; Lucide icons; Sonner toasts
- **AI**: Lovable AI Gateway (`src/lib/ai-gateway.server.ts`), Google Gemini models (chat streaming at `/api/chat`, Gemini vision for prescription OCR)
- **Payments**: Stripe (invite-only in India; Paddle under consideration as alternative)
- **Calling**: Amazon Chime SDK (`src/hooks/useChimeMeeting.ts`, `CallRoom.tsx`) with LiveKit as legacy/fallback; Twilio or Plivo planned for phone calls (provider undecided)
- **WhatsApp**: provider-agnostic outbox pattern (`whatsapp_outbox` table); bot state machine in `src/lib/whatsapp/bot.server.ts`; works in simulation until Twilio/Plivo credentials are added
- **Testing**: Playwright (`tests/e2e/smoke.spec.ts`)

## Architecture rules (important)

- **Routing**: TanStack Router only — never react-router-dom. Routes in `src/routes/`; never edit `src/routeTree.gen.ts`. Authenticated pages live under `src/routes/_authenticated/` behind the gate in `_authenticated/route.tsx`.
- **Server functions**: files declaring `createServerFn` must be thin wrappers — imports, types, and exported server-function declarations only. Runtime helpers go in imported `*.server.ts` modules (splitting deletes runtime siblings). Read `process.env.*` inside `.handler()`, never at module scope.
- **Runtime**: server runs on a Cloudflare Worker — no child_process, sharp, canvas, puppeteer, fs.watch, or Node-only npm packages. Prefer Web-standard/fetch-based libraries.
- **Supabase clients**: browser uses `@/integrations/supabase/client`; authenticated server fns use `.middleware([requireSupabaseAuth])` with `context.supabase`; never expose the service-role key. Never edit auto-generated files in `src/integrations/supabase/`.
- **Database**: every new `public` table needs `GRANT`s (to `authenticated`/`service_role`, `anon` only if a policy allows it) **in the same migration**, plus `ENABLE ROW LEVEL SECURITY` and policies. Roles live in `public.user_roles` with the `has_role()` security-definer function — never on profiles.
- **Client-safe imports**: components import `*.functions.ts`, never `*.server.ts` or anything under `src/server/` directly.

## Key surfaces

- `src/routes/index.tsx` — landing page (live stats via `public.get_public_stats()` RPC + `use-live-stats` polling)
- `src/routes/_authenticated/companion.*` — AI companion chat (streams via `/api/chat`, per-tier monthly quota in `src/lib/quota.functions.ts`)
- `src/routes/_authenticated/listeners.tsx` — listener call booking; **2-hour minimum lead time enforced server-side**; users are called on their phone (no video join link)
- `src/routes/_authenticated/call-room.$bookingId.tsx` + `src/components/call/CallRoom.tsx` — Chime call room with mic controls, audio visualizer, recording banner, data-message chat sidebar
- `src/routes/_authenticated/admin.calls.tsx` — Call CRM: queue board (requested → assigned → confirmed → in_call → completed/missed/escalated), agent roster, scoring-based assignment (`src/lib/call-crm.server.ts`), flag inbox, SLA coloring (T-90m amber, T-60m orange, past = red)
- `src/routes/_authenticated/admin.whatsapp.tsx` — WhatsApp console with live bot simulator
- `src/routes/_authenticated/admin.feedback.tsx` — feedback inbox
- `src/components/notification-bell.tsx` — in-app notification centre (Realtime; randomized channel names to survive StrictMode double-mount)
- `src/routes/docs.*` — public docs section, accessible logged in or out

## Background jobs

- **SLA ladder** (`src/lib/sla-ladder.server.ts`, route `/api/public/hooks/call-sla`, pg_cron every 5 min): T-90m and T-60m warnings to member + agent; past SLA → booking escalated, urgent admin flag, red state. Mirrored to WhatsApp outbox.
- **Medication reminders** (`src/lib/whatsapp/reminders.server.ts`, route `/api/public/hooks/whatsapp-reminders`, every 10 min): queues dose nudges due in next 20 min; replies TAKEN/SKIP log the dose; drains the WhatsApp outbox.
- Public hooks verify caller (apikey / webhook token) before processing.

## WhatsApp bot flows

State machine keyed by `whatsapp_sessions` (phone → step). Supports: account linking via 6-digit code, elder-friendly call booking (day → time → note, same 2h rule), dose logging, prescription photo parsing via Gemini vision with confirm-before-save. Messages queue in `whatsapp_outbox` with `dedupe_key` until a provider (Twilio connector or Plivo custom secrets) is configured.

## Conventions

- Semantic design tokens only — no hardcoded color utilities (`text-white`, `bg-[#...]`) in components.
- Brand is **SomeoneNear** everywhere (renamed from BesideU); heart icon favicon.
- Prices displayed in USD (Together $8.99, Family $15.99, Care $36.99).
- Full tech inventory: `techstack.txt`.
