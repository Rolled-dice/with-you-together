# Simplify staff portals

## Changes
- Show regular member features only to normal member accounts.
- Show agents only the Agent Console navigation item.
- Show admins only Dashboard and Call CRM; remove Feedback and other member links from the admin navigation.
- Hide member-only notification and membership panels for agent/admin accounts.
- Redirect staff away from pages outside their allowed portal so hidden features cannot be opened from old links.

## Verification
- Check agent, admin, and regular-member navigation states.
- Confirm direct access redirects to the correct staff landing page.
- Confirm the app builds without errors.

## Technical details
- Centralize role-based navigation and staff-page allowlists in the shared authenticated app shell.
- Give admin precedence when an account has both admin and agent roles.
