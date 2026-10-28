# SomeoneNear policy review notes

Prepared 1 October 2026. Internal drafting notes, not public policy copy. This package is based on the user's business decisions and the current local code. It does not certify deployed configuration, provider contracts, regulatory coverage or completed registration. Have qualified counsel review the completed package for the actual launch scope.

## Decisions still needed

| Decision | Why it is unresolved |
| --- | --- |
| Legal operator, legal form, address and registration details | SomeoneNear was supplied as the business name; Indian registration is in progress. Do not invent a company suffix or incorporation status. |
| Working support and privacy contacts; grievance role | Existing pages name care@someonenear.com and privacy@someonenear.com, but mailbox operation and assigned staff were not verified. |
| Age policy for India and US states | Current code admits ages 13 and above using a self-declared guardian checkbox below 18. That is implementation evidence, not a legal conclusion. |
| Active payment provider and commercial scope | Owner is considering Razorpay; current checkout imports Dodo. Old Razorpay setup notes conflict with current code. Confirm international payments, subscriptions and the actual service mix with the provider. |
| Cancellation process and refund rules | Owner explicitly requested blank refund rules. Do not infer a no-refund policy, a refund window, a proration rule or a processing deadline. |
| Retention schedule and deletion operations | No complete verified schedule or cross-provider account-deletion process was established. Do not repeat an unsupported universal 30-day erasure promise. |
| AI provider account terms | Verify paid/free service terms, use of prompts and images, training/data-use settings, logging and processing regions. Do not promise universal zero retention or no training without evidence. |
| Market coverage and service timing | Confirm supported phone destinations, listener hours, payment activation timing and support targets. |

## Code-to-policy checks

| Topic | Evidence in the current checkout | Consequence for the draft |
| --- | --- | --- |
| Signup acceptance | [Signup form](../../src/components/auth/sign-up-form.tsx) stores client-supplied time and versions in user metadata | Do not describe it as an immutable server-side consent ledger; cover all signup methods. |
| Hosting | [Worker configuration](../../wrangler.json) and [Supabase client](../../src/integrations/supabase/client.ts) | Replace the old Lovable-hosting statement only after verifying the live arrangement. |
| Payment | [Checkout](../../src/routes/_authenticated/checkout.tsx), [Dodo server functions](../../src/lib/dodo.server.ts) | Razorpay is planned. Drafting these documents does not switch payment integrations. |
| Conversation history | [Chat endpoint](../../src/routes/api/chat.ts) writes message content to the database | A minimized summary is not the only retained conversational information. |
| Safety provider | [Bedrock adapter](../../src/lib/ai/adapters/bedrock-safety.server.ts) submits text for evaluation | Explain that the provider processes actual text; minimized audit records do not mean no text is processed. |
| Memory controls | [Memory functions](../../src/lib/ai/memory.functions.ts) have authentication problems identified in the audit | Do not promise working self-service access or deletion until fixed and tested. |
| AWS deletion | [Safety sink](../../src/lib/ai/adapters/aws-safety-sink.server.ts) catches errors and processes a single query result | Verify error reporting and complete deletion, including pagination, before treating a success response as proof. |
| Family sharing | [Calendar engine](../../src/lib/calendar-sync/supabaseSyncEngine.server.ts) resolves owners/adults and sends invitations to them | Role membership is not sharing consent. Identify recipients, obtain required permission, and implement withdrawal. |
| Call recording | [Telnyx configuration](../../src/lib/telnyx.server.ts) uses a global recording flag | Keep recording off until the participant notice/consent and retention process is implemented. |
| Media | [Scheduled messages](../../src/lib/send-later.server.ts) store voice/video in Supabase Storage | Mention recorded uploads and recipient delivery in privacy and consent documents. |
| Cookies | [Root page](../../src/routes/__root.tsx) loads Cookiebot | Verify actual deployed storage and blocking behaviour. Script presence alone does not establish compliance. |
| Existing policy dates | [Legal layout](../../src/components/legal/legal-page.tsx) and signup metadata use fixed dates | Coordinate approved version, effective date and acceptance evidence when publishing. |

