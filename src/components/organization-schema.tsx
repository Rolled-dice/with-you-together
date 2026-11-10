import { JsonLd } from "@/components/json-ld";

const rootSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://someonenear.com/#organization",
      name: "SomeoneNear",
      alternateName: ["Someone Near", "SomeoneNear App"],
      url: "https://someonenear.com",
      logo: {
        "@type": "ImageObject",
        url: "https://someonenear.com/logo.png",
        width: 640,
        height: 640,
      },
      description:
        "Warm family care membership connecting loved ones across distance with trained phone check-in listeners, an empathetic AI Companion, and medication reminders.",
      email: "care@someonenear.com",
      contactPoint: [
        {
          "@type": "ContactPoint",
          email: "care@someonenear.com",
          contactType: "customer support",
          availableLanguage: ["English", "Hindi"],
        },
      ],
    },
    {
      "@type": "WebSite",
      "@id": "https://someonenear.com/#website",
      url: "https://someonenear.com",
      name: "SomeoneNear",
      description:
        "Checking in when they can't. Warm family care membership with an AI Companion, medication reminders, mood insights, and human listener calls.",
      publisher: {
        "@id": "https://someonenear.com/#organization",
      },
      inLanguage: "en-US",
    },
    {
      "@type": "WebApplication",
      "@id": "https://someonenear.com/#application",
      name: "SomeoneNear",
      url: "https://someonenear.com",
      applicationCategory: "HealthApplication",
      operatingSystem: "All modern web browsers, iOS, Android",
      description:
        "Family care platform featuring daily medication dose logs, private AI companion reflection, scheduled send-later memories, and phone check-ins.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        name: "7-day Free Trial",
      },
      author: {
        "@id": "https://someonenear.com/#organization",
      },
    },
  ],
};

export function OrganizationSchema() {
  return <JsonLd data={rootSchema} />;
}
