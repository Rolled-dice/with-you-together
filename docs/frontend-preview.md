# New frontend preview

The homepage on `feature/new-ui` now opens the full frontend based on the supplied `someonenear_family_globe_ui_figma_prototype(1).tsx`. It runs at `http://127.0.0.1:8082/`. The supplied file is unchanged in Downloads. Its untyped React source was imported as JSX; the route, workspace screens and lifecycle helpers are TypeScript.

The prior connected homepage is at `/connected-home`. Existing authenticated routes still run separately. No backend functions, database migrations or provider settings were changed for this preview.

## What can be reviewed

- Home, family globe, three globe modes, notification appearances, drag, zoom and pause.
- Light/dark themes, avatar motifs and the supplied people/bridge logo in its navy-and-gold tile, with a theme-matched SomeoneNear wordmark.
- Globe adapted from the October 28 supplied prototype: 2,000 surface dots, three palettes, rotation-speed and ring controls, far-side avatar hiding, and an all-member list. Fixed the rotation-dependent radius, mobile framing, keyboard rotation, and pause while reading an update.
- Family Today, My sharing, Health and Calls, with distinct content and local state.
- Dashboard, Companion layout, listener booking layout, medication, Send Later drafts, insights, safety and settings.
- Reminder completion and snooze, initially-off sharing controls, local image/audio/video file previews, sample call booking and cancellation.
- Invitation form and sample verification queue. Creating a preview invite does not activate a member.
- Four Chatak-Patak activities, optional local sounds, a calm worry-release screen, and the assistive action menu.

The top notice identifies the sample data. Account screens are simulations. Checkout is disabled. Voice recording is an animation preview; it does not access the microphone. Uploaded files use browser object URLs and are not sent to storage. Preview edits reset when the page reloads. Retention choices illustrate the intended interaction; there is no server deletion job in this stage.

Care and Care Plus prices and bullets come from `PLAN_DISPLAY`, with India and US currencies. The reference's other prices, payment gateways and seven-day trial are not enabled.

## Verification

Verified on 27 October 2026: all five preview browser tests passed, TypeScript reported no errors, and the Cloudflare production build completed. Desktop and mobile screenshots are in `test-results/frontend-preview-preview-globe-and-themes-at-*/`. No production deployment was performed.

`tests/e2e/frontend-preview.spec.ts` checks the canvas is drawn and moving, reduced motion, light/dark appearance at 1440/390/320 pixels, family tasks, local file previews, call previews, keyboard dialogs, invitations, arcade controls and absence of backend writes during the preview journey.

Run against the local server with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8082` and `PLAYWRIGHT_BROWSER_CHANNEL=msedge`. Type checking and the Cloudflare production build also apply. No production deployment is part of this frontend-only stage.

## Next stage

Replace sample state with the existing authenticated family, consent, reminder, call-credit, transcription and payment functions after the design review. Media sharing needs its own storage and recipient permissions. Preserve the recipient's explicit consent, staff verification, capacity rules and private chat boundaries when connecting these screens.
