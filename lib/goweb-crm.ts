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

/**
 * GoWeb بيقبل الجوال أرقام بس (مع + اختياري في الأول) ولازم يكون رقم سعودي صالح، مثل:
 * 0500000000 · 500000000 · 966500000000 · +966500000000
 * بيرفض: مسافات/شرطات، أرقام عربية (٠٥..)، بادئة 00966، أرقام أرضية أو غير سعودية.
 * هنا بننضّف اللي ينفع تنضيفه (أرقام عربية، مسافات، 00 → +) والباقي السيرفر بيحكم عليه.
 */
export function normalizeGowebPhone(raw: string): string {
  const ascii = raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  const cleaned = ascii.replace(/[^\d+]/g, "");
  const digits = cleaned.replace(/\+/g, "");
  if (cleaned.startsWith("+") || digits.startsWith("00")) {
    return `+${digits.replace(/^00/, "")}`;
  }
  return digits;
}

export type GowebLeadInput = {
  name: string;
  phone: string;
  email?: string | null;
  subject?: string;
  message?: string;
  locale: "ar" | "en";
  /** تصنيف مختلف عن الافتراضي (مثلاً تأجير الشركات). */
  categoryId?: string;
  /** حقول مخصصة إضافية: [رقم الحقل، القيمة]. الحقل بدون رقم بيتخطّى. */
  extraFields?: Array<[string | undefined, string]>;
  /** identifier مصدر الحملة (من كوكي `_source`) — لو معروف في GoWeb بيتنسب الطلب له بدل المصدر الافتراضي. */
  sourceIdentifier?: string | null;
};

/** تصنيف «تأجير الشركات» في GoWeb (من GET /categories) — يتغلّب عليه GOWEB_CORPORATE_CATEGORY_ID. */
const DEFAULT_CORPORATE_CATEGORY_ID = "12846";

export function getGowebCorporateCategoryId(): string {
  return process.env.GOWEB_CORPORATE_CATEGORY_ID?.trim() || DEFAULT_CORPORATE_CATEGORY_ID;
}

/** رقم حقل مخصص للرقم الضريبي (اختياري) — لو مش متضبط الرقم الضريبي بيتحط في الموضوع. */
export function getGowebTaxFieldId(): string | undefined {
  return process.env.GOWEB_TAX_FIELD_ID?.trim() || undefined;
}

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

type GowebSource = { id: string; identifier: string };

const SOURCES_TTL_MS = 10 * 60 * 1000;
let sourcesCache: { at: number; rows: GowebSource[] } | null = null;

function baseAndTenant(): { base: string; tenant: string } {
  return {
    base: (process.env.GOWEB_API_BASE?.trim() || DEFAULT_BASE).replace(/\/+$/, ""),
    tenant: process.env.GOWEB_TENANT?.trim() || DEFAULT_TENANT,
  };
}

