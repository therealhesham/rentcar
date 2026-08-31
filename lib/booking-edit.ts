/** أدوات تعديل تواريخ حجز قائم من حساب العميل: احتساب الإجمالي لعدد أيام جديد وإعادة بناء لقطة الإضافات. */

import { computeCheckoutTotals } from "@/lib/booking-checkout-pricing";
import {
  computeDelayPenaltySnap,
  type DelayPenaltySnap,
} from "@/lib/booking-delay-penalty";
import { computeBookingReturnAt } from "@/lib/booking-return-schedule";
import { formatDailyBookingDurationAr } from "@/lib/booking-duration-display";
import {
  parseBookingPricingSnapshot,
  resolveBookingRentalPricePerDayExclTax,
} from "@/lib/booking-pricing-snapshot";
import { capFullTotalDiscountToFloor } from "@/lib/min-price-floor";

export type BookingDaysPriceInput = {
  /** سعر الإيجار اليومي الفعلي (بعد الخصم) غير شامل الضريبة. */
  pricePerDayExclTax: number;
  vatRatePercent: number;
  /** أسعار الإضافات باليوم (غير شاملة الضريبة) — تتكرر بعدد الأيام. */
  addonPerDayExclTax: number[];
  /** رسوم لمرة واحدة لا تتأثر بعدد الأيام (شحن، رسوم إتمام، غرامة تأخير سابقة). */
  oneTimeFeesExclTax: number;
  /** خصم كوبون FULL_TOTAL مُجمَّد (مبلغ ثابت لا يتغيّر مع عدد الأيام). صفر لو لا يوجد أو كان RENTAL_ONLY. */
  discountExclTax: number;
  /** أرضية السعر الأدنى المُجمَّدة (مكافئ يومي، دون ضريبة). null = بلا أرضية. */
  floorPerDayExclTax: number | null;
};

/**
 * إجمالي الحجز (شامل الضريبة) لعدد أيام محدّد — دالة نقية صالحة للعميل.
 *
 * الأرضية تُعاد فرضها بعدد الأيام الجديد: خصم كوبون `FULL_TOTAL` مبلغ مطلق
 * مُجمَّد لا يتقلّص مع تقليل الأيام، فبدون إعادة القصّ هنا يقدر العميل يقلّل
 * المدة فينزل الصافي تحت الأرضية.
 */
export function bookingTotalInclTaxForDays(
  input: BookingDaysPriceInput,
  days: number,
): number {
  const addonRows = input.addonPerDayExclTax.map((pricePerDay) => ({ pricePerDay }));
  const preDiscount = computeCheckoutTotals(
    input.pricePerDayExclTax,
    days,
    input.vatRatePercent,
    addonRows,
    { oneTimeFeesExclTax: input.oneTimeFeesExclTax },
  );
  const { discountExclTax } = capFullTotalDiscountToFloor(
    input.discountExclTax,
    preDiscount.subtotalExclTax,
    input.floorPerDayExclTax,
    days,
  );
  const totals = computeCheckoutTotals(
    input.pricePerDayExclTax,
    days,
    input.vatRatePercent,
    addonRows,
    { oneTimeFeesExclTax: input.oneTimeFeesExclTax, discountExclTax },
  );
  return totals.totalInclTax;
}

export type BalanceInputBooking = {
  paymentStatus: string;
  snapshotTotalAmountSar: number | null;
  paidAmountSar: number | null;
  balanceDueAtBranchSar: number | null;
  refundDueToCustomerSar: number | null;
  refundDueSettledAt: Date | null;
};

export type BalanceAfterTotalChange = {
  snapshotTotalAmountSar: number;
  /** undefined = لا تلمس الحقل (حجز غير مدفوع — الرصيد يُشتق حياً عند التحصيل). */
  balanceDueAtBranchSar: number | null | undefined;
  /** undefined = لا تلمس الحقل (نفس منطق balanceDueAtBranchSar للحجز غير المدفوع). */
  refundDueToCustomerSar: number | null | undefined;
  /** > 0 لو نتج مستحق جديد للعميل يلزم تسويته من «مستحقات للعميل». */
  creditForCustomerSar: number;
};

/**
 * يشتق الرصيد/المستحق للعميل بعد تغيّر إجمالي الحجز بمقدار `diff` — الصيغة الموثوقة
 * المطابقة لمسار تعديل العميل (`updateCustomerBookingDates`): الرصيد يُشتق من
 * (الإجمالي الجديد − المدفوع فعلياً) لا بالتراكم على الرصيد القديم، فيصحّح ذاتياً أي
 * رصيد متراكم بشكل غير متسق. راجع ذاكرة `booking-edit-parity` و`unpaid-booking-balance-rule`.
 *
 * `oldTotalFallback` يُستخدم فقط لو الحجز بلا `snapshotTotalAmountSar` وغير مدفوع
 * (حجوزات قديمة جداً) — كل استدعاء يشتق إجماله القديم بطريقته الخاصة قبل النداء.
 */
