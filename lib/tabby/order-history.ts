import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * بناء `payment.order_history` و`buyer_history.loyalty_level` لحمولة تابي.
 *
 * تابي تستخدمهما في تقييم المخاطر: عميل له حجوزات سابقة مكتملة أقل خطراً من عميل
 * جديد. طلبها Egor صراحةً في مراجعة التكامل (٩ سبتمبر ٢٠٢٦) — كانت `order_history`
 * تُرسَل مصفوفة فارغة دائماً و`loyalty_level` صفراً ثابتاً.
 */

/** الحالات المعتمدة في سكيما تابي — لا يجوز إرسال غيرها. */
type TabbyOrderStatus = "new" | "processing" | "complete" | "refunded" | "canceled" | "unknown";

/** أقصى ما تطلبه تابي في المصفوفة (٥–١٠ طلبات سابقة). */
const MAX_HISTORY = 10;

/**
 * تعيين حالات حجوزاتنا إلى حالات تابي المعتمدة.
 * حالة الدفع تسبق حالة الحجز: حجز مسترد يُرسَل `refunded` مهما كانت حالته.
 */
function toTabbyStatus(bookingStatus: string, paymentStatus: string): TabbyOrderStatus {
  const pay = paymentStatus.trim().toUpperCase();
  if (pay === "REFUNDED" || pay === "PARTIAL_REFUND") return "refunded";

  switch (bookingStatus.trim().toUpperCase()) {
    case "NEW":
    case "UNDER_REVIEW":
      return "new";
    case "CONTACTED":
    case "CONFIRMED":
    case "PICKED_UP":
      return "processing";
    case "RETURNED":
    case "COMPLETED":
      return "complete";
    case "CANCELLED":
    case "REJECTED":
      return "canceled";
    default:
      return "unknown";
  }
}

export type TabbyOrderHistoryEntry = {
  purchased_at: string;
  amount: string;
  status: TabbyOrderStatus;
  payment_method?: "card" | "cod";
  buyer: { phone: string; email: string; name: string };
  shipping_address: { city: string; address: string; zip: string };
  items?: Array<{
    title: string;
    quantity: number;
    unit_price: string;
    ordered?: number;
    captured?: number;
  }>;
};

export type TabbyBuyerContext = {
  orderHistory: TabbyOrderHistoryEntry[];
  /** عدد الطلبات المُنجَزة فعلاً (مدفوعة وغير ملغاة) — يُرسَل كـ loyalty_level. */
  loyaltyLevel: number;
  /** تاريخ تسجيل العميل، أو تاريخ أول حجز له إن لم يكن مسجَّلاً. */
  registeredSinceIso: string | null;
};

function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

/**
 * يجمع سياق العميل من حجوزاته السابقة. الحجز الحالي مستثنى دائماً
 * (`excludeBookingId`) كما تشترط تابي.
 */
export async function buildTabbyBuyerContext(args: {
  customerId: number | null;
  phone: string;
  excludeBookingId: number;
  /** رمز بريدي احتياطي حين لا يتوفر للفرع — `zip` حقل إلزامي لدى تابي. */
  fallbackZip: string;
}): Promise<TabbyBuyerContext> {
  // الربط بالحساب أو بالجوال: الحجوزات القديمة قد تسبق إنشاء الحساب.
  const where = args.customerId
    ? { OR: [{ customerId: args.customerId }, { phone: args.phone }] }
    : { phone: args.phone };

  const rows = await prisma.bookingRequest.findMany({
    where: { ...where, id: { not: args.excludeBookingId } },
    orderBy: { createdAt: "desc" },
    take: MAX_HISTORY,
    select: {
      createdAt: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      snapshotTotalAmountSar: true,
      paidAmountSar: true,
      fullName: true,
      phone: true,
      contactEmail: true,
      numberOfDays: true,
      pickupMode: true,
      deliveryAddress: true,
      customer: { select: { email: true, createdAt: true } },
      carModel: { select: { name: true, nameEn: true, brand: { select: { name: true, nameEn: true } } } },
      pickupBranch: { select: { name: true, nameEn: true, address: true, addressEn: true, postalCode: true, city: { select: { name: true, nameEn: true } } } },
      returnBranch: { select: { name: true, nameEn: true, address: true, addressEn: true, postalCode: true, city: { select: { name: true, nameEn: true } } } },
    },
  });

  const orderHistory: TabbyOrderHistoryEntry[] = rows.map((r) => {
    const branch = r.pickupBranch ?? r.returnBranch;
    const isDelivery = r.pickupMode === "DELIVERY";
    const amount = r.snapshotTotalAmountSar ?? r.paidAmountSar ?? 0;
    const title =
      `${r.carModel?.brand?.nameEn?.trim() || r.carModel?.brand?.name || ""} ${
        r.carModel?.nameEn?.trim() || r.carModel?.name || ""
      }`.trim() || "Car Rental";

    return {
      purchased_at: r.createdAt.toISOString(),
      amount: money(amount),
      status: toTabbyStatus(r.status, r.paymentStatus),
      buyer: {
        phone: r.phone,
        email: r.contactEmail?.trim() || r.customer?.email?.trim() || "",
        name: r.fullName,
      },
      shipping_address: {
        city: branch?.city?.nameEn?.trim() || branch?.city?.name?.trim() || "",
        address:
          (isDelivery ? r.deliveryAddress?.trim() : null) ||
          branch?.addressEn?.trim() ||
          branch?.address?.trim() ||
          branch?.nameEn?.trim() ||
          branch?.name?.trim() ||
          "",
        zip: branch?.postalCode?.trim() || args.fallbackZip,
      },
      items: [
        {
          title,
          quantity: r.numberOfDays,
          unit_price: money(r.numberOfDays > 0 ? amount / r.numberOfDays : amount),
        },
      ],
    };
  });

  // «طلبات مُنجَزة بنجاح» = وصلت لحالة مكتملة ولم تُلغَ أو تُسترد.
  const loyaltyLevel = orderHistory.filter((o) => o.status === "complete").length;

  // تاريخ التسجيل، أو أقدم حجز حين لا يوجد حساب (كما اقترح Egor).
  const accountCreated = rows.find((r) => r.customer?.createdAt)?.customer?.createdAt ?? null;
  const oldestBooking = rows.length ? rows[rows.length - 1].createdAt : null;
  const registeredSince = accountCreated ?? oldestBooking;

  return {
    orderHistory,
    loyaltyLevel,
    registeredSinceIso: registeredSince ? registeredSince.toISOString() : null,
  };
}
