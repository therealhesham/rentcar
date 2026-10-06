/**
 * معاينة الإلغاء لتطبيق الموبايل — كام هيترد وكام هيتخصم، قبل ما العميل يأكّد.
 *
 * الحساب كله بيتم في buildCancellationFinancePreview الموجودة أصلاً، فالمعاينة
 * اللي التطبيق بيعرضها والمبلغ اللي بيتنفّذ فعلاً بيطلعوا من نفس الدالة — ما
 * ينفعش يفترقوا.
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { buildCancellationFinancePreview } from "@/lib/booking-cancellation-service";
import { customerOwnsBooking } from "@/lib/customer-booking-access";
import { getCustomerCancellationDeductTiers } from "@/lib/site-settings";
import { resolveBookingRentalPricePerDayExclTax } from "@/lib/booking-pricing-snapshot";
import { readCustomerId, verifyInternalRequest } from "@/lib/internal-api-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = verifyInternalRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { id } = await ctx.params;
  const bookingId = Number(id);
  if (!Number.isInteger(bookingId) || bookingId < 1) {
    return NextResponse.json({ ok: false, error: "معرّف الطلب غير صالح." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const customerId = readCustomerId(body);
  if (customerId == null) {
    return NextResponse.json({ ok: false, error: "customerId مطلوب." }, { status: 400 });
  }

  const row = await prisma.bookingRequest.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      kind: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      numberOfDays: true,
      pickupDate: true,
      addonsJson: true,
      customerId: true,
      phone: true,
      carModel: { select: { price: true, vatRatePercent: true } },
    },
  });
  if (!row) {
    return NextResponse.json({ ok: false, error: "الطلب غير موجود." }, { status: 404 });
  }

  // نفس فحص الملكية المستخدَم في الإلغاء نفسه — الرد 404 مش 403 عشان ما نأكّدش
  // لحد وجود حجز مش بتاعه.
  const customer = await prisma.user.findUnique({ where: { id: customerId }, select: { phone: true } });
  if (!customerOwnsBooking(row, customerId, customer?.phone ?? null)) {
    return NextResponse.json({ ok: false, error: "الطلب غير موجود." }, { status: 404 });
  }

  // حجز بلا موديل مرتبط (اتمسح من الأسطول مثلاً) — مفيش سعر يومي يُحسب عليه
  // الاسترداد، فمفيش معاينة. buildCancellationFinancePreview نفسها بترجع null
  // في الحالة دي، فبنقصّر الطريق بدل ما نمرّر أصفاراً مضلِّلة.
  if (!row.carModel) {
    return NextResponse.json({ ok: true, preview: null });
  }

  const preview = buildCancellationFinancePreview({
    kind: row.kind,
    status: row.status,
    paymentStatus: row.paymentStatus,
    paymentMethod: row.paymentMethod,
    numberOfDays: row.numberOfDays,
    pickupDate: row.pickupDate,
    pricePerDayExclTax: resolveBookingRentalPricePerDayExclTax(row.carModel.price, row.addonsJson),
    vatRatePercent: row.carModel.vatRatePercent,
    addonsJson: row.addonsJson,
    tiers: await getCustomerCancellationDeductTiers(),
  });

  // null = الحجز مش مدفوع، أو في حالة ما تسمحش بالإلغاء أصلاً. مش خطأ — بس
  // مفيش أرقام استرداد تتعرض، والتطبيق بيعرض تأكيداً بلا مبالغ.
  return NextResponse.json({ ok: true, preview });
}
