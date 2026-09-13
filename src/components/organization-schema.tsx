const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://someonenear.com/#organization",
  name: "SomeoneNear",
  alternateName: ["Someone Near", "Someone Near App"],
  url: "https://someonenear.com",
  logo: "https://someonenear.com/favicon.png",
  description:
    "SomeoneNear helps people find someone near when they need a caring check-in, a listener, or quiet companionship.",
};

export function OrganizationSchema() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
    />
  );
}