import { saudiLocalNineToE164 } from "@/lib/normalize-saudi-phone";

/** مدخلات الحظر اليدوي — مشتركة بين نموذج الإدارة (تحقق فوري ولصق) والـ action (تحقق نهائي). */

export type ManualBlacklistEntry = {
  phone?: string | null;
  email?: string | null;
  name?: string | null;
  nationalIdNumber?: string | null;
  passportNumber?: string | null;
  licenseNumber?: string | null;
};

/** صف في جدول «مجموعة عملاء» كما أدخله الموظف. */
export type BlacklistRowInput = {
  phone: string;
  name: string;
  nationalIdNumber: string;
};

/** «05xxxxxxxx» / «5xxxxxxxx» / «+9665…» / «009665…» → +9665XXXXXXXX، وإلا null. */
export function parseSaudiPhoneInput(raw: string): string | null {
  const digits = raw.replace(/\D/g, "").replace(/^(00966|966|0)/, "");
  return saudiLocalNineToE164(digits);
}

/** رقم هوية وطنية أو إقامة: 10 أرقام تبدأ بـ 1 أو 2. */
function parseNationalId(raw: string): string | null {
  const compact = raw.replace(/[\s-]/g, "");
  return /^[12]\d{9}$/.test(compact) ? compact : null;
}

export function isBlankRow(row: BlacklistRowInput): boolean {
  return !row.phone.trim() && !row.name.trim() && !row.nationalIdNumber.trim();
}

/** تحقق صف واحد: جوال أو هوية على الأقل، وكل ما أُدخل يجب أن يكون صالحاً. */
export function validateBlacklistRow(
  row: BlacklistRowInput,
): { ok: true; entry: ManualBlacklistEntry } | { ok: false; field: "phone" | "nationalIdNumber"; error: string } {
  const rawPhone = row.phone.trim();
  const rawId = row.nationalIdNumber.trim();
  const phone = rawPhone ? parseSaudiPhoneInput(rawPhone) : null;
  const nationalId = rawId ? parseNationalId(rawId) : null;

  if (rawPhone && !phone) return { ok: false, field: "phone", error: "رقم جوال غير صالح" };
  if (rawId && !nationalId) {
    return { ok: false, field: "nationalIdNumber", error: "الهوية 10 أرقام تبدأ بـ 1 أو 2" };
  }
  if (!phone && !nationalId) return { ok: false, field: "phone", error: "أدخل الجوال أو الهوية" };

  return {
    ok: true,
    entry: { phone, nationalIdNumber: nationalId, name: row.name.trim().slice(0, 255) || null },
  };
}

/**
 * سطر ملصوق من Excel/نص: خلايا مفصولة بـ Tab/فاصلة/فاصلة منقوطة/«|» بأي ترتيب —
 * جوال سعودي، رقم هوية/إقامة، والباقي اسم. سطر بلا جوال ولا هوية (كالعناوين) → null.
 */
export function parsePastedLine(line: string): BlacklistRowInput | null {
  const row: BlacklistRowInput = { phone: "", name: "", nationalIdNumber: "" };
  const nameParts: string[] = [];
  for (const cell of line.split(/[,;\t|،؛]/).map((t) => t.trim()).filter(Boolean)) {
    if (!row.nationalIdNumber && parseNationalId(cell)) row.nationalIdNumber = parseNationalId(cell)!;
    else if (!row.phone && parseSaudiPhoneInput(cell)) row.phone = `0${parseSaudiPhoneInput(cell)!.slice(4)}`;
    else nameParts.push(cell);
  }
  row.name = nameParts.join(" ");
  return row.phone || row.nationalIdNumber ? row : null;
}
