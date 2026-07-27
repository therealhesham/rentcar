import {
  BOOKING_STATUS_PICKED_UP,
  BOOKING_STATUS_RETURNED,
  canRecordPickupFromBranch,
  canRecordReturnToBranch,
} from "@/lib/booking-lifecycle";
import { isCashPaymentMethod } from "@/lib/booking-cash-flow";
import {
  computeDelayPenaltyExclTax,
  computeLateReturnHours,
  DELAY_PENALTY_FREE_HOURS,
  type DelayPenaltySnap,
} from "@/lib/booking-delay-penalty";
import { computeBookingReturnAt } from "@/lib/booking-return-schedule";
import { sendBookingInvoiceEmailAfterPayment } from "@/lib/booking-invoice-email";
import { prisma } from "@/lib/prisma";
import { computeCheckoutTotals } from "@/lib/booking-checkout-pricing";
import { parseBookingPricingSnapshot, resolveBookingRentalPricePerDayExclTax } from "@/lib/booking-pricing-snapshot";
import { recordPaymentTransaction } from "@/lib/payment-transaction";

export type LifecycleActionResult = { ok: true } | { ok: false; error: string };

/** تفاصيل تأخير الإرجاع الفعلي — لعرضها في مودال قرار الغرامة. */
export type LateReturnInfo = {
  /** إجمالي ساعات التأخير عن الموعد الأساسي (المعلَن وقت الحجز محسوب ضمنها). */
  totalLateHours: number;
  scheduledReturnAtIso: string;
  actualReturnAtIso: string;
  /** غرامة السياسة على إجمالي الساعات (دون ضريبة). */
  policyFeeExclTax: number;
  /** بند الساعات المعلنة المدفوع مسبقاً وقت الحجز (دون ضريبة). */
  prepaidDelayFeeExclTax: number;
  /** صافي الغرامة الجديدة = السياسة − المدفوع مسبقاً (دون ضريبة). */
  netPenaltyExclTax: number;
  /** صافي الغرامة شامل الضريبة — هذا ما سيُحصَّل من العميل. */
  netPenaltyInclTax: number;
  vatRatePercent: number;
  policyKind: "hourly" | "full_day";
  billableHours: number;
  /** أيام التأخير المحتسبة عند policyKind === full_day (تراكمي). */
  billableDays: number;
};

export type ReturnLifecycleResult =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: false; needsLateDecision: true; lateInfo: LateReturnInfo };

export type LatePenaltyDecision = "APPLY" | "WAIVE";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type LoadedBooking = NonNullable<Awaited<ReturnType<typeof loadDirectBooking>>>;

/** يحسب تفاصيل التأخير عند الإرجاع؛ null = داخل السماحية (ساعتان) أو تعذّر الحساب. */
function computeLateReturnInfo(booking: LoadedBooking, now: Date): LateReturnInfo | null {
  if (!booking.carModel) return null;
  const lateHours = computeLateReturnHours(booking.pickupDate, booking.numberOfDays, now);
  if (lateHours <= DELAY_PENALTY_FREE_HOURS) return null;

  const price = resolveBookingRentalPricePerDayExclTax(
    booking.carModel.price,
    booking.addonsJson,
  );
  const vat = booking.carModel.vatRatePercent;
  const policy = computeDelayPenaltyExclTax(price, lateHours);
  if (policy.kind === "none") return null;

  const prepaid =
    parseBookingPricingSnapshot(booking.addonsJson).delayPenalty?.feeExclVatSar ?? 0;
  const net = Math.max(0, round2(policy.feeExclVatSar - prepaid));

  return {
    totalLateHours: Math.round(lateHours * 10) / 10,
    scheduledReturnAtIso: computeBookingReturnAt(
      booking.pickupDate,
      booking.numberOfDays,
    ).toISOString(),
    actualReturnAtIso: now.toISOString(),
    policyFeeExclTax: policy.feeExclVatSar,
    prepaidDelayFeeExclTax: round2(prepaid),
    netPenaltyExclTax: net,
    netPenaltyInclTax: round2(net * (1 + vat / 100)),
    vatRatePercent: vat,
    policyKind: policy.kind,
    billableHours: policy.billableHours,
    billableDays: policy.billableDays,
  };
}

