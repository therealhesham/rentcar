/**
 * تنفيذ إلغاء العميل من تطبيق الموبايل.
 *
 * مجرّد غلاف حول cancelBookingWithPolicy — كل السياسة (شرائح الخصم، مهلة
 * الإلغاء، منع الإلغاء بعد الاستلام، حساب الاسترداد، تنفيذه، تسجيله في
 * المعاملات المالية، والمطالبة الذرّية اللي بتمنع استرداد مزدوج) موجودة جوّاها
 * بالفعل. ولا سطر حساب مالي بيتكتب هنا.
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { cancelBookingWithPolicy } from "@/lib/booking-cancellation-service";
import { logBookingEvent } from "@/lib/booking-audit";
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

  const customer = await prisma.user.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, phone: true },
  });
  if (!customer) {
    return NextResponse.json({ ok: false, error: "الحساب غير موجود." }, { status: 404 });
  }

  const result = await cancelBookingWithPolicy({
    bookingRequestId: bookingId,
    role: "customer",
    customerId: customer.id,
    customerPhone: customer.phone,
  });

  if (!result.ok) {
    // رسائل السياسة (مهلة انتهت، بدأ الاستلام، مش بتاع حسابك…) بتتعرض للعميل
    // زي ما هي، فبتفضل مطابقة لنص الموقع حرفاً بحرف.
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  // نفس سجل التدقيق اللي بيتكتب لما العميل يلغي من الموقع — بس بمصدر مختلف
  // عشان يبان في السجل إن الإلغاء جه من التطبيق.
  await logBookingEvent({
    bookingId,
    event: "CUSTOMER_CANCELLED",
    actorKind: "CUSTOMER",
    actorName: customer.name ?? customer.phone ?? undefined,
    toStatus: "CANCELLED",
    notes: [
      "من تطبيق الجوال",
      result.refundInclTaxSar ? `استرداد ${result.refundInclTaxSar} ر.س` : null,
    ]
      .filter(Boolean)
      .join(" — "),
  });

  return NextResponse.json({
    ok: true,
    refundInclTaxSar: result.refundInclTaxSar ?? 0,
    deductDays: result.deductDays,
    paymentMethod: result.paymentMethod ?? null,
  });
}