export function computeBalanceAfterTotalChange(
  booking: BalanceInputBooking,
  diff: number,
  oldTotalFallback: number,
): BalanceAfterTotalChange {
  const isPaid = booking.paymentStatus.trim().toUpperCase() === "PAID";
  const previousTotal =
    booking.snapshotTotalAmountSar ??
    (isPaid && typeof booking.paidAmountSar === "number"
      ? booking.paidAmountSar + (booking.balanceDueAtBranchSar ?? 0)
      : oldTotalFallback);

  const snapshotTotalAmountSar = Math.round((previousTotal + diff) * 100) / 100;

  if (!isPaid) {
    // غير مدفوع: الإجمالي الجديد يُدفع كاملاً عند إتمام الدفع، وهو يُشتق من اللقطة
    // نفسها (`computeBookingOutstanding`). ضمّ فرق التعديل إلى الرصيد كان يطالب
    // العميل به مرتين: مرة داخل الإجمالي ومرة كرصيد عند الفرع.
    //
    // والرصيد لا يُصفَّر أيضاً: قد يحمل رسوماً إضافية أو غرامة تأخير سُجّلت قبل
    // التحصيل، وتقليص المدة كان يبتلعها. فلا يُمسّ هنا إطلاقاً.
    return {
      snapshotTotalAmountSar,
      balanceDueAtBranchSar: undefined,
      refundDueToCustomerSar: undefined,
      creditForCustomerSar: 0,
    };
  }

  const unsettledCredit =
    booking.refundDueSettledAt == null ? (booking.refundDueToCustomerSar ?? 0) : 0;
  const net =
    typeof booking.paidAmountSar === "number"
      ? Math.round((snapshotTotalAmountSar - booking.paidAmountSar) * 100) / 100
      : Math.round(((booking.balanceDueAtBranchSar ?? 0) - unsettledCredit + diff) * 100) / 100;

  if (net > 0.005) {
    return {
      snapshotTotalAmountSar,
      balanceDueAtBranchSar: net,
      refundDueToCustomerSar: null,
      creditForCustomerSar: 0,
    };
  }
  if (net < -0.005) {
    const creditForCustomerSar = Math.round(-net * 100) / 100;
    return {
      snapshotTotalAmountSar,
      balanceDueAtBranchSar: null,
      refundDueToCustomerSar: creditForCustomerSar,
      creditForCustomerSar,
    };
  }
  return {
    snapshotTotalAmountSar,
    balanceDueAtBranchSar: null,
    refundDueToCustomerSar: null,
    creditForCustomerSar: 0,
  };
}

/** يستخرج مدخلات احتساب السعر من لقطة الحجز المخزّنة (لتمريرها للعميل وإعادة الحساب الحي). */
export function bookingDaysPriceInputFromSnapshot(
  modelPricePerDayExclTax: number,
  vatRatePercent: number,
  addonsJson: string | null,
): BookingDaysPriceInput {
  const pricePerDayExclTax = resolveBookingRentalPricePerDayExclTax(
    modelPricePerDayExclTax,
    addonsJson,
  );
  const {
    addons,
    interCityShipping,
    checkoutOneTimeFees,
    delayPenalty,
    couponCode,
    rentalFloorPerDayExclTax,
  } = parseBookingPricingSnapshot(addonsJson);
  const shipFee = interCityShipping?.feeExclVatSar ?? 0;
  const checkoutFeesSum = checkoutOneTimeFees.reduce((s, x) => s + x.feeExclVatSar, 0);
  const delayFee = delayPenalty?.feeExclVatSar ?? 0;
  return {
    pricePerDayExclTax,
    vatRatePercent,
    addonPerDayExclTax: addons.map((a) => a.pricePerDayExclTax),
    oneTimeFeesExclTax: shipFee + checkoutFeesSum + delayFee,
    discountExclTax: couponCode?.scope === "FULL_TOTAL" ? couponCode.discountExclTax : 0,
    // الحجوزات الأقدم من هذا الحقل = بلا أرضية، فسلوكها يبقى كما هو.
    floorPerDayExclTax: rentalFloorPerDayExclTax,
  };
}

/**
 * يعيد احتساب لقطة ساعات التأخير من **وقت تسليم صريح**، ويكتبها في اللقطة دون
 * المساس ببقية حقولها.
 *
 * `rebuildAddonsJsonForDays` يحافظ على *فارق* الساعات القديم، وهو الصحيح حين لا
 * يُعرف وقت تسليم جديد. لكن مودال تعديل الإدارة صار يختار الاستلام والتسليم مثل
 * إتمام العميل تماماً، فالفارق الجديد هو المرجع — وإلا بقيت رسوم ساعات لم يعد لها
 * وجود، أو ضاعت ساعات اختارها الموظف ويدفعها العميل في مسار الإتمام.
 */
