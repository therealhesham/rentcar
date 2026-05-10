import { prisma } from "@/lib/prisma";
import { computeCheckoutTotals } from "@/lib/booking-checkout-pricing";

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&q=80";

export type BookingPaymentSnapshot = {
  id: number;
  fullName: string;
  phone: string;
  branch: string;
  pickupMode: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  pickupDate: Date;
  numberOfDays: number;
  paymentStatus: string;
  paidAt: Date | null;
  /** TABBY | TAMARA | CARD | POINTS — يُسجَّل عند إتمام الدفع التجريبي */
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
  totals: {
    rentalExclTax: number;
    addonsExclTax: number;
    subtotalExclTax: number;
    vatAmount: number;
    totalInclTax: number;
  };
};

type AddonSnapItem = {
  titleAr?: string;
  pricePerDayExclTax?: number;
  lineTotalExclTax?: number;
};

function parseAddonsSnapshot(raw: string | null): Array<{
  titleAr: string;
  pricePerDayExclTax: number;
  lineTotalExclTax: number;
}> {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as { items?: AddonSnapItem[] };
    return (data.items ?? []).map((it) => ({
      titleAr: String(it.titleAr ?? "—"),
      pricePerDayExclTax: Number(it.pricePerDayExclTax ?? 0),
      lineTotalExclTax: Number(it.lineTotalExclTax ?? 0),
    }));
  } catch {
    return [];
  }
}

export async function getBookingForPayment(
  id: number,
): Promise<BookingPaymentSnapshot | null> {
  if (!Number.isInteger(id) || id < 1) return null;

  const row = await prisma.bookingRequest.findUnique({
    where: { id },
    include: {
      carModel: {
        include: { brand: true, category: true },
      },
    },
  });
  if (!row || row.kind !== "DIRECT" || !row.carModel) return null;

  const m = row.carModel;
  const brandName = m.brand.name.trim();
  const modelName = m.name.trim();

  const addons = parseAddonsSnapshot(row.addonsJson);
  const totals = computeCheckoutTotals(
    m.price,
    row.numberOfDays,
    m.vatRatePercent,
    addons.map((a) => ({ pricePerDay: a.pricePerDayExclTax })),
  );

  return {
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    branch: row.branch,
    pickupMode: row.pickupMode,
    deliveryLat: row.deliveryLat,
    deliveryLng: row.deliveryLng,
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
    totals,
  };
}
