# Deployed prototype integration

Reference: test_front Worker version fcea0dc6-b130-4bdc-9e15-11a11ed2c1f6, serving 100% of traffic when inspected. Deployed 30 October 2026 at 08:09 IST. Branch: feature/frontend-production.

The public landing page follows the deployed prototype's cream/navy palette, serif headings, original squircle mark, worry prompts, six interactive service demonstrations, family globe, three-step introduction, pricing cards, and footer.

## Navbar reference update — 4 November 2026

The supplied `someonenear_live_web_application.html` provides the public navbar interaction reference: a single desktop row, contextual hover/focus previews, a collapsible mobile menu, and pink accents. The landing navbar links only to landing sections; authenticated application routes stay in the member navigation. Docs remain accessible from the footer. Log in opens sign-in and Try for free opens the account creation tab.

Preview text uses the current services and approved Care/Care Plus entitlements instead of the reference's simulated reach statistics and obsolete prices. Previews close with Escape, outside click, pointer exit, or navigation. Mobile navigation supports Escape, outside click, and closing after a section choice. Calm space selects the existing quiet-moment demonstration. Reduced motion disables drawing/entrance animation and smooth scrolling.

Pink tokens match the reference: `#e11d74` for the brush underline and text-selection background, `#ec4899` for the secondary brush stroke, and `#fdf2f8` for selected service cards. Pink ink is darkened to `#b5165e` for readable small navigation text. The original globe and logo artwork remain intact.

Five dedicated navbar browser checks pass: desktop hover/focus previews, Escape and focus restoration, pink selection styles, section navigation, Calm space, signup, and mobile behavior at 320/390/768/1150px. Fourteen public/privacy/pricing/authentication regression journeys also pass. Screenshots are in `../outputs/navbar-*.png`.

Final validation also passed TypeScript, targeted ESLint/formatting, 41 focused catalog/checkout/session tests, the environment-reload self-check, artwork/backend contract verification, and the Cloudflare production build. The compiled Worker was not served or deployed. Development logs still show recoverable hydration warnings during signed-out redirects into `/auth`; the browser journeys reach the expected sign-in screen, but production redirect hydration remains to be checked.

The globe now ports `ThreeJsFamilyStage` from the user's supplied `someonenear_complete_integrated_platform.tsx`: Three.js camera/group projection, a rotating outer dot shell, the changing inner core radius, pulse rings, original illustrated members, floating badges, and member update cards. Its original varying core radius is intentional for this design; do not replace it with a constant sphere silhouette or clip the outer dots. Animation respects reduced motion and suspends offscreen. Call opt-in buttons in the public globe change only explicitly labeled sample state.

The sample customization dialog supports up to 12 members, names/notes, original avatar appearance options, pin angles, floating badges, three globe palettes, rotation speed, orbit rings, cancel/apply and reset. Customizations live only in page memory and are cleared on reload; they do not read or modify signed-in family profiles.

The visual system also applies to the actual signed-in application: shared top navigation, page headers, cards, buttons, dashboard family/reminder panels, Companion workspace, and branding on sign-in and documentation. Family, Reminders, Send Later, Companion, Insights, Settings, Safety, and staff routes continue to use their existing real data and permissions.

## Production behavior retained

Member visual follow-up: inspected the running test Worker's Family page and applied its cream/coral/gold palette, navy card shadows, care shortcuts and mobile bottom navigation to the shared member shell. Family member cards render actual roster names/roles with colorful initials, not the prototype's simulated medical updates or call confirmations. Warm/deep-navy and larger-text preferences persist locally. Browser verification covered password login to Family, both display modes, persistence after reload, More-menu opening/Escape closing, and the three-column desktop layout without horizontal overflow. TypeScript, targeted ESLint, production build and the artwork/backend contract guard passed. Screenshots: `../outputs/vibrant-family-mobile.jpg` and `../outputs/vibrant-family-desktop.jpg`. No deployment was made.

- Authentication, role checks, private routes, server functions, migrations, and provider contracts remain in place.
- Only explicitly marked public demonstrations use illustrated sample content. Private screens do not receive the preview's fabricated appointments, health readings, payments, or successful uploads.
- Legacy purchased terms continue to use src/lib/currency.ts. New launch offers use the approved versioned src/lib/launch-catalog.ts prices and entitlements. Production purchases remain gated; the separate sandbox checkout verifies supported Dodo test products.
- Privacy/cookie pages were compared with `origin/feature/new-ui`; the existing production policy text is retained and restyled. The Worker's navy/gold consent banner and preference controls now use Cookiebot's [documented consent SDK](https://www.cookiebot.com/en/developer/) while retaining automatic blocking. Browser-only fallback choices are remembered for 180 days and synchronized when Cookiebot becomes available. The prototype's simulated S3/geolocation cache controls and compliance badges are not copied.
- No Cloudflare deployment or push was performed. Local project credentials were configured and sandbox products/checkouts were created under explicit user authorization. The launch ledger migration remains unapplied.

## Verification

- Privacy follow-up: mobile/desktop consent, persistence, cancel/reopen and legal navigation journeys pass, plus a Cookiebot SDK test double verifies accept-all and essential-only category arguments. Actual Cookiebot domain/account configuration needs hosted verification.
- Source-globe follow-up: Three.js projection checks (3), mobile/desktop customization journeys (2), animation/pause/member card demo journey (1), TypeScript, targeted ESLint, Cloudflare production build, and artwork/backend contract checks pass.
- TypeScript check, production Cloudflare build, 84 unit tests, and original artwork/backend contract verification.
- Public browser journeys at 320, 390, 768, and 1440px: globe selection/zoom/reduced motion, demo selection/run/reset, currency selection, mobile menu, docs navigation, and horizontal overflow.
- Signed-out recovery on Dashboard, Family, Reminders, Send Later, Companion, Insights, and Settings.
- Targeted ESLint: no errors; existing mixed-export warnings remain in docs-shell and ui/button.

Signed-in verification now uses the three existing confirmed synthetic accounts in the user-approved live project: member, admin and listener. Tests obtain sessions through generated magic links without sending emails or changing passwords/roles. Member verification includes three reloads, the principal member pages, staff-route denial, sign-out and opening the real sandbox checkout. Admin and listener role-specific areas pass. Recovery and provider-option UI are checked; real password/Google callback and email delivery remain unverified. No test payment or real call was submitted. Existing repository-wide lint debt is outside this visual integration.
