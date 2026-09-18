import "server-only";
import { buildBranchResolver } from "@/lib/branch-name-resolver";
import { BOOKING_EVENTS } from "@/lib/booking-audit";
import {
  buildModelIndex,
  bulkLookupCustomersByPhone,
  cell,
  parseSheetDate,
  resolveModelId,
  resolveOrCreateCustomerByPhone,
  sheetPhoneToE164,
  type ModelIndex,
} from "@/lib/booking-import";
import { parseHmCell } from "@/lib/availability-block-time";
import { parseDateTimeInRiyadh } from "@/lib/branch-opening-hours";
import { composeDatetimeLocal } from "@/lib/booking-search-shared";
import { prisma } from "@/lib/prisma";
import type { ImportRow } from "@/lib/vehicle-import-excel";

export type { ImportRow } from "@/lib/vehicle-import-excel";

/**
 * حجب إتاحة إداري بالجملة عبر Excel — **مسار مستقل عن `createDirectBooking`** بنفس فلسفة
 * `lib/booking-import.ts`. الحجز الناتج **حجز مباشر عادي** (`kind: "DIRECT"`) بكل ما
 * يترتب على ذلك (يظهر في القوائم، يُحسب في الإحصائيات، يخضع لتاريخ تابي إن كان لعميل
 * حقيقي...) — قرار مقصود بعد تجربة: نوع `kind` مستقل (`BLOCK`) بدا أنظف نظرياً، لكن عشرات
 * الاستعلامات عبر الكود (لوحة التحكم، الإحصائيات، الإشعارات، تابي، حساب العميل) تفترض أن
 * كل صف `BookingRequest` من نوعين فقط، فتسرّبت صفوف الحجب إليها بمسمّيات خاطئة. الحل: علامة
 * منفصلة `isBulkAvailabilityImport` لا يفحصها أي كود آخر إطلاقاً — صفر مفاجآت.
 *
 * الاستثناءان الوحيدان المتعمَّدان لهذه الحجوزات:
 * 1. تُستبعد من صفحة العمليات المالية (`app/admin/(dashboard)/financials/page.tsx`) — راجع
 *    `baseWhere` هناك.
 * 2. لا تُرسِل إيميل "حجز جديد" للموظفين — نسجّل `BOOKING_EVENTS.STAFF_BOOKING_EMAIL_SENT`
 *    فوراً عند الإنشاء بدل الإرسال الفعلي، فيعاملها كرون `booking-notification-drops` كأنها
 *    أُشعِر بها بالفعل ولا يعيد إرسالها بعد ٢٤ ساعة.
 *
 * التوقيت: تاريخ+وقت كل من الاستلام والإرجاع يُدمَجان بنفس شكل `composeDatetimeLocal`
 * ثم يمران على `parseDateTimeInRiyadh` — **حرفياً نفس المسار** الذي يمر منه نموذج بحث العميل،
 * لضمان معالجة توقيت مطابقة بلا أي فرق تقريب.
 */

export type AvailabilityBlockFieldMapping = {
  brand?: string;
  modelName?: string;
  year?: string;
  branch?: string;
  pickupDate?: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
  /** سبب الحجب (صيانة/تأجير خارجي...) — يُحفظ في ملاحظات الحجز الإدارية. */
  reason?: string;
  /**
   * بيانات عميل حقيقي (تأجير خارجي) — اختياريان معاً: لو اتربطا يُحفظان في الحجز بدل بيانات
   * placeholder، ويُنشأ/يُربط حساب عميل حقيقي بنفس منطق ترحيل الحجوزات التاريخية
   * (`resolveOrCreateCustomerByPhone`). لو غابا يبقى حجب صيانة مجهول العميل كالمعتاد.
   */
  fullName?: string;
  phone?: string;
};

export type AvailabilityImportResult = {
  /** معاينة بلا كتابة — كل الأرقام محسوبة لكن لا شيء حُفظ. */
  dryRun: boolean;
  total: number;
  created: number;
  /** صفوف مكررة (نفس الموديل+الفرع+التوقيت محجوب سلفاً) أو فارغة كلياً. */
  skipped: number;
  duplicates: number;
  /** عملاء حقيقيون (بجوال) مطابقون لحسابات موجودة سيُربطون بالحجب. */
  customersMatched: number;
  /** حسابات عملاء جدد سيتم إنشاؤها. */
  customersToCreate: number;
  errors: { row: number; message: string }[];
  warnings: { row: number; message: string }[];
};

