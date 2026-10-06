/**
 * تفصيل فاتورة الحجز لتطبيق الموبايل.
 *
 * الأرقام بتتقرا من **لقطة** السعر المتخزّنة وقت الحجز (`addonsJson`) مش من
 * أسعار الموديل الحالية — فتعديل سعر السيارة بعد الحجز ما بيغيّرش فاتورة حجز
 * قديم. نفس المفسّر ونفس دالة الإجماليات اللي بتستخدمها صفحة الدفع والفاتورة
 * على الموقع، فالتطبيق والموقع ما ينفعش يعرضوا رقمين مختلفين لنفس الحجز.
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { customerOwnsBooking } from "@/lib/customer-booking-access";
import {
  parseBookingPricingSnapshot,
  resolveBookingRentalPricePerDayExclTax,
} from "@/lib/booking-pricing-snapshot";
import { computeCheckoutTotals } from "@/lib/booking-checkout-pricing";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
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
      numberOfDays: true,
      addonsJson: true,
      paymentMethod: true,
      paymentStatus: true,
      paidAmountSar: true,
      balanceDueAtBranchSar: true,
      cancellationDeductedDays: true,
      customerId: true,
      phone: true,
      carModel: { select: { price: true, vatRatePercent: true } },
    },
  });
  if (!row || !row.carModel) {
    return NextResponse.json({ ok: false, error: "الطلب غير موجود." }, { status: 404 });
  }

  const customer = await prisma.user.findUnique({ where: { id: customerId }, select: { phone: true } });
  if (!customerOwnsBooking(row, customerId, customer?.phone ?? null)) {
    return NextResponse.json({ ok: false, error: "الطلب غير موجود." }, { status: 404 });
  }

  const snap = parseBookingPricingSnapshot(row.addonsJson);
  const oneTimeFeesExclTax =
    (snap.interCityShipping?.feeExclVatSar ?? 0) +
    snap.checkoutOneTimeFees.reduce((s, f) => s + f.feeExclVatSar, 0) +
    (snap.delayPenalty?.feeExclVatSar ?? 0);
  const discountExclTax = snap.couponCode?.scope === "FULL_TOTAL" ? snap.couponCode.discountExclTax : 0;

  const pricePerDayExclTax = resolveBookingRentalPricePerDayExclTax(row.carModel.price, row.addonsJson);
  const totals = computeCheckoutTotals(
    pricePerDayExclTax,
    row.numberOfDays,
    row.carModel.vatRatePercent,
    snap.addons.map((a) => ({ pricePerDay: a.pricePerDayExclTax })),
    { oneTimeFeesExclTax, discountExclTax },
  );

  return NextResponse.json({
    ok: true,
    invoice: {
      pricePerDayExclTax,
      numberOfDays: row.numberOfDays,
      vatRatePercent: row.carModel.vatRatePercent,
      rentalExclTax: totals.rentalExclTax,
      addonsExclTax: totals.addonsExclTax,
      oneTimeFeesExclTax: totals.oneTimeFeesExclTax,
      discountExclTax: totals.discountExclTax,
      subtotalExclTax: totals.subtotalExclTax,
      vatAmount: totals.vatAmount,
      totalInclTax: totals.totalInclTax,
      addons: snap.addons.map((a) => ({ titleAr: a.titleAr, lineTotalExclTax: a.lineTotalExclTax })),
      oneTimeFees: [
        ...(snap.interCityShipping
          ? [{ labelAr: "شحن بين المدن", feeExclVatSar: snap.interCityShipping.feeExclVatSar }]
          : []),
        ...snap.checkoutOneTimeFees.map((f) => ({ labelAr: f.labelAr, feeExclVatSar: f.feeExclVatSar })),
        ...(snap.delayPenalty
          ? [{ labelAr: "رسوم تأخير", feeExclVatSar: snap.delayPenalty.feeExclVatSar }]
          : []),
      ],
      couponCode: snap.couponCode?.code ?? null,
      rentalDiscount: snap.rentalDiscount
        ? {
            originalPricePerDayExclTax: snap.rentalDiscount.originalPricePerDayExclTax,
            discountPerDayExclTax: snap.rentalDiscount.discountPerDayExclTax,
          }
        : null,
      paymentMethodLabel: bookingPaymentMethodLabelAr(row.paymentMethod),
      paymentStatus: row.paymentStatus,
      paidAmountSar: row.paidAmountSar,
      balanceDueAtBranchSar: row.balanceDueAtBranchSar,
      cancellationDeductedDays: row.cancellationDeductedDays,
    },
  });
}
