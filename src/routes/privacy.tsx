import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/legal-page";

const title = "Privacy Policy | SomeoneNear";
const description = "How SomeoneNear collects, uses, protects, and shares personal information.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy" summary="This policy explains what information SomeoneNear uses, why we use it, and the choices available to you.">
      <section className="legal-notice">
        <h2>Medical and emergency disclaimer</h2>
        <p>SomeoneNear is a companionship, check-in, and everyday-support service. It may provide emotional support and general information, but it is not a medical, psychiatric, or emergency service. If you are in immediate danger, experiencing a medical emergency, or require professional mental-health support, contact local emergency services or a qualified healthcare provider immediately.</p>
      </section>

      <section>
        <h2>Who we are</h2>
        <p>SomeoneNear provides AI conversations, human listener calls, family-circle features, medication reminders, and membership services. For privacy questions or requests, email <a href="mailto:privacy@someonenear.com">privacy@someonenear.com</a>.</p>
      </section>

      <section>
        <h2>Information we collect and why</h2>
        <h3>Account and identity information</h3>
        <p>We use your name, email address, date of birth, phone number, and account identifiers to create and secure your account, provide calls and notifications, manage your membership, and communicate with you.</p>
        <h3>Conversations, check-ins, and family information</h3>
        <p>We process Companion messages, mood check-ins, listener-booking details, call notes, and information you choose to add to a Family Circle so we can provide the features you request. A payer or Family Circle owner does not automatically receive access to another member&apos;s private Companion conversations.</p>
        <h3>Medication and prescription information</h3>
        <p>When you use medication reminders or prescription scanning, we process the medication details and images you provide to create schedules and reminders. Prescription images are used for text extraction and are not intended for diagnosis.</p>
        <h3>Sign-in and connected services</h3>
        <p>If you use Google or Apple sign-in, we receive the account details you authorize, such as your email, name, and provider identifier. We never receive your Google or Apple password. When calendar synchronization is enabled, event reminders and dose schedules are delivered directly via standard RFC 5545 / RFC 6047 calendar invitations without requiring third-party OAuth access or token permissions.</p>
        <h3>Calls, microphone, and messaging</h3>
        <p>Listener staff may use microphone access for browser calling. The member receives an ordinary phone call. Calls are not recorded by default. We process phone numbers, call status, timing, and operational notes needed to arrange and complete calls. WhatsApp or SMS messages may be queued or sent when those services are enabled.</p>
        <p>Companion voice input is optional and starts only when you choose it and allow microphone access. Your browser&apos;s speech-recognition service may process audio for live transcription. Where live recognition is unavailable, a short recording is sent to Google Gemini for transcription. SomeoneNear does not store these audio recordings in its database or file storage. A recording may stay temporarily in browser memory so you can retry a failed transcription, and is cleared on completion, cancellation, or leaving the page. Provider processing is subject to the relevant provider&apos;s terms. You can review or edit the resulting text before sending it as a Companion message, or use typing without microphone access.</p>
        <h3>Payments and approximate region</h3>
        <p>Payment providers process payment details for memberships. SomeoneNear does not store full card numbers. We may infer a country or timezone from information such as your selected country, phone country code, browser settings, or network information to show suitable pricing, taxes, and reminder times. We do not use the service to track precise GPS location.</p>
      </section>

      <section>
        <h2>How we use information</h2>
        <ul>
          <li>Provide, personalize, secure, and support SomeoneNear.</li>
          <li>Arrange listener calls, reminders, family features, and account communications.</li>
          <li>Process memberships and maintain financial records required by law.</li>
          <li>Prevent misuse, investigate safety concerns, and improve reliability.</li>
          <li>Meet legal obligations and respond to valid rights requests.</li>
        </ul>
      </section>

      <section>
        <h2>Service providers and sharing</h2>
        <p>We do not sell personal information or share it with third-party advertisers. We disclose only the information needed to providers that help operate the service. These currently include Lovable Cloud for application hosting, account services, and data storage; Google Gemini for Companion responses and prescription text extraction; Amazon Web Services (AWS) and Amazon Bedrock for AI safety guardrail evaluations and encrypted memory storage; Telnyx for listener calling; Google and Apple for sign-in or connected calendar services; enabled payment providers; and enabled email or messaging providers. A provider is involved only when its related feature is configured or used. Switching backend service providers does not reduce your privacy rights.</p>
        <p>We may also disclose information when required by law, to protect a person from serious harm, or as part of a business transaction subject to appropriate safeguards.</p>
      </section>

      <section>
        <h2>AI Companion, safety processing, and memory</h2>
        <p>To provide safe and empathetic emotional companionship, our AI integration adheres to strict boundaries:</p>
        <ul>
          <li><strong>Safety evaluations:</strong> Amazon Web Services and Amazon Bedrock may process conversation prompts and generated responses to evaluate crisis indicators, self-harm risk, and safety boundaries.</li>
          <li><strong>Minimized audit logs:</strong> Safety logs record categorized outcomes and technical metrics. They do not contain raw conversation transcripts or message text by default.</li>
          <li><strong>Encrypted continuity summaries:</strong> To maintain continuity between chats without retaining full conversation histories in memory, a minimized, non-clinical summary of user-stated preferences and wellbeing goals may be created. Summaries and safety audit records are encrypted at rest and stored in the configured AWS region under pseudonymous identifiers.</li>
          <li><strong>Memory controls:</strong> You can view your stored summary, request corrections, or clear your Companion memory at any time in Settings.</li>
          <li><strong>Account deletion:</strong> Deleting your account queues the deletion or anonymization of your AI user summary and deletable safety events in accordance with our retention policy.</li>
        </ul>
      </section>

      <section>
        <h2>Storage, security, and retention</h2>
        <p>We use access controls, encrypted connections, role-based permissions, and database row-level protections designed to limit access to personal information. No online service can guarantee absolute security.</p>
        <p>Account information, conversations, medication records, and uploaded material are generally kept while your account is active or as needed to provide the service. When you delete information or your account, we remove or de-identify it from active systems within 30 days unless law, fraud prevention, safety, disputes, or financial-record duties require longer retention. Backups may take additional time to expire through routine rotation.</p>
      </section>

      <section>
        <h2>Family consent and young people</h2>
        <p>SomeoneNear is not available to children under 13. A user aged 13 or older who has not reached the age of legal adulthood where they live must have permission from a parent or legal guardian. A Family Circle invitation does not by itself prove parental consent. Parents or guardians may contact us to request review or deletion of a young person&apos;s account.</p>
      </section>

      <section>
        <h2>Your rights and choices</h2>
        <p>Depending on where you live, you may ask to access, correct, export, delete, restrict, or object to the use of your personal information, and you may withdraw consent. You can update many details in Settings, disconnect integrations, or email <a href="mailto:privacy@someonenear.com">privacy@someonenear.com</a>. We aim to answer verified requests within 30 days or the period required by applicable law.</p>
        <p>If information is processed outside your country, we use provider terms and legal safeguards intended to protect it. You may also complain to your local data-protection authority.</p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>Essential storage supports sign-in, security, and requested features. Optional analytics or marketing technologies are blocked until you consent. SomeoneNear currently has no analytics or advertising scripts installed. Read the <a href="/cookies">Cookie Policy</a> or use Manage Privacy Choices at any time.</p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>We may update this policy when the service or legal requirements change. We will change the effective date and provide additional notice when a material change requires it.</p>
      </section>
    </LegalPage>
  );
}