/** بيانات الحجز حين لا يُربط عمود اسم/جوال العميل — حجب صيانة إداري بلا عميل حقيقي. */
const PLACEHOLDER_FULL_NAME = "حجب إتاحة — استيراد Excel";
const PLACEHOLDER_PHONE = "0000000000";

const MAX_ISSUES = 200;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function ymdFromDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

type ParsedBlock = {
  rowNum: number;
  carModelId: number;
  branchId: number;
  pickupAt: Date;
  /** موعد الإرجاع الفعلي المكتوب بالإكسل — يُحفظ في `addonsJson.blockReturnAt` للعرض. */
  returnAt: Date;
  numberOfDays: number;
  reason: string | null;
  /** بيانات عميل حقيقي (تأجير خارجي) — كلاهما null = حجب صيانة placeholder. */
  customerFullName: string | null;
  customerPhoneE164: string | null;
  dedupKey: string;
};

/** يبني JSON خفيف يُحفظ في `addonsJson` لحفظ موعد الإرجاع الفعلي (بدقيقة) للعرض لاحقاً.
 * لا علاقة له بشكل `BookingPricingSnapshotV1` المستخدم للحجوزات الحقيقية — أي كود يقرأه
 * عبر `parseBookingPricingSnapshot` (مثل `bookingOccupiedUntil`) هيلاقي حقول غير متوقعة
 * فيتجاهلها بأمان ويرجع لحساب الحجب الآمن من `numberOfDays` (ceil) كما هو. */
function blockAddonsJson(returnAt: Date): string {
  return JSON.stringify({ blockReturnAt: returnAt.toISOString() });
}

