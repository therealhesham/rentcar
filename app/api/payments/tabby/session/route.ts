import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTabbyCheckoutSession, isTabbyConfigured } from "@/lib/tabby/client";
import { getBookingForPayment } from "@/lib/booking-payment-data";

export const dynamic = "force-dynamic";

/**
 * إنشاء جلسة دفع Tabby وحفظ معرف الدفعة بالحجز
 */
export async function POST(req: Request) {
  if (!isTabbyConfigured()) {
    return NextResponse.json({ error: "Tabby gateway not configured" }, { status: 503 });
  }

  let body: {
    bookingId?: number;
    lang?: "ar" | "en";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const bookingId = Number(body.bookingId);
  if (!Number.isInteger(bookingId) || bookingId < 1) {
    return NextResponse.json({ error: "missing or invalid bookingId" }, { status: 400 });
  }

  const booking = await getBookingForPayment(bookingId);
  if (!booking) {
    return NextResponse.json({ error: "booking not found" }, { status: 404 });
  }

  // احتساب المبلغ المطلوب بالريال
  let amountSar: number | null = null;
  const isAlreadyPaid = booking.paymentStatus.trim().toUpperCase() === "PAID";
  if (isAlreadyPaid) {
    amountSar = booking.balanceDueAtBranchSar ?? 0;
  } else {
    amountSar = booking.totals.totalInclTax;
  }

  if (amountSar == null || amountSar <= 0) {
    return NextResponse.json({ error: "invalid amount to pay" }, { status: 400 });
  }

  const appUrl = (process.env.APP_PUBLIC_URL ?? "").trim().replace(/\/$/, "");
  const successUrl = `${appUrl}/fleet/payment/${bookingId}?status=success`;
  const cancelUrl = `${appUrl}/fleet/payment/${bookingId}?status=cancel`;
  const failureUrl = `${appUrl}/fleet/payment/${bookingId}?status=failure`;

  try {
    const session = await createTabbyCheckoutSession({
      bookingRequestId: bookingId,
      amountSar,
      buyer: {
        phone: booking.phone,
        email: booking.invoiceEmail || undefined,
        name: booking.fullName || undefined,
      },
      items: [
        {
          title: booking.car?.fullTitle || `حجز سيارة #${bookingId}`,
          quantity: 1,
          unitPriceSar: amountSar,
        },
      ],
      successUrl,
      cancelUrl,
      failureUrl,
      language: body.lang || "ar",
    });

    await prisma.bookingRequest.update({
      where: { id: bookingId },
      data: {
        paymentSessionRef: session.merchantReferenceId,
        paymentGatewayRef: session.paymentId,
        paymentMethod: "TABBY",
      },
    });

    return NextResponse.json({
      webUrl: session.webUrl,
      paymentId: session.paymentId,
      merchantReferenceId: session.merchantReferenceId,
    });
  } catch (err) {
    console.error("[tabby-session-route] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Session creation failed" },
      { status: 500 },
    );
  }
}
