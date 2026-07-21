# Docs Section Plan (revised)

Public `/docs` area for both signed-in and signed-out users. **User-facing only** — how to get started and how each feature works from the user's perspective. No internal architecture, no "under the hood" tech notes, no infra/provider names.

## Routes

```
src/routes/
  docs.tsx                   -> layout with sidebar + <Outlet />
  docs.index.tsx             -> /docs (Welcome + Quick Start)
  docs.getting-started.tsx   -> /docs/getting-started
  docs.companion.tsx         -> /docs/companion
  docs.journal.tsx           -> /docs/journal
  docs.listeners.tsx         -> /docs/listeners
  docs.family.tsx            -> /docs/family
  docs.insights.tsx          -> /docs/insights
  docs.safety.tsx            -> /docs/safety
  docs.billing.tsx           -> /docs/billing
  docs.account.tsx           -> /docs/account   (profile, notifications, delete account)
  docs.faq.tsx               -> /docs/faq
```

Each leaf has its own `head()` with unique title, description, and OG tags.

## Layout

- Left sticky sidebar with grouped nav (Start here / Features / Account & Billing / Help). Collapsible sheet on mobile.
- Top bar shows "Back to app" or "Sign in" based on auth state.
- Right-side "On this page" TOC on `lg+`.
- Breadcrumbs and prev/next footer links.
- Client-side search across page titles and headings.
- Reuses existing `[data-reveal]` scroll animations.

## Page template (user-facing only)

Every page follows the same shape:
1. **What it is** — one short paragraph
2. **When to use it** — real situations
3. **How to use it** — numbered steps with screenshots/icons
4. **Tips** — small callouts
5. **Try it now** — deep link into the app (auth-gated pages prompt sign-in first)
6. **Common questions** — 2–4 mini FAQs

No sections about databases, models, providers, RLS, encryption internals, or system diagrams.

## Content outline

- **Welcome / Quick Start** — what WithU helps with, 4-step get-started, link cards to each feature
- **Getting Started** — create account, complete onboarding, pick a plan, invite family
- **Companion** — starting a chat, what to ask, changing tone, ending a session
- **Journal** — writing an entry, moods, viewing past entries, who can see it (only you)
- **Listeners** — browsing listeners, booking a slot (including today), joining the call, session minutes
- **Family Circle** — sending invites, accepting invites, shared minutes, what each member sees
- **Insights** — reading your mood trends, what stays private
- **Safety** — crisis resources, how to reach help fast
- **Billing** — plans and prices (Together / Family / Care in USD & INR), upgrading, cancelling, refunds
- **Account** — editing profile, notifications, changing password, deleting account
- **FAQ** — top 10 questions

## Components

- `src/components/docs/docs-shell.tsx`, `docs-sidebar.tsx`
- `doc-section.tsx`, `steps.tsx`, `callout.tsx`, `mini-faq.tsx`
- Reuses shadcn `Card`, `Badge`, `Separator`, `Sheet`

## Navigation entry points

- "Docs" link in homepage header and footer
- "Help & Docs" link in the authenticated app shell

## Non-goals

- No architecture / infrastructure pages
- No markdown/CMS pipeline — authored in TSX
- No new backend tables

## Open question

Voice: friendly and plain-language (matches current landing tone)? I'll default to that unless you say otherwise.
