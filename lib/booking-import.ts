import { buildBranchResolver } from "@/lib/branch-name-resolver";
import { saudiLocalNineToE164 } from "@/lib/normalize-saudi-phone";
import { prisma } from "@/lib/prisma";
import type { ImportRow } from "@/lib/vehicle-import-excel";

export type { ImportRow } from "@/lib/vehicle-import-excel";

/**
 * ترحيل حجوزات تاريخية من ملف Excel — **مسار منفصل تماماً عن `createDirectBooking`**.
 *
 * الفرق مقصود: `createDirectBooking` تعيد حساب التسعير من سعر الفرع والخصومات الحالية،
 * وتتحقق من توفّر الأسطول، وترفض التواريخ الماضية. الثلاثة غلط في الترحيل — الحجز القديم
 * سعره اتفق عليه وقتها، وتواريخه انتهت، والأسطول وقتها مش أسطول اليوم. فالمبالغ هنا تُحفظ
 * كما هي من الملف في `snapshotTotalAmountSar` بدون إعادة حساب.
 *
 * لذلك **لا تستخدم هذا الملف لإنشاء حجوزات جديدة فعّالة** — لأنه لا يحجب الأسطول ولا يتحقق
 * من تعارض المواعيد. الحجز الجديد يمر على `createDirectBooking` وبس.
 */

/** كل الحقول اختيارية — يُستخدم فقط ما ربطه المستخدم في الواجهة. */
export type BookingFieldMapping = {
  /** رقم العقد في النظام القديم — مفتاح منع التكرار عند إعادة الرفع. */
  legacyRef?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  /** أعمدة تحديد الموديل — لازم واحد منها على الأقل لأن `carType` يُشتق من فئة الموديل. */
  brand?: string;
  modelName?: string;
  year?: string;
  /** فرع الاستلام؛ يُستخدم لفرع الإرجاع كذلك إن لم يُربط عمود إرجاع منفصل. */
  branch?: string;
  returnBranch?: string;
  pickupDate?: string;
  /** المدة بالأيام؛ عند غيابها تُشتق من الفرق بين تاريخي الاستلام والإرجاع. */
  numberOfDays?: string;
  dropoffDate?: string;
  /** إجمالي الحجز شامل الضريبة كما هو في الملف (بدون إعادة حساب). */
  totalAmount?: string;
  paidAmount?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  status?: string;
  plateNumber?: string;
  notes?: string;
};

export type BookingImportResult = {
  /** معاينة بلا كتابة — كل الأرقام محسوبة لكن لا شيء حُفظ. */
  dryRun: boolean;
  total: number;
  created: number;
  /** صفوف مكررة (نفس `legacyRef` موجود) أو فارغة كلياً. */
  skipped: number;
  duplicates: number;
  /** عملاء مطابقون بالجوال سيُربطون بالحجز. */
  customersMatched: number;
  /** حسابات عملاء ناقصة سيتم إنشاؤها. */
  customersToCreate: number;
  /** إجمالي المبالغ في الملف (شامل الضريبة) — للمطابقة مع النظام القديم قبل الحفظ. */
  totalAmountSar: number;
  errors: { row: number; message: string }[];
  warnings: { row: number; message: string }[];
};

const MAX_ISSUES = 200;

/** الحالات التي لا تحجب الأسطول — الترحيل يجب أن يقع داخلها وإلا ظهر الحجز القديم كطلب قائم. */
const CLOSED_STATUSES = new Set(["RETURNED", "COMPLETED", "CANCELLED", "REJECTED"]);

const VALID_STATUSES = [
  "NEW",
  "UNDER_REVIEW",
  "CONFIRMED",
  "PICKED_UP",
  "RETURNED",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
] as const;

const VALID_PAYMENT_METHODS = new Set([
  "CASH",
  "CARD",
  "MADA",
  "APPLE_PAY",
  "TABBY",
  "TAMARA",
  "AMKAN",
  "POINTS",
  "TRANSFER",
]);

function cell(row: ImportRow, col?: string): string {
  if (!col) return "";
  return (row[col] ?? "").trim();
}

function normalizeModelKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

