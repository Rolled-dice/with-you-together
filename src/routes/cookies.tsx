import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/legal-page";
import { PrivacyChoicesButton } from "@/components/privacy-choices-button";

const title = "Cookie Policy | SomeoneNear";
const description = "How SomeoneNear uses essential browser storage and manages optional cookie consent.";

export const Route = createFileRoute("/cookies")({
  head: () => ({ meta: [
    { title }, { name: "description", content: description },
    { property: "og:title", content: title }, { property: "og:description", content: description },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: CookiePolicy,
});

function CookiePolicy() {
  return (
    <LegalPage title="Cookie Policy" summary="SomeoneNear uses essential browser storage to keep the service secure and asks before allowing optional tracking technologies.">
      <section><h2>What cookies are</h2><p>Cookies and similar browser storage are small pieces of data used by websites to remember information, maintain sessions, and support features. This policy covers cookies, local storage, and comparable technologies used on SomeoneNear.</p></section>
      <section><h2>Strictly necessary</h2><p>These technologies support secure account sign-in, session continuity, fraud prevention, consent choices, and interface settings. They are required for requested features and cannot be disabled through our consent banner. You can block them in your browser, but account access or parts of the service may stop working.</p></section>
      <section><h2>Preferences</h2><p>Preference storage may remember choices that improve your experience. Cookiebot presents available categories and records your selection.</p></section>
      <section><h2>Statistics and marketing</h2><p>Optional statistics technologies help a service understand usage. Marketing technologies may measure campaigns or personalize advertising. SomeoneNear currently has no analytics or advertising scripts installed. If we add them, Cookiebot&apos;s automatic blocking keeps them inactive until you give the relevant consent.</p></section>
      <section><h2>Third-party services</h2><p>Features you deliberately use—such as account sign-in, payment checkout, calendar connection, or embedded provider tools—may involve storage set by that provider where technically necessary. The Cookiebot declaration shown through the consent interface is the current source for detected cookies, providers, purposes, and expiry periods.</p></section>
      <section><h2>Your choices</h2><p>You can accept, reject, or customize optional categories in the Cookiebot banner and change your decision later. Withdrawing consent does not affect processing that occurred lawfully before withdrawal.</p><PrivacyChoicesButton variant="outline" className="mt-3" /></section>
      <section><h2>Contact</h2><p>For questions about cookies or privacy, email <a href="mailto:privacy@someonenear.com">privacy@someonenear.com</a>.</p></section>
    </LegalPage>
  );
}