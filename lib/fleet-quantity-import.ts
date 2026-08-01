/**
 * قالب «تحديث عدد السيارات»: أعمدة موحّدة بين مُصدِّر القالب (API) والاكتشاف التلقائي
 * في واجهة الرفع. عمود «رقم النظام» مخفي في الملف عمداً — يربط الصف بسجله بدقة حتى لو
 * عُدِّلت الأسماء، ولا يحتاج المستخدم رؤيته. غيابه يعني الرجوع للمطابقة بالاسم.
 */
export const FLEET_QUANTITY_COLUMNS = {
  key: "رقم النظام",
  branch: "الفرع",
  brand: "الماركة",
  model: "الموديل",
  year: "السنة",
  quantity: "الكمية",
} as const;

/** معرّف صف القالب: `modelId-branchId` — نص بسيط يصمد أمام تنسيق Excel. */
export function fleetRowKey(modelId: number, branchId: number): string {
  return `${modelId}-${branchId}`;
}

export function parseFleetRowKey(
  raw: string,
): { modelId: number; branchId: number } | null {
  const m = /^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(toAsciiDigits(raw));
  if (!m) return null;
  const modelId = Number(m[1]);
  const branchId = Number(m[2]);
  if (!modelId || !branchId) return null;
  return { modelId, branchId };
}

/** يحوّل الأرقام العربية/الفارسية إلى ASCII حتى تُقرأ الكميات المكتوبة يدوياً. */
export function toAsciiDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (d) => {
    const code = d.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

/** أقصى كمية لموديل واحد في فرع واحد — نفس سقف التعديل اليدوي في جدول المركبات. */
export const MAX_FLEET_QUANTITY = 500;
