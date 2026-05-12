import { NextResponse } from "next/server";
import { getCustomerSessionUserId } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

/** تقرير المسافة المحسوبة؛ يقيِّد بالبدلة الحالية لتفادي الزيادة الظرفية قبل الفوترة. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const uid = await getCustomerSessionUserId();
  if (!uid) return bad("غير مصرّح.", 401);
  const id = Number((await ctx.params).id);

  let body: { mileageUsedKm?: number };
  try {
    body = await req.json();
  } catch {
    return bad("JSON غير صالح.");
  }
  const km = Number(body.mileageUsedKm);
  if (!Number.isFinite(km) || km < 0) return bad("قيمة كيلومترات غير صالحة.");

  const sub = await prisma.userSubscription.findFirst({
    where: { id, userId: uid, status: { in: ["ACTIVE", "SUSPENDED"] } },
  });
  if (!sub) return bad("غير موجود أو غير مؤهل.", 404);

  const capped = Math.min(Math.round(km), sub.mileageAllowanceKm);
  await prisma.userSubscription.update({
    where: { id },
    data: { mileageUsedKm: capped },
  });

  return NextResponse.json({ ok: true, mileageUsedKm: capped });
}
