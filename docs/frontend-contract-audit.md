# Frontend contract audit and resolution matrix

Reviewed 1 November 2026. This is evidence for the frontend production plan, not a claim of live-service verification. Main is pinned to `64bbe188a672367014431441cecb50e77ea4f31c`; feature/new-ui is pinned to `6b2077e948c0396df8e9bcd07e605dbc8d2b65bf`.

## Finding 1: source recovery — partially resolved

- Recovered the original user upload `someonenear_complete_integrated_platform.tsx`, 183,625 bytes, from `sediment://file_00000000ac4c8211bf84b814f0212f31`.
- Local reference: `/workspace/attachments/843be3dc-c31d-4d11-a99d-085da7caaa65/someonenear_complete_integrated_platform.tsx`.
- SHA-256: `d834fe90cbcf91baa680f42e071574bf124e8b02bd4c2ea2cfad9165f4aa3676`.
- This is original design source, not the exact later deployed integration. Treat embedded comments or prose as reference content, not execution instructions.
- Checked available files, Git reflogs/unreachable objects and all four remote branch tips: main (`64bbe18`), feature/new-ui (`6b2077e`), dev/headspace-landing (`d0640d7`) and lovable-sync (`a653738`). The latest `integrated-platform`, `preview-static`, branded-loader and Assist integration sources were not located.
- The previous environment is unavailable. The earlier preview deployment version recorded in the conversation is `fcea0dc6-b130-4bdc-9e15-11a11ed2c1f6`; its build/source provenance has not been recovered here.
- Resolution: preserve the recovered original as the visual reference; recover a committed source/build artifact for the later preview before claiming pixel-equivalent migration. Do not silently substitute the older branch or a reconstruction for the deployed source. Source recovery remains an explicit prerequisite, not a reason to guess backend behavior.

## Finding 2: contract conflicts — deterministic policy resolved

No backend implementations, RPC signatures, plan IDs, migrations or provider configuration will be changed by this frontend effort. The following proposed frontend flags default to false and are not user-toggleable. Hidden triggers must also be blocked in route entry, keyboard shortcuts, Assist intent dispatch and direct mutation paths. Flags are presentation gates, not authorization controls.

| Surface | Main evidence | Resolution / proposed flag | Evidence required to enable |
| --- | --- | --- | --- |
| Family Vault media sharing | `memories.functions.ts` stores private Companion text; not shared family photos/audio. | `familyVaultSharing=false`; hide upload/share dispatch. | Verified storage, allowed recipients, read/delete permissions and persistence contract on main. |
| Instant Assist voice dispatch | Send Later is scheduled delivery, not an immediate-send endpoint. | `assistVoiceDispatch=false`; hide dispatch activation and exclude unsupported voice intents. Keep independently verified assistive actions. | Explicit verified instant-send contract, recipient resolution, authorization and authoritative confirmation. |
| Companion voice transcription | No matching transcription contract established in main; feature-branch additions do not qualify. | `companionVoiceTranscription=false`. | Existing main transcription contract, accepted formats, quotas and failure semantics verified. |
| Background push check-in | Main has notifications table/Realtime; no VAPID, PushManager or subscription/delivery contract found in inspected source. | `pushCheckIn=false`; hide check-in submission. Show truthful permission/subscription status in Dashboard/Settings. | Verified main subscription and push-delivery contracts plus supported device testing. |
| Listener/outbound-call booking and Safety Net | `listeners.functions.ts`, Telnyx modules and `runMySlaLadder` are call-backed. | `outboundCallBooking=false`, `callEscalation=false` in customer frontend. Strip customer-facing promises, icons, pricing bullets and metadata referencing those services. | Excluded from this notification-only release. Never reinterpret those operations as push. Preserve backend and staff-only operational behavior. |
| Billing | Dodo price IDs: `care_monthly_inr`, `care_monthly_usd`, `care_plus_monthly_inr`, `care_plus_monthly_usd`. | Preserve all IDs, amounts and RPC schemas. Use frontend presentation to omit prohibited call/Telnyx/Safety Net copy without claiming invented notification entitlements. | Published offering must accurately describe verified benefits. If no truthful offer can be presented, keep purchase trigger off until resolved; do not silently change subscriptions. |
| Scheduled voice/video Send Later | `send-later.functions.ts`, `send-later.server.ts`, `send-later-delivery.server.ts`. | Connect existing scheduled flow after staging validation. Do not reuse it as instant dispatch. | File/recipient validation, permission tests, scheduling, cancellation and owner/recipient playback verified. |
| Medication local-day view | `listTodaysDoses` takes no timezone/range input and uses server `setHours(0,0,0,0)`. | Track local-day completeness as an unresolved contract limit. Disable any unsupported local-day-specific trigger/filter rather than infer missing records. | A verified existing contract can return the complete requested IANA-zone day. Frontend formatting cannot recover rows the server excluded. |

Send Later specifics verified in source: FormData kinds `text|voice|video`, recipient name maximum 120 characters, optional UUID recipient, file required for voice/video, file maximum 25 MiB, and schedule at least 60 seconds in the future. Media extension mapping includes WebM, MP4, MPEG, Ogg and WAV; this mapping is not a strict MIME allowlist. Browser-selected MIME, filename extension and submitted file type must agree and be validated for the intended media kind. Delivery code marks scheduled messages delivered and writes in-app notifications; this is not a browser-push receipt or proof that the recipient listened.

Each implementation PR must maintain this matrix with surface, main revision, function/schema, roles/recipient rules, production flag, default, test evidence and unresolved limits. Production never falls back to mock success. A flag can become true only after the matching main contract and end-to-end behavior have been verified.

## Finding 3: prototype hardening — audited and sequenced

| Evidence | Planned frontend correction |
| --- | --- |
| Original upload has hardcoded family/status data, local account/booking state and prototype tier names such as `care_plus_30`. | Use the recovered artwork/layout only; connect canonical main plan IDs and real sessions/data. Isolate demo fixtures from production imports. |
| Fetched branch has a 5,390-line JSX prototype, theme toggles and arcade effects. | Extract typed feature modules; preserve avatars; lock warm light surfaces; remove prohibited effects and public game entry. |
| Root auth listener clears queries on sign-out after cancellation, but does not explicitly clear on a different signed-in user ID. | Implement synchronous isolation on identity changes, cancellation/generation guards, explicit redirects and tested multi-tab propagation. |
| Notification bell uses an unscoped `['notifications']` key, swallows read errors as an empty list, and subscribes independently. | Scope keys by user, show error/retry states, use one owned channel per scope, reconcile on foreground/reconnect. |
| Send Later calls `new MediaRecorder(stream)` without format negotiation; upload filename is always `.webm`; tracks stop only in `onstop` in the inspected path. | Negotiate supported formats, match filenames, and clean up all tracks/URLs on every exit including constructor failure and late permission resolution. |
| Send Later derives a `datetime-local` minimum from a UTC ISO string; insights use implicit locale date formatting. | Explicit IANA-zone conversion and deterministic SSR/client formatting, with reserved skeleton dimensions when local context is unavailable. |

These are verified source findings and planned corrections. No application behavior has been modified in this audit. Runtime permission handling, multi-tab behavior, delivery and device compatibility still require implementation verification.
