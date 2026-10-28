# SomeoneNear Privacy Policy

> Review draft. Effective date: [EFFECTIVE_DATE]. Version: [POLICY_VERSION]. Provider deployment, retention, rights-handling procedures and age rules need confirmation before publication.

## 1. Who is responsible

SomeoneNear is operated by [LEGAL_PERSON_OR_ENTITY_NAME], [BUSINESS_ADDRESS], India. We determine how personal information is used to provide SomeoneNear's services. Contact [VERIFIED_PRIVACY_EMAIL] for privacy questions or requests.

This policy covers SomeoneNear's services for users in India and the United States. The separate Consumer Health Data Privacy Policy provides additional information about medication, wellbeing and other health-related information where applicable.

## 2. Information, sources and purposes

| Information | Sources | Why we use it |
| --- | --- | --- |
| Name, email, date of birth, telephone number, country, timezone, account identifiers and authentication information | You, your selected sign-in provider, or a person authorized to arrange a service for you | Account access, age checks, security, calls, local times and account communications |
| Companion messages, responses, conversation titles, continuity notes and saved memories | You and outputs generated from your interactions | Conversation history, responses, personalization and safety checks |
| Mood entries, journal entries, wellbeing preferences and notes | You | The check-in, journal and review features you request |
| Medicine names, doses, prescriber details if supplied, schedules, instructions, prescription images, extracted text and reported dose actions | You or an authorized family member | Prescription text extraction, medication organization and reminders |
| Family invitations, roles, relationships, shared information and recipient contact details | You, other family members and invitation responses | Family coordination and the sharing described for the feature |
| Call requests, telephone numbers, scheduling details, status, duration, feedback and operational notes | You, listeners and calling providers | Arranging calls, providing support, managing delivery and investigating complaints |
| Scheduled message text, voice or video, chosen recipients, attachments and delivery information | You and delivery systems | Storing and delivering the message you schedule |
| Subscription, transaction, billing and payment-status information | You and the payment provider | Membership access, accounting, payment support and dispute handling |
| IP address, device/browser information, session identifiers, security events and technical logs | Your device and service infrastructure | Sign-in, troubleshooting, security and service operation |
| Notice versions, permissions, consent choices and rights-request records | Your choices and our support process | Respecting choices, documenting requests and demonstrating actions taken |

Some information can reveal physical or mental health, family circumstances or other sensitive matters. Supply only what the feature needs. We do not request precise GPS location as part of the current service. Region or timezone can be inferred from account settings, telephone country codes, browser information or network information.

## 3. AI processing and history

Companion messages and relevant context are sent to the configured AI provider to generate a response. The current integration uses Google Gemini. Where enabled, Amazon Bedrock evaluates message or response content for safety signals. These providers may receive the actual text being processed, not just a risk category.

Our application stores conversation history separately from continuity summaries. A short summary does not replace or automatically erase the underlying chat messages. Summaries can include preferences, everyday concerns and wellbeing goals. A summary or safety classification can still be personal information even when stored under a pseudonymous identifier.

The application's structured safety records contain outcome categories, timestamps, identifiers and technical measurements rather than raw message text. This does not mean that all transcripts, infrastructure logs or provider records are absent. Provider processing and retention depend on the configured service and applicable agreement.

Provider use of submitted content for model improvement or training must be confirmed before publication: [VERIFIED_PROVIDER_DATA_USE_TERMS]. This draft makes no unverified promise that every provider has zero retention or never uses data for training.

Contact [VERIFIED_PRIVACY_EMAIL] to request access to, correction of, or deletion of your information. Any advertised in-app memory controls must be verified before this draft is published.

## 4. Family, calendar and recipient sharing

A payer does not automatically receive another person's private Companion transcript. Family tools can nevertheless share other information, such as schedules, medication information, booking information or a message addressed to another member.

The current calendar implementation sends invitations to the member and may also send them to Family Circle owners and adults. Invitations can include medication names, doses, schedules and notes. These roles do not establish legal guardianship. Before enabling this sharing at launch, the app must identify the information and actual recipients and obtain the required authorization. [CONFIRM_AND_IMPLEMENT_FAMILY_SHARING_CONTROLS_BEFORE_PUBLICATION.]

Calendar invitations pass through an email provider and the recipient's email/calendar service. Once received, copies can remain in inboxes or calendars independently of SomeoneNear. Recipients may save or forward messages they receive. We will make deletion requests to recipients or providers where legally required, but cannot promise the recall of every delivered copy.

## 5. Calls, recordings and device permissions

Listeners may access information needed for an assigned call and record necessary operational notes. Authorized support and safety staff may access relevant records to resolve a specific issue. This access is distinct from sharing with a family member.

Listener calls are not recorded by default in the current implementation. Any recording programme requires a separate notice describing its purpose, access and retention, and the permissions required for the participants and their locations.

Browser microphone or camera permissions allow you to create a voice or video message, or staff to use calling tools. Granting device permission is not permission to record unrelated activity or to use the recording for unrelated purposes. Uploaded scheduled messages are stored for the delivery feature. Review their contents and recipients before sending.

Companion voice input starts only when you choose it and allow microphone access. Your browser's speech-recognition service may process audio for live transcription. Where live recognition is unavailable, a short recording is sent to Google Gemini for transcription. SomeoneNear does not store these Companion audio recordings in its database or file storage. A recording may stay temporarily in browser memory for an explicit retry after a failed transcription, and is cleared on completion, cancellation, or leaving the page. Provider processing is subject to the relevant provider's terms. The resulting text stays as an editable draft until you send it as a Companion message. You can use typing without microphone access.

## 6. Providers and other recipients

Only providers used in the deployed service should appear in the published version of this table. Review-draft status is shown because code presence does not prove a production service is active.

