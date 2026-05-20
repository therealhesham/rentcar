import { prisma } from "@/lib/prisma";
import { parseBookingPricingSnapshot } from "@/lib/booking-pricing-snapshot";
import { computeCheckoutTotals } from "@/lib/booking-checkout-pricing";
import type { InterCityShippingSnap } from "@/lib/inter-city-shipping";
import type { CheckoutOneTimeFeeSnap } from "@/lib/booking-pricing-snapshot";

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&q=80";

export type BookingPaymentSnapshot = {
  id: number;
  fullName: string;
  phone: string;
  branch: string;
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
  car: {
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
  totals: {
    rentalExclTax: number;
    addonsExclTax: number;
    oneTimeFeesExclTax: number;
    subtotalExclTax: number;
    vatAmount: number;
    totalInclTax: number;
  };
};

export async function getBookingForPayment(
  id: number,
): Promise<BookingPaymentSnapshot | null> {
  if (!Number.isInteger(id) || id < 1) return null;

  const row = await prisma.bookingRequest.findUnique({
    where: { id },
    include: {
      returnBranch: { select: { slug: true, address: true, mapUrl: true } },
      carModel: {
        include: { brand: true, category: true },
      },
    },
  });
  if (!row || row.kind !== "DIRECT" || !row.carModel) return null;

  const m = row.carModel;
  const brandName = m.brand.name.trim();
  const modelName = m.name.trim();

  const { addons, interCityShipping, checkoutOneTimeFees } = parseBookingPricingSnapshot(
    row.addonsJson,
  );
  const returnSlug = row.returnBranch?.slug ?? "jeddah";

  const shipFee = interCityShipping?.feeExclVatSar ?? 0;
  const checkoutFeesSum = checkoutOneTimeFees.reduce((s, x) => s + x.feeExclVatSar, 0);
  const totals = computeCheckoutTotals(
    m.price,
    row.numberOfDays,
    m.vatRatePercent,
    addons.map((a) => ({ pricePerDay: a.pricePerDayExclTax })),
    { oneTimeFeesExclTax: shipFee + checkoutFeesSum },
  );

  return {
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    branch: returnSlug,
    branchAddress: row.returnBranch?.address?.trim() || null,
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
    car: {
      fullTitle: `${brandName} ${modelName}`.trim(),
      categoryTitle: m.category.title.trim(),
      pricePerDayExclTax: m.price,
      vatRatePercent: m.vatRatePercent,
      image: m.image?.trim() || PLACEHOLDER_IMG,
      alt: m.alt?.trim() || `${brandName} ${modelName}`,
    },
    addons,
    interCityShipping,
    checkoutOneTimeFees,
    totals,
  };
}
