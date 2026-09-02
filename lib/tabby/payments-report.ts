import "server-only";
import { getTabbyConfig } from "@/lib/tabby/client";
import { prisma } from "@/lib/prisma";

/**
 * تقرير مدفوعات تابي: يسرد الدفعات من البوابة مباشرةً ثم يطابقها على حجوزاتنا.
 * نفس فكرة تقرير جيديا (lib/geidea/orders-report.ts) — البوابة مصدر حقيقة مستقل
 * عن قاعدتنا، فأي دفعة مكتملة لديها وغير مسجَّلة عندنا تعني دفعة وصلت ولم
 * يلتقطها الـ webhook.
 *
 * للقراءة فقط: لا يعدّل أي حجز. التصحيح يبقى قراراً يدوياً.
 */

/** حد الصفحة الأقصى الذي تفرضه تابي — تجاوزه يُقتَص تلقائياً بلا خطأ. */
const PAGE_LIMIT = 20;
/** سقف أمان يمنع حلقة لا نهائية لو أعادت تابي total_count كبيراً بشكل غير متوقَّع. */
const MAX_PAGES = 100;

export const TABBY_REPORT_MAX_DAYS = 90;
export const TABBY_REPORT_DAY_OPTIONS = [7, 30, 60, 90] as const;

type RawRefund = { amount?: string | number; status?: string };
type RawPayment = {
  id?: string;
  created_at?: string;
  status?: string;
  amount?: string | number;
  currency?: string;
  buyer?: { name?: string; email?: string; phone?: string } | null;
  order?: { reference_id?: string } | null;
  refunds?: RawRefund[];
};

export type TabbyPaymentRow = {
  paymentId: string;
  createdAt: string | null;
  amount: number;
  currency: string;
  status: string;
  referenceId: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
  refundedAmount: number;
  isPaid: boolean;
  bookingId: number | null;
  /** طلب من أداة /admin/test-tabby بمرجع booking-0-… لا يخص عميلاً. */
  isTestOrder: boolean;
  booking: {
    id: number;
    paymentStatus: string;
    fullName: string;
    phone: string;
    snapshotTotalAmountSar: number | null;
  } | null;
  /** مدفوع (CLOSED) لدى تابي وغير مسجَّل مدفوعاً عندنا — يستدعي تدخّلاً فورياً. */
  unrecorded: boolean;
};

export type TabbyPaymentsReport = {
  rows: TabbyPaymentRow[];
  totals: {
    count: number;
    paidCount: number;
    paidAmountSar: number;
    refundedAmountSar: number;
    unrecordedCount: number;
  };
};

/** رقم الحجز من reference_id بصيغة booking-{id}-{ts}؛ booking-0-… أداة اختبار. */
function bookingIdFromReference(ref: string | null): number | null {
  const m = /^booking-(\d+)-\d+$/.exec(ref ?? "");
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isInteger(id) && id >= 1 ? id : null;
}

function summarize(p: RawPayment): Omit<TabbyPaymentRow, "booking" | "unrecorded"> {
  const status = (p.status ?? "").trim().toUpperCase();
  const currency = (p.currency ?? "").trim().toUpperCase();
  const amount = Number(p.amount ?? 0);
  const ref = p.order?.reference_id ?? null;
  const refundedAmount = (p.refunds ?? [])
    .filter((r) => (r.status ?? "").trim().toLowerCase() !== "failed")
    .reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

  return {
    paymentId: p.id ?? "",
    createdAt: p.created_at ?? null,
    amount,
    currency,
    status,
    referenceId: ref,
    buyerName: p.buyer?.name?.trim() || null,
    buyerPhone: p.buyer?.phone?.trim() || null,
    refundedAmount,
    // نفس معيار isTabbyPaymentAuthorized في mark-paid.ts: CLOSED يعني تحصيل فعلي.
    isPaid: status === "CLOSED" && currency === "SAR" && amount > 0,
    bookingId: bookingIdFromReference(ref),
    isTestOrder: /^booking-0-\d+$/.test(ref ?? ""),
  };
}

async function fetchPaymentsPage(
  cfg: NonNullable<ReturnType<typeof getTabbyConfig>>,
  query: string,
): Promise<{ payments: RawPayment[]; totalCount: number }> {
  const res = await fetch(`${cfg.apiBase}/api/v2/payments${query}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.secretKey}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    payments?: RawPayment[];
    pagination?: { total_count?: number };
  };
  return { payments: data.payments ?? [], totalCount: data.pagination?.total_count ?? 0 };
}

/**
 * يبني التقرير لآخر `days` يوماً (بلا حد أقصى موثَّق من تابي، نُبقيه لأسباب أداء).
 *
 * لا فلترة بالتاريخ من طرف تابي: `created_at__gte` مش باراميتر مدعوم فعلياً —
 * تحقّقنا بنداء مباشر: بدونه ترجع تابي الدفعات الحقيقية، وبيه ترجع صفر نتائج
 * دايماً (فلترة صامتة بلا خطأ). الفلترة هنا يدوية على الصفحة المجلوبة، ونتوقف
 * عن طلب صفحات جديدة أول ما نعدّي حد التاريخ — النتائج مرتبة الأحدث أولاً.
 */
export async function buildTabbyPaymentsReport(days: number): Promise<TabbyPaymentsReport> {
  const cfg = getTabbyConfig();
  if (!cfg) throw new Error("بوابة تابي غير مهيّأة — أضف مفاتيح البيئة.");

  const span = Math.min(Math.max(Math.round(days), 1), TABBY_REPORT_MAX_DAYS);
  const from = new Date(Date.now() - span * 86_400_000);

  const all: RawPayment[] = [];
  let offset = 0;
  pageLoop: for (let page = 0; page < MAX_PAGES; page++) {
    const query = `?limit=${PAGE_LIMIT}&offset=${offset}`;
    const { payments, totalCount } = await fetchPaymentsPage(cfg, query);
    for (const p of payments) {
      const createdAt = p.created_at ? new Date(p.created_at) : null;
      if (createdAt && createdAt < from) break pageLoop;
      all.push(p);
    }
    offset += PAGE_LIMIT;
    if (offset >= totalCount || payments.length === 0) break;
  }

  const summaries = all
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

  const rows: TabbyPaymentRow[] = summaries.map((s) => {
    const booking = s.bookingId != null ? (bookingById.get(s.bookingId) ?? null) : null;
    const recorded = booking != null && booking.paymentStatus.trim().toUpperCase() !== "PENDING";
    return {
      ...s,
      booking,
      unrecorded: s.isPaid && !s.isTestOrder && s.bookingId != null && !recorded,
    };
  });

  return {
    rows,
    totals: {
      count: rows.length,
      paidCount: rows.filter((r) => r.isPaid).length,
      paidAmountSar: rows.filter((r) => r.isPaid).reduce((sum, r) => sum + r.amount, 0),
      refundedAmountSar: rows.reduce((sum, r) => sum + r.refundedAmount, 0),
      unrecordedCount: rows.filter((r) => r.unrecorded).length,
    },
  };
}
