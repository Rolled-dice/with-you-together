import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/legal-page";
import { PrivacyChoicesButton } from "@/components/privacy-choices-button";

const title = "Cookie Policy | SomeoneNear";
const description =
  "How SomeoneNear uses essential browser storage and manages optional cookie consent.";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://someonenear.com/cookies" },
      { property: "og:image", content: "https://someonenear.com/logo.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://someonenear.com/cookies" }],
  }),
  component: CookiePolicy,
});

function CookiePolicy() {
  return (
    <LegalPage
      title="Cookie Policy"
      summary="SomeoneNear uses essential browser storage to keep the service secure and asks before allowing optional tracking technologies."
    >
      <section>
        <h2>What cookies are</h2>
        <p>
          Cookies and similar browser storage are small pieces of data used by websites to remember
          information, maintain sessions, and support features. This policy covers cookies, local
          storage, and comparable technologies used on SomeoneNear.
        </p>
      </section>
      <section>
        <h2>Strictly necessary</h2>
        <p>
          These technologies support secure account sign-in, session continuity, fraud prevention,
          consent choices, and interface settings. They are required for requested features and
          cannot be disabled through our consent banner. You can block them in your browser, but
          account access or parts of the service may stop working.
        </p>
      </section>
      <section>
        <h2>Preferences</h2>
        <p>
          Preference storage may remember choices that improve your experience. Our privacy controls
          let you choose optional preferences, statistics, and marketing categories. SomeoneNear
          stores these choices locally in this browser.
        </p>
      </section>
      <section>
        <h2>Statistics and marketing</h2>
        <p>
          Optional statistics technologies help a service understand usage. Marketing technologies
          may measure campaigns or personalize advertising. SomeoneNear currently has no analytics
          or advertising scripts installed. If we add them, they will remain inactive until you give
          the relevant consent.
        </p>
      </section>
      <section>
        <h2>Third-party services</h2>
        <p>
          Features you deliberately use—such as account sign-in, payment checkout, calendar
          connection, or embedded provider tools—may involve storage set by that provider where
          technically necessary. The consent interface explains the categories and choices that
          SomeoneNear currently supports.
        </p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>
          You can accept, reject, or customize optional categories in the SomeoneNear privacy
          banner and change your decision later. Withdrawing consent does not affect processing
          that occurred lawfully before withdrawal.
        </p>
        <PrivacyChoicesButton variant="outline" className="mt-3" />
      </section>
      <section>
        <h2>What this browser remembers</h2>
        <p>
          We store your privacy selection under <code>sn_privacy_choice_v1</code> for up to 180 days
          so you do not have to repeat it on every visit. If browser storage is unavailable, your
          choice applies to the current page. The public globe’s customizations stay in page memory
          and reset on reload. These privacy controls do not clear your sign-in session, family
          information, or saved account data.
        </p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>
          For questions about cookies or privacy, email{" "}
          <a href="mailto:privacy@someonenear.com">privacy@someonenear.com</a>.
        </p>
      </section>
    </LegalPage>
  );
}