function blockReturnAtFromAddonsJson(raw: string | null): Date | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { blockReturnAt?: unknown };
    if (typeof data.blockReturnAt !== "string") return null;
    const d = new Date(data.blockReturnAt);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function parseRow(
  row: ImportRow,
  rowNum: number,
  mapping: AvailabilityBlockFieldMapping,
  modelIndex: ModelIndex,
  resolveBranch: (name: string) => number | null,
): ParsedBlock | null {
  const brandRaw = cell(row, mapping.brand);
  const modelRaw = cell(row, mapping.modelName);
  const branchRaw = cell(row, mapping.branch);
  const pickupDateRaw = cell(row, mapping.pickupDate);
  const pickupTimeRaw = cell(row, mapping.pickupTime);
  const returnDateRaw = cell(row, mapping.returnDate);
  const returnTimeRaw = cell(row, mapping.returnTime);

  // صف فارغ كلياً (سطور فاصلة أو مجاميع في آخر الملف) — يُتخطّى بلا خطأ
  if (!brandRaw && !modelRaw && !branchRaw && !pickupDateRaw && !returnDateRaw) return null;

  if (!brandRaw && !modelRaw) {
    throw new Error("عمود الماركة أو الموديل مطلوب");
  }
  const carModelId = resolveModelId(modelIndex, brandRaw, modelRaw, cell(row, mapping.year));

  if (!branchRaw) throw new Error("عمود الفرع مطلوب");
  const branchId = resolveBranch(branchRaw);
  if (branchId === null) throw new Error(`فرع غير معروف: "${branchRaw}"`);

  if (!pickupDateRaw) throw new Error("تاريخ الاستلام مطلوب");
  const pickupDateObj = parseSheetDate(pickupDateRaw);
  if (!pickupDateObj) throw new Error(`تاريخ استلام غير صالح: "${pickupDateRaw}"`);

  if (!pickupTimeRaw) throw new Error("توقيت الاستلام مطلوب");
  const pickupHm = parseHmCell(pickupTimeRaw);
  if (pickupHm === null) {
    throw new Error(`توقيت استلام غير صالح: "${pickupTimeRaw}" — الصيغة المطلوبة HH:mm مثل 14:30`);
  }

  if (!returnDateRaw) throw new Error("تاريخ الإرجاع مطلوب");
  const returnDateObj = parseSheetDate(returnDateRaw);
  if (!returnDateObj) throw new Error(`تاريخ إرجاع غير صالح: "${returnDateRaw}"`);

  if (!returnTimeRaw) throw new Error("توقيت الإرجاع مطلوب");
  const returnHm = parseHmCell(returnTimeRaw);
  if (returnHm === null) {
    throw new Error(`توقيت إرجاع غير صالح: "${returnTimeRaw}" — الصيغة المطلوبة HH:mm مثل 18:00`);
  }

  const pickupAt = parseDateTimeInRiyadh(
    composeDatetimeLocal(ymdFromDate(pickupDateObj), pickupHm),
  );
  const returnAt = parseDateTimeInRiyadh(
    composeDatetimeLocal(ymdFromDate(returnDateObj), returnHm),
  );
  if (Number.isNaN(pickupAt.getTime()) || Number.isNaN(returnAt.getTime())) {
    throw new Error("تعذّر تحويل التاريخ/الوقت — راجع صيغة الخلايا");
  }
  if (returnAt.getTime() <= pickupAt.getTime()) {
    throw new Error("موعد الإرجاع يجب أن يكون بعد موعد الاستلام");
  }

  const fullNameRaw = cell(row, mapping.fullName);
  const phoneRaw = cell(row, mapping.phone);
  let customerFullName: string | null = null;
  let customerPhoneE164: string | null = null;
  if (fullNameRaw || phoneRaw) {
    if (!fullNameRaw) throw new Error("اسم العميل مطلوب لو اتربط عمود جوال العميل");
    if (!phoneRaw) throw new Error("جوال العميل مطلوب لو اتربط عمود اسم العميل");
    const phoneE164 = sheetPhoneToE164(phoneRaw);
    if (!phoneE164) {
      throw new Error(
        `جوال عميل غير صالح: "${phoneRaw}" — المطلوب جوال سعودي (05xxxxxxxx أو +9665xxxxxxxx)`,
      );
    }
    customerFullName = fullNameRaw;
    customerPhoneE164 = phoneE164;
  }

  // مبني بالسقف لأعلى (ceil) لا بالأرضية: `computeBookingReturnAt` تُرجع pickup + numberOfDays
  // أيام كاملة بنفس توقيت الاستلام بالضبط — الـ ceil يضمن أن نافذة الحجب تغطي موعد الإرجاع
  // المطلوب بالكامل ولا تُحرِّر العربية قبله (اتجاه آمن ضد أي تعارض حجز).
  const numberOfDays = Math.max(
    1,
    Math.min(60, Math.ceil((returnAt.getTime() - pickupAt.getTime()) / 86_400_000)),
  );

  return {
    rowNum,
    carModelId,
    branchId,
    pickupAt,
    returnAt,
    numberOfDays,
    reason: cell(row, mapping.reason) || null,
    customerFullName,
    customerPhoneE164,
    // مفتاح التكرار على التوقيت الفعلي (لا numberOfDays المشتقة بالسقف) — صفان بنفس
    // الاستلام لكن بإرجاع مختلف بدقائق قد يتساويا في numberOfDays فيُعتبران خطأً مكررين.
    dedupKey: `${carModelId}|${branchId}|${pickupAt.getTime()}|${returnAt.getTime()}`,
  };
}

