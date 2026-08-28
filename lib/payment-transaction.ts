import "server-only";
import type { Prisma } from "@prisma/client";
import {
  bookingWhereForScope,
  scopeAllowsMultipleBranches,
  type AdminScope,
} from "@/lib/admin-scope";
import { VISIBLE_BOOKINGS_WHERE } from "@/lib/booking-visibility";
import { prisma } from "@/lib/prisma";

/**
 * دفتر أستاذ العمليات المالية للحجوزات (PaymentTransaction).
 *
 * كل دفعة أو استرداد يُسجَّل هنا كسطر مستقل بدلاً من الاكتفاء بالكتابة المباشرة
 * على BookingRequest. الحقول المجمّعة على الحجز (paidAmountSar/paymentStatus)
 * تبقى كـ cache للأداء والـ CAS، وهذا الدفتر هو مصدر الحقيقة للتتبع التفصيلي.
 *
 * للتتبع الصارم: مرّر tx (Prisma.TransactionClient) كي يُدرَج السطر ذرّياً مع
 * تحديث الرصيد داخل نفس الـ $transaction — إمّا يُثبَّتان معاً أو يُلغيان معاً.
 */

export type PaymentTxnKind =
  | "INITIAL_PAYMENT" // الدفعة الأولى للحجز
  | "BALANCE_PAYMENT" // سداد فرق تمديد/تعديل
  | "LATE_PENALTY" // تحصيل غرامة إرجاع متأخر
  | "REFUND" // استرداد (إلغاء أو استرداد يدوي)
  | "REFUND_REVERSAL" // عكس/تصحيح استرداد خاطئ (إرجاع المبلغ للشركة)
  | "CUSTOMER_SETTLEMENT"; // تسوية مستحقات مستحقة للعميل

export type PaymentTxnStatus = "PENDING" | "COMPLETED" | "FAILED" | "REVERSED";
export type PaymentTxnDirection = "CREDIT" | "DEBIT";
export type PaymentTxnActorKind = "CUSTOMER" | "ADMIN" | "GATEWAY" | "SYSTEM";

/** الأنواع التي تخرج فيها الأموال من الشركة (DEBIT)؛ الباقي دخل (CREDIT). */
const DEBIT_KINDS: ReadonlySet<PaymentTxnKind> = new Set([
  "REFUND",
  "CUSTOMER_SETTLEMENT",
]);

/** اتجاه المبلغ الافتراضي المشتق من نوع العملية. */
export function defaultDirectionForKind(kind: PaymentTxnKind): PaymentTxnDirection {
  return DEBIT_KINDS.has(kind) ? "DEBIT" : "CREDIT";
}

export type RecordPaymentTransactionInput = {
  bookingId: number;
  kind: PaymentTxnKind;
  /** المبلغ بالريال — دائماً موجب، الاتجاه يحدّده direction. */
  amountSar: number;
  /** يُشتق من النوع إن لم يُمرَّر. */
  direction?: PaymentTxnDirection;
  /** الحالة الافتراضية COMPLETED؛ استخدم PENDING لجلسة بوابة مفتوحة. */
  status?: PaymentTxnStatus;
  method?: string | null;
  actorKind: PaymentTxnActorKind;
  actorName?: string | null;
  gatewayRef?: string | null;
  sessionRef?: string | null;
  externalRef?: string | null;
  notes?: string | null;
};

/**
 * يُدرِج سطراً في دفتر الأستاذ. مرّر client = tx لجعله جزءاً من transaction
 * (يتراجع مع بقية العملية عند الفشل)؛ بدونه يُدرَج باستخدام prisma العام.
 *
 * لا يبتلع الأخطاء عمداً — فشل الإدراج في سياق transaction يجب أن يُلغي
 * العملية كلها حفاظاً على تطابق الدفتر مع الرصيد.
 */