export function applyDropoffDelayPenaltyToAddonsJson(input: {
  addonsJson: string | null;
  pickupDate: Date;
  numberOfDays: number;
  actualDropoffDate: Date;
  /** سعر اليوم من الموديل — اللقطة المجمَّدة تسبقه إن وُجدت. */
  modelPricePerDayExclTax: number;
}): { addonsJson: string | null; snap: DelayPenaltySnap | null } {
  const snap = computeDelayPenaltySnap({
    rentalTab: "daily",
    pricePerDayExclTax: resolveBookingRentalPricePerDayExclTax(
      input.modelPricePerDayExclTax,
      input.addonsJson,
    ),
    pickupDate: input.pickupDate,
    numberOfDays: input.numberOfDays,
    actualDropoffDate: input.actualDropoffDate,
  });

  let data: Record<string, unknown> = {};
  if (input.addonsJson?.trim()) {
    try {
      const parsed = JSON.parse(input.addonsJson);
      if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
    } catch {
      return { addonsJson: input.addonsJson, snap };
    }
  }

  const extraMs =
    input.actualDropoffDate.getTime() -
    computeBookingReturnAt(input.pickupDate, input.numberOfDays).getTime();
  if (extraMs > 0) {
    data.tripDurationLabelAr = formatDailyBookingDurationAr({
      days: Math.max(1, Math.round(input.numberOfDays)),
      extraHours: Math.ceil(extraMs / 3_600_000),
    });
  } else {
    delete data.tripDurationLabelAr;
  }
  if (snap) {
    data.delayPenalty = snap;
  } else {
    delete data.delayPenalty;
  }

  const json = Object.keys(data).length > 0 ? JSON.stringify(data) : null;
  return { addonsJson: json, snap };
}

/**
 * يعيد تسعير لقطة الحجز على موديل جديد (تبديل السيارة من الإدارة):
 * يستبدل سعر الإيجار اليومي المجمَّد وأرضية السعر بقيم الموديل الجديد في فرع الإرجاع،
 * ويُسقط لقطة الخصم القديمة (كانت تخص الموديل السابق — الخصم الجديد مدموج أصلاً في السعر).
 *
 * الإضافات والرسوم لمرة واحدة وكوبون `FULL_TOTAL` تبقى كما هي: مبالغ مستقلة عن الموديل.
 * كوبون `RENTAL_ONLY` مدموج في السعر اليومي، فهذه الدالة لا تعرف عنه شيئاً — على
 * الاستدعاء إعادة تطبيقه على سعر الموديل الجديد قبل تمرير `pricePerDayExclTax`
 * هنا (انظر `repriceRentalOnlyCouponForModelChange` و`updateBookingRequestByAdmin`).
 */
export function repriceAddonsJsonForModel(
  addonsJson: string | null,
  pricePerDayExclTax: number,
  floorPerDayExclTax: number | null,
): string {
  let data: Record<string, unknown> = {};
  if (addonsJson?.trim()) {
    try {
      const parsed = JSON.parse(addonsJson);
      if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
    } catch {
      data = {};
    }
  }
  data.rentalPricePerDayExclTax = Math.round(pricePerDayExclTax * 100) / 100;
  if (floorPerDayExclTax != null && floorPerDayExclTax > 0) {
    data.rentalFloorPerDayExclTax = Math.round(floorPerDayExclTax * 100) / 100;
  } else {
    delete data.rentalFloorPerDayExclTax;
  }
  delete data.rentalDiscount;
  if (!Array.isArray(data.items)) data.items = [];
  return JSON.stringify(data);
}

/**
 * يعيد بناء لقطة الإضافات (addonsJson) بعدد أيام جديد:
 * - يضبط days وlineTotalExclTax لكل إضافة على عدد الأيام الجديد.
 * - يُبقي رسوم الشحن بين المدن ورسوم الإتمام ولقطة الخصم وسعر الإيجار اليومي وأرضية السعر المجمَّدين كما هي.
 * - يعيد احتساب الساعات/الأيام الإضافية ووصف المدة على المدة الجديدة.
 *
 * `pickupDate` مطلوب للحفاظ على الساعات الإضافية المتفق عليها: العميل الذي اختار
 * إرجاعاً بعد حدّ اليوم الكامل دفع فرقها، وإسقاطها هنا كان يمحو ذلك المبلغ من
 * الحجز ويضيّع موعد الإرجاع الحقيقي. المحفوظ هو **فارق الساعات** لا التوقيت
 * المطلق، فيتحرّك الإرجاع مع أي تغيير في موعد الاستلام أو عدد الأيام.
 */
