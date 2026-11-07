import { JsonLd } from "@/components/json-ld";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://someonenear.com/#organization",
  name: "SomeoneNear",
  alternateName: ["Someone Near", "Someone Near App"],
  url: "https://someonenear.com",
  // Raster, which Google prefers for rich results over SVG.
  logo: "https://someonenear.com/logo.png",
  description:
    "A trained listener phones your elderly parent on a schedule you set, on their ordinary phone. After every call the family gets a short update on how they're really doing.",
};

export function OrganizationSchema() {
  return <JsonLd data={organizationSchema} />;
}
