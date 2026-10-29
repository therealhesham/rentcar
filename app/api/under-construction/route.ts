import { NextResponse } from "next/server";
import { getUnderConstructionSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

/** يقرأه middleware (Edge لا يصل لـ Prisma) لمعرفة هل الموقع في وضع «قيد الإنشاء». */
export async function GET() {
  const settings = await getUnderConstructionSettings();
  return NextResponse.json(settings, { headers: { "Cache-Control": "no-store" } });
}
