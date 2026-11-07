# SomeoneNear launch readiness: next steps

## Completed in this workspace

- Confirmed existing in-app notification inbox remains available.
- Aligned browser subscription handling with the existing `push_devices` table and authenticated save/disable actions. Browser roles cannot read or write endpoints directly.
- Added a service-worker receiver that shows a generic SomeoneNear update and opens Reminders without putting personal content on the lock screen.
- Added a Worker-compatible encrypted VAPID sender. It has no access to private reminder content and remains blocked unless `FAMILY_PUSH_ENABLED` is exactly `true` and all VAPID secrets are configured.
- Added focused tests for ownership checks and HTTPS-only endpoints.
- Kept push delivery disabled. The service worker is not registered, no device permission prompt is shown, and no push message can be sent by this change.
- Payment checkout remains parked as requested.

## Before enabling Web Push

1. Review and back up production before deploying the Web Push dispatcher.
2. Regenerate Supabase types from the production schema, then deploy the authenticated device-registration actions.
3. Configure a VAPID public key for the browser and private key plus sender subject as server-only secrets. Never place the private key in a `VITE_` variable.
4. Implement and verify the actual sender against the production reminder queue. The `prepare_reminder_delivery` RPC queues `reminder_push_jobs`; the dispatcher must claim and finalise them atomically.
5. Keep notification text generic so lock screens do not reveal appointments, medication, or family details.
6. Test opt-in, unsubscribe, retries, expired subscriptions, and delivery on Android Chrome and iPhone Safari after installing the site to the Home Screen. Keep `FAMILY_PUSH_ENABLED=false` until these pass.

## Still gated or externally blocked

- **SMS:** Keep region flags off until India DLT registration/templates and US 10DLC eligibility are confirmed and delivery is tested.
- **Payments / extra calls:** Deferred by request.
- **Family verification:** Local migrations/tests may be ready, but production schema changes still require a current backup and migration verification.