export async function recordPaymentTransaction(
  input: RecordPaymentTransactionInput,
  client: Prisma.TransactionClient = prisma,
): Promise<void> {
  const amount = Math.round(Math.abs(input.amountSar) * 100) / 100;
  await client.paymentTransaction.create({
    data: {
      bookingId: input.bookingId,
      kind: input.kind,
      status: input.status ?? "COMPLETED",
      direction: input.direction ?? defaultDirectionForKind(input.kind),
      amountSar: amount,
      method: input.method ?? null,
      actorKind: input.actorKind,
      actorName: input.actorName ?? null,
      gatewayRef: input.gatewayRef ?? null,
      sessionRef: input.sessionRef ?? null,
      externalRef: input.externalRef ?? null,
      notes: input.notes ?? null,
    },
  });
}

// ─── القراءة (لصفحة دفتر الحركات في لوحة الإدارة) ──────────────────────────────

/** النطاق يحدّ النتائج بفرع الموظف أو مدينته (استلام أو إرجاع)؛ سوبر أدمن يرى الكل. */
export type PaymentTxnScope = AdminScope;

/** تصفية القائمة حسب الاتجاه. */
export type PaymentTxnDirectionFilter = "all" | "credit" | "debit";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** شرط تحديد النطاق عبر الحجز المرتبط — مطابق لمنطق بقية صفحات الإدارة. */
function txnScopeWhere(scope: PaymentTxnScope): Prisma.PaymentTransactionWhereInput {
  // حركات الحجز المؤرشف تسقط من الدفتر ومن مجاميعه، فتتسق الأرقام مع بقية الأقسام.
  return { booking: { ...bookingWhereForScope(scope), ...VISIBLE_BOOKINGS_WHERE } };
}

export type PaymentTxnListItem = Prisma.PaymentTransactionGetPayload<{
  include: { booking: { select: { fullName: true; phone: true; status: true } } };
}>;

/** فلاتر استعلام الدفتر: الاتجاه + مدى التاريخ + الفرع. */
export type PaymentTxnQueryFilters = {
  filter?: PaymentTxnDirectionFilter;
  /** حدّ زمني أدنى (شامل) على createdAt. */
  from?: Date;
  /** حدّ زمني أعلى (شامل) على createdAt. */
  to?: Date;
  /** فرع محدّد (استلام أو إرجاع) — يُطبَّق لسوبر أدمن؛ موظف الفرع مقيّد بنطاقه أصلاً. */
  branchId?: number | null;
};

/** تاريخ بصيغة YYYY-MM-DD بتوقيت الرياض. */
export function riyadhDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(d);
}

/** الوسائط الخام لفلاتر الدفتر من searchParams. */
export type LedgerFilterParams = {
  dir?: string;
  period?: string;
  from?: string;
  to?: string;
  branch?: string;
};

/**
 * يحوّل وسائط الرابط إلى فلاتر جاهزة — مشترك بين صفحة الدفتر وتصدير Excel
 * ليضمن تطابق التصدير مع المعروض. الأزرار السريعة (today/month) لها الأولوية.
 */
export function ledgerFiltersFromParams(sp: LedgerFilterParams): {
  filter: PaymentTxnDirectionFilter;
  from?: Date;
  to?: Date;
  branchId?: number;
  fromStr: string;
  toStr: string;
  today: string;
  monthStart: string;
  isToday: boolean;
  isMonth: boolean;
} {
  const filter: PaymentTxnDirectionFilter =
    sp.dir === "credit" || sp.dir === "debit" ? sp.dir : "all";
  const today = riyadhDateStr(new Date());
  const monthStart = `${today.slice(0, 8)}01`;
  let fromStr = sp.from?.trim() || "";
  let toStr = sp.to?.trim() || "";
  if (sp.period === "today") {
    fromStr = today;
    toStr = today;
  } else if (sp.period === "month") {
    fromStr = monthStart;
    toStr = today;
  }
  const from = /^\d{4}-\d{2}-\d{2}$/.test(fromStr)
    ? new Date(`${fromStr}T00:00:00+03:00`)
    : undefined;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(toStr)
    ? new Date(`${toStr}T23:59:59.999+03:00`)
    : undefined;
  const branchId = sp.branch && /^\d+$/.test(sp.branch) ? Number(sp.branch) : undefined;
  return {
    filter,
    from,
    to,
    branchId,
    fromStr,
    toStr,
    today,
    monthStart,
    isToday: fromStr === today && toStr === today,
    isMonth: fromStr === monthStart && toStr === today,
  };
}

