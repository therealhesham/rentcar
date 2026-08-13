import { prisma } from "@/lib/prisma";
import { BOOKING_EVENTS } from "@/lib/booking-audit";
import { sendPlainTransactionalEmail } from "@/lib/booking-invoice-email";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
import { absoluteUrl } from "@/lib/seo";
import { EMAIL_RESPONSIVE_CSS } from "@/lib/email-layout";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString("ar-SA", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type PaymentSummary = {
  /** حالة الدفع كنص عربي جاهز للعرض. */
  statusLabel: string;
  /** المبلغ المدفوع فعلاً (شامل الضريبة)، أو null إن لم يُسدَّد شيء. */
  paidSar: number | null;
  /** المتبقي على العميل، أو null إن لا يوجد متبقٍ. */
  remainingSar: number | null;
};

/**
 * ملخّص الدفع للإيميل: مدفوع بالكامل يعني وصلت قيمة الحجز (snapshotTotalAmountSar)
 * ولا يوجد فرق مستحق عند الفرع. الفروق أقل من هللة تُتجاهل لتفادي فروق الفاصلة العشرية.
 */
function paymentSummary(row: {
  paymentStatus: string;
  paidAmountSar: number | null;
  snapshotTotalAmountSar: number | null;
  balanceDueAtBranchSar: number | null;
}): PaymentSummary {
  const paid = row.paidAmountSar ?? 0;
  const total = row.snapshotTotalAmountSar;
  const balanceDue = row.balanceDueAtBranchSar ?? 0;
  const shortfall = total != null ? total - paid : 0;
  const remaining = Math.max(balanceDue, shortfall);

  const paidSar = paid > 0 ? paid : null;
  const remainingSar = remaining > 0.01 ? remaining : null;

  const status = row.paymentStatus.trim().toUpperCase();
  if (status === "REFUNDED") {
    return { statusLabel: "مسترد بالكامل", paidSar, remainingSar: null };
  }
  if (status === "PARTIAL_REFUND") {
    return { statusLabel: "مسترد جزئياً", paidSar, remainingSar: null };
  }
  if (paidSar == null) {
    return { statusLabel: "غير مدفوع", paidSar: null, remainingSar };
  }
  return {
    statusLabel: remainingSar == null ? "مدفوع بالكامل" : "مدفوع جزئياً",
    paidSar,
    remainingSar,
  };
}

export function buildNotificationHtml(row: {
  id: number;
  kind: string;
  fullName: string;
  phone: string;
  carType: string;
  carModel: { name: string; brand: { name: string } } | null;
  branchLabel: string;
  pickupDate: Date;
  numberOfDays: number;
  paymentStatus: string;
  paymentMethod: string | null;
  paidAmountSar: number | null;
  snapshotTotalAmountSar: number | null;
  balanceDueAtBranchSar: number | null;
}): string {
  const kindLabel = row.kind === "DIRECT" ? "حجز مباشر" : "طلب استفسار";
  const carLabel = row.carModel ? `${row.carModel.brand.name} ${row.carModel.name}` : row.carType;
  const rowStyle =
    "padding:14px 20px; border-bottom:1px solid #f0f0f0; color:#4b5563; font-size:14px;";
  const valStyle =
    "padding:14px 20px; border-bottom:1px solid #f0f0f0; text-align:left; font-weight:600; color:#111827; font-size:15px;";

  const pay = paymentSummary(row);

  // ltr للأرقام والتواريخ فقط؛ النصوص العربية تُترك على اتجاه الرسالة لتفادي خلط الاتجاهات.
  const rows: Array<[string, string, boolean]> = [
    ["اسم العميل", row.fullName, true],
    ["الجوال", row.phone, true],
    ["الفرع", row.branchLabel, true],
    ["السيارة", carLabel, true],
    ["تاريخ الاستلام", fmtDateTime(row.pickupDate), true],
    ["عدد الأيام", String(row.numberOfDays), true],
    ["حالة الدفع", pay.statusLabel, false],
    ["المبلغ المدفوع", pay.paidSar != null ? `${fmtMoney(pay.paidSar)} ر.س` : "—", true],
    ...(pay.remainingSar != null
      ? ([["المتبقي", `${fmtMoney(pay.remainingSar)} ر.س`, true]] as Array<[string, string, boolean]>)
      : []),
    ["طريقة الدفع", bookingPaymentMethodLabelAr(row.paymentMethod), false],
  ];

  const rowsHtml = rows
    .map(
      ([label, value, ltr]) =>
        `<tr><td class="em-cell" style="${rowStyle}">${escapeHtml(label)}</td><td${ltr ? ' dir="ltr"' : ""} class="em-val" style="${valStyle}">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
${EMAIL_RESPONSIVE_CSS}
  </style>
</head>
<body class="em-outer" style="margin:0;padding:40px 20px;background:#f3f4f6;font-family:'Tajawal',Tahoma,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-card" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.08);border:1px solid #e5e7eb;margin:0 auto;">
      <tr><td class="em-head" style="background:linear-gradient(135deg, #003749 0%, #001f29 100%);padding:36px 32px;text-align:center;">
        <h2 class="em-brand" style="margin:0;color:#dfb163;font-size:24px;font-weight:800;">روائس لتأجير السيارات</h2>
        <p style="margin:16px 0 0;font-size:20px;font-weight:800;color:#ffffff;">${escapeHtml(kindLabel)} جديد</p>
        <p style="margin:6px 0 0;font-size:14px;color:#cbd5e1;">رقم المرجع: <span dir="ltr" style="font-family:monospace;">#${row.id}</span></p>
      </td></tr>
      <tr><td class="em-body" style="padding:32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          ${rowsHtml}
        </table>
        ${
          row.kind === "DIRECT"
            ? `<p style="margin-top:24px;text-align:center;"><a href="${escapeHtml(absoluteUrl(`/admin/bookings/${row.id}`))}" style="display:inline-block;background:#003749;color:#dfb163;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;">فتح الحجز في لوحة التحكم</a></p>`
            : ""
        }
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;
}

function buildNotificationText(row: {
  id: number;
  kind: string;
  fullName: string;
  phone: string;
  paymentStatus: string;
  paymentMethod: string | null;
  paidAmountSar: number | null;
  snapshotTotalAmountSar: number | null;
  balanceDueAtBranchSar: number | null;
}): string {
  const kindLabel = row.kind === "DIRECT" ? "حجز مباشر" : "طلب استفسار";
  const pay = paymentSummary(row);
  return [
    `${kindLabel} جديد — طلب رقم #${row.id}`,
    `العميل: ${row.fullName}`,
    `الجوال: ${row.phone}`,
    `حالة الدفع: ${pay.statusLabel}`,
    `المبلغ المدفوع: ${pay.paidSar != null ? `${fmtMoney(pay.paidSar)} ر.س` : "—"}`,
    ...(pay.remainingSar != null ? [`المتبقي: ${fmtMoney(pay.remainingSar)} ر.س`] : []),
    `طريقة الدفع: ${bookingPaymentMethodLabelAr(row.paymentMethod)}`,
  ].join("\n");
}

/** حدث في BookingLog يمثّل «تم إرسال إيميل الموظفين» — يمنع التكرار بين مسارات الإنشاء وتأكيد الدفع. */
const STAFF_NOTIFY_EVENT = BOOKING_EVENTS.STAFF_BOOKING_EMAIL_SENT;

/**
 * حجز مباشر لسه مستني العميل يختار وسيلة الدفع (وسيلة فاضية + غير مدفوع).
 * في الحالة دي الإشعار يتأجَّل: لو اتبعت الآن هيوصل للموظف مكتوب فيه «غير مدفوع»
 * حتى لو العميل أكمل الدفع بعدها بثوانٍ.
 */
function isAwaitingPaymentChoice(row: {
  kind: string;
  paymentStatus: string;
  paymentMethod: string | null;
}): boolean {
  return (
    row.kind === "DIRECT" &&
    row.paymentStatus.trim().toUpperCase() === "PENDING" &&
    !row.paymentMethod?.trim()
  );
}

/**
 * يحجز حقّ الإرسال لهذا الحجز مرة واحدة. يسجّل العلامة قبل الإرسال حتى لا يسبق
 * استدعاءان متوازيان بعضهما (webhook + مصالحة صفحة الدفع مثلاً).
 */
async function claimStaffNotification(bookingRequestId: number): Promise<boolean> {
  const existing = await prisma.bookingLog.findFirst({
    where: { bookingId: bookingRequestId, event: STAFF_NOTIFY_EVENT },
    select: { id: true },
  });
  if (existing) return false;
  await prisma.bookingLog.create({
    data: {
      bookingId: bookingRequestId,
      event: STAFF_NOTIFY_EVENT,
      actorKind: "SYSTEM",
      actorName: "System",
    },
  });
  return true;
}

/**
 * يرسل إيميل تنبيه الموظفين مرة واحدة لكل حجز، عند استقرار نتيجة الدفع:
 * فوراً للاستفسارات وللحجوزات اللي وسيلة دفعها محسومة (كاش/مسجَّلة من الفرع)،
 * ومؤجَّلاً للحجوزات الإلكترونية حتى تأكيد الدفع (جيديا أو تسجيل الإدارة).
 * الاستدعاء المتكرر آمن — العلامة في BookingLog تمنع التكرار.
 *
 * مستلمو TO (كل تطابق يُضاف، بلا استبعاد بينها):
 * موظف الفرع نفسه (branchId) + مشرف مدينة الفرع (cityId) + مَن مفعِّل TO عام
 * (notifyGlobalTo، مثل مشرف العمليات). مستلمو CC: مَن مفعِّل CC عام (notifyGlobalCc،
 * مثل المحاسب/المدير المالي) — يُستثنى مَن هو أصلاً في TO لتفادي التكرار.
 * لو مفيش أي TO (فرع بلا موظف ولا مدينة ولا TO عام)، تُرسَل الرسالة لمستلمي CC وحدهم.
 * لا يرمي أي خطأ للخارج (فشل الإرسال ما يفشّلش تسجيل الحجز نفسه).
 */
export async function sendNewBookingNotificationEmails(bookingRequestId: number): Promise<void> {
  try {
    const row = await prisma.bookingRequest.findUnique({
      where: { id: bookingRequestId },
      select: {
        id: true,
        kind: true,
        fullName: true,
        phone: true,
        carType: true,
        carModel: { select: { name: true, brand: { select: { name: true } } } },
        pickupDate: true,
        numberOfDays: true,
        paymentStatus: true,
        paymentMethod: true,
        paidAmountSar: true,
        snapshotTotalAmountSar: true,
        balanceDueAtBranchSar: true,
        branchId: true,
        returnBranchId: true,
        pickupBranch: { select: { name: true, cityId: true } },
        returnBranch: { select: { name: true, cityId: true } },
      },
    });
    if (!row) return;
    if (isAwaitingPaymentChoice(row)) return;

    const targetBranchId = row.branchId ?? row.returnBranchId;
    const targetCityId = row.pickupBranch?.cityId ?? row.returnBranch?.cityId ?? null;
    const branchLabel =
      row.pickupBranch?.name?.trim() || row.returnBranch?.name?.trim() || "—";

    const employees = await prisma.adminEmployee.findMany({
      where: { isActive: true, notifyOnBookingEmail: true },
      select: { email: true, branchId: true, cityId: true, notifyGlobalTo: true, notifyGlobalCc: true },
    });
    const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

    const toSet = new Set<string>();
    const ccSet = new Set<string>();
    for (const e of employees) {
      const email = e.email.trim();
      if (!isValidEmail(email)) continue;
      const isToBranch = targetBranchId != null && e.branchId === targetBranchId;
      const isToCity = targetCityId != null && e.cityId === targetCityId;
      if (isToBranch || isToCity || e.notifyGlobalTo) toSet.add(email);
      else if (e.notifyGlobalCc) ccSet.add(email);
    }
    for (const email of toSet) ccSet.delete(email);

    // لو مفيش TO خالص (نادر — يعني notifyGlobalTo متعطّل عند الكل)، نرسل لمستلمي CC كـ TO
    // بدل حقل To فارغ (بعض بوابات الإيميل ترفضه).
    const to = toSet.size > 0 ? [...toSet] : [...ccSet];
    const cc = toSet.size > 0 ? [...ccSet] : [];
    if (to.length === 0) return;

    // الحجز بعد تحديد المستلمين مباشرةً: لو مفيش مستلمين أصلاً نسيب الباب مفتوح
    // لإعادة المحاولة بعد ضبط إعدادات الموظفين.
    if (!(await claimStaffNotification(bookingRequestId))) return;

    const html = buildNotificationHtml({ ...row, branchLabel });
    const text = buildNotificationText(row);
    const kindLabel = row.kind === "DIRECT" ? "حجز مباشر" : "طلب استفسار";

    await sendPlainTransactionalEmail({
      to: to.join(","),
      cc: cc.length > 0 ? cc.join(",") : undefined,
      subject: `${kindLabel} جديد — ${branchLabel} — #${row.id}`,
      html,
      text,
    });
  } catch (e) {
    console.error("[booking-notification-email] فشل إرسال إشعار الحجز:", e);
  }
}
