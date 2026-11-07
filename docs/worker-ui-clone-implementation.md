# Worker member frontend port

Implemented on `test-worker-ui`, 4 November 2026, using the live Worker's signed-in desktop/mobile layouts and supplied integrated TSX. Existing dirty work was preserved. No deployment, provider configuration or database migration was performed.

## Changes

- Replaced the approximate member header with the 228px desktop sidebar, editorial palette card, toolbar, care shortcuts, mobile bottom navigation and compact footer. Staff navigation stays separate. The public landing navbar remains public.
- Reproduced the navigation-only cream/navy theme scope. Parent mode increases readable content sizes. Preferences persist in the browser.
- Dashboard uses the original four-category composition and selected navy/gold treatment. Arrow/Home/End navigation selects category tabs; the detail panel changes in place. Names, roster, medications, bookings and reminders use existing authenticated server functions. Each query has its own loading/error handling.
- Family cards and dashboard roster use the original editorial SVG artwork. The avatar dialog supports member selection, illustration, backdrop and glasses. These appearance choices are browser-local and account-scoped; they are not claimed as server profile updates.
- Mobile More is a dialog with all member destinations. Family updates opens the existing notification inbox. ASSIST opens working links to member services. The original palette is downloadable.
- Added the authenticated `/calm` screen with the reference's Spice Pop, Keepsake Memory Match, Singing Bowl and Barnaby activities. Sound starts only from interaction and can be muted. Timers/audio are cleaned up on unmount; shuffling cancels a pending match.
- Listener hub has roster, upcoming calls and reflection sections using existing records and booking handlers. Medication has medication/reminder/calendar tabs; photo/manual setup opens in a dialog. Memory Vault has gallery, voice and capsule sections over existing message/recording operations. Companion, Insights, Safety and Settings use the shared shell/card system; Settings opens the same avatar editor.
- Fixed a route-level redirect that prevented browsing the listener roster while calling was disabled. `/listeners` now opens for members; new scheduled/callback submissions remain disabled and guarded by the existing capability. Booking details open in a dialog. The Companion start view now uses a compact conversation panel with one page heading, preserving real conversation creation and thread routes.

## Data-dependent differences from the sample

The Worker is a sample app. Its six fictional people, medication verification claims, sample call usage, medical readings and simulated escalation successes are not copied into real accounts. The test member currently has one family member and its own medication/call records. Family badges currently show actual roster roles; a call opt-in status feed and shared monthly usage ledger are not wired into this frontend. The dashboard links to current purchased membership settings rather than inventing a remaining balance. Provider-dependent features retain existing capability gates and actual errors. AWS/Bedrock work remains deferred.

The detailed connected forms are retained for real profile editing, booking, medication entry, messages, charts and privacy controls. Their live empty/error states differ from the sample's populated demos. This is not a claim of pixel parity for every state or of completed provider fulfillment.

## Verification

- Targeted ESLint, TypeScript and Cloudflare production build passed after the layout/route changes.
- Three Calm tests passed: spice count/reset, cancelling an in-flight match on shuffle, independent bowl/cat counters.
- Browser-verified dashboard category switching, More navigation, medication setup dialog, Calendar tab, avatar dialog, ASSIST panel and Calm controls.
- Desktop measurement at 1440px: sidebar 228px, four 275px category columns, no horizontal overflow. At 320px: sidebar hidden, bottom navigation visible, no horizontal overflow. Cream/navy verification confirmed the main background remains cream while navigation changes navy.
- Original artwork/backend contract guard passed. Existing connected-auth test locators were updated for sidebar/footer sign-out placement; that entire end-to-end suite was not rerun in this pass.
- Additional browser checks reached Listeners, Memory Vault/capsule tab, Family, Insights, Safety, Settings and Companion with the actual test session. Family SVG artwork rendered, the Settings avatar entry was present, and all checked pages had no horizontal overflow at the desktop test size. A fresh server load verified the replacement Companion start view and single main heading.
- Screenshots: `../outputs/worker-clone-dashboard-desktop.jpg`, `worker-clone-dashboard-mobile.jpg`, `worker-clone-dashboard-320.jpg`, `worker-clone-calm-mobile.jpg`.

