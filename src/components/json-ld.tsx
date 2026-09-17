type JsonLdProps = {
  /** Any Schema.org object, e.g. { "@context": "https://schema.org", "@type": "Organization", ... } */
  data: Record<string, unknown>;
};

/**
 * Injects a Schema.org JSON-LD <script> tag. Place it anywhere in the
 * page tree — inside the document <head> when possible (e.g. RootShell),
 * or in a page component body; search engines accept both.
 */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