| Provider/category | Purpose and information involved | Draft status |
| --- | --- | --- |
| Cloudflare | Hosting, request delivery and infrastructure/security information; application traffic processed by hosted functions | Current deployment target; verify live settings |
| Supabase | Authentication, application database, conversation and feature records, uploaded media and access controls | Current integration; verify hosting arrangement and region |
| Google Gemini | Chat generation, summary generation, optional Companion audio transcription and prescription image/text extraction | Current integration; verify account terms and data use |
| AWS, including Amazon Bedrock and DynamoDB | Safety evaluation of text, continuity summaries and structured safety records | Current integration; verify resources, region and retention |
| Telnyx | Telephone numbers, call routing, status and call content needed to carry a call; any separately permitted recording | Current calling integration |
| Brevo or the configured transactional email provider | Recipient addresses and message/invitation contents, including medication details where included | Brevo path exists; confirm actual sender/provider |
| Razorpay | Payment and billing details, transaction processing and fraud prevention | Planned only; not the current checkout integration |
| Actual active payment provider, if different | Purchase and subscription information | Current code uses Dodo; resolve before publishing |
| Google or Apple sign-in | Sign-in identifiers and account information authorized by the user | Include only enabled providers |
| Cookiebot | Privacy choices and information needed to operate the consent tool | Script configured; verify live behaviour and declaration |
| WhatsApp/Meta and messaging delivery provider | Telephone numbers, selected message content and delivery information | Name the enabled delivery provider before launch |
| Family members, invited recipients and authorized staff | Information described in the family, delivery and access sections | Limit to the applicable feature and authority |

We do not sell personal information or use sensitive conversation or medication content for third-party targeted advertising. [VERIFY_THIS_STATEMENT_AGAINST_ALL_ACTIVE_SDKS_AND_CONTRACTS.]

We may disclose information when required by valid legal process or when permitted by applicable law to address serious harm, fraud or a security incident. Any disclosure must be limited to its lawful purpose. A corporate transaction involving personal information remains subject to applicable protections, notice and consent requirements.

## 7. International processing and security

SomeoneNear is being established in India and intends to serve users in India and the United States. Providers may process information in those and other countries. Verified hosting and processing locations: [PROCESSING_LOCATIONS_AND_TRANSFER_SAFEGUARDS]. There is no promise that all information remains in India.

We use safeguards appropriate to the information and service, including access restrictions and secure communications. The final description of encryption and other controls must match deployed settings. No online service can promise absolute security, and an application using server-side AI processing should not be described as end-to-end encrypted without a verified basis.

## 8. Retention and deletion

We retain personal information for the purposes described in this policy and for applicable legal obligations. The retention schedule must specify the period or objective deletion trigger for each category below.

| Category | Retention period or deletion trigger |
| --- | --- |
| Accounts and profiles | [ACCOUNT_RETENTION] |
| Conversations, journals, mood entries and memories | [CONVERSATION_AND_WELLBEING_RETENTION] |
| AI summaries and safety records | [AI_RECORD_RETENTION] |
| Prescriptions, medication records and dose logs | [MEDICATION_RETENTION] |
| Call metadata, notes and any permitted recordings | [CALL_RETENTION] |
| Scheduled text, voice and video messages | [SCHEDULED_MESSAGE_RETENTION] |
| Billing and tax records | [FINANCIAL_RETENTION] |
| Consent evidence and rights requests | [CONSENT_AND_REQUEST_RETENTION] |
| Technical logs and backups | [LOG_AND_BACKUP_RETENTION] |

Deleting one chat does not by itself delete a separately stored summary, audit record, delivered calendar invitation or required financial record. An account-deletion request must address the relevant systems and providers. Where an exception permits continued retention, we will explain it as required and limit further use. Backups and external copies must be handled in accordance with applicable law and the completed schedule.

## 9. Your choices and rights

Depending on applicable law, you may have rights to know about or access your information, obtain a copy, correct it, request deletion, withdraw consent, limit certain processing or sharing, and appeal a decision. Submit a request to [VERIFIED_PRIVACY_EMAIL] or [RIGHTS_REQUEST_CHANNEL]. We will respond within the applicable legal period and explain any lawful refusal or extension.

We may take reasonable steps to verify identity or an agent's authority. We will not request more information than needed for verification. You may contact the grievance contact shown on our Contact & Grievance page and complain to the competent authority where the law provides that right. We will not unlawfully discriminate against you for exercising your rights.

Withdrawing permission for a particular optional use stops future processing for that use, subject to applicable law. It may make the related feature unavailable; it does not automatically require giving up unrelated services. Withdrawal does not undo processing that was lawful before withdrawal.

## 10. Children and people acting for others

Minimum age and any permitted guardian-supported access: [APPROVED_AGE_POLICY]. A person paying for an account or selecting an adult family role is not necessarily a legal guardian. If a guardian or authorized representative acts for another person, we must establish the relevant authority and provide the required notices and choices.

The currently implemented signup permits ages 13 and above with a self-declared guardian checkbox below 18. [REPLACE_THIS_DRAFT_NOTE_WITH_THE_APPROVED_AND_IMPLEMENTED_MARKET_SPECIFIC_AGE_PROCESS.] This design has not been verified as sufficient for India or every US state.

## 11. Cookies, changes and contact

Read the Cookie Policy for browser storage and privacy choices. We will publish updated policy dates and provide further notice or obtain fresh consent where a change requires it. This policy does not authorize undisclosed new uses of health information.

Privacy contact: [VERIFIED_PRIVACY_EMAIL]. Grievance contact: [GRIEVANCE_CONTACT]. Postal address: [BUSINESS_ADDRESS].
