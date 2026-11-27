import "server-only";

/**
 * إرسال الطلبات (leads) إلى GoWeb site API.
 * https://api.goweb.llc/api/site  — كل الطلبات تحتاج headers: Accept-Language / Accept / local-host (tenant).
 *
 * المتغيرات البيئية (كلها اختيارية ما عدا الفرع؛ لو GOWEB_BRANCH_ID ناقص الإرسال بيتخطّى):
 *  - GOWEB_BRANCH_ID    الفرع الرئيسي للـ tenant (مطلوب — مفيش endpoint يرجّعه)
 *  - GOWEB_TENANT       اسم الـ tenant (قيمة header ‏local-host) — افتراضي rawais
 *  - GOWEB_SOURCE_ID    مصدر الطلب (من GET /sources) — افتراضي website
 *  - GOWEB_CATEGORY_ID  التصنيف (من GET /categories) — افتراضي تأجير الأفراد
 *  - GOWEB_SUBJECT_FIELD_ID / GOWEB_MESSAGE_FIELD_ID / GOWEB_LOCALE_FIELD_ID  أرقام الحقول المخصصة (من GET /fields) — افتراضي 60 / 61 / 62
 *  - GOWEB_API_BASE     (اختياري) افتراضي https://api.goweb.llc/api/site
 */

const DEFAULT_BASE = "https://api.goweb.llc/api/site";
const TIMEOUT_MS = 8000;

export type GowebLeadInput = {
  name: string;
  phone: string;
  email?: string | null;
  subject?: string;
  message?: string;
  locale: "ar" | "en";
};

type GowebConfig = {
  base: string;
  tenant: string;
  branchId: string;
  sourceId: string;
  categoryId: string;
  subjectFieldId: string;
  messageFieldId: string;
  localeFieldId: string;
};

/**
 * قيم مشروعنا (tenant "rawais" → https://rent.rawaes.com) — اتجابت من GET /sources و GET /categories.
 * أي متغير بيئة بيتغلّب عليها. الـ branch_id مفيش له endpoint، فلازم يتحط في GOWEB_BRANCH_ID.
 */
const DEFAULT_TENANT = "rawais";
const DEFAULT_SOURCE_ID = "15609"; // identifier: website / Organic
const DEFAULT_CATEGORY_ID = "12845"; // تأجير الأفراد
// الحقول المخصصة (من GET /fields)
const DEFAULT_SUBJECT_FIELD_ID = "60"; // الموضوع / subject (text)
const DEFAULT_MESSAGE_FIELD_ID = "61"; // الرسالة / message (textarea)
const DEFAULT_LOCALE_FIELD_ID = "62"; // لغة العميل / locale (text)

let warnedMissingBranch = false;

function readConfig(): GowebConfig | null {
  const tenant = process.env.GOWEB_TENANT?.trim() || DEFAULT_TENANT;
  const branchId = process.env.GOWEB_BRANCH_ID?.trim();
  const sourceId = process.env.GOWEB_SOURCE_ID?.trim() || DEFAULT_SOURCE_ID;
  const categoryId = process.env.GOWEB_CATEGORY_ID?.trim() || DEFAULT_CATEGORY_ID;
  if (!branchId) {
    if (!warnedMissingBranch) {
      warnedMissingBranch = true;
      console.warn("[goweb] GOWEB_BRANCH_ID غير مضبوط — تم تخطي إرسال الطلب للـ CRM.");
    }
    return null;
  }
  return {
    base: (process.env.GOWEB_API_BASE?.trim() || DEFAULT_BASE).replace(/\/+$/, ""),
    tenant,
    branchId,
    sourceId,
    categoryId,
    subjectFieldId: process.env.GOWEB_SUBJECT_FIELD_ID?.trim() || DEFAULT_SUBJECT_FIELD_ID,
    messageFieldId: process.env.GOWEB_MESSAGE_FIELD_ID?.trim() || DEFAULT_MESSAGE_FIELD_ID,
    localeFieldId: process.env.GOWEB_LOCALE_FIELD_ID?.trim() || DEFAULT_LOCALE_FIELD_ID,
  };
}

export function isGowebConfigured(): boolean {
  return readConfig() !== null;
}

/**
 * يبعت الطلب إلى GoWeb. بيرجع true عند النجاح، false لو متخطّى أو فشل (ما بيرميش error).
 */
export async function sendGowebLead(input: GowebLeadInput): Promise<boolean> {
  const cfg = readConfig();
  if (!cfg) return false;

  const buildBody = (withEmail: boolean): FormData => {
    const fd = new FormData();
    fd.set("name", input.name);
    fd.set("phone", input.phone);
    if (withEmail && input.email) fd.set("email", input.email);
    fd.set("branch_id", cfg.branchId);
    fd.set("source_id", cfg.sourceId);
    fd.set("category_id", cfg.categoryId);

    const customFields: Array<[string, string | undefined]> = [
      [cfg.subjectFieldId, input.subject?.trim()],
      [cfg.messageFieldId, input.message?.trim()],
      [cfg.localeFieldId, input.locale],
    ];
    let i = 0;
    for (const [fieldId, value] of customFields) {
      if (!fieldId || !value) continue;
      fd.set(`fields[${i}][field_id]`, fieldId);
      fd.set(`fields[${i}][value]`, value);
      i += 1;
    }
    return fd;
  };

  const post = (withEmail: boolean) =>
    fetch(`${cfg.base}/order`, {
      method: "POST",
      headers: {
        "Accept-Language": input.locale,
        Accept: "application/json",
        "local-host": cfg.tenant,
      },
      body: buildBody(withEmail),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  try {
    let res = await post(true);
    let body = "";

    // الـ API بيرفض بعض الإيميلات (validation أشد من الفورم عندنا) — نعيد المحاولة من غير إيميل بدل ما نضيّع الطلب.
    if (res.status === 422 && input.email) {
      body = await res.text().catch(() => "");
      try {
        const errors = (JSON.parse(body) as { errors?: Record<string, unknown> }).errors ?? {};
        if ("email" in errors) {
          res = await post(false);
          body = "";
        }
      } catch {
        /* رد مش JSON — نكمل بالخطأ الأصلي */
      }
    }

    if (!res.ok) {
      body ||= await res.text().catch(() => "");
      console.error(`[goweb] فشل إنشاء الطلب (${res.status})`, body.slice(0, 500));
      return false;
    }
    const created = (await res.json().catch(() => null)) as { data?: { id?: number } } | null;
    console.info(`[goweb] تم إنشاء الطلب #${created?.data?.id ?? "?"}`);
    return true;
  } catch (e) {
    console.error("[goweb] تعذّر الاتصال بـ GoWeb", e);
    return false;
  }
}
