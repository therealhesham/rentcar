import { resolvePickupBranchDisplayName } from "@/lib/booking-branches";
import { prisma } from "@/lib/prisma";
import { parseBookingPricingSnapshot, resolveBookingRentalPricePerDayExclTax } from "@/lib/booking-pricing-snapshot";
import { computeCheckoutTotals } from "@/lib/booking-checkout-pricing";
import type { InterCityShippingSnap } from "@/lib/inter-city-shipping";
import type { DelayPenaltySnap } from "@/lib/booking-delay-penalty";
import type { CheckoutOneTimeFeeSnap, CouponCodeSnap } from "@/lib/booking-pricing-snapshot";

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&q=80";

function resolveInvoiceEmail(
  contactEmail: string | null | undefined,
  customerEmail: string | null | undefined,
): string | null {
  const fromBooking = contactEmail?.trim().toLowerCase();
  if (fromBooking && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromBooking)) {
    return fromBooking;
  }
  const fromUser = customerEmail?.trim().toLowerCase();
  if (fromUser && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromUser)) {
    return fromUser;
  }
  return null;
}

export type BookingPaymentSnapshot = {
  id: number;
  fullName: string;
  phone: string;
  /** بريد إرسال الفاتورة إن وُجد */
  invoiceEmail: string | null;
  branch: string;
  /** اسم فرع الاستلام بالعربية (من Branch.name) */
  pickupBranchLabelAr: string | null;
  /** اسم فرع التسليم بالعربية */
  returnBranchLabelAr: string | null;
  /** من جدول الفروع — لعرض الموقع في إشعارات واتساب وغيرها */
  branchAddress: string | null;
  branchMapUrl: string | null;
  pickupMode: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryAddress: string | null;
  pickupDate: Date;
  numberOfDays: number;
  paymentStatus: string;
  paidAt: Date | null;
  /** TABBY | TAMARA | CARD | APPLE_PAY | POINTS — يُسجَّل عند إتمام الدفع التجريبي */
  paymentMethod: string | null;
  status: string;
  /** رصيد مستحق على العميل بعد تمديد/تعديل حجز مدفوع — يُسدَّد أونلاين من نفس الصفحة أو في الفرع. */
  balanceDueAtBranchSar: number | null;
  car: {
    modelId: number;
    fullTitle: string;
    categoryTitle: string;
    pricePerDayExclTax: number;
    vatRatePercent: number;
    image: string;
    alt: string;
  };
  addons: Array<{
    titleAr: string;
    pricePerDayExclTax: number;
    lineTotalExclTax: number;
  }>;
  interCityShipping: InterCityShippingSnap | null;
  /** رسوم لمرة واحدة عند الإتمام (من الإدارة)، غير شاملة الضريبة. */
  checkoutOneTimeFees: CheckoutOneTimeFeeSnap[];
  /** غرامة تأخير (حجز يومي)، غير شاملة الضريبة. */
  delayPenalty: DelayPenaltySnap | null;
  /** مدة الحجز اليومي للعرض إن وُجدت في اللقطة. */
  tripDurationLabelAr: string | null;
  /** كود الخصم المُطبَّق على الحجز إن وُجد. */
  couponCode: CouponCodeSnap | null;
  totals: {
    rentalExclTax: number;
    addonsExclTax: number;
    oneTimeFeesExclTax: number;
    discountExclTax: number;
    subtotalExclTax: number;
    vatAmount: number;
    totalInclTax: number;
  };
};

