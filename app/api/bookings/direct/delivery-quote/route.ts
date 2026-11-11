import { NextResponse } from "next/server";
import { resolveDeliveryFeeSnap } from "@/lib/delivery-fee-server";
import type { DeliveryLeg } from "@/lib/delivery-fee";

export const dynamic = "force-dynamic";

/** حماية بسيطة لحصة جوجل: 30 طلباً/دقيقة لكل IP داخل نفس النسخة. */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

function allowed(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 2000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }
  return true;
}

/**
 * عرض سعر التوصيل لصفحة الإتمام — نفس دالة الحساب التي يستخدمها إنشاء الحجز، فالرقم
 * المعروض هو الرقم المحفوظ (المسافة تُخزَّن مؤقتاً لساعة).
 * POST { branch, lat, lng, leg: "PICKUP" | "RETURN" }
 */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allowed(ip)) {
    return NextResponse.json(
      { ok: false, error: "طلبات كثيرة. حاول بعد قليل." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "جسم الطلب ليس JSON صالحاً." }, { status: 400 });
  }

  const branch = String(body.branch ?? "").trim().toLowerCase();
  if (!/^[a-z0-9-]{1,64}$/.test(branch)) {
    return NextResponse.json({ ok: false, error: "معرّف الفرع غير صالح." }, { status: 400 });
  }
  const leg: DeliveryLeg = body.leg === "RETURN" ? "RETURN" : "PICKUP";
  const lat = Number(body.lat);
  const lng = Number(body.lng);

  const r = await resolveDeliveryFeeSnap({ leg, branchSlug: branch, lat, lng });
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, snap: r.snap });
}
