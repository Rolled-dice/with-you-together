# Worker UI clone plan

Prepared 4 November 2026. This is an inspection and implementation plan; no application code was changed in this audit.

## Verified references

- Live reference: https://test_front.mdutt855.workers.dev/dashboard, inspected in the signed-in sample account on mobile (411px) and desktop (1440px). A newly loaded preview initially showed a public header; completing its clearly labelled sample sign-in revealed the actual desktop member sidebar. Compare like-for-like authenticated states.
- Local comparison: http://127.0.0.1:8081/dashboard with the existing real member test account. It currently uses a different page hierarchy, horizontal desktop navigation, simplified family content and a large public footer.
- Remote `origin/feature/new-ui` verified via `git ls-remote`: `6b2077e948c0396df8e9bcd07e605dbc8d2b65bf`. There is no separate remote branch named `new-ui` in that lookup. Current work stays on `test-worker-ui`; inspect/port selected files without replacing the dirty working tree.
- `feature/new-ui` has TWO surfaces: connected routes under `_authenticated` and a separate sample frontend in `src/components/frontend-preview/{prototype.jsx,workspace.tsx,preview.css}`. Its connected dashboard is not the deployed Worker dashboard. The prototype is useful for artwork, controls and interactions, but is not verified as identical to the deployed revision.
- The supplied `Downloads/someonenear_complete_integrated_platform.tsx` directly contains the deployed dashboard's four-category switcher and family status panel around lines 2723–2810. Use it alongside the live reference, resolving differences in favour of the running Worker.

## Observed differences

| Area | Running Worker | Current localhost | Required change |
| --- | --- | --- | --- |
| Desktop shell | Fixed left sidebar with logo, icon navigation, family badge, palette/customization card, sign-out | Logo/header plus horizontal navigation | Port the sidebar layout, dimensions and content offset |
| Member toolbar | Navigation theme, parent mode, Customize avatars, Family updates, Assistive hub | Theme, parent mode, Family circle shortcut | Match control order, sizing, placement and opened states |
| Theme scope | Deep navy changes navigation while the dashboard remains warm cream | Navy preference recolors the whole member page | Reproduce reference navigation theme scope |
| Care tabs | Today, Family, My sharing, Health, Calls | Health replaced with Reminders; links go straight to separate pages | Match names, selected styling and the reference's distinct views |
| Dashboard introduction | Gold page label, compact serif greeting, status summary and Book Listener Call / Manage Family actions | Coral label, different greeting and description; notification panel comes before cards | Rebuild hierarchy and action placement; move notification details to their appropriate surface |
| Overview | Family Circle, Photo Meds, Listener Calls, Care Reminders | Family, reminders, Companion, memories | Use the exact four categories and their selected states |
| Category behavior | Selecting Photo Meds replaces the detail panel in place; family selection restores its panel | Cards navigate directly to routes | Implement a keyboard-accessible category switcher and progressive detail panel |
| Family panel | Illustrated avatars, name, call opt-in badge, short update; three columns on desktop | Text-only dashboard roster; separate family page uses initials | Reuse original artwork and card anatomy, bound to actual profiles/status data |
| Mobile | Compact stacked toolbar, five care tabs, four main bottom destinations plus More, floating ASSIST | Approximate bottom bar; different toolbar, text wrapping and More contents; no ASSIST | Match spacing, badges, menu, safe-area padding and floating control |
| Member footer | Small warm-presence/sample-account footer | Large marketing footer with multiple columns | Use the compact member footer; keep public footer on public routes |

## Implementation sequence

1. **Freeze the reference and build the screen/state checklist.** Capture the signed-in Worker at 320, 390, 411, 768, 1024, 1440 and 1920px. Record sidebar/bottom-bar switch points, font sizes, widths, gaps, radii, borders, shadows and stacking order. Capture cream/navy navigation, parent mode, active categories, More, family updates, avatar editor and ASSIST. Existing saved screenshots establish the initial mobile/desktop baseline, not every breakpoint or popup.
2. **Port one faithful shared member shell.** Replace the current approximate shell with the Worker's desktop sidebar and mobile layout. Reuse original logo, icons and editorial avatar artwork. Match the toolbar, care tabs, navigation labels/order/badges, compact footer and overlays. Apply navigation themes with the same scope as the reference. Use existing TanStack routing and preserve role-specific staff navigation and session handling. Public landing navigation remains separate.
3. **Rebuild the dashboard composition.** Port the original hero, action buttons, four overview categories, selected navy/gold treatment and progressive panel. Port all four panel states, including family roster, medication list, call allowance and reminders. Match empty/loading/error states to the same visual system. Keep account names, member counts and approved Care/Care Plus allowances data-driven.
4. **Port the remaining member screens and interactions.** Work through Family, Listeners, Medication/Reminders, Send Later, Companion, Insights, Safety, Settings and Calm. Match each screen's layout, avatar treatment, dialogs, drawers, validation messages and transitions. Match Today/Family/My sharing/Health/Calls as actual distinct views rather than substitute links. Reuse matching `new-ui` components selectively; the current routes/backends remain the integration points.
5. **Connect each control to the existing application.** Create a UI-to-data map for family profiles, avatar preferences, opt-in statuses, medication verification, recent updates, call balances, reminder state and notifications. Show truthful empty/unavailable states when data or a provider is absent. Keep sample fixtures confined to visual comparison tests. Existing AWS/Bedrock work stays deferred, approved launch pricing stays intact, and call/payment actions retain their gates. Avatar/profile editing, ASSIST, uploads, calls and sharing require their existing permissions and actual success/error handling; copying the prototype's simulated success messages is not completion.
6. **Prove visual and interaction parity.** Render the port and Worker with identical synthetic fixture content, viewport, theme, category and motion state. Review paired screenshots/overlays for each breakpoint. Use the real test account separately to verify authentication, navigation and data binding. Check touch targets, scrolling, bottom safe areas, keyboard focus/Escape, reduced motion, preference persistence and absence of horizontal overflow. Finish with type checking, targeted lint, production build and original-artwork/backend contract verification.

## Completion criteria

- Desktop has the same sidebar, toolbar, content position, category row and family-grid geometry as the signed-in Worker.
- Mobile matches the reference's content order, control wrapping, bottom navigation, More menu and floating ASSIST placement.
- Original illustrations and consistent typography replace approximate initials/plain roster rows where profile appearance is available; missing profile appearance uses an intentional default without inventing age or identity.
- Each category changes its detail panel, with the same selection feedback and animation; each navigation item and overlay has the corresponding behavior.
- The same theme setting has the same visual scope. Parent mode remains usable across the ported screens.
- No additional cards, footer blocks or decorative redesigns change the reference's hierarchy. Necessary live-data empty/error states fit the original card structure.
- Real member data can differ from the sample family. Fixture comparisons establish layout parity without representing fictional calls, medical verification or payments as real activity.
- Compare every listed screen and its principal interactions before calling the website a clone. Dashboard parity is the first reviewable milestone, followed by the remaining member screens.

## Evidence

- `../outputs/clone-worker-mobile.jpg`
- `../outputs/clone-worker-desktop-signed-in.jpg` (authoritative signed-in desktop shell)
- `../outputs/clone-worker-desktop.jpg` (public-header state before sample sign-in; not the member-shell target)
- `../outputs/clone-local-mobile.jpg`
- `../outputs/clone-local-desktop.jpg`

This audit did not verify every Worker popup or every member screen, apply migrations, change provider settings, switch branches or deploy. Those checks are explicit steps in the plan rather than assumed parity.