Remaining acceptance work: identical-fixture screenshot comparisons across all planned breakpoints (including tablet/large desktop), every member dialog and provider-dependent action. Full trial/renewal/refund fulfillment and shared ledger integration remain separate backend work documented in the launch rollout notes.

## Integrated source refresh — animation, 2am Companion and Quick Care

The user supplied a newer integrated TSX with the expanded quiet-hours Companion. This pass adds:

- Shared click chimes, tap/pop transitions, floating thoughts and the pulsing CARE button. The same sound preference covers member/public controls and Calm activities. Audio is created after an interaction; mute persists. Reduced-motion preference disables decorative animation.
- A navy/gold 2am Companion hero, real conversation history, six starter chips and a typed composer over the existing authenticated chat transport. The selected starter message crosses to its newly created thread in memory only, with session/thread checks and one-shot consumption. No private message is placed in a URL or browser storage.
- Breathe & Float: Settle 4/6, Box 4/4/4/4, Sleepy 4/7/8. The visible count uses the real phase durations and pauses while the tab is hidden. Floating thoughts have no persistence or network operation. Memory & Privacy reuses the actual owner-only note operations from Settings and shows real loading/errors; it does not introduce the sample's fake sharing toggle or fake memory-clear success.
- Floating Quick Care actions for the listener roster, Parent & Self Reminders, Voice Studio and PhotoMed setup. Search parameters open the intended tab/form and are consumed, so repeated shortcuts work on the same route. Nothing auto-submits, calls a phone or starts recording. A family recipient is still required by the existing message flow.
- Calendar & Phone information and per-reminder `.ics` downloads with UTC dates, recurrence, ten-minute alerts, escaped text and UTF-8 line folding. Users review/import the downloaded file in their calendar. No invitation email or external calendar delivery is claimed by the download.

Verification: 10 focused tests pass (Calm activities, Companion breathing/floating state, private draft handoff, audio mute/lifecycle, and calendar serialization). TypeScript, lint on the changed files, and the Cloudflare production build pass. Full repository lint was attempted but fails on existing CRLF/formatting and other findings; no repository-wide reformat was performed. Browser checks verified Companion tabs, breathing start/pause, thought release/dissolve, memory loading, mute/navigation, reminder shortcut, PhotoMed dialog, Voice Studio selection, and no horizontal overflow at 390px or 320px. Desktop/mobile captures: `../outputs/companion-quick-care-desktop.jpg` and `../outputs/companion-calm-mobile.jpg`.

Not checked in this pass: live AI generation, microphone recording/upload, saving/deleting live reminders or memory, booking a call, importing the calendar file in an external calendar app, or full authenticated end-to-end regression. The Bedrock/S3/provider work remains deferred, and source demo replies, medical statistics, outbound-dispatch claims and privacy-sharing simulation were not treated as live functionality. No deployment or database migration was performed.

## Production navigation cleanup

Removed the editorial palette card, palette download links (including mobile More), unused palette styling/asset, and the duplicate top-toolbar Assistive hub entry. Avatar customization remains available from the toolbar and Settings. The always-visible CARE button keeps its four shortcuts and now includes the existing `/docs/faq` page plus `mailto:care@someonenear.com` for further information and enquiries. The popover scrolls within available screen height. TypeScript and changed-file ESLint pass; browser verification covers the menu contents, links, desktop cleanup and mobile fit. No email was sent and no deployment was performed.

## Footer theme behavior

The public footer and member footer now follow the shared saved cream/navy preference. Without a valid saved choice, navigation and footer use the device's `prefers-color-scheme` setting and react to changes. Explicit choices persist across routes/reloads and synchronize across mounted surfaces and browser tabs. Changing Parent simple mode no longer saves an incidental theme override. The navy footer uses cream text, muted cream secondary text, coral wordmark accent and gold tagline. Two theme tests, changed-file lint and TypeScript pass. No full-site dark restyle or deployment was performed.
