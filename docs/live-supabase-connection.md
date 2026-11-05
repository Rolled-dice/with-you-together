# Confirmed live Supabase connection

On 4 November 2026 the user confirmed `with-you-together` (`jflufaxdwzrohslviqeb`) as the target project. The connected Supabase account can access this active, healthy project. The former reference `hagqbqxsedoqdoqdbtqt` in the repository is not accessible through that account.

## Connection changes

- Updated the six public project URL/ID/publishable-key variables in `.env`, the Supabase CLI project reference and browser preconnect hints.
- Selected the enabled modern publishable key. This is a public client credential, not the server/service-role secret. Generated integration clients were not edited.
- Public `/auth/v1/settings` responds HTTP 200 with the selected publishable key. Email and Google are enabled; Apple is disabled.
- No database rows, schemas, auth settings, provider settings or production deployments were changed during connection setup.

## Read-only schema findings

- RLS is enabled on profiles, families, family_members, family_invitations, subscriptions, family_session_pool and family_session_allocations.
- Family invitations already contain phone/contact delivery fields, adult confirmation, consent timestamps and sharing choices beyond the local generated types.
- `family_command` and `family_reminder_command` exist and can be executed by service_role, not anon or authenticated. Do not expose these actor-parameter commands directly to browsers or broaden their execution grants.
- The live family command requires Care Plus to create/invite and uses family-row locks around invitation/acceptance operations. Integrate the new versioned 2/5 limits into that contract rather than adding a parallel bypass.
- Existing subscriptions have no catalog-version or market snapshot columns. Legacy terms must be preserved when adding launch billing records.
- The migration history and live function inventory extend beyond the files present in this checkout. Reconcile schema drift before applying local migrations.

## Remaining integration dependencies

The server secret is now configured in Git-ignored `.env.local`. A read-only request against the confirmed project's `family_members` endpoint with `limit=0` returned HTTP 200; no customer records were returned. Vite's development environment loader also resolves the key and the correct project URL, and the key is absent from `VITE_` values. Generated integration clients were not edited. This verifies local access; deployment secrets must be configured separately. Never put the secret in tracked `.env`, client-prefixed variables or chat.

Dodo test credentials are configured in ignored `.env.local`. The approved sandbox setup now has 32 verified launch products across 16 supported markets and a verified one-paid-cycle 30% discount. KWD, BHD and OMR were rejected by the test API and remain unavailable for checkout. The real India Care hosted checkout was opened and inspected; no payment was submitted. Live Dodo entries are empty. The environment audit found test credentials in committed `.env.development`; working-copy assignments have been removed after confirming identical local overrides and unchanged effective configuration. The user explicitly requested proceeding with sandbox configuration. See `launch-catalog-rollout.md` for the remaining fulfillment work.

All five Telnyx voice variables are now configured locally. The phone and Ed25519 public-key formats pass; provider access and real call/webhook journeys remain unverified. Gemini and Google Calendar credentials plus calendar encryption material are also present. The calendar callback uses a website URL, so local OAuth round trips still need checking. Lovable connector credentials for the current prescription OCR, auth-email and S3 upload implementations are absent locally. Turnstile is not yet wired into the application.

Before production schema changes: verify a recoverable database backup/restore path, reconcile current migrations and function definitions, prepare additive versioned changes with rollback instructions, and test authorization/entitlement behavior using designated accounts. A read-only schema inventory is not a data backup.

## Local verification after connection update

The environment loader now refreshes only values it previously injected, preserving genuine shell overrides and removing stale local values during Vite restarts. Its dedicated self-check passes. TanStack's CommonJS store-selector dependency is explicitly prebundled to prevent a browser named-export error during hydration. Generated integration clients remain unchanged.

Signed-out protected deep links and existing confirmed member/admin/listener sessions now pass in browser checks. Member coverage includes three reloads, the principal private pages, staff-route denial, sandbox checkout and sign-out. Tests use generated magic-link sessions without sending emails or changing accounts. Email/password delivery, a complete external OAuth callback, and production Cookiebot domain behavior remain unverified.