The earlier audit also identified public-hook authentication, database authorization and chat-input validation defects. Fix and verify these before relying on the privacy safeguards described in launch materials. This drafting task does not repair those issues.

## India review

The DPDP framework has phased commencement. The official notification puts many core processing, consent, rights and children's-data provisions in the eighteen-month tranche after Gazette publication. As of this draft date, do not describe the entire Act and all Rules as already operative. Recheck the Gazette, corrigenda and actual launch date, and assess the existing IT/SPDI framework and consumer obligations during the transition. Sources: [MeitY commencement notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf), [DPDP Rules](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf), and [MeitY official index and corrigendum](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025-2).

Review the age/guardian model, notices, sensitive information, cross-border processing, grievance arrangements, request handling and vendor terms for the completed business structure. Do not assume a disclaimer about medical care removes obligations arising from the health information actually processed. The government has clarified that consent under the 2011 SPDI rules may be given electronically; that is not proof that the present consent scope is sufficient. [Government clarification on the SPDI rules](https://www.pib.gov.in/newsite/erelcontent.aspx?lang=2&reg=48&relid=74990).

## United States review

Medication data, mood information and health inferences warrant a consumer-health-data assessment. Washington's Attorney General explains that its My Health My Data Act can cover businesses serving Washington consumers, including businesses outside the state, and requires a separate health-data privacy-policy link on the homepage where applicable. The health-data draft provides a distinct document for that review; applicability and operational controls still need to be established. [Washington Attorney General guidance](https://www.atg.wa.gov/protecting-washingtonians-personal-health-data-and-privacy).

The separate notice addresses data categories, sources, purposes, sharing, recipient/affiliate details and rights routes. Complete the specific-recipient and affiliate fields and verify access, withdrawal, deletion and appeal handling before publication. [Washington policy requirements, RCW 19.373.030](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373.030). Review other relevant state health-data and general privacy laws; this is not a completed fifty-state assessment.

Assess the FTC Health Breach Notification Rule using the actual product and data flows. Lack of HIPAA coverage is not a general exemption for consumer health applications. Do not market SomeoneNear as HIPAA compliant or determine its status solely from a "not medical care" disclaimer. [FTC health-app tool](https://www.ftc.gov/business-guidance/resources/mobile-health-apps-interactive-tool), [FTC breach-rule guidance](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0).

AI companion laws can require product behaviour beyond a legal page. New York's official notice describes AI disclosures at the start of interactions and at least every three hours of continued use, plus protocols concerning suicidal ideation and self-harm. Assess coverage and implement required controls before serving covered users. [New York companion safeguards notice](https://www.governor.ny.gov/news/governor-hochul-pens-letter-ai-companion-companies-notifying-them-safeguard-requirements-are). Review California's companion-chatbot law and effective provisions as well. [California SB 243 official bill text](https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260SB243).

For recurring billing, disclose material terms before obtaining billing details, obtain express informed consent and provide a simple mechanism to stop recurring charges. These are ROSCA considerations, not a claim that every provision of a separate FTC rule is currently enforceable. Also assess applicable state renewal rules. [FTC ROSCA guidance](https://www.ftc.gov/business-guidance/blog/2018/07/time-rosca-recap-ftc-says-risk-free-trial-was-risky-not-free).

## Razorpay review

Razorpay's merchant terms require displayed customer terms and a return/refund policy with processing timelines, among other merchant duties. The owner's blank refund worksheet is deliberately not ready to meet that requirement. Finalize it before publishing or presenting it as complete. Verify onboarding, legal identity, business category, payment methods, currencies and recurring-billing arrangements directly with Razorpay. [Razorpay merchant terms](https://razorpay.com/terms/).

## Publication record

Record the final operator, policy versions, effective dates, reviewer, deployed checkout provider, verified support contacts and completed consent/control tests. Remove internal notes and placeholders from public documents. Keep the review history and the exact texts shown to users. Publish the separate health-data link where required and link all relevant purchase policies before payment.

The documents in this directory are drafts. None has been published, integrated into acceptance flows, or submitted to a payment provider by this task.
