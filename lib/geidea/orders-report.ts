import "server-only";
import { getGeideaConfig } from "@/lib/geidea/client";
import { prisma } from "@/lib/prisma";

/**
 * تقرير مدفوعات جيديا: يسرد الطلبات من البوابة مباشرةً ثم يطابقها على حجوزاتنا.
 * القيمة الأساسية أن جيديا مصدر حقيقة مستقل عن قاعدتنا — فأي طلب مدفوع لديها
 * وغير مسجَّل عندنا يعني دفعة وصلت ولم يلتقطها الـ webhook.
 *
 * للقراءة فقط: لا يعدّل أي حجز. التصحيح يبقى قراراً يدوياً.
 */

/** حدّان تفرضهما جيديا على سرد الطلبات — تجاوز أيّهما يعيد HTTP 400. */
const LIST_MAX_WINDOW_DAYS = 30;
export const GEIDEA_REPORT_MAX_DAYS = 90;
export const GEIDEA_REPORT_DAY_OPTIONS = [7, 30, 60, 90] as const;

type RawPaymentMethod = {
  type?: string;
  brand?: string;
  wallet?: string | null;
  cardholderName?: string | null;
  maskedCardNumber?: string | null;
};

type RawOrder = {
  orderId?: string;
  createdDate?: string;
  status?: string;
  detailedStatus?: string;
  amount?: number;
  totalAmount?: number;
  totalRefundedAmount?: number | null;
  currency?: string;
  merchantReferenceId?: string;
  callbackUrl?: string | null;
  paymentMethod?: RawPaymentMethod | null;
  transactions?: Array<{
    type?: string;
    status?: string;
    amount?: number;
    paymentMethod?: RawPaymentMethod | null;
  }>;
};

export type GeideaPaymentRow = {
  orderId: string;
  createdAt: string | null;
  amount: number;
  currency: string;
  status: string;
  detailedStatus: string;
  merchantReferenceId: string | null;
  /** دومين الإشعار وقت إنشاء الجلسة — سجلّ تاريخي لقيمة APP_PUBLIC_URL آنذاك. */
  callbackHost: string | null;
  paymentBrand: string | null;
  cardholderName: string | null;
  maskedCard: string | null;
  refundedAmount: number;
  isPaid: boolean;
  bookingId: number | null;
  /** طلب من أداة /admin/test-geidea بمرجع booking-0-… لا يخص عميلاً. */
  isTestOrder: boolean;
  booking: {
    id: number;
    paymentStatus: string;
    fullName: string;
    phone: string;
    snapshotTotalAmountSar: number | null;
  } | null;
  /** مدفوع لدى جيديا وغير مسجَّل مدفوعاً عندنا — يستدعي تدخّلاً فورياً. */
  unrecorded: boolean;
};

export type GeideaPaymentsReport = {
  rows: GeideaPaymentRow[];
  /** نافذة زمنية فشل جلبها — الباقي صالح، لكن التقرير ناقص. */
  windowErrors: string[];
  totals: {
    count: number;
    paidCount: number;
    paidAmountSar: number;
    refundedAmountSar: number;
    unrecordedCount: number;
  };
};

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** رقم الحجز من merchantReferenceId بصيغة booking-{id}-{ts}؛ booking-0-… أداة اختبار. */
function bookingIdFromReference(ref: string | null): number | null {
  const m = /^booking-(\d+)-\d+$/.exec(ref ?? "");
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isInteger(id) && id >= 1 ? id : null;
}

function summarize(o: RawOrder): Omit<GeideaPaymentRow, "booking" | "unrecorded"> {
  const txs = o.transactions ?? [];
  // وسيلة الدفع تأتي داخل المعاملة في السرد، وعلى الطلب نفسه في الجلب المفرد.
  const pm = txs.find((t) => t.paymentMethod)?.paymentMethod ?? o.paymentMethod ?? null;
  const computedRefund = txs
    .filter(
      (t) =>
        String(t.type ?? "").toLowerCase() === "refund" &&
        String(t.status ?? "").toLowerCase() === "success",
    )
    .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);

  const detailedStatus = o.detailedStatus ?? "";
  const currency = o.currency ?? "";
  const amount = Number(o.totalAmount ?? o.amount ?? 0);
  const ref = o.merchantReferenceId ?? null;

  return {
    orderId: o.orderId ?? "",
    createdAt: o.createdDate ?? null,
    amount,
    currency,
    status: o.status ?? "",
    detailedStatus,
    merchantReferenceId: ref,
    callbackHost: hostOf(o.callbackUrl),
    paymentBrand: pm?.wallet?.trim() || pm?.brand?.trim() || pm?.type?.trim() || null,
    cardholderName: pm?.cardholderName?.trim() || null,
    maskedCard: pm?.maskedCardNumber?.trim() || null,
    refundedAmount: Number(o.totalRefundedAmount ?? computedRefund),
    // نفس معيار isGeideaOrderPaid في mark-paid.ts حتى لا يختلف التقرير عن قرار التسجيل.
    isPaid:
      detailedStatus.trim().toLowerCase() === "paid" &&
      currency.trim().toUpperCase() === "SAR" &&
      amount > 0,
    bookingId: bookingIdFromReference(ref),
    isTestOrder: /^booking-0-\d+$/.test(ref ?? ""),
  };
}