/** يستبدل لقطة غرامة التأخير في addonsJson بالإجمالي الجديد (مع الحفاظ على بقية اللقطة). */
function addonsJsonWithDelaySnap(addonsJson: string | null, snap: DelayPenaltySnap): string {
  let data: Record<string, unknown> = { items: [] };
  if (addonsJson?.trim()) {
    try {
      data = JSON.parse(addonsJson) as Record<string, unknown>;
    } catch {
      data = { items: [] };
    }
  }
  data.delayPenalty = snap;
  return JSON.stringify(data);
}

async function loadDirectBooking(bookingRequestId: number) {
  return prisma.bookingRequest.findUnique({
    where: { id: bookingRequestId },
    select: {
      id: true,
      kind: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      pickupDate: true,
      numberOfDays: true,
      addonsJson: true,
      paidAmountSar: true,
      balanceDueAtBranchSar: true,
      snapshotTotalAmountSar: true,
      vehicleUnitId: true,
      vehiclePlateNumber: true,
      odometerAtPickupKm: true,
      carModel: {
        select: { price: true, vatRatePercent: true },
      },
    },
  });
}

/** تسجيل استلام السيارة من الفرع — الحالة PICKED_UP مع ربط رقم اللوحة اختيراياً. */
export async function recordBookingPickupFromBranch(
  bookingRequestId: number,
  opts?: {
    vehicleUnitId?: number | null;
    vehiclePlateNumber?: string | null;
    odometerAtPickupKm?: number | null;
  },
): Promise<LifecycleActionResult> {
  const booking = await loadDirectBooking(bookingRequestId);
  if (!booking) return { ok: false, error: "الطلب غير موجود." };
  if (!canRecordPickupFromBranch(booking)) {
    return { ok: false, error: "لا يمكن تسجيل الاستلام في هذه المرحلة." };
  }

  const now = new Date();
  if (now < booking.pickupDate) {
    return { ok: false, error: "لا يمكن استلام السيارة قبل الموعد المحدد للحجز." };
  }

  let finalUnitId: number | null = opts?.vehicleUnitId ?? null;
  let finalPlateNumber: string | null = opts?.vehiclePlateNumber?.trim() || null;

  if (finalUnitId && !finalPlateNumber) {
    const unit = await prisma.vehicleUnit.findUnique({ where: { id: finalUnitId } });
    if (unit) finalPlateNumber = unit.plateNumber;
  } else if (!finalUnitId && finalPlateNumber) {
    const unit = await prisma.vehicleUnit.findUnique({ where: { plateNumber: finalPlateNumber } });
    if (unit) finalUnitId = unit.id;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.bookingRequest.updateMany({
      where: {
        id: bookingRequestId,
        kind: "DIRECT",
        status: { notIn: [BOOKING_STATUS_PICKED_UP, BOOKING_STATUS_RETURNED] },
      },
      data: {
        status: BOOKING_STATUS_PICKED_UP,
        vehiclePickedUpAt: now,
        ...(finalUnitId != null ? { vehicleUnitId: finalUnitId } : {}),
        ...(finalPlateNumber != null ? { vehiclePlateNumber: finalPlateNumber } : {}),
        ...(opts?.odometerAtPickupKm != null
          ? { odometerAtPickupKm: opts.odometerAtPickupKm }
          : {}),
      },
    });

    if (res.count > 0 && finalUnitId) {
      await tx.vehicleUnit.update({
        where: { id: finalUnitId },
        data: { status: "RENTED" },
      });
    }

    return res;
  });

  if (updated.count === 0) {
    return { ok: false, error: "تعذّر تسجيل الاستلام. حدّث الصفحة." };
  }
  return { ok: true };
}