export async function importAvailabilityBlocksFromRows(payload: {
  rows: ImportRow[];
  mapping: AvailabilityBlockFieldMapping;
  /** معاينة بلا كتابة — الافتراضي true حتى لا تكتب مكالمة ناقصة بالغلط. */
  dryRun?: boolean;
  /** اسم الموظف المنفّذ — يُسجَّل في `BookingLog`. */
  actorName?: string | null;
}): Promise<AvailabilityImportResult> {
  const { rows, mapping } = payload;
  const dryRun = payload.dryRun ?? true;
  const actorName = payload.actorName ?? null;

  const result: AvailabilityImportResult = {
    dryRun,
    total: rows.length,
    created: 0,
    skipped: 0,
    duplicates: 0,
    customersMatched: 0,
    customersToCreate: 0,
    errors: [],
    warnings: [],
  };

  const [modelIndex, resolveBranch] = await Promise.all([
    buildModelIndex(),
    buildBranchResolver(),
  ]);

  // ── المرحلة ١: تحليل كل الصفوف قبل أي كتابة ────────────────────────────────
  const parsedRows: ParsedBlock[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // +2: صف الرأس + فهرسة من 1
    try {
      const parsed = parseRow(rows[i]!, rowNum, mapping, modelIndex, resolveBranch);
      if (!parsed) {
        result.skipped++;
        continue;
      }
      if (seenKeys.has(parsed.dedupKey)) {
        result.duplicates++;
        result.skipped++;
        result.warnings.push({
          row: rowNum,
          message: "صف مكرر داخل نفس الملف (نفس الموديل والفرع والتوقيت) — تم تخطيه",
        });
        continue;
      }
      seenKeys.add(parsed.dedupKey);
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

  // ── المرحلة ٢: استبعاد ما سبق حجبه فعلياً (إعادة رفع نفس الملف) ────────────
  const carModelIds = [...new Set(parsedRows.map((p) => p.carModelId))];
  const branchIds = [...new Set(parsedRows.map((p) => p.branchId))];
  const existingKeys = new Set<string>();
  if (carModelIds.length > 0 && branchIds.length > 0) {
    const existing = await prisma.bookingRequest.findMany({
      where: {
        isBulkAvailabilityImport: true,
        status: { not: "CANCELLED" },
        carModelId: { in: carModelIds },
        branchId: { in: branchIds },
      },
      select: {
        carModelId: true,
        branchId: true,
        pickupDate: true,
        numberOfDays: true,
        addonsJson: true,
      },
    });
    const { computeBookingReturnAt } = await import("@/lib/booking-return-schedule");
    for (const e of existing) {
      const returnAt =
        blockReturnAtFromAddonsJson(e.addonsJson) ??
        computeBookingReturnAt(e.pickupDate, e.numberOfDays);
      existingKeys.add(`${e.carModelId}|${e.branchId}|${e.pickupDate.getTime()}|${returnAt.getTime()}`);
    }
  }

  const pending = parsedRows.filter((p) => {
    if (existingKeys.has(p.dedupKey)) {
      result.duplicates++;
      result.skipped++;
      return false;
    }
    return true;
  });

  // ── عملاء التأجير الخارجي الحقيقيون (اختياري) ───────────────────────────────
  const customerPhones = [
    ...new Set(
      pending
        .map((p) => p.customerPhoneE164)
        .filter((p): p is string => p !== null),
    ),
  ];
  const userIdByPhone = await bulkLookupCustomersByPhone(customerPhones);
  result.customersMatched = customerPhones.filter((p) => userIdByPhone.has(p)).length;
  result.customersToCreate = customerPhones.length - result.customersMatched;

  if (dryRun) {
    // المعاينة تتوقف هنا: لا حسابات عملاء ولا حجوزات تُكتب
    return result;
  }

  // ── المرحلة ٣: الكتابة ─────────────────────────────────────────────────────
  for (const p of pending) {
    try {
      const customerId =
        p.customerPhoneE164 && p.customerFullName
          ? await resolveOrCreateCustomerByPhone(
              p.customerPhoneE164,
              p.customerFullName,
              null,
              userIdByPhone,
            )
          : null;

      const booking = await prisma.bookingRequest.create({
        data: {
          kind: "DIRECT",
          isBulkAvailabilityImport: true,
          carModelId: p.carModelId,
          customerId,
          fullName: p.customerFullName ?? PLACEHOLDER_FULL_NAME,
          phone: p.customerPhoneE164 ?? PLACEHOLDER_PHONE,
          ageRange: "غير محدد",
          carType: modelIndex.carTypeById.get(p.carModelId) ?? "غير محدد",
          branchId: p.branchId,
          returnBranchId: p.branchId,
          pickupMode: "BRANCH",
          pickupDate: p.pickupAt,
          numberOfDays: p.numberOfDays,
          termsAccepted: true,
          status: "CONFIRMED",
          paymentStatus: "PENDING",
          adminNotes: p.reason,
          addonsJson: blockAddonsJson(p.returnAt),
        },
        select: { id: true },
      });

      await prisma.bookingLog.create({
        data: {
          bookingId: booking.id,
          event: "AVAILABILITY_BLOCK_IMPORTED",
          actorKind: "ADMIN",
          actorName: actorName ?? "Excel Import",
          toStatus: "CONFIRMED",
          notes: p.reason
            ? `حجب إتاحة من Excel — السبب: ${p.reason}`.slice(0, 500)
            : "حجب إتاحة من Excel",
        },
      });

      // يمنع كرون "حجوزات بلا إشعار" من إرسال إيميل "حجز جديد" حقيقي لهذا الصف —
      // راجع تعليق أعلى الملف ولوحة booking-notification-drops.ts.
      await prisma.bookingLog.create({
        data: {
          bookingId: booking.id,
          event: BOOKING_EVENTS.STAFF_BOOKING_EMAIL_SENT,
          actorKind: "SYSTEM",
          actorName: "Excel Import",
          notes: "لا يوجد إيميل فعلي — حجز مستورد بالجملة من تحديث الاتاحة",
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

export type AvailabilityBlockRow = {
  id: number;
  carModelTitle: string;
  branchName: string;
  pickupAt: Date;
  returnAt: Date;
  reason: string | null;
  createdAt: Date;
  /** بيانات عميل حقيقي (تأجير خارجي) — null لحجب صيانة مجهول العميل. */
  customerFullName: string | null;
  customerPhone: string | null;
};

/** الحجوزات المحجوبة الفعّالة (غير الملغاة) — لعرضها وإتاحة إلغائها من لوحة التحكم. */
export async function listActiveAvailabilityBlocks(branchIds?: number[]): Promise<AvailabilityBlockRow[]> {
  const rows = await prisma.bookingRequest.findMany({
    where: {
      isBulkAvailabilityImport: true,
      status: { not: "CANCELLED" },
      ...(branchIds ? { branchId: { in: branchIds } } : {}),
    },
    orderBy: { pickupDate: "asc" },
    select: {
      id: true,
      pickupDate: true,
      numberOfDays: true,
      adminNotes: true,
      addonsJson: true,
      createdAt: true,
      fullName: true,
      phone: true,
      customerId: true,
      carModel: { select: { name: true, brand: { select: { name: true } } } },
      pickupBranch: { select: { name: true } },
    },
  });

  // `returnAt` المعروض هو الموعد الفعلي المكتوب بالإكسل (من addonsJson.blockReturnAt) —
  // مختلف غالباً عن نافذة الحجب الفعلية (pickupDate + numberOfDays بالسقف) المستخدمة داخلياً
  // لحساب التعارض، لأن الأخيرة مقصودة تغطي فترة أطول أو تساوي المطلوبة (راجع parseRow).
  const { computeBookingReturnAt } = await import("@/lib/booking-return-schedule");
  return rows.map((r) => ({
    id: r.id,
    carModelTitle: r.carModel ? `${r.carModel.brand.name} ${r.carModel.name}` : "—",
    branchName: r.pickupBranch?.name ?? "—",
    pickupAt: r.pickupDate,
    returnAt:
      blockReturnAtFromAddonsJson(r.addonsJson) ??
      computeBookingReturnAt(r.pickupDate, r.numberOfDays),
    reason: r.adminNotes,
    createdAt: r.createdAt,
    customerFullName: r.customerId ? r.fullName : null,
    customerPhone: r.customerId ? r.phone : null,
  }));
}

/** إلغاء حجب (لا حذف): نفس أثر إلغاء أي حجز — يخرج تلقائياً من حساب الإتاحة. */
export async function cancelAvailabilityBlock(
  id: number,
  actorName: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await prisma.bookingRequest.findUnique({
    where: { id },
    select: { id: true, isBulkAvailabilityImport: true, status: true },
  });
  if (!row || !row.isBulkAvailabilityImport) {
    return { ok: false, error: "سجل الحجب غير موجود." };
  }
  if (row.status === "CANCELLED") {
    return { ok: true };
  }

  await prisma.$transaction([
    prisma.bookingRequest.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    }),
    prisma.bookingLog.create({
      data: {
        bookingId: id,
        event: "AVAILABILITY_BLOCK_CANCELLED",
        actorKind: "ADMIN",
        actorName: actorName ?? "Admin",
        toStatus: "CANCELLED",
        notes: "إلغاء حجب إتاحة يدوياً من لوحة التحكم",
      },
    }),
  ]);

  return { ok: true };
}
