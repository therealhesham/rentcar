/**
 * أثر التدقيق وإشعارات الحد الأدنى للسعر.
 *
 * يُستدعى فقط لمّا تُلغي الأرضية جزءاً من الخصم فعلياً — أي العميل دفع الحد
 * الأدنى بدل الخصم الأعمق. ثلاث قنوات:
 *   1. `BookingLog` بحدث `MIN_PRICE_FLOOR_APPLIED` (أثر دائم للتدقيق).
 *   2. إشعار داخلي في لوحة التحكم (سوبر أدمن + موظفو الفرع).
 *   3. إيميل لفريق المحاسبة/الإشراف (مستلمو `notifyGlobalCc` و`notifyGlobalTo`).
 *
 * لا يرمي أي خطأ للخارج — فشل التسجيل أو الإشعار ما يفشّلش الحجز نفسه.
 */
import { prisma } from "@/lib/prisma";
import { BOOKING_EVENTS, logBookingEvent } from "@/lib/booking-audit";
import { createNotification } from "@/lib/notification-service";
import { sendPlainTransactionalEmail } from "@/lib/booking-invoice-email";

export type MinPriceFloorAuditInput = {
  bookingId: number;
  branchId: number | null;
  /** وصف السيارة للعرض في الإشعار (مثلاً «تويوتا كامري 2024»). */
  carLabel: string;
  periodKind: "DAILY" | "MONTHLY";
  /** السعر اليومي الأساسي قبل الخصم (دون ضريبة). */
  basePricePerDayExclTax: number;
  /** السعر اليومي بعد الخصم وقبل الأرضية (دون ضريبة). */
  discountedPricePerDayExclTax: number;
  /** الأرضية كمكافئ يومي (دون ضريبة). */
  floorPerDayExclTax: number;
  /** السعر اليومي النهائي المُطبَّق (دون ضريبة). */
  finalPricePerDayExclTax: number;
  /** المبلغ المحجوب من الخصم لكامل المدة (دون ضريبة). */
  withheldDiscountExclTax: number;
  days: number;
  /** مصدر الخصم المقصوص: كود خصم أو خصم تلقائي. */
  discountSource: { kind: "COUPON"; code: string } | { kind: "RENTAL_DISCOUNT" };
  /** الأرضية أعلى من السعر الأساسي — خطأ إعداد يستوجب تصحيح. */
  floorExceedsBasePrice?: boolean;
};

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function periodLabelAr(kind: "DAILY" | "MONTHLY"): string {
  return kind === "MONTHLY" ? "شهري" : "يومي";
}

function discountSourceLabelAr(src: MinPriceFloorAuditInput["discountSource"]): string {
  return src.kind === "COUPON" ? `كود الخصم ${src.code}` : "الخصم التلقائي";
}

/**
 * صياغة الحدث بترتيب ما حصل فعلاً: الخصم اتطبّق ← نزل تحت الحد الأدنى المسجّل
 * ← اتطبّق الحد الأدنى بدلاً منه. الصياغة القديمة («الحد الأدنى تجاوز الخصم»)
 * كانت مقلوبة وغير مفهومة لفريق المحاسبة.
 */
function buildFloorExplanationAr(input: MinPriceFloorAuditInput): string {
  const sourceAr = discountSourceLabelAr(input.discountSource);
  const isMonthly = input.periodKind === "MONTHLY";

  // الشهري يُصاغ بإجمالي الشهر مباشرةً — المحاسبة بتتعامل بالإجمالي، والمكافئ
  // اليومي (شهري ÷ أيام) رقم داخلي للحساب مش رقم تواصل.
  const subjectAr = isMonthly ? "بإجمالي الشهر" : "بالسعر اليومي";
  // «إجمالي الشهر» في صدر الجملة يغني عن لاحقة الوحدة، بخلاف جدول الإيميل.
  const unitAr = isMonthly ? "ر.س" : "ر.س/يوم";
  const scale = isMonthly ? input.days : 1;
  const discountedAmount = input.discountedPricePerDayExclTax * scale;
  const floorAmount = input.floorPerDayExclTax * scale;

  return (
    `تم تطبيق ${sourceAr} على هذا الحجز، وكان سينزل ${subjectAr} إلى ` +
    `${fmt(discountedAmount)} ${unitAr}. ` +
    `وبما أن الخصم تجاوز الحد الأدنى المسجّل في قاعدة البيانات ` +
    `(${fmt(floorAmount)} ${unitAr})، تم تطبيق الحد الأدنى بدلاً من الخصم. ` +
    `قيمة الخصم المحجوبة: ${fmt(input.withheldDiscountExclTax)} ر.س لكامل المدة (دون ضريبة).`
  );
}