/**
 * تسجيل إرجاع السيارة إلى الفرع — الحالة RETURNED؛ للكاش: تأكيد الدفع وإرسال الفاتورة.
 * عند تأخير يتجاوز السماحية وبغرامة صافية > 0: يتطلب قرار الموظف (تطبيق/إعفاء) —
 * بدون قرار يُرجع `needsLateDecision` مع التفاصيل ليعرضها المودال.
 */
export async function recordBookingReturnToBranch(
  bookingRequestId: number,
  opts?: {
    latePenaltyDecision?: LatePenaltyDecision;
    decidedBy?: string | null;
    odometerAtReturnKm?: number | null;
  },
): Promise<ReturnLifecycleResult> {
  const booking = await loadDirectBooking(bookingRequestId);
  if (!booking) return { ok: false, error: "الطلب غير موجود." };
  if (!canRecordReturnToBranch(booking)) {
    return { ok: false, error: "سجّل استلام السيارة من الفرع أولاً." };
  }

  // العداد لا يرجع للخلف — قراءة أقل من قراءة التسليم غالباً خطأ إدخال.
  if (
    opts?.odometerAtReturnKm != null &&
    booking.odometerAtPickupKm != null &&
    opts.odometerAtReturnKm < booking.odometerAtPickupKm
  ) {
    return {
      ok: false,
      error: `قراءة العداد عند الإرجاع (${opts.odometerAtReturnKm.toLocaleString("en-US")}) أقل من قراءة التسليم (${booking.odometerAtPickupKm.toLocaleString("en-US")}). راجع الرقم.`,
    };
  }

  const now = new Date();
  const cash = isCashPaymentMethod(booking.paymentMethod);
  const extraDue = booking.balanceDueAtBranchSar ?? 0;

  // ─── فحص الإرجاع المتأخر وقرار الغرامة ──────────────────────────────────────
  const lateInfo = computeLateReturnInfo(booking, now);
  const penaltyDue = lateInfo != null && lateInfo.netPenaltyExclTax > 0;
  if (penaltyDue && !opts?.latePenaltyDecision) {
    return { ok: false, needsLateDecision: true, lateInfo };
  }
  const applyPenalty = penaltyDue && opts?.latePenaltyDecision === "APPLY";
  const waivePenalty = penaltyDue && opts?.latePenaltyDecision === "WAIVE";

  // لقطة الغرامة الجديدة على إجمالي الساعات (تستبدل بند الساعات المعلنة إن وُجد)
  const appliedSnap: DelayPenaltySnap | null =
    applyPenalty && lateInfo
      ? {
          kind: lateInfo.policyKind,
          lateHours: lateInfo.totalLateHours,
          billableHours: lateInfo.billableHours,
          billableDays: lateInfo.billableDays,
          feeExclVatSar: lateInfo.policyFeeExclTax,
          labelAr: lateInfo.policyKind === "full_day" ? "أيام تأخير" : "ساعات تأخير",
          scheduledReturnAt: lateInfo.scheduledReturnAtIso,
          actualDropoffAt: lateInfo.actualReturnAtIso,
        }
      : null;
  const penaltyInclTax = applyPenalty && lateInfo ? lateInfo.netPenaltyInclTax : 0;

  // ─── حساب paidAmountSar النهائي ─────────────────────────────────────────────
  // كاش: نستخدم snapshotTotalAmountSar المجمّد وقت الحجز/التمديد (لا يتأثر بتغيير الأسعار).
  //       fallback: computeCheckoutTotals من addonsJson (لو الـ snapshot غير موجود).
  // مدفوع مسبقاً (أونلاين/كارد): paidAmountSar الأصلي + balanceDueAtBranchSar المتراكم.
  let finalPaidAmountSar: number | null = null;
  if (cash) {
    if (typeof booking.snapshotTotalAmountSar === "number" && booking.snapshotTotalAmountSar > 0) {
      // snapshot مجمّد: لا نعيد الحساب من السعر الحالي
      finalPaidAmountSar = booking.snapshotTotalAmountSar;
    } else if (booking.carModel) {
      // fallback للحجوزات القديمة قبل إضافة الحقل
      const { addons, interCityShipping, checkoutOneTimeFees } = parseBookingPricingSnapshot(booking.addonsJson);
      const effectivePrice = resolveBookingRentalPricePerDayExclTax(booking.carModel.price, booking.addonsJson);
      const shipFee = interCityShipping?.feeExclVatSar ?? 0;
      const feesSum = checkoutOneTimeFees.reduce((s, x) => s + x.feeExclVatSar, 0);
      const totals = computeCheckoutTotals(
        effectivePrice,
        booking.numberOfDays,
        booking.carModel.vatRatePercent,
        addons.map((a) => ({ pricePerDay: a.pricePerDayExclTax })),
        { oneTimeFeesExclTax: shipFee + feesSum },
      );
      finalPaidAmountSar = Math.round(totals.totalInclTax * 100) / 100;
    }
    // الكاش يسدّد كل شيء عند الإرجاع — الغرامة المطبقة تدخل في التحصيل النهائي
    if (finalPaidAmountSar !== null && penaltyInclTax > 0) {
      finalPaidAmountSar = round2(finalPaidAmountSar + penaltyInclTax);
    }
  } else if (!cash && extraDue > 0 && typeof booking.paidAmountSar === "number") {
    // مدفوع مسبقاً + فرق مدّد في الفرع
    finalPaidAmountSar = Math.round((booking.paidAmountSar + extraDue) * 100) / 100;
  }

  // إجمالي الحجز المجمّد يرتفع بصافي الغرامة المطبقة (تظهر في الفاتورة وكشف الحساب)
  const newSnapshotTotal =
    penaltyInclTax > 0 && typeof booking.snapshotTotalAmountSar === "number"
      ? round2(booking.snapshotTotalAmountSar + penaltyInclTax)
      : undefined;

  // تحديث الحجز + إدراج سطور الدفتر ذرّياً في transaction واحد.
  const actorName = opts?.decidedBy?.trim() || null;
  const applied = await prisma.$transaction(async (tx) => {
    const updated = await tx.bookingRequest.updateMany({
      where: {
        id: bookingRequestId,
        kind: "DIRECT",
        status: BOOKING_STATUS_PICKED_UP,
      },
      data: {
        status: BOOKING_STATUS_RETURNED,
        vehicleReturnedAt: now,
        ...(opts?.odometerAtReturnKm != null
          ? { odometerAtReturnKm: opts.odometerAtReturnKm }
          : {}),
        // مدفوع أونلاين + غرامة مطبقة: تبقى الغرامة رصيداً مستحقاً يتابَع من صفحة الاستلامات المتأخرة
        balanceDueAtBranchSar: !cash && penaltyInclTax > 0 ? penaltyInclTax : null,
        ...(appliedSnap
          ? {
              addonsJson: addonsJsonWithDelaySnap(booking.addonsJson, appliedSnap),
              ...(newSnapshotTotal !== undefined
                ? { snapshotTotalAmountSar: newSnapshotTotal }
                : {}),
            }
          : {}),
        ...(lateInfo
          ? {
              lateReturnHours: lateInfo.totalLateHours,
              lateReturnPenaltyExclTaxSar: applyPenalty ? lateInfo.netPenaltyExclTax : 0,
              lateReturnPenaltyWaived: waivePenalty,
              lateReturnDecidedBy: penaltyDue ? actorName : null,
            }
          : {}),
        ...(cash
          ? {
              paymentStatus: "PAID",
              paidAt: now,
              paidAmountSar: finalPaidAmountSar,
            }
          : {
              // للمدفوع أونلاين: نضيف فرق التمديد إلى المدفوع المسجّل
              ...(finalPaidAmountSar !== null ? { paidAmountSar: finalPaidAmountSar } : {}),
            }),
      },
    });
    if (updated.count === 0) return false;

    if (booking.vehicleUnitId) {
      await tx.vehicleUnit.update({
        where: { id: booking.vehicleUnitId },
        data: { status: "AVAILABLE" },
      });
    }

    if (cash) {
      // الكاش يسدّد كل شيء عند الإرجاع: أصل الإيجار سطر INITIAL_PAYMENT،
      // والغرامة المطبقة (إن وُجدت) سطر LATE_PENALTY مستقل.
      const basePortion =
        finalPaidAmountSar !== null ? round2(finalPaidAmountSar - penaltyInclTax) : 0;
      if (basePortion > 0) {
        await recordPaymentTransaction(
          {
            bookingId: bookingRequestId,
            kind: "INITIAL_PAYMENT",
            amountSar: basePortion,
            method: booking.paymentMethod ?? "CASH",
            actorKind: "ADMIN",
            actorName,
            notes: "تحصيل نقدي عند الإرجاع",
          },
          tx,
        );
      }
      if (penaltyInclTax > 0) {
        await recordPaymentTransaction(
          {
            bookingId: bookingRequestId,
            kind: "LATE_PENALTY",
            amountSar: penaltyInclTax,
            method: booking.paymentMethod ?? "CASH",
            actorKind: "ADMIN",
            actorName,
            notes: "غرامة تأخير محصّلة نقداً عند الإرجاع",
          },
          tx,
        );
      }
    } else if (finalPaidAmountSar !== null && extraDue > 0) {
      // مدفوع أونلاين + فرق تمديد حُصِّل عند الإرجاع.
      await recordPaymentTransaction(
        {
          bookingId: bookingRequestId,
          kind: "BALANCE_PAYMENT",
          amountSar: extraDue,
          actorKind: "ADMIN",
          actorName,
          notes: "فرق تمديد محصّل عند الإرجاع",
        },
        tx,
      );
    }
    return true;
  });
  if (!applied) {
    return { ok: false, error: "تعذّر تسجيل الإرجاع. حدّث الصفحة." };
  }

  if (cash) {
    try {
      await sendBookingInvoiceEmailAfterPayment(bookingRequestId);
    } catch (e) {
      console.error("[booking-invoice-email] بعد إرجاع السيارة (كاش):", e);
    }
  }

  return { ok: true };
}

