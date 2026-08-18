import { NextResponse } from "next/server";
import { listCheckoutAlternatives } from "@/lib/checkout-alternatives";

export const dynamic = "force-dynamic";

/**
 * سيارات متاحة بديلة لنفس الفترة والفرع — يستدعيها `CarUnavailableModal`.
 * ?excludeModelId=&pickupDate=&days=&branch=
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const excludeModelId = Number(url.searchParams.get("excludeModelId"));
  const pickupRaw = url.searchParams.get("pickupDate") ?? "";
  const branchRaw = url.searchParams.get("branch") ?? "";
  const days = Number(url.searchParams.get("days"));

  if (!Number.isInteger(excludeModelId) || excludeModelId < 1) {
    return NextResponse.json({ ok: false, error: "excludeModelId غير صالح." }, { status: 400 });
  }
  const pickupDate = new Date(pickupRaw);
  if (!pickupRaw || Number.isNaN(pickupDate.getTime())) {
    return NextResponse.json({ ok: false, error: "pickupDate غير صالح." }, { status: 400 });
  }
  if (!Number.isFinite(days) || days < 1 || days > 60) {
    return NextResponse.json({ ok: false, error: "days يجب أن يكون بين 1 و 60." }, { status: 400 });
  }
  const branchSlug = branchRaw.trim().toLowerCase();
  if (!branchSlug || !/^[a-z0-9-]{1,64}$/.test(branchSlug)) {
    return NextResponse.json({ ok: false, error: "branch مطلوب." }, { status: 400 });
  }

  try {
    const alternatives = await listCheckoutAlternatives({
      excludeModelId,
      pickupDate,
      numberOfDays: days,
      branchSlug,
    });
    return NextResponse.json({ ok: true, alternatives });
  } catch (e) {
    console.error("[alternatives] تعذّر حساب البدائل", e);
    // المودال يعمل بدونها (يعرض «غيّر التواريخ» فقط)، فلا نُفشل الطلب بصخب.
    return NextResponse.json({ ok: true, alternatives: [] });
  }
}
