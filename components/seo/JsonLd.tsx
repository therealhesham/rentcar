type JsonLdProps = {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
};

/** بيانات منظمة JSON-LD — آمنة لأنها تُبنى من الخادم فقط */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
