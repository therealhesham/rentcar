import "server-only";
import type { Prisma } from "@prisma/client";
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

/** النطاق يحدّ النتائج بفرع الموظف (استلام أو إرجاع)؛ سوبر أدمن يرى الكل. */
export type PaymentTxnScope = { isSuperAdmin: boolean; branchId: number | null };

/** تصفية القائمة حسب الاتجاه. */
export type PaymentTxnDirectionFilter = "all" | "credit" | "debit";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** شرط تحديد الفرع عبر الحجز المرتبط — مطابق لمنطق بقية صفحات الإدارة. */
function txnScopeWhere(scope: PaymentTxnScope): Prisma.PaymentTransactionWhereInput {
  if (scope.isSuperAdmin || scope.branchId == null) return {};
  return {
    booking: {
      OR: [{ branchId: scope.branchId }, { returnBranchId: scope.branchId }],
    },
  };
}

export type PaymentTxnListItem = Prisma.PaymentTransactionGetPayload<{
  include: { booking: { select: { fullName: true; phone: true; status: true } } };
}>;

/** أحدث حركات الدفتر ضمن النطاق، مع بيانات الحجز المختصرة للعرض. */
export async function getPaymentTransactions(
  scope: PaymentTxnScope,
  opts?: { filter?: PaymentTxnDirectionFilter; limit?: number },
): Promise<PaymentTxnListItem[]> {
  const filter = opts?.filter ?? "all";
  const directionWhere: Prisma.PaymentTransactionWhereInput =
    filter === "credit" ? { direction: "CREDIT" } : filter === "debit" ? { direction: "DEBIT" } : {};
  return prisma.paymentTransaction.findMany({
    where: { ...txnScopeWhere(scope), ...directionWhere },
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

/** ملخّص الاتجاهين للحركات المكتملة ضمن النطاق. */
export async function getPaymentTransactionsSummary(
  scope: PaymentTxnScope,
): Promise<PaymentTxnSummary> {
  const grouped = await prisma.paymentTransaction.groupBy({
    by: ["direction"],
    where: { ...txnScopeWhere(scope), status: "COMPLETED" },
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
