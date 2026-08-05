import { NextResponse } from "next/server";
import { checkTabbyEligibility, isTabbyConfigured } from "@/lib/tabby/client";

export const dynamic = "force-dynamic";

/**
 * فحص الأهلية المسبق لخدمة تابي (Pre-scoring eligibility check)
 */
export async function POST(req: Request) {
  if (!isTabbyConfigured()) {
    // إذا لم تكن البوابة مجهزة، نفترض الأهلية افتراضياً (Fail-safe)
    return NextResponse.json({ eligible: true });
  }

  let body: {
    amountSar?: number;
    phone?: string;
    email?: string;
    name?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const amountSar = Number(body.amountSar ?? 0);
  if (isNaN(amountSar) || amountSar <= 0) {
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  }

  const result = await checkTabbyEligibility({
    amountSar,
    buyer: {
      phone: body.phone,
      email: body.email,
      name: body.name,
    },
  });

  return NextResponse.json(result);
}
