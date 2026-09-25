# Cookie consent and legal policies

## Goal
Add Cookiebot consent management and publish clear SomeoneNear legal pages based on the uploaded policy, corrected to match the service that exists today.

## Build
- Load Cookiebot in the document head with the supplied Domain Group ID and automatic blocking enabled.
- Add a reusable “Manage Privacy Choices” control that reopens Cookiebot preferences.
- Create public Privacy Policy, Terms of Service, and Cookie Policy pages with SomeoneNear styling, readable navigation, effective dates, and route-specific search/social metadata.
- Use the uploaded privacy policy as the source, while removing or correcting unsupported claims such as unverified encryption/MFA guarantees, precise calendar scanning, default call transcripts, and vendors not currently used.
- State that essential login/security storage is always active, optional analytics/marketing is blocked until consent, and no analytics or advertising tools are currently installed.
- Add legal and privacy-choice links to the public footer, sign-in/create-account page, and the signed-in experience.
- Require Terms and Privacy acceptance for email/password registration. For Google/Apple signup, show the same linked agreement before continuing.
- Enforce the selected age position: users must be 13+, and users under the age of legal adulthood need parent or guardian consent.
- Configure private-data query caching conservatively without introducing a persistent browser cache.

## Verification
- Confirm all three legal pages render on desktop and mobile and expose unique metadata.
- Confirm Cookiebot loads before application scripts and the privacy-choice control opens its preferences.
- Confirm signup cannot continue without legal acceptance and that sign-in remains unaffected.
- Confirm rejecting optional cookies does not break account access.
- Check the preview for build, browser, and navigation errors.

## Legal caveat
The pages will identify the operator as “SomeoneNear,” as requested. A registered legal name and address can be added later; publishing without them may be less complete in some jurisdictions.
