import { prisma } from "@/lib/prisma";
import { sendPlainTransactionalEmail } from "@/lib/booking-invoice-email";
import { absoluteUrl } from "@/lib/seo";

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

function buildNotificationHtml(row: {
  id: number;
  kind: string;
  fullName: string;
  phone: string;
  carType: string;
  carModel: { name: string; brand: { name: string } } | null;
  branchLabel: string;
  pickupDate: Date;
  numberOfDays: number;
}): string {
  const kindLabel = row.kind === "DIRECT" ? "حجز مباشر" : "طلب استفسار";
  const carLabel = row.carModel ? `${row.carModel.brand.name} ${row.carModel.name}` : row.carType;
  const rowStyle =
    "padding:14px 20px; border-bottom:1px solid #f0f0f0; color:#4b5563; font-size:14px;";
  const valStyle =
    "padding:14px 20px; border-bottom:1px solid #f0f0f0; text-align:left; font-weight:600; color:#111827; font-size:15px;";

  const rows = [
    ["اسم العميل", row.fullName],
    ["الجوال", row.phone],
    ["الفرع", row.branchLabel],
    ["السيارة", carLabel],
    ["تاريخ الاستلام", fmtDateTime(row.pickupDate)],
    ["عدد الأيام", String(row.numberOfDays)],
  ]
    .map(
      ([label, value]) =>
        `<tr><td style="${rowStyle}">${escapeHtml(label)}</td><td dir="ltr" style="${valStyle}">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width"/>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
  </style>
</head>
<body style="margin:0;padding:40px 20px;background:#f3f4f6;font-family:'Cairo',Tahoma,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.08);border:1px solid #e5e7eb;margin:0 auto;">
      <tr><td style="background:linear-gradient(135deg, #003749 0%, #001f29 100%);padding:36px 32px;text-align:center;">
        <h2 style="margin:0;color:#dfb163;font-size:24px;font-weight:800;">روائس</h2>
        <p style="margin:16px 0 0;font-size:20px;font-weight:800;color:#ffffff;">${escapeHtml(kindLabel)} جديد</p>
        <p style="margin:6px 0 0;font-size:14px;color:#cbd5e1;">رقم المرجع: <span dir="ltr" style="font-family:monospace;">#${row.id}</span></p>
      </td></tr>
      <tr><td style="padding:32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          ${rows}
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
}): string {
  const kindLabel = row.kind === "DIRECT" ? "حجز مباشر" : "طلب استفسار";
  return [`${kindLabel} جديد — طلب رقم #${row.id}`, `العميل: ${row.fullName}`, `الجوال: ${row.phone}`].join("\n");
}

/**
 * يرسل إيميل تنبيه عند حجز جديد: لموظف الفرع (branchId مطابق) وCC لموظفي الإدارة
 * المركزية (branchId فارغ) — فقط للموظفين المفعّلين اللي اختاروا notifyOnBookingEmail.
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
        branchId: true,
        returnBranchId: true,
        pickupBranch: { select: { name: true } },
        returnBranch: { select: { name: true } },
      },
    });
    if (!row) return;

    const targetBranchId = row.branchId ?? row.returnBranchId;
    const branchLabel =
      row.pickupBranch?.name?.trim() || row.returnBranch?.name?.trim() || "—";

    const employees = await prisma.adminEmployee.findMany({
      where: { isActive: true, notifyOnBookingEmail: true },
      select: { email: true, branchId: true },
    });
    const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    const branchEmails = employees
      .filter((e) => targetBranchId != null && e.branchId === targetBranchId)
      .map((e) => e.email.trim())
      .filter(isValidEmail);
    const hqEmails = employees
      .filter((e) => e.branchId == null)
      .map((e) => e.email.trim())
      .filter(isValidEmail);

    const to = branchEmails.length > 0 ? branchEmails : hqEmails;
    const cc = branchEmails.length > 0 ? hqEmails : [];
    if (to.length === 0) return;

    const html = buildNotificationHtml({ ...row, branchLabel });
    const text = buildNotificationText(row);
    const kindLabel = row.kind === "DIRECT" ? "حجز مباشر" : "طلب استفسار";

    await sendPlainTransactionalEmail({
      to: [...new Set(to)].join(","),
      cc: cc.length > 0 ? [...new Set(cc)].join(",") : undefined,
      subject: `${kindLabel} جديد — ${branchLabel} — #${row.id}`,
      html,
      text,
    });
  } catch (e) {
    console.error("[booking-notification-email] فشل إرسال إشعار الحجز:", e);
  }
}