/** يسجّل الحدث ويُشعِر المحاسبة والمشرفين. آمن للاستدعاء داخل أي مسار حجز. */
export async function recordMinPriceFloorApplied(
  input: MinPriceFloorAuditInput,
): Promise<void> {
  const periodAr = periodLabelAr(input.periodKind);
  const sourceAr = discountSourceLabelAr(input.discountSource);

  const notes = buildFloorExplanationAr(input);

  await logBookingEvent({
    bookingId: input.bookingId,
    event: BOOKING_EVENTS.MIN_PRICE_FLOOR_APPLIED,
    actorKind: "SYSTEM",
    actorName: "System",
    notes: notes.slice(0, 500),
    meta: {
      periodKind: input.periodKind,
      days: input.days,
      basePricePerDayExclTax: input.basePricePerDayExclTax,
      discountedPricePerDayExclTax: input.discountedPricePerDayExclTax,
      floorPerDayExclTax: input.floorPerDayExclTax,
      finalPricePerDayExclTax: input.finalPricePerDayExclTax,
      withheldDiscountExclTax: input.withheldDiscountExclTax,
      discountSource: input.discountSource,
      floorExceedsBasePrice: input.floorExceedsBasePrice ?? false,
    },
  });

  await notifyStaff(input, periodAr, sourceAr);
}

async function notifyStaff(
  input: MinPriceFloorAuditInput,
  periodAr: string,
  sourceAr: string,
): Promise<void> {
  const title = `تفعيل الحد الأدنى للسعر — حجز #${input.bookingId}`;
  const message =
    `${input.carLabel} — تأجير ${periodAr}. ${buildFloorExplanationAr(input)}`;

  try {
    await createNotification({ branchId: input.branchId }, title, message);
  } catch {
    // الإشعار الداخلي لا يوقف الحجز
  }

  try {
    await sendFloorEmail(input, title, periodAr, sourceAr);
  } catch {
    // الإيميل لا يوقف الحجز
  }
}

/**
 * إيميل لفريق المحاسبة والإشراف. المستلمون هم نفس مَن يستقبل تنبيهات الحجوزات
 * العامة: `notifyGlobalCc` (المحاسب/المدير المالي) و`notifyGlobalTo` (مشرف
 * العمليات) — بدل تكرار قائمة بريد منفصلة تحتاج صيانة.
 */
async function sendFloorEmail(
  input: MinPriceFloorAuditInput,
  title: string,
  periodAr: string,
  sourceAr: string,
): Promise<void> {
  const employees = await prisma.adminEmployee.findMany({
    where: {
      isActive: true,
      notifyOnBookingEmail: true,
      OR: [{ notifyGlobalCc: true }, { notifyGlobalTo: true }],
    },
    select: { email: true },
  });

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const recipients = [
    ...new Set(
      employees.map((e) => e.email.trim()).filter((e) => isValidEmail(e)),
    ),
  ];
  if (recipients.length === 0) return;

  // نفس وحدة الصياغة النصية: الشهري بإجمالي الشهر، اليومي بسعر اليوم.
  const isMonthly = input.periodKind === "MONTHLY";
  const unitAr = isMonthly ? "ر.س للشهر" : "ر.س/يوم";
  const scale = isMonthly ? input.days : 1;
  const amount = (perDay: number) => `${fmt(perDay * scale)} ${unitAr}`;

  const rows: [string, string][] = [
    ["رقم الحجز", `#${input.bookingId}`],
    ["السيارة", input.carLabel],
    ["نوع التأجير", periodAr],
    ["عدد الأيام", String(input.days)],
    ["السعر الأساسي قبل الخصم", amount(input.basePricePerDayExclTax)],
    ["مصدر الخصم", sourceAr],
    ["السعر بعد الخصم (قبل الحد)", amount(input.discountedPricePerDayExclTax)],
    ["الحد الأدنى المسجّل", amount(input.floorPerDayExclTax)],
    ["السعر المطبَّق فعلياً", amount(input.finalPricePerDayExclTax)],
    ["قيمة الخصم المحجوبة", `${fmt(input.withheldDiscountExclTax)} ر.س`],
  ];

  const rowsHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px;border:1px solid #e5e7eb;background:#f9fafb">${escapeHtml(k)}</td>` +
        `<td style="padding:6px 12px;border:1px solid #e5e7eb"><strong>${escapeHtml(v)}</strong></td></tr>`,
    )
    .join("");

  const warning = input.floorExceedsBasePrice
    ? `<p style="color:#b45309"><strong>تنبيه إعداد:</strong> الحد الأدنى المضبوط أعلى من السعر الأساسي نفسه — ` +
      `تم الاكتفاء بالسعر الأساسي وعدم رفع السعر على العميل. يُرجى مراجعة إعدادات هذا الموديل/الفرع.</p>`
    : "";

  const html =
    `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:14px;color:#111827">` +
    `<h2 style="margin:0 0 12px">${escapeHtml(title)}</h2>` +
    `<p>${escapeHtml(buildFloorExplanationAr(input))}</p>` +
    `<p style="color:#6b7280">كل المبالغ أدناه دون ضريبة القيمة المضافة — الضريبة تُحتسب بعد تطبيق الحد الأدنى.</p>` +
    warning +
    `<table style="border-collapse:collapse;margin-top:8px">${rowsHtml}</table>` +
    `<p style="margin-top:12px;color:#6b7280">رسالة آلية — لا حاجة للرد.</p>` +
    `</div>`;

  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");

  await sendPlainTransactionalEmail({
    to: recipients.join(","),
    subject: title,
    html,
    text,
  });
}