export async function getBookingForPayment(
  id: number,
  /** لغة العرض — تُنتقى الحقول الإنجليزية من القاعدة عند "en" مع رجوع للعربي إن كانت فارغة. */
  locale: string = "ar",
): Promise<BookingPaymentSnapshot | null> {
  if (!Number.isInteger(id) || id < 1) return null;

  const row = await prisma.bookingRequest.findUnique({
    where: { id },
    include: {
      pickupBranch: { select: { slug: true, name: true, nameEn: true } },
      returnBranch: { select: { slug: true, name: true, nameEn: true, address: true, addressEn: true, mapUrl: true } },
      customer: { select: { email: true } },
      carModel: {
        include: { brand: true, category: true },
      },
    },
  });
  if (!row || row.kind !== "DIRECT" || !row.carModel) return null;

  const m = row.carModel;
  const en = locale === "en";
  // الرجوع للعربي مقصود: أعمدة *En اختيارية وقد تكون فارغة لبعض السجلات.
  const brandName = (en ? m.brand.nameEn?.trim() : null) || m.brand.name.trim();
  const modelName = (en ? m.nameEn?.trim() : null) || m.name.trim();
  const categoryTitle =
    (en ? m.category.titleEn?.trim() : null) || m.category.title.trim();

  const { addons, interCityShipping, checkoutOneTimeFees, delayPenalty, tripDurationLabelAr, couponCode } =
    parseBookingPricingSnapshot(row.addonsJson);
  const returnSlug = row.returnBranch?.slug ?? "jeddah";
  const effectiveRentalPrice = resolveBookingRentalPricePerDayExclTax(m.price, row.addonsJson);

  const shipFee = interCityShipping?.feeExclVatSar ?? 0;
  const checkoutFeesSum = checkoutOneTimeFees.reduce((s, x) => s + x.feeExclVatSar, 0);
  const delayFee = delayPenalty?.feeExclVatSar ?? 0;
  const discountExclTax = couponCode?.scope === "FULL_TOTAL" ? couponCode.discountExclTax : 0;
  const totals = computeCheckoutTotals(
    effectiveRentalPrice,
    row.numberOfDays,
    m.vatRatePercent,
    addons.map((a) => ({ pricePerDay: a.pricePerDayExclTax })),
    { oneTimeFeesExclTax: shipFee + checkoutFeesSum + delayFee, discountExclTax },
  );

  return {
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    invoiceEmail: resolveInvoiceEmail(row.contactEmail, row.customer?.email),
    branch: returnSlug,
    pickupBranchLabelAr: resolvePickupBranchDisplayName(
      {
        branchId: row.branchId,
        returnBranchId: row.returnBranchId,
        pickupMode: row.pickupMode,
        addonsJson: row.addonsJson,
        pickupBranch: row.pickupBranch,
        returnBranch: row.returnBranch,
      },
      locale,
    ),
    returnBranchLabelAr:
      (en ? row.returnBranch?.nameEn?.trim() : null) || row.returnBranch?.name?.trim() || null,
    branchAddress:
      (en ? row.returnBranch?.addressEn?.trim() : null) || row.returnBranch?.address?.trim() || null,
    branchMapUrl: row.returnBranch?.mapUrl?.trim() || null,
    pickupMode: row.pickupMode,
    deliveryLat: row.deliveryLat,
    deliveryLng: row.deliveryLng,
    deliveryAddress: row.deliveryAddress,
    pickupDate: row.pickupDate,
    numberOfDays: row.numberOfDays,
    paymentStatus: row.paymentStatus,
    paidAt: row.paidAt,
    paymentMethod: row.paymentMethod,
    status: row.status,
    balanceDueAtBranchSar: row.balanceDueAtBranchSar,
    car: {
      modelId: m.id,
      fullTitle: `${brandName} ${modelName}`.trim(),
      categoryTitle,
      pricePerDayExclTax: effectiveRentalPrice,
      vatRatePercent: m.vatRatePercent,
      image: m.image?.trim() || PLACEHOLDER_IMG,
      alt: m.alt?.trim() || `${brandName} ${modelName}`,
    },
    addons,
    interCityShipping,
    checkoutOneTimeFees,
    delayPenalty,
    tripDurationLabelAr,
    couponCode,
    totals,
  };
}
