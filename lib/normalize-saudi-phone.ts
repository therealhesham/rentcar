/** تحويل الجوال المحلي السعودي (9 أرقام تبدأ بـ 5) إلى صيغة التخزين +9665XXXXXXXX */
export function saudiLocalNineToE164(localDigits: string): string | null {
  const d = localDigits.replace(/\D/g, "");
  if (!/^5\d{8}$/.test(d)) return null;
  return `+966${d}`;
}

/** عكس التخزين: +9665XXXXXXXX أو 9665XXXXXXXX → 9 أرقام محلية */
export function e164ToLocalNine(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const p = stored.replace(/\s/g, "").trim();
  if (p.startsWith("+966")) {
    const rest = p.slice(4).replace(/\D/g, "");
    if (/^5\d{8}$/.test(rest)) return rest;
    return null;
  }
  const digits = p.replace(/\D/g, "");
  if (digits.startsWith("966") && digits.length === 12) {
    const rest = digits.slice(3);
    if (/^5\d{8}$/.test(rest)) return rest;
  }
  if (/^5\d{8}$/.test(digits)) return digits;
  return null;
}
