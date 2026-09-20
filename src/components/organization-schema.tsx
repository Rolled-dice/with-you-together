import { JsonLd } from "@/components/json-ld";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://someonenear.com/#organization",
  name: "SomeoneNear",
  alternateName: ["Someone Near", "Someone Near App"],
  url: "https://someonenear.com",
  // Points at the SVG because the PNG export has its transparency checkerboard
  // baked in as opaque pixels. Google prefers a raster logo for rich results,
  // so swap this for a clean PNG once one exists.
  logo: "https://someonenear.com/logo.svg",
  description:
    "A trained listener phones your elderly parent on a schedule you set, on their ordinary phone. After every call the family gets a short update on how they're really doing.",
};

export function OrganizationSchema() {
  return <JsonLd data={organizationSchema} />;
}
