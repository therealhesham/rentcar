import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  createDirectBooking,
  getDirectBookingAvailability,
  parseCommonBookingFieldsFromJson,
} from "@/lib/direct-booking";

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
  const excludeBookingRequestId =
    excludeRaw != null && excludeRaw !== ""
      ? Number(excludeRaw)
      : undefined;
  if (
    excludeBookingRequestId !== undefined &&
    (!Number.isInteger(excludeBookingRequestId) || excludeBookingRequestId < 1)
  ) {
    return NextResponse.json(
      { ok: false, error: "excludeBookingRequestId غير صالح." },
      { status: 400 },
    );
  }

  const result = await getDirectBookingAvailability({
    carModelId,
    pickupDate,
    numberOfDays: Math.round(days),
    excludeBookingRequestId,
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
  const carModelId = Number(obj.carModelId);
  if (!Number.isInteger(carModelId) || carModelId < 1) {
    return NextResponse.json({ ok: false, error: "معرّف السيارة غير صالح." }, { status: 400 });
  }

  const parsed = parseCommonBookingFieldsFromJson(obj);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const created = await createDirectBooking({
    carModelId,
    ...parsed.data,
  });

  if (!created.ok) {
    return NextResponse.json({ ok: false, error: created.error }, { status: 409 });
  }

  revalidatePath("/admin");
  revalidatePath("/fleet");

  return NextResponse.json({ ok: true });
}