export function rebuildAddonsJsonForDays(
  addonsJson: string | null,
  newDays: number,
  pickupDate?: Date | null,
): string | null {
  if (!addonsJson?.trim()) return null;
  let data: {
    items?: Array<{ pricePerDayExclTax?: unknown; [k: string]: unknown }>;
    interCityShipping?: unknown;
    checkoutOneTimeFees?: unknown;
    rentalDiscount?: unknown;
    rentalPricePerDayExclTax?: unknown;
    rentalFloorPerDayExclTax?: unknown;
    couponCode?: unknown;
    delayPenalty?: DelayPenaltySnap;
  };
  try {
    data = JSON.parse(addonsJson);
  } catch {
    return addonsJson;
  }

  const days = Math.max(1, Math.round(newDays));
  const items = Array.isArray(data.items)
    ? data.items.map((it) => {
        const ppd = Number(it.pricePerDayExclTax ?? 0);
        return { ...it, days, lineTotalExclTax: ppd * days };
      })
    : [];

  const payload: {
    items: typeof items;
    interCityShipping?: unknown;
    checkoutOneTimeFees?: unknown;
    rentalDiscount?: unknown;
    rentalPricePerDayExclTax?: unknown;
    rentalFloorPerDayExclTax?: unknown;
    couponCode?: unknown;
    delayPenalty?: DelayPenaltySnap;
    tripDurationLabelAr?: string;
  } = { items };

  if (data.interCityShipping) payload.interCityShipping = data.interCityShipping;
  if (Array.isArray(data.checkoutOneTimeFees) && data.checkoutOneTimeFees.length) {
    payload.checkoutOneTimeFees = data.checkoutOneTimeFees;
  }
  if (data.rentalDiscount) payload.rentalDiscount = data.rentalDiscount;
  if (typeof data.rentalPricePerDayExclTax === "number") {
    payload.rentalPricePerDayExclTax = data.rentalPricePerDayExclTax;
  }
  // إسقاط الأرضية هنا كان هيسمح للعميل يهرب منها بمجرد تعديل التواريخ.
  if (typeof data.rentalFloorPerDayExclTax === "number") {
    payload.rentalFloorPerDayExclTax = data.rentalFloorPerDayExclTax;
  }
  if (data.couponCode) payload.couponCode = data.couponCode;

  // الساعات الزائدة عن حدّ اليوم الكامل: نحتفظ بفارقها لا بتوقيتها المطلق، ونعيد
  // احتساب الرسم بالمدة الجديدة — تمديد يوم قد يبتلع تلك الساعات فتسقط الرسوم.
  const oldDelay = data.delayPenalty;
  if (pickupDate && !Number.isNaN(pickupDate.getTime()) && oldDelay?.scheduledReturnAt && oldDelay?.actualDropoffAt) {
    const extraMs =
      new Date(oldDelay.actualDropoffAt).getTime() -
      new Date(oldDelay.scheduledReturnAt).getTime();
    if (Number.isFinite(extraMs) && extraMs > 0) {
      const newDropoff = new Date(computeBookingReturnAt(pickupDate, days).getTime() + extraMs);
      const snap = computeDelayPenaltySnap({
        // وجود اللقطة أصلاً يعني أن الحجز يومي — الشهري لا يُنتج هذه اللقطة.
        rentalTab: "daily",
        pricePerDayExclTax:
          typeof data.rentalPricePerDayExclTax === "number" ? data.rentalPricePerDayExclTax : 0,
        pickupDate,
        numberOfDays: days,
        actualDropoffDate: newDropoff,
      });
      if (snap) payload.delayPenalty = snap;
      // نبنيه من الأيام المعروفة والساعات المحفوظة مباشرةً؛ إعادة اشتقاق المدة من
      // التاريخين تمرّ بـ`computeBookingDays` التي تعتمد التوقيت المحلي للخادم،
      // فيختلف الوصف باختلاف إعداد الخادم (UTC → «3 أيام + 7 ساعات»، الرياض → «4 أيام»).
      payload.tripDurationLabelAr = formatDailyBookingDurationAr({
        days,
        extraHours: Math.ceil(extraMs / 3_600_000),
      });
    }
  }

  const hasAny =
    items.length > 0 ||
    payload.interCityShipping != null ||
    payload.checkoutOneTimeFees != null ||
    payload.rentalDiscount != null ||
    payload.rentalPricePerDayExclTax != null ||
    payload.rentalFloorPerDayExclTax != null ||
    payload.couponCode != null ||
    payload.delayPenalty != null;

  return hasAny ? JSON.stringify(payload) : null;
}