/** أرقام عربية-هندية → لاتينية؛ ملفات المكاتب القديمة مليانة بيها. */
function toLatinDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (d) => {
    const code = d.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

/**
 * جوال الملفات القديمة يجي بكل الصيغ: `0551234567` و`551234567` و`+966551234567`
 * و`00966551234567`. `e164ToLocalNine` وحدها ترفض صيغة `05…` (بتتوقّع ٩ أرقام بلا صفر
 * بادئ) وهي أشهر صيغة في ملفات المكاتب — فنقشّر البادئات هنا قبل التحقق.
 */
export function sheetPhoneToE164(raw: string): string | null {
  let digits = toLatinDigits(raw).replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("00966")) digits = digits.slice(5);
  else if (digits.startsWith("966")) digits = digits.slice(3);

  // صفر بادئ محلي (05…) — بعد تقشير مفتاح الدولة عشان يمسك 966055… كذلك
  if (digits.length === 10 && digits.startsWith("0")) digits = digits.slice(1);

  return saudiLocalNineToE164(digits);
}

export function parseAmount(raw: string): number | null {
  if (!raw) return null;
  const cleaned = toLatinDigits(raw)
    .replace(/[,\s٬]/g, "")
    .replace(/[^\d.\-]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function parseIntCell(raw: string): number | null {
  if (!raw) return null;
  const digits = toLatinDigits(raw).replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * تواريخ الملفات القديمة تجي بصيغ مختلطة. `cellToPlainString` بتحوّل خلايا التاريخ الحقيقية
 * لـ `YYYY-MM-DD`، لكن الخلايا النصية تفضل زي ما هي — فنقبل الصيغتين وd/m/y.
 * ملاحظة: `dd/mm/yyyy` تُقرأ يوم-شهر (مش الصيغة الأمريكية) لأن الملفات محلية.
 */
export function parseSheetDate(raw: string): Date | null {
  const s = toLatinDigits(raw).trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    return buildUtcDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    return buildUtcDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  }

  // أرقام تسلسل Excel الخام (لو الخلية وصلت كرقم مش كتاريخ): 1 = 1900-01-01
  const serial = Number(s);
  if (Number.isFinite(serial) && serial > 20000 && serial < 60000) {
    const ms = Math.round((serial - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function buildUtcDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1990 || year > 2100) return null;
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (Number.isNaN(d.getTime())) return null;
  // تواريخ زي 31/02 يعدّلها JS تلقائياً لشهر تالي — نرفضها بدل ما نحفظ تاريخ غلط
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return d;
}

function parseStatus(raw: string): (typeof VALID_STATUSES)[number] | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;

  const upper = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if ((VALID_STATUSES as readonly string[]).includes(upper)) {
    return upper as (typeof VALID_STATUSES)[number];
  }

  if (v.includes("ملغ")) return "CANCELLED";
  if (v.includes("مرفوض")) return "REJECTED";
  if (v.includes("مرتجع") || v.includes("رجع") || v.includes("مسترجع")) return "RETURNED";
  if (v.includes("مكتمل") || v.includes("منته") || v.includes("مغلق")) return "COMPLETED";
  if (v.includes("مستلم") || v.includes("جاري") || v.includes("قائم") || v.includes("نشط")) {
    return "PICKED_UP";
  }
  if (v.includes("مؤكد") || v.includes("معتمد")) return "CONFIRMED";
  if (v.includes("مراجع")) return "UNDER_REVIEW";
  if (v.includes("جديد")) return "NEW";
  return null;
}

function parsePaymentMethod(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;

  const upper = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (VALID_PAYMENT_METHODS.has(upper)) return upper;

  if (v.includes("نقد") || v.includes("كاش")) return "CASH";
  if (v.includes("مدى") || v.includes("مدي")) return "MADA";
  if (v.includes("شبك")) return "MADA";
  if (v.includes("تحويل") || v.includes("بنك")) return "TRANSFER";
  if (v.includes("تابي")) return "TABBY";
  if (v.includes("تمارا")) return "TAMARA";
  if (v.includes("امكان") || v.includes("إمكان")) return "AMKAN";
  if (v.includes("شيك") || v.includes("بطاق") || v.includes("ائتمان")) return "CARD";
  return null;
}

/** هل عمود حالة الدفع يقول «مدفوع»؟ null = غير محدد فنستنتجها من المبلغ المدفوع. */
function parsePaidFlag(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (
    v === "paid" ||
    v === "true" ||
    v === "1" ||
    v === "yes" ||
    v.includes("مدفوع") ||
    v.includes("سدد") ||
    v.includes("محصل") ||
    v.includes("تم الدفع")
  ) {
    return !v.includes("غير") && !v.includes("لم");
  }
  if (
    v === "pending" ||
    v === "unpaid" ||
    v === "false" ||
    v === "0" ||
    v === "no" ||
    v.includes("غير مدفوع") ||
    v.includes("آجل") ||
    v.includes("اجل") ||
    v.includes("معلق")
  ) {
    return false;
  }
  return null;
}

type ModelIndex = {
  exact: Map<string, number>;
  byBrandModel: Map<string, number[]>;
  byModel: Map<string, number[]>;
  carTypeById: Map<number, string>;
};

async function buildModelIndex(): Promise<ModelIndex> {
  const models = await prisma.carModel.findMany({
    select: {
      id: true,
      name: true,
      year: true,
      brand: { select: { name: true } },
      category: { select: { slug: true, title: true } },
    },
  });

  const index: ModelIndex = {
    exact: new Map(),
    byBrandModel: new Map(),
    byModel: new Map(),
    carTypeById: new Map(),
  };
  for (const m of models) {
    const brand = normalizeModelKey(m.brand.name);
    const name = normalizeModelKey(m.name);
    index.exact.set(`${brand}|${name}|${m.year}`, m.id);
    const bm = `${brand}|${name}`;
    index.byBrandModel.set(bm, [...(index.byBrandModel.get(bm) ?? []), m.id]);
    index.byModel.set(name, [...(index.byModel.get(name) ?? []), m.id]);
    // نفس اشتقاق `createDirectBooking` للحقل الإلزامي `carType`
    index.carTypeById.set(m.id, m.category.slug || m.category.title);
  }
  return index;
}

/** يحلّ الموديل من أعمدة الماركة/الموديل/السنة؛ يرمي خطأً عند التعذّر. */
function resolveModelId(
  index: ModelIndex,
  brandRaw: string,
  modelRaw: string,
  yearRaw: string,
): number {
  const brand = normalizeModelKey(brandRaw);
  const name = normalizeModelKey(modelRaw);
  const year = parseIntCell(yearRaw);

  if (brand && name && year !== null) {
    const hit = index.exact.get(`${brand}|${name}|${year}`);
    if (hit !== undefined) return hit;
  }

  const candidates = brand
    ? index.byBrandModel.get(`${brand}|${name}`)
    : index.byModel.get(name);

  if (!candidates || candidates.length === 0) {
    throw new Error(
      `لا يوجد موديل مطابق لـ "${[brandRaw, modelRaw, yearRaw].filter(Boolean).join(" ")}" — أضف الموديل أولاً من استيراد المركبات`,
    );
  }
  if (candidates.length > 1) {
    throw new Error(
      `"${[brandRaw, modelRaw].filter(Boolean).join(" ")}" يطابق أكثر من موديل — اربط عمود سنة الصنع للتمييز`,
    );
  }
  return candidates[0]!;
}

type ParsedBooking = {
  rowNum: number;
  legacyRef: string | null;
  fullName: string;
  phoneE164: string;
  email: string | null;
  carModelId: number;
  carType: string;
  branchId: number | null;
  returnBranchId: number | null;
  pickupDate: Date;
  numberOfDays: number;
  dropoffDate: Date | null;
  totalAmountSar: number | null;
  paidAmountSar: number | null;
  paymentMethod: string | null;
  paymentStatus: "PAID" | "PENDING";
  status: string;
  plateNumber: string | null;
  notes: string | null;
};

/**
 * حساب عميل لكل جوال في الملف. الإيميل إلزامي وunique في `User`، والملفات القديمة
 * غالباً بلا إيميل — فنولّد إيميلاً اصطلاحياً مشتقاً من الجوال على نطاق `.invalid`
 * (محجوز في RFC 2606 فمستحيل يوصله بريد حقيقي بالغلط). ثابت لنفس الجوال حتى تبقى
 * إعادة الرفع بلا حسابات مكررة.
 */
function syntheticEmailForPhone(phoneE164: string): string {
  return `${phoneE164.replace(/\D/g, "")}@imported.invalid`;
}

function parseRow(
  row: ImportRow,
  rowNum: number,
  mapping: BookingFieldMapping,
  modelIndex: ModelIndex,
  resolveBranch: (name: string) => number | null,
  defaults: { status: string; carModelId: number | null; branchId: number | null },
  warnings: { row: number; message: string }[],
): ParsedBooking | null {
  const fullName = cell(row, mapping.fullName);
  const phoneRaw = cell(row, mapping.phone);
  const pickupRaw = cell(row, mapping.pickupDate);
  const legacyRef = cell(row, mapping.legacyRef) || null;

  // صف فارغ كلياً (سطور فاصلة أو مجاميع في آخر الملف) — يُتخطّى بلا خطأ
  if (!fullName && !phoneRaw && !pickupRaw && !legacyRef) return null;

  if (!fullName) throw new Error("اسم العميل فارغ");

  const phoneE164 = sheetPhoneToE164(phoneRaw);
  if (!phoneE164) {
    throw new Error(
      phoneRaw
        ? `جوال غير صالح: "${phoneRaw}" — المطلوب جوال سعودي (05xxxxxxxx أو +9665xxxxxxxx)`
        : "عمود الجوال غير مربوط أو القيمة فارغة",
    );
  }

  const pickupDate = parseSheetDate(pickupRaw);
  if (!pickupDate) {
    throw new Error(
      pickupRaw ? `تاريخ استلام غير صالح: "${pickupRaw}"` : "تاريخ الاستلام مطلوب",
    );
  }

  const dropoffDate = parseSheetDate(cell(row, mapping.dropoffDate));

  let numberOfDays = parseIntCell(cell(row, mapping.numberOfDays));
  if (numberOfDays === null && dropoffDate) {
    const diffMs = dropoffDate.getTime() - pickupDate.getTime();
    numberOfDays = Math.max(1, Math.round(diffMs / 86400000));
  }
  if (numberOfDays === null || numberOfDays < 1) {
    throw new Error("المدة بالأيام مطلوبة — اربط عمود المدة أو عمود تاريخ الإرجاع");
  }
  if (dropoffDate && dropoffDate.getTime() < pickupDate.getTime()) {
    throw new Error("تاريخ الإرجاع أقدم من تاريخ الاستلام");
  }

  // الموديل إلزامي: `carType` حقل مطلوب في السكيما ومشتق من فئة الموديل
  const hasModelColumns = Boolean(mapping.brand || mapping.modelName);
  let carModelId: number;
  if (hasModelColumns) {
    carModelId = resolveModelId(
      modelIndex,
      cell(row, mapping.brand),
      cell(row, mapping.modelName),
      cell(row, mapping.year),
    );
  } else if (defaults.carModelId !== null) {
    carModelId = defaults.carModelId;
  } else {
    throw new Error("اربط أعمدة الماركة/الموديل أو اختر موديلاً افتراضياً للملف");
  }
  const carType = modelIndex.carTypeById.get(carModelId);
  if (!carType) throw new Error("الموديل المحدد بلا فئة أسطول");

  const branchCol = cell(row, mapping.branch);
  let branchId = defaults.branchId;
  if (branchCol) {
    const resolved = resolveBranch(branchCol);
    if (resolved === null) {
      throw new Error(`فرع غير معروف: "${branchCol}"`);
    }
    branchId = resolved;
  }

  const returnCol = cell(row, mapping.returnBranch);
  let returnBranchId = branchId;
  if (returnCol) {
    const resolved = resolveBranch(returnCol);
    if (resolved === null) {
      throw new Error(`فرع إرجاع غير معروف: "${returnCol}"`);
    }
    returnBranchId = resolved;
  }

  const totalAmountSar = parseAmount(cell(row, mapping.totalAmount));
  const paidAmountSar = parseAmount(cell(row, mapping.paidAmount));

  const paidFlag = parsePaidFlag(cell(row, mapping.paymentStatus));
  // العمود الصريح أولاً، وإلا نستنتج من وجود مبلغ مدفوع
  const isPaid = paidFlag ?? (paidAmountSar !== null && paidAmountSar > 0);

  const status = parseStatus(cell(row, mapping.status)) ?? defaults.status;
  if (!CLOSED_STATUSES.has(status)) {
    warnings.push({
      row: rowNum,
      message: `الحالة "${status}" حالة مفتوحة — الحجز هيظهر في لوحة الإدارة كطلب قائم وهيحجب وحدة من الأسطول`,
    });
  }
  if (isPaid && paidAmountSar === null && totalAmountSar === null) {
    warnings.push({
      row: rowNum,
      message: "الحجز مُعلَّم كمدفوع بلا مبلغ — هيُحفظ بلا قيمة مالية",
    });
  }

  return {
    rowNum,
    legacyRef,
    fullName,
    phoneE164,
    email: cell(row, mapping.email).toLowerCase() || null,
    carModelId,
    carType,
    branchId,
    returnBranchId,
    pickupDate,
    numberOfDays,
    dropoffDate,
    totalAmountSar,
    paidAmountSar: isPaid ? (paidAmountSar ?? totalAmountSar) : paidAmountSar,
    paymentMethod: parsePaymentMethod(cell(row, mapping.paymentMethod)),
    paymentStatus: isPaid ? "PAID" : "PENDING",
    status,
    plateNumber: cell(row, mapping.plateNumber) || null,
    notes: cell(row, mapping.notes) || null,
  };
}

export async function importBookingsFromRows(payload: {
  rows: ImportRow[];
  mapping: BookingFieldMapping;
  /** معاينة بلا كتابة — الافتراضي true حتى لا تكتب مكالمة ناقصة بالغلط. */
  dryRun?: boolean;
  /** الحالة المفترضة للصفوف بلا عمود حالة (الافتراضي RETURNED = حجز منتهٍ). */
  defaultStatus?: string;
  /** موديل/فرع افتراضي للصفوف التي لا تحددهما. */
  defaultCarModelId?: number | null;
  defaultBranchId?: number | null;
  /** اسم الموظف المنفّذ — يُسجَّل في `BookingLog`. */
  actorName?: string | null;
}): Promise<BookingImportResult> {
  const { rows, mapping } = payload;
  const dryRun = payload.dryRun ?? true;
  const actorName = payload.actorName ?? null;

  const defaultStatus = payload.defaultStatus?.trim().toUpperCase() || "RETURNED";

  const result: BookingImportResult = {
    dryRun,
    total: rows.length,
    created: 0,
    skipped: 0,
    duplicates: 0,
    customersMatched: 0,
    customersToCreate: 0,
    totalAmountSar: 0,
    errors: [],
    warnings: [],
  };

  if (!(VALID_STATUSES as readonly string[]).includes(defaultStatus)) {
    result.errors.push({ row: 0, message: `حالة افتراضية غير معروفة: ${defaultStatus}` });
    return result;
  }

  const [modelIndex, resolveBranch] = await Promise.all([
    buildModelIndex(),
    buildBranchResolver(),
  ]);

  const defaults = {
    status: defaultStatus,
    carModelId: payload.defaultCarModelId ?? null,
    branchId: payload.defaultBranchId ?? null,
  };

  // ── المرحلة ١: تحليل كل الصفوف قبل أي كتابة ────────────────────────────────
  const parsedRows: ParsedBooking[] = [];
  const seenLegacyRefs = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // +2: صف الرأس + فهرسة من 1
    try {
      const parsed = parseRow(
        rows[i]!,
        rowNum,
        mapping,
        modelIndex,
        resolveBranch,
        defaults,
        result.warnings,
      );
      if (!parsed) {
        result.skipped++;
        continue;
      }
      // تكرار داخل نفس الملف — يُمسك هنا لأن قيد قاعدة البيانات لسه ما شافهم
      if (parsed.legacyRef) {
        const key = parsed.legacyRef.toLowerCase();
        if (seenLegacyRefs.has(key)) {
          result.duplicates++;
          result.skipped++;
          result.warnings.push({
            row: rowNum,
            message: `رقم العقد "${parsed.legacyRef}" مكرر داخل الملف — تم تخطي الصف`,
          });
          continue;
        }
        seenLegacyRefs.add(key);
      }
      parsedRows.push(parsed);
    } catch (err) {
      if (result.errors.length < MAX_ISSUES) {
        result.errors.push({
          row: rowNum,
          message: err instanceof Error ? err.message : "خطأ غير متوقع",
        });
      }
      result.skipped++;
    }
  }

  // ── المرحلة ٢: استبعاد ما تم ترحيله سابقاً (إعادة رفع نفس الملف) ───────────
  const refsToCheck = parsedRows.map((p) => p.legacyRef).filter((r): r is string => r !== null);
  const alreadyImported = new Set<string>();
  if (refsToCheck.length > 0) {
    const existing = await prisma.bookingRequest.findMany({
      where: { legacyRef: { in: refsToCheck } },
      select: { legacyRef: true },
    });
    for (const e of existing) {
      if (e.legacyRef) alreadyImported.add(e.legacyRef.toLowerCase());
    }
  }

  const pending = parsedRows.filter((p) => {
    if (p.legacyRef && alreadyImported.has(p.legacyRef.toLowerCase())) {
      result.duplicates++;
      result.skipped++;
      return false;
    }
    return true;
  });

  // ── المرحلة ٣: حلّ العملاء بالجوال ─────────────────────────────────────────
  const phones = [...new Set(pending.map((p) => p.phoneE164))];
  const existingUsers = await prisma.user.findMany({
    where: { phone: { in: phones } },
    select: { id: true, phone: true },
  });
  const userIdByPhone = new Map<string, number>();
  for (const u of existingUsers) {
    if (u.phone) userIdByPhone.set(u.phone, u.id);
  }

  result.customersMatched = phones.filter((p) => userIdByPhone.has(p)).length;
  result.customersToCreate = phones.length - result.customersMatched;
  result.totalAmountSar =
    Math.round(pending.reduce((sum, p) => sum + (p.totalAmountSar ?? 0), 0) * 100) / 100;

  if (dryRun) {
    // المعاينة تتوقف هنا: لا حسابات عملاء ولا حجوزات تُكتب
    return result;
  }

  // ── المرحلة ٤: الكتابة ─────────────────────────────────────────────────────
  for (const p of pending) {
    try {
      let customerId = userIdByPhone.get(p.phoneE164) ?? null;
      if (customerId === null) {
        const email = p.email ?? syntheticEmailForPhone(p.phoneE164);
        // الإيميل unique كذلك: لو موجود لحساب آخر نربط بيه بدل ما نفشل الصف
        const byEmail = await prisma.user.findUnique({
          where: { email },
          select: { id: true, phone: true },
        });
        if (byEmail) {
          customerId = byEmail.id;
          if (!byEmail.phone) {
            await prisma.user.update({
              where: { id: byEmail.id },
              data: { phone: p.phoneE164 },
            });
          }
        } else {
          const createdUser = await prisma.user.create({
            data: { email, phone: p.phoneE164, name: p.fullName, passwordHash: null },
            select: { id: true },
          });
          customerId = createdUser.id;
        }
        userIdByPhone.set(p.phoneE164, customerId);
      }

      const paidAt = p.paymentStatus === "PAID" ? p.pickupDate : null;

      const booking = await prisma.bookingRequest.create({
        data: {
          kind: "DIRECT",
          legacyRef: p.legacyRef,
          carModelId: p.carModelId,
          customerId,
          fullName: p.fullName,
          phone: p.phoneE164,
          contactEmail: p.email,
          ageRange: "25-35",
          carType: p.carType,
          branchId: p.branchId,
          returnBranchId: p.returnBranchId,
          pickupMode: "BRANCH",
          deliveryLat: null,
          deliveryLng: null,
          deliveryAddress: null,
          pickupDate: p.pickupDate,
          numberOfDays: p.numberOfDays,
          termsAccepted: true,
          status: p.status,
          paymentStatus: p.paymentStatus,
          paidAt,
          paymentMethod: p.paymentMethod,
          paymentReceivedBy: p.paymentStatus === "PAID" ? (actorName ?? "Excel Import") : null,
          paidAmountSar: p.paymentStatus === "PAID" ? p.paidAmountSar : null,
          // المبالغ كما هي من الملف — لا إعادة حساب (شوف تعليق أعلى الملف)
          snapshotTotalAmountSar: p.totalAmountSar,
          rentalPeriodKind: "DAILY",
          vehiclePlateNumber: p.plateNumber,
          // تاريخ الإرجاع الفعلي يُسجَّل فقط لو الحجز فعلاً رجع
          vehicleReturnedAt: p.status === "RETURNED" || p.status === "COMPLETED" ? p.dropoffDate : null,
          adminNotes: p.notes,
        },
        select: { id: true },
      });

      await prisma.bookingLog.create({
        data: {
          bookingId: booking.id,
          event: "BOOKING_IMPORTED",
          actorKind: "ADMIN",
          actorName: actorName ?? "Excel Import",
          toStatus: p.status,
          notes: p.legacyRef
            ? `ترحيل من Excel — رقم العقد القديم: ${p.legacyRef}`
            : "ترحيل من Excel (بلا رقم عقد قديم)",
        },
      });

      result.created++;
    } catch (err) {
      if (result.errors.length < MAX_ISSUES) {
        result.errors.push({
          row: p.rowNum,
          message: err instanceof Error ? err.message : "فشل حفظ الصف",
        });
      }
      result.skipped++;
    }
  }

  return result;
}