/** مصادر الـ tenant من GET /sources — بتتخزّن 10 دقايق في الذاكرة. لو فشل الطلب بنرجع آخر نسخة معروفة. */
async function loadGowebSources(): Promise<GowebSource[]> {
  const now = Date.now();
  if (sourcesCache && now - sourcesCache.at < SOURCES_TTL_MS) return sourcesCache.rows;
  const { base, tenant } = baseAndTenant();
  try {
    const res = await fetch(`${base}/sources`, {
      headers: { "Accept-Language": "ar", Accept: "application/json", "local-host": tenant },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { data?: Array<{ id?: number; identifier?: string }> };
    const rows = (json.data ?? [])
      .filter((s): s is { id: number; identifier: string } => s.id != null && !!s.identifier)
      .map((s) => ({ id: String(s.id), identifier: s.identifier.toLowerCase() }));
    sourcesCache = { at: now, rows };
    return rows;
  } catch (e) {
    console.error("[goweb] تعذّر تحميل المصادر", e);
    const stale = sourcesCache?.rows ?? [];
    // نعيد المحاولة بعد دقيقة مش في كل طلب.
    sourcesCache = { at: now - SOURCES_TTL_MS + 60_000, rows: stale };
    return stale;
  }
}

/** يحوّل identifier (زي `meta`) إلى مصدر معروف في GoWeb، أو null لو مجهول. */
export async function resolveGowebSource(
  identifier: string | null | undefined,
): Promise<GowebSource | null> {
  const wanted = identifier?.trim().toLowerCase();
  if (!wanted) return null;
  const rows = await loadGowebSources();
  return rows.find((r) => r.identifier === wanted) ?? null;
}

/**
 * يبعت الطلب إلى GoWeb. بيرجع true عند النجاح، false لو متخطّى أو فشل (ما بيرميش error).
 */
export async function sendGowebLead(input: GowebLeadInput): Promise<boolean> {
  const cfg = readConfig();
  if (!cfg) return false;

  const source = await resolveGowebSource(input.sourceIdentifier);
  const sourceId = source?.id ?? cfg.sourceId;

  const buildBody = (withEmail: boolean): FormData => {
    const fd = new FormData();
    fd.set("name", input.name);
    fd.set("phone", normalizeGowebPhone(input.phone));
    if (withEmail && input.email) fd.set("email", input.email);
    fd.set("branch_id", cfg.branchId);
    fd.set("source_id", sourceId);
    fd.set("category_id", input.categoryId || cfg.categoryId);

    const customFields: Array<[string | undefined, string | undefined]> = [
      [cfg.subjectFieldId, input.subject?.trim()],
      [cfg.messageFieldId, input.message?.trim()],
      [cfg.localeFieldId, input.locale],
      ...(input.extraFields ?? []),
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
      const sent = normalizeGowebPhone(input.phone);
      const masked = sent.length > 6 ? `${sent.slice(0, 3)}****${sent.slice(-3)}` : "***";
      console.error(`[goweb] فشل إنشاء الطلب (${res.status}) — الجوال المُرسل: ${masked}`, body.slice(0, 500));
      return false;
    }
    const created = (await res.json().catch(() => null)) as {
      data?: { id?: number; source?: string | null };
    } | null;
    console.info(
      `[goweb] تم إنشاء الطلب #${created?.data?.id ?? "?"} — المصدر: ${created?.data?.source ?? "?"}`,
    );
    return true;
  } catch (e) {
    console.error("[goweb] تعذّر الاتصال بـ GoWeb", e);
    return false;
  }
}

/** أنواع الضغطات المعتمدة (الـ API نفسه بيقبل أي نص، فبنحدّدها إحنا). */
export const GOWEB_CLICK_TYPES = ["whatsapp", "call", "email", "form"] as const;
export type GowebClickType = (typeof GOWEB_CLICK_TYPES)[number];

export function isGowebClickType(v: unknown): v is GowebClickType {
  return typeof v === "string" && (GOWEB_CLICK_TYPES as readonly string[]).includes(v);
}

/** identifier المصدر اللي بتتنسب له الضغطات (من GET /sources) — افتراضي website. */
const DEFAULT_CLICK_IDENTIFIER = "website";

/**
 * يسجّل ضغطة على مصدر في GoWeb (POST /add_click). ما بيحتاجش branch_id.
 * بيرجع true عند النجاح، false عند الفشل (ما بيرميش error).
 */
export async function sendGowebClick(
  type: GowebClickType,
  sourceIdentifier?: string | null,
): Promise<boolean> {
  const { base, tenant } = baseAndTenant();
  // مصدر الزائر (من كوكي _source) لو معروف في GoWeb، وإلا الافتراضي — identifier مجهول بيرجّع 404.
  const known = await resolveGowebSource(sourceIdentifier);
  const identifier =
    known?.identifier || process.env.GOWEB_CLICK_IDENTIFIER?.trim() || DEFAULT_CLICK_IDENTIFIER;

  const fd = new FormData();
  fd.set("identifier", identifier);
  fd.set("type", type);

  try {
    const res = await fetch(`${base}/add_click`, {
      method: "POST",
      headers: { "Accept-Language": "ar", Accept: "application/json", "local-host": tenant },
      body: fd,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[goweb] فشل تسجيل الضغطة (${res.status})`, body.slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[goweb] تعذّر تسجيل الضغطة", e);
    return false;
  }
}