/** يبني شرط الاستعلام من النطاق + الفلاتر — مشترك بين القائمة والملخّص. */
function buildTxnWhere(
  scope: PaymentTxnScope,
  f: PaymentTxnQueryFilters,
): Prisma.PaymentTransactionWhereInput {
  const where: Prisma.PaymentTransactionWhereInput = { ...txnScopeWhere(scope) };
  if (f.filter === "credit") where.direction = "CREDIT";
  else if (f.filter === "debit") where.direction = "DEBIT";
  if (f.from || f.to) {
    where.createdAt = {};
    if (f.from) where.createdAt.gte = f.from;
    if (f.to) where.createdAt.lte = f.to;
  }
  // فلتر فرع اختياري فوق النطاق (لا يوسّعه): موظف الفرع مقيّد أصلاً، ومشرف المدينة يضيّق
  // داخل مدينته — لذلك نُضيف الشرط بـ AND بدل استبدال شرط النطاق.
  if (f.branchId != null && scopeAllowsMultipleBranches(scope)) {
    const branchFilter: Prisma.BookingRequestWhereInput = {
      OR: [{ branchId: f.branchId }, { returnBranchId: f.branchId }],
    };
    where.booking = where.booking ? { AND: [where.booking, branchFilter] } : branchFilter;
  }
  return where;
}

/** أحدث حركات الدفتر ضمن النطاق والفلاتر، مع بيانات الحجز المختصرة للعرض. */
export async function getPaymentTransactions(
  scope: PaymentTxnScope,
  opts?: PaymentTxnQueryFilters & { limit?: number },
): Promise<PaymentTxnListItem[]> {
  return prisma.paymentTransaction.findMany({
    where: buildTxnWhere(scope, opts ?? {}),
    include: { booking: { select: { fullName: true, phone: true, status: true } } },
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 200,
  });
}

/** كل حركات حجز واحد (الأحدث أولاً) — لقسم دفتر الحجز في صفحة المالية. */
export async function getBookingPaymentTransactions(bookingId: number) {
  return prisma.paymentTransaction.findMany({
    where: { bookingId },
    orderBy: { createdAt: "desc" },
  });
}

export type PaymentTxnSummary = {
  /** إجمالي الداخل للشركة (CREDIT) — الحركات المكتملة فقط. */
  creditSar: number;
  /** إجمالي الخارج من الشركة (DEBIT) — الحركات المكتملة فقط. */
  debitSar: number;
  /** الصافي = الداخل − الخارج. */
  netSar: number;
  /** عدد الحركات المكتملة. */
  count: number;
};

/** ملخّص الاتجاهين للحركات المكتملة ضمن النطاق والفلاتر. */
export async function getPaymentTransactionsSummary(
  scope: PaymentTxnScope,
  filters?: PaymentTxnQueryFilters,
): Promise<PaymentTxnSummary> {
  const grouped = await prisma.paymentTransaction.groupBy({
    by: ["direction"],
    where: { ...buildTxnWhere(scope, filters ?? {}), status: "COMPLETED" },
    _sum: { amountSar: true },
    _count: true,
  });
  let creditSar = 0;
  let debitSar = 0;
  let count = 0;
  for (const g of grouped) {
    count += g._count;
    if (g.direction === "CREDIT") creditSar = g._sum.amountSar ?? 0;
    else if (g.direction === "DEBIT") debitSar = g._sum.amountSar ?? 0;
  }
  return {
    creditSar: round2(creditSar),
    debitSar: round2(debitSar),
    netSar: round2(creditSar - debitSar),
    count,
  };
}
