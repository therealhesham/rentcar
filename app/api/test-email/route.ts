import { NextRequest, NextResponse } from "next/server";
import { buildReceivedHtml } from "@/lib/booking-received-notification";
import { buildInvoiceHtml } from "@/lib/booking-invoice-email";
import type { BookingPaymentSnapshot } from "@/lib/booking-payment-data";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") || "invoice";

  if (type === "received") {
    // handled below by passing dummySnapshot to buildReceivedHtml
  }

  const dummySnapshot = {
    id: 12345,
    kind: "DIRECT",
    status: "PICKED_UP",
    paymentStatus: "PAID",
    paymentMethod: "CASH",
    pickupDate: new Date(),
    numberOfDays: 3,
    pickupMode: "BRANCH",
    pickupBranchLabelAr: "فرع المطار الرئيسي",
    returnBranchLabelAr: "فرع البلد",
    deliveryAddress: null,
    car: {
      id: 99,
      fullTitle: "تويوتا كامري 2024",
      categoryTitle: "سيدان",
      vatRatePercent: 15,
    },
    fullName: "محمد عبدالله",
    phone: "0550000000",
    totals: {
      rentalExclTax: 450,
      subtotalExclTax: 500,
      vatAmount: 75,
      totalInclTax: 575,
      amountPaidSar: 575,
      balanceDueSar: 0,
    },
    addons: [
      {
        id: 1,
        titleAr: "تأمين شامل",
        quantity: 1,
        lineTotalExclTax: 50,
      }
    ],
    checkoutOneTimeFees: [],
    interCityShipping: null,
    delayPenalty: null,
    tripDurationLabelAr: "3 أيام",
    paidAt: new Date(),
    contactEmail: "test@example.com",
    branch: "المطار",
  } as unknown as BookingPaymentSnapshot;

  const html = type === "received" ? buildReceivedHtml(dummySnapshot) : buildInvoiceHtml(dummySnapshot);
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
