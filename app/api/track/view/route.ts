import { NextResponse } from "next/server";
import { currentRequestMeta, logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const BOT_UA_PATTERN = /bot|crawler|spider|crawling|preview|lighthouse|headless/i;

export async function POST(request: Request) {
  let path = "";
  try {
    const body = (await request.json()) as { path?: unknown };
    path = String(body.path ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // مسار داخلي فقط، ولا نسجل صفحات لوحة التحكم أو واجهات الـ API
  if (!path.startsWith("/") || path.startsWith("//") || path.length > 512) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (path.startsWith("/admin") || path.startsWith("/api")) {
    return NextResponse.json({ ok: true });
  }

  const meta = await currentRequestMeta();
  if (meta.userAgent && BOT_UA_PATTERN.test(meta.userAgent)) {
    return NextResponse.json({ ok: true });
  }

  await logActivity({ kind: "PAGE_VIEW", path, ...meta });
  return NextResponse.json({ ok: true });
}
