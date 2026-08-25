import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { requireAdminPage } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { isGeideaConfigured } from "@/lib/geidea/client";
import {
  buildGeideaPaymentsReport,
  GEIDEA_REPORT_DAY_OPTIONS,
  type GeideaPaymentRow,
} from "@/lib/geidea/orders-report";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ days?: string }> };

/**
 * البريد (أو قائمة مفصولة بفواصل) المسموح له بفتح التقرير. غيابه يقفل الصفحة
 * تماماً — لا افتراضي مفتوح.
 */
function allowedEmails(): string[] {
  return (process.env.GEIDEA_REPORT_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** بريد الموظف من قاعدة البيانات إن كان حساباً حقيقياً، وإلا بريد مدير النظام من الجلسة. */
async function sessionEmail(employeeId: number | null, displayName: string): Promise<string> {
  if (employeeId != null) {
    const row = await prisma.adminEmployee.findUnique({
      where: { id: employeeId },
      select: { email: true },
    });
    if (row?.email) return row.email.trim().toLowerCase();
  }
  return displayName.trim().toLowerCase();
}

function StatusPill({ row }: { row: GeideaPaymentRow }) {
  const s = row.detailedStatus.trim().toLowerCase();
  const tone =
    s === "paid"
      ? "bg-emerald-100 text-emerald-800"
      : s === "refunded" || s === "partiallyrefunded"
        ? "bg-sky-100 text-sky-800"
        : s === "orderfailed" || s === "failed"
          ? "bg-red-100 text-red-800"
          : "bg-amber-100 text-amber-800";
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-black ${tone}`}>
      {row.detailedStatus || row.status || "—"}
    </span>
  );
}

function money(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div
      className={`rounded-2xl border px-5 py-4 ${
        tone === "danger"
          ? "border-red-300 bg-red-50"
          : "border-outline-variant/25 bg-white"
      }`}
    >
      <p className="text-xs font-extrabold text-on-surface-variant">{label}</p>
      <p
        className={`mt-1 text-2xl font-extrabold tracking-tight ${
          tone === "danger" ? "text-red-700" : "text-on-surface"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default async function AdminGeideaPaymentsPage({ searchParams }: Props) {
  const session = await requireAdminPage();

  // بوابة إضافية فوق فحص middleware: التقرير يكشف بيانات دفع العملاء كاملةً،
  // فيُقصر على البريد المحدد في GEIDEA_REPORT_EMAIL ولو كان الفاتح مدير نظام.
  const allowed = allowedEmails();
  const email = await sessionEmail(session.employeeId, session.displayName);
  if (allowed.length === 0 || !allowed.includes(email)) {
    notFound();
  }

  const sp = await searchParams;
  const requested = Number(sp.days);
  const days = GEIDEA_REPORT_DAY_OPTIONS.includes(requested as (typeof GEIDEA_REPORT_DAY_OPTIONS)[number])
    ? requested
    : 30;

  const configured = isGeideaConfigured();
  let report: Awaited<ReturnType<typeof buildGeideaPaymentsReport>> | null = null;
  let loadError: string | null = null;
  if (configured) {
    try {
      report = await buildGeideaPaymentsReport(days);
    } catch (e) {
      loadError = e instanceof Error ? e.message : "تعذّر جلب المدفوعات من جيديا.";
    }
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="مدفوعات جيديا"
        description="سرد مباشر من بوابة جيديا ومطابقته على حجوزاتنا. جيديا مصدر حقيقة مستقل عن قاعدة بياناتنا، فأي طلب مدفوع لديها وغير مسجَّل عندنا يظهر هنا محمّراً. الصفحة للقراءة فقط ولا تعدّل أي حجز."
      />

      <nav className="flex flex-wrap items-center gap-2">
        {GEIDEA_REPORT_DAY_OPTIONS.map((d) => (
          <Link
            key={d}
            href={`/admin/geidea-payments?days=${d}`}
            className={`rounded-xl border px-4 py-2 text-sm font-extrabold transition-colors ${
              d === days
                ? "border-primary bg-primary text-white"
                : "border-outline-variant/40 bg-white text-on-surface hover:bg-surface-container"
            }`}
          >
            آخر {d} يوم
          </Link>
        ))}
        <span className="text-xs font-bold text-on-surface-variant">
          جيديا لا تتيح أبعد من ٩٠ يوماً
        </span>
      </nav>

      {!configured ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
          بوابة جيديا غير مهيّأة — أضف <code>GEIDEA_PUBLIC_KEY</code> و<code>GEIDEA_API_PASSWORD</code> في البيئة.
        </div>
      ) : null}

      {loadError ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-bold text-red-900">
          {loadError}
        </div>
      ) : null}

      {report ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile label="إجمالي الطلبات" value={String(report.totals.count)} />
            <SummaryTile
              label="مدفوعة"
              value={`${report.totals.paidCount} — ${money(report.totals.paidAmountSar)} ر.س`}
            />
            <SummaryTile label="مسترد" value={`${money(report.totals.refundedAmountSar)} ر.س`} />
            <SummaryTile
              label="مدفوع وغير مسجَّل"
              value={String(report.totals.unrecordedCount)}
              tone={report.totals.unrecordedCount > 0 ? "danger" : undefined}
            />
          </div>

          {report.totals.unrecordedCount > 0 ? (
            <div className="rounded-2xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-bold leading-relaxed text-red-900">
              ⚠️ يوجد {report.totals.unrecordedCount} طلب مدفوع لدى جيديا وحجزه ما زال غير مدفوع عندنا.
              معناه أن الإشعار (webhook) لم يصل. راجع كل صف محمّر وسجّل الدفعة يدوياً على الحجز.
            </div>
          ) : null}

          {report.windowErrors.length > 0 ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
              تعذّر جلب بعض الفترات — التقرير ناقص:
              <ul className="mt-2 list-inside list-disc font-normal">
                {report.windowErrors.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <AdminCard noPadding>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-start text-sm">
                <thead>
                  <tr className="bg-surface-container text-xs font-extrabold uppercase tracking-wide text-on-surface-variant">
                    <th className="px-4 py-3 text-start">التاريخ</th>
                    <th className="px-4 py-3 text-start">الحجز</th>
                    <th className="px-4 py-3 text-start">العميل</th>
                    <th className="px-4 py-3 text-start">المبلغ</th>
                    <th className="px-4 py-3 text-start">حالة جيديا</th>
                    <th className="px-4 py-3 text-start">عندنا</th>
                    <th className="px-4 py-3 text-start">الوسيلة</th>
                    <th className="px-4 py-3 text-start">دومين الإشعار</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-10 text-center text-sm font-bold text-on-surface-variant"
                      >
                        لا توجد طلبات في هذه الفترة.
                      </td>
                    </tr>
                  ) : (
                    report.rows.map((row) => (
                      <tr
                        key={row.orderId}
                        className={`border-t border-outline-variant/15 ${
                          row.unrecorded ? "bg-red-50" : ""
                        }`}
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-bold text-on-surface-variant">
                          {(row.createdAt ?? "").slice(0, 16).replace("T", " ") || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {row.isTestOrder ? (
                            <span className="text-xs font-bold text-on-surface-variant">اختبار</span>
                          ) : row.bookingId != null ? (
                            <Link
                              href={`/admin/bookings/${row.bookingId}`}
                              className="font-extrabold text-primary hover:underline"
                            >
                              #{row.bookingId}
                            </Link>
                          ) : (
                            <span className="text-xs font-bold text-on-surface-variant">
                              {row.merchantReferenceId ?? "—"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="block font-bold text-on-surface">
                            {row.booking?.fullName ?? row.cardholderName ?? "—"}
                          </span>
                          {row.booking?.phone ? (
                            <span className="block text-xs text-on-surface-variant">
                              {row.booking.phone}
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-extrabold text-on-surface">
                          {money(row.amount)} {row.currency}
                          {row.refundedAmount > 0 ? (
                            <span className="block text-xs font-bold text-sky-700">
                              مسترد {money(row.refundedAmount)}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill row={row} />
                        </td>
                        <td className="px-4 py-3">
                          {row.isTestOrder ? (
                            <span className="text-xs font-bold text-on-surface-variant">—</span>
                          ) : row.booking ? (
                            <span
                              className={`text-xs font-black ${
                                row.unrecorded ? "text-red-700" : "text-on-surface-variant"
                              }`}
                            >
                              {row.booking.paymentStatus}
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-amber-700">حجز غير موجود</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs font-bold text-on-surface-variant">
                          {row.paymentBrand ?? "—"}
                          {row.maskedCard ? (
                            <span className="block opacity-70">{row.maskedCard}</span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-on-surface-variant">
                          {row.callbackHost ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </AdminCard>
        </>
      ) : null}
    </div>
  );
}
