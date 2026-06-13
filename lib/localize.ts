/**
 * Helper to localize a database field based on the active locale.
 * It checks if the locale is English and returns the `{field}En` value if available.
 * Falls back to the default (Arabic) field if the English version is missing.
 */
export function localizeDbField(
  record: any,
  field: string,
  locale: string
): string {
  if (!record) return "";
  
  if (locale === "en") {
    const enField = field.endsWith("Ar") ? field.replace(/Ar$/, "En") : `${field}En`;
    if (record[enField] && typeof record[enField] === "string" && record[enField].trim() !== "") {
      return record[enField];
    }
  }
  
  // Default (Arabic or fallback)
  if (field in record && record[field]) return String(record[field]);
  
  const arField = field.endsWith("Ar") ? field : `${field}Ar`;
  if (arField in record && record[arField]) return String(record[arField]);

  return "";
}
