# SomeoneNear consent wording and placement

Prepared 1 October 2026. Proposed product copy and implementation requirements, not evidence that these permissions are already collected. Replace placeholders and approve the age policy before use.

## General rules

Separate agreement to contractual terms from acknowledgment of a privacy notice and from consent to a specific optional activity. Do not preselect optional permissions or use one checkbox for unrelated purposes. Explain what information is needed and why at the point of collection.

Display the person concerned and named recipients where someone acts for a family member. A payer, family owner or adult role does not establish parental or representative authority. Verify the authority required for the feature.

Record the action, person, notice version, purpose, data categories, scope, recipients, server timestamp and any later withdrawal. Protect the evidence and retain it according to the approved schedule. Avoid collecting extra device or identity information merely to document consent.

## 1. Signup

Required agreement checkbox:

> I agree to the SomeoneNear Terms & Conditions and acknowledge that I have read the Privacy Policy.

Show links beside the checkbox and keep versions available. This acknowledgment does not authorize optional marketing, health-data sharing or call recording.

Eligibility wording:

> I meet SomeoneNear's age requirements for my location.

Before using it, set [APPROVED_AGE_POLICY] and enforce it in all signup paths, including social sign-in. If minors will be admitted, provide a separate, verified guardian process where required. Do not treat the minor's own checkbox as verification of a guardian.

## 2. First use of the AI Companion

Notice:

> You are chatting with AI, not a person. Your messages and relevant context are processed to generate replies and check for safety concerns. Conversations may be saved in your account. SomeoneNear is not medical care or an emergency service, and a person is not guaranteed to be monitoring this chat.

Specific consent wording, where consent is the applicable basis:

> I consent to SomeoneNear processing the information I provide, including health or wellbeing information I choose to share, to provide this Companion conversation and its safety checks, as explained in the Privacy Policy and Consumer Health Data Privacy Policy.

Keep a visible AI label in the conversation. Assess any location-specific repeat notices and safety interventions; a signup checkbox alone does not implement them. Identify the generation and safety providers in the linked notices.

## 3. Optional continuity memory

Proposed separate control:

> Save a short summary of my preferences and past conversations to personalize future chats. I can review or request correction or deletion of the summary through [VERIFIED_MEMORY_CONTROLS_OR_REQUEST_CHANNEL]. Clearing the summary does not automatically delete my chat history.

Do not present this as an optional switch until the backend respects the choice and withdrawal. Consent to a chat must not be silently treated as consent to every new memory use. Test summary access, correction, deletion and account-deletion coverage before describing them as available.

## 4. Prescription upload and medication information

Before uploading an image:

> This image may contain sensitive health information. SomeoneNear will send it to [VERIFIED_EXTRACTION_PROVIDER] to extract medication text and use the confirmed details to create your record and reminders. Review the extracted medicine, dose and schedule carefully. Remove information that is not needed. Storage and deletion are explained in our Privacy Policy.

Specific consent, where required:

> I consent to the processing of this prescription and the medication information I provide for text extraction, organization and reminders.

When uploading for another person:

> This information is for [PERSON]. I have authority to provide it for this purpose and have obtained any required permission.

That declaration does not replace verification or direct consent where required. Display the relevant person and avoid family-sharing defaults.

## 5. Sharing with family members

Show the actual names, recipient addresses and data categories before the choice:

> Share [DATA_CATEGORIES] for [PERSON] with [NAMED_RECIPIENTS] for [PURPOSE]. These recipients will be able to read this information. You can stop future sharing through [VERIFIED_SHARING_CONTROL]. Copies already delivered may remain with recipients, subject to applicable deletion rights.

Separate sharing consent:

> I consent to this sharing with the recipients listed above.

Collection consent and sharing consent must be distinct where required. Require a new decision if the recipient list or purpose expands. Do not automatically add every Family Circle adult or owner.

## 6. Email and calendar invitations

> Send [EVENT_DETAILS] to [RECIPIENT_ADDRESSES] through [EMAIL_PROVIDER]. The invitation may show medication names, doses, times and notes in inboxes, calendars and notifications. Your calendar service may require you to accept or import it. You can stop future invitations through [VERIFIED_CONTROL].

Obtain the required permission before sending. Display any family recipients separately. Turning invitations off must stop future sends; it is not a promise that all existing calendar copies disappear.

## 7. Listener calls and recording

Booking confirmation:

> I request a SomeoneNear listener call to [PHONE_NUMBER] on [DATE_AND_TIME_WITH_TIMEZONE]. The call is for companionship, not therapy, medical advice or emergency response.

If someone books for another adult, obtain the recipient's permission to receive the call. Do not combine the requested call with marketing consent.

Calls remain unrecorded by default. If recording is later enabled, present this separately before recording starts:

> May SomeoneNear record this call for [SPECIFIC_PURPOSE]? The recording will be available to [AUTHORIZED_RECIPIENTS] and kept for [RECORDING_RETENTION]. You may decline or ask us to stop recording through [RECORDING_CONTROL].

Obtain and document all participant permissions required by location, including the listener's. Explain any effect of declining; do not invent a feature restriction merely to obtain consent. A global recording configuration flag is not participant consent.

## 8. Scheduled voice and video messages

> Record or upload this message for [RECIPIENT]. SomeoneNear will store it and deliver it through [CHANNEL] at [DATE_AND_TIME_WITH_TIMEZONE]. Check the recording and recipient before scheduling. Confirm that you have permission to include any other person shown or heard.

Explain camera/microphone access before invoking the browser permission prompt. A camera permission does not authorize unrelated recording. Show how to cancel a pending delivery and what happens to the uploaded file.

## 9. WhatsApp, SMS and promotional messages

Transactional channel choice:

> Send my selected [REMINDER_OR_ACCOUNT_MESSAGE_TYPES] to [PHONE_NUMBER] through [WHATSAPP_OR_SMS]. Messages may reveal [DATA_CATEGORIES] in notifications. I can change this choice through [VERIFIED_CHANNEL_CONTROL]. Message and data charges may apply.

Marketing must have its own optional, unchecked choice and approved location-specific wording. No marketing permission is granted by creating an account, requesting a call or enabling medication reminders. If the product promises STOP, HELP or an equivalent withdrawal route, test that route first.

## 10. Recurring payments

Place beside the payment authorization, using the actual checkout values:

> I authorize recurring charges of [AMOUNT_AND_CURRENCY] every [BILLING_INTERVAL], plus any disclosed taxes, starting [FIRST_CHARGE_DATE], until I cancel through [CANCELLATION_METHOD]. I have read the cancellation terms and completed Cancellation & Refund Policy.

Do not deploy this text with blank financial or cancellation values. Display trial conversion, introductory pricing and later price changes if applicable. The provider's authorization flow and the website's wording must agree. Razorpay is planned; this text does not assert it is already integrated.

## Current gaps to resolve

The signup currently stores a client-generated acceptance timestamp and fixed versions in account metadata. Add reliable server-side evidence appropriate to the approved process. The guardian checkbox is self-declared. Memory controls have authentication defects. Calendar sharing currently selects family owners and adults automatically. Recording is controlled by configuration. None of these facts should be described as completed granular consent or verified guardian permission.