/** عند تغيير الحالة يدوياً من لوحة التعديل — طوابع زمنية + فاتورة الكاش عند الإرجاع. */
export async function syncLifecycleFromAdminStatusChange(
  bookingRequestId: number,
  previousStatus: string,
  newStatus: string,
  paymentMethod: string | null,
): Promise<void> {
  const prev = previousStatus.trim().toUpperCase();
  const next = newStatus.trim().toUpperCase();
  if (prev === next) return;

  const now = new Date();
  const data: {
    vehiclePickedUpAt?: Date;
    vehicleReturnedAt?: Date;
    paymentStatus?: string;
    paidAt?: Date;
  } = {};

  // مبالغ محصّلة عند الإرجاع تُدرَج في الدفتر مع التحديث النهائي.
  let cashCollectedSar: number | null = null;
  let balanceCollectedSar: number | null = null;

  if (next === BOOKING_STATUS_PICKED_UP && prev !== BOOKING_STATUS_PICKED_UP) {
    data.vehiclePickedUpAt = now;
  }
  if (next === BOOKING_STATUS_RETURNED && prev !== BOOKING_STATUS_RETURNED) {
    data.vehicleReturnedAt = now;
    if (isCashPaymentMethod(paymentMethod)) {
      data.paymentStatus = "PAID";
      data.paidAt = now;
      // حساب وحفظ المبلغ الكامل المدفوع (كاش: الإجمالي الفعلي بالأيام الجديدة)
      const br = await prisma.bookingRequest.findUnique({
        where: { id: bookingRequestId },
        select: {
          numberOfDays: true,
          addonsJson: true,
          balanceDueAtBranchSar: true,
          carModel: { select: { price: true, vatRatePercent: true } },
        },
      });
      if (br?.carModel) {
        const { addons, interCityShipping, checkoutOneTimeFees } = parseBookingPricingSnapshot(br.addonsJson);
        const effectivePrice = resolveBookingRentalPricePerDayExclTax(br.carModel.price, br.addonsJson);
        const shipFee = interCityShipping?.feeExclVatSar ?? 0;
        const feesSum = checkoutOneTimeFees.reduce((s, x) => s + x.feeExclVatSar, 0);
        const totals = computeCheckoutTotals(
          effectivePrice,
          br.numberOfDays,
          br.carModel.vatRatePercent,
          addons.map((a) => ({ pricePerDay: a.pricePerDayExclTax })),
          { oneTimeFeesExclTax: shipFee + feesSum },
        );
        (data as Record<string, unknown>).paidAmountSar = totals.totalInclTax;
        // إزالة المبلغ المستحق عند الفرع بعد التسجيل
        (data as Record<string, unknown>).balanceDueAtBranchSar = null;
        // كامل الإجمالي حُصِّل نقداً عند الإرجاع.
        cashCollectedSar = round2(totals.totalInclTax);
      }
    } else {
      // مدفوع مسبقاً (أونلاين/كارد): نضيف فرق التمديد إلى paidAmountSar
      const brOnline = await prisma.bookingRequest.findUnique({
        where: { id: bookingRequestId },
        select: { paidAmountSar: true, balanceDueAtBranchSar: true },
      });
      const extraDue = brOnline?.balanceDueAtBranchSar ?? 0;
      if (extraDue > 0 && typeof brOnline?.paidAmountSar === "number") {
        (data as Record<string, unknown>).paidAmountSar =
          Math.round((brOnline.paidAmountSar + extraDue) * 100) / 100;
        (data as Record<string, unknown>).balanceDueAtBranchSar = null;
        // فرق تمديد حُصِّل عند الإرجاع.
        balanceCollectedSar = round2(extraDue);
      } else if (brOnline?.balanceDueAtBranchSar) {
        (data as Record<string, unknown>).balanceDueAtBranchSar = null;
      }
    }
  }

  if (Object.keys(data).length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.bookingRequest.update({
        where: { id: bookingRequestId },
        data,
      });
      if (cashCollectedSar != null && cashCollectedSar > 0) {
        await recordPaymentTransaction(
          {
            bookingId: bookingRequestId,
            kind: "INITIAL_PAYMENT",
            amountSar: cashCollectedSar,
            method: paymentMethod ?? "CASH",
            actorKind: "ADMIN",
            notes: "تحصيل نقدي عند تغيير الحالة إلى إرجاع",
          },
          tx,
        );
      }
      if (balanceCollectedSar != null && balanceCollectedSar > 0) {
        await recordPaymentTransaction(
          {
            bookingId: bookingRequestId,
            kind: "BALANCE_PAYMENT",
            amountSar: balanceCollectedSar,
            actorKind: "ADMIN",
            notes: "فرق تمديد محصّل عند تغيير الحالة إلى إرجاع",
          },
          tx,
        );
      }
    });
  }

  if (
    next === BOOKING_STATUS_RETURNED &&
    prev !== BOOKING_STATUS_RETURNED &&
    isCashPaymentMethod(paymentMethod)
  ) {
    try {
      await sendBookingInvoiceEmailAfterPayment(bookingRequestId);
    } catch (e) {
      console.error("[booking-invoice-email] بعد تغيير الحالة إلى إرجاع (كاش):", e);
    }
  }
}