async function fetchOrdersPage(
  cfg: NonNullable<ReturnType<typeof getGeideaConfig>>,
  query: string,
): Promise<RawOrder[]> {
  const res = await fetch(`${cfg.apiBase}/pgw/api/v1/direct/order${query}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${cfg.publicKey}:${cfg.apiPassword}`).toString("base64")}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { orders?: RawOrder[] };
  return data.orders ?? [];
}

/**
 * يبني التقرير لآخر `days` يوماً. المدى يُقطَّع إلى نوافذ ٣٠ يوماً لأن جيديا ترفض
 * ما هو أوسع، وفشل نافذة لا يُسقط الباقي.
 */
export async function buildGeideaPaymentsReport(days: number): Promise<GeideaPaymentsReport> {
  const cfg = getGeideaConfig();
  if (!cfg) throw new Error("بوابة جيديا غير مهيّأة — أضف مفاتيح البيئة.");

  const span = Math.min(Math.max(Math.round(days), 1), GEIDEA_REPORT_MAX_DAYS);
  const hardStart = new Date(Date.now() - span * 86_400_000);
  const windowErrors: string[] = [];
  const byId = new Map<string, RawOrder>();

  let windowEnd = new Date();
  while (windowEnd.getTime() > hardStart.getTime()) {
    const windowStart = new Date(
      Math.max(hardStart.getTime(), windowEnd.getTime() - LIST_MAX_WINDOW_DAYS * 86_400_000),
    );

    let skip = 0;
    for (;;) {
      const query = `?Take=100&Skip=${skip}&FromDate=${dateOnly(windowStart)}&ToDate=${dateOnly(windowEnd)}`;
      let batch: RawOrder[];
      try {
        batch = await fetchOrdersPage(cfg, query);
      } catch (e) {
        windowErrors.push(
          `${dateOnly(windowStart)} → ${dateOnly(windowEnd)}: ${e instanceof Error ? e.message : String(e)}`,
        );
        break;
      }
      for (const o of batch) {
        if (o.orderId) byId.set(o.orderId, o);
      }
      if (batch.length < 100) break;
      skip += 100;
    }

    windowEnd = new Date(windowStart.getTime() - 86_400_000);
  }

  const summaries = [...byId.values()]
    .map(summarize)
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));

  const bookingIds = [...new Set(summaries.map((s) => s.bookingId).filter((id): id is number => id != null))];
  const bookings = bookingIds.length
    ? await prisma.bookingRequest.findMany({
        where: { id: { in: bookingIds } },
        select: {
          id: true,
          paymentStatus: true,
          fullName: true,
          phone: true,
          snapshotTotalAmountSar: true,
        },
      })
    : [];
  const bookingById = new Map(bookings.map((b) => [b.id, b]));

  const rows: GeideaPaymentRow[] = summaries.map((s) => {
    const booking = s.bookingId != null ? (bookingById.get(s.bookingId) ?? null) : null;
    // الاسترداد يعيد paymentStatus إلى REFUNDED، فوجوده يعني أن الدفعة سُجّلت أصلاً.
    const recorded =
      booking != null && booking.paymentStatus.trim().toUpperCase() !== "PENDING";
    return {
      ...s,
      booking,
      unrecorded: s.isPaid && !s.isTestOrder && s.bookingId != null && !recorded,
    };
  });

  return {
    rows,
    windowErrors,
    totals: {
      count: rows.length,
      paidCount: rows.filter((r) => r.isPaid).length,
      paidAmountSar: rows.filter((r) => r.isPaid).reduce((sum, r) => sum + r.amount, 0),
      refundedAmountSar: rows.reduce((sum, r) => sum + r.refundedAmount, 0),
      unrecordedCount: rows.filter((r) => r.unrecorded).length,
    },
  };
}
