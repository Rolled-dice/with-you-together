# Fix the listener console blank screen

## Outcome
The Agent Console opens reliably for real listener accounts, without the blank-screen exception or development role preview.

## Changes
- Make the shared page animation wait until the browser has mounted before SplitText changes heading markup, with safe cleanup and reduced-motion behavior.
- Remove the obsolete “View as” switcher and its local role override files.
- Keep staff navigation based only on real backend roles: listeners go to Agent Console, admins go to Call CRM.
- Correct the listener account linkage only if the current roster still has missing user IDs or the known email typo. Do not grant listener accounts an admin role.
- Add graceful query/error handling so an unlinked listener sees a usable message instead of a blank page.

## Verification
- Confirm the affected listener is recognized as active.
- Open `/agent/console` in a signed-in browser and verify the page renders without uncaught errors.
- Check the current app build and relevant tests.
