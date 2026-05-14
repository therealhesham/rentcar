import { NextResponse } from "next/server";
import { getDirectBookingAvailability } from "@/lib/direct-booking";
import { createFleetBookingAndLinkCustomerSession } from "@/lib/fleet-checkout-customer-session";
import { getCustomerProfile, getCustomerSessionUserId } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { isBookingCheckoutOtpStepRequired } from "@/lib/booking-checkout-otp";
import { parseCreateDirectBookingInputFromCheckoutJson } from "@/lib/booking-direct-checkout-parse";
import { revalidateAfterDirectBooking } from "@/lib/revalidate-after-direct-booking";
import { isDirectBookingCapacityMessage } from "@/lib/direct-booking-user-messages";

export const dynamic = "force-dynamic";

/**
 * التحقق من توفر الموديل في الفترة: نفس منطق إنشاء الحجز المباشر.
 * ?carModelId=&pickupDate=YYYY-MM-DD&days=
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const carModelId = Number(url.searchParams.get("carModelId"));
  const pickupRaw = url.searchParams.get("pickupDate") ?? "";
  const days = Number(url.searchParams.get("days"));

  if (!Number.isInteger(carModelId) || carModelId < 1) {
    return NextResponse.json(
      { ok: false, error: "carModelId غير صالح." },
      { status: 400 },
    );
  }
  if (!pickupRaw) {
    return NextResponse.json(
      { ok: false, error: "pickupDate مطلوب." },
      { status: 400 },
    );
  }
  const pickupDate = new Date(pickupRaw);
  if (Number.isNaN(pickupDate.getTime())) {
    return NextResponse.json(
      { ok: false, error: "pickupDate غير صالح." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(days) || days < 1 || days > 60) {
    return NextResponse.json(
      { ok: false, error: "days يجب أن يكون بين 1 و 60." },
      { status: 400 },
    );
  }

  const excludeRaw = url.searchParams.get("excludeBookingRequestId");
  const excludeParsed =
    excludeRaw != null && excludeRaw !== ""
      ? Number(excludeRaw)
      : undefined;
  if (
    excludeParsed !== undefined &&
    (!Number.isInteger(excludeParsed) || excludeParsed < 1)
  ) {
    return NextResponse.json(
      { ok: false, error: "excludeBookingRequestId غير صالح." },
      { status: 400 },
    );
  }

  /** لا يُستثنى من التداخل إلا طلب يخص نفس العميل (حساب أو جوال) ونفس الموديل — وإلا يُتجاهل المعامل. */
  let verifiedExcludeBookingRequestId: number | undefined;
  if (excludeParsed !== undefined) {
    const profile = await getCustomerProfile();
    if (profile) {
      const owned = await prisma.bookingRequest.findFirst({
        where: {
          id: excludeParsed,
          kind: "DIRECT",
          carModelId,
          OR: [
            { customerId: profile.id },
            ...(profile.phone ? [{ phone: profile.phone }] : []),
          ],
        },
        select: { id: true },
      });
      if (owned) {
        verifiedExcludeBookingRequestId = owned.id;
      }
    }
  }

  const result = await getDirectBookingAvailability({
    carModelId,
    pickupDate,
    numberOfDays: Math.round(days),
    excludeBookingRequestId: verifiedExcludeBookingRequestId,
  });

  return NextResponse.json({
    ok: true,
    available: result.available,
    fleetUnits: result.fleetUnits,
    overlapping: result.overlapping,
  });
}

/** إنشاء حجز مباشر (موقع العميل أو أي عميل API) — نفس منطق الخادم الداخلي. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "جسم الطلب ليس JSON صالحاً." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "جسم الطلب فارغ." }, { status: 400 });
  }

  const obj = body as Record<string, unknown>;
  const sessionUserId = await getCustomerSessionUserId();
  const parsed = parseCreateDirectBookingInputFromCheckoutJson(obj, sessionUserId);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  if (await isBookingCheckoutOtpStepRequired()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "عند تفعيل رمز التحقق يُكمَل الحجز من صفحة «رمز التحقق» بعد إرسال بياناتك من صفحة الإتمام.",
      },
      { status: 400 },
    );
  }

  const created = await createFleetBookingAndLinkCustomerSession(parsed.input);

  if (!created.ok) {
    const status = isDirectBookingCapacityMessage(created.error) ? 409 : 400;
    return NextResponse.json({ ok: false, error: created.error }, { status });
  }

  revalidateAfterDirectBooking();

  return NextResponse.json({ ok: true, bookingRequestId: created.bookingRequestId });
}
