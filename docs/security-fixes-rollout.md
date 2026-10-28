# Security Fixes: Rollout Checklist

The code changes do not modify the live database or deployed Worker.

1. Generate a random private cron secret with at least 32 characters. Do not reuse any Supabase public key or commit the secret.
2. Set that value as the Cloudflare Worker secret `CRON_HOOK_SECRET` (and in local environment settings when testing locally).
3. Store the same value using Supabase Vault with the name `someonenear_cron_hook_secret`. Restrict access to Vault decrypted secrets to trusted operators.
4. Apply `supabase/migrations/20261002090000_restrict_calendar_rpc.sql`, then run `supabase/tests/calendar_rpc_permissions.sql`. This removes browser-role access to all three calendar mutation functions while retaining service-role access. The verification script must complete without exceptions.
5. Deploy the updated app and rerun `supabase/cron-production.sql` to replace the scheduled jobs' public credentials. Local tunnels use `supabase/cron-localhost.sql`. Without the private credential, hooks intentionally return 401.
6. Check that public/anon credentials receive 401 from the three cron hooks; the private credential should run each job. Confirm calendar mutation RPCs reject anon/authenticated requests and permit the server's service role.
7. Verify memory view/edit/clear while signed in; confirm signed-out requests are rejected. Check saved Companion exchanges after reloading, including safety replies. Confirm an email-provider outage reports a calendar failure rather than success.

Calendar invitations require delivery and acceptance in the recipient's calendar app. An app response cannot confirm that the invitation appeared in an external calendar. Failed deliveries remain pending for retry.
