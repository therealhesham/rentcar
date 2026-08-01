// مؤقت للتحقق فقط — يُحذف بعد الاختبار. يستدعي المعاينة (لا تكتب في القاعدة).
import type { NextRequest } from "next/server";
import { previewFleetQuantityImport } from "@/app/admin/fleet-quantity-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await previewFleetQuantityImport(body);
  return Response.json(result);
}
