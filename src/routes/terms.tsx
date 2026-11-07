import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/legal-page";

const title = "Terms of Service | SomeoneNear";
const description =
  "Terms governing your use of SomeoneNear companionship, check-in, and everyday-support services.";

export const Route = createFileRoute("/terms")({
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
  component: Terms,
});

function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      summary="These terms describe the rules for using SomeoneNear and the limits of our companionship and everyday-support service."
    >
      <section className="legal-notice">
        <h2>Not medical or emergency care</h2>
        <p>
          SomeoneNear is not therapy, medical advice, diagnosis, psychiatric care, crisis response,
          or an emergency service. Do not rely on SomeoneNear for urgent help. Contact local
          emergency services or a qualified professional when needed.
        </p>
      </section>
      <section>
        <h2>Accepting these terms</h2>
        <p>
          By creating an account or using SomeoneNear, you agree to these Terms and our Privacy
          Policy. If you use the service for another person or manage a Family Circle, you confirm
          that you have permission to provide their information and arrange services for them.
        </p>
      </section>
      <section>
        <h2>Age and guardian permission</h2>
        <p>
          You must be at least 13. If you have not reached the age of legal adulthood where you
          live, you may use SomeoneNear only with permission from a parent or legal guardian. The
          adult responsible for consent should review these Terms and the Privacy Policy.
        </p>
      </section>
      <section>
        <h2>Your account</h2>
        <p>
          Provide accurate information, protect your sign-in details, and tell us promptly about
          unauthorized use. You are responsible for activity through your account unless caused by
          our failure to use reasonable safeguards. We may suspend access when needed to protect
          users, investigate misuse, or comply with law.
        </p>
      </section>
      <section>
        <h2>Appropriate use</h2>
        <p>
          Do not use SomeoneNear to threaten, exploit, harass, impersonate, deceive, unlawfully
          monitor, or harm anyone; upload unlawful or malicious material; interfere with the
          service; attempt unauthorized access; or use automated methods to copy or abuse it.
        </p>
      </section>
      <section>
        <h2>AI Companion</h2>
        <p>
          AI responses can be incomplete, inaccurate, or unsuitable. They are generated from the
          information you provide and are not professional advice. Use your judgment and confirm
          important information with a qualified person.
        </p>
      </section>
      <section>
        <h2>Feature availability</h2>
        <p>
          Only enabled features are available in this release. Device notification permission does
          not guarantee delivery. Scheduled messages depend on service availability, correct
          recipient details, and the selected delivery time.
        </p>
      </section>
      <section>
        <h2>Medication reminders</h2>
        <p>
          Medication features help organize information and reminders; they do not verify
          prescriptions, dosages, interactions, or whether medication has been taken. Always follow
          instructions from your prescriber or pharmacist.
        </p>
      </section>
      <section>
        <h2>Family Circles</h2>
        <p>
          Members see only information made available through the relevant feature and permissions.
          Paying for another person does not grant access to that person&apos;s private Companion
          conversations. Do not invite someone or share their information without authority to do
          so.
        </p>
      </section>
      <section>
        <h2>Memberships and payment</h2>
        <p>
          Prices, included Check-Ins, billing periods, taxes, and renewal terms are shown before
          purchase. Payments are handled by the provider presented at checkout. Unless checkout or
          applicable law states otherwise, subscriptions renew until cancelled and cancellation
          stops future renewal rather than refunding a completed billing period. Statutory
          cancellation and refund rights continue to apply. Contact{" "}
          <a href="mailto:care@someonenear.com">care@someonenear.com</a> about billing issues.
        </p>
      </section>
      <section>
        <h2>Availability and changes</h2>
        <p>
          We work to keep SomeoneNear available, but do not promise uninterrupted or error-free
          operation. We may maintain, change, or discontinue features and will provide reasonable
          notice when a material change affects an active paid service.
        </p>
      </section>
      <section>
        <h2>Responsibility</h2>
        <p>
          To the maximum extent permitted by law, SomeoneNear is provided without warranties beyond
          those that cannot legally be excluded. SomeoneNear is not responsible for indirect or
          consequential losses. Nothing in these Terms excludes liability that cannot legally be
          limited, including liability for fraud or deliberate misconduct.
        </p>
      </section>
      <section>
        <h2>Ending use</h2>
        <p>
          You may stop using the service, cancel a membership, or request account deletion. We may
          restrict or terminate access for serious or repeated violations, safety risks,
          non-payment, or legal requirements.
        </p>
      </section>
      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update these Terms and will change the effective date when we do. Material changes
          may require a new acknowledgement. Questions may be sent to{" "}
          <a href="mailto:care@someonenear.com">care@someonenear.com</a>. Because the service can be
          used in multiple countries, mandatory consumer laws where you live remain applicable.
        </p>
      </section>
    </LegalPage>
  );
}
