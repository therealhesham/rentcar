import { NextResponse } from "next/server";
import { isGowebClickType, sendGowebClick } from "@/lib/goweb-crm";
import { getStoredGowebSource } from "@/lib/goweb-source";

export const dynamic = "force-dynamic";

/** نفس فكرة /api/track/view: البوتات ومكتبات HTTP ما تتحسبش ضغطات. */
const BOT_UA_PATTERN =
  /bot|crawler|spider|crawling|preview|lighthouse|headless|scrapy|semrush|ahrefs|mj12|dotbot|slurp|yandex|petalbot|applebot|facebookexternalhit|gptbot|ccbot|perplexity|python-requests|axios\/|node-fetch|go-http-client|okhttp|java\/|curl\/|wget/i;

/**
 * يستقبل ضغطة من المتصفح ويسجّلها في GoWeb (POST /add_click) من الخادم،
 * عشان الـ tenant والـ identifier يفضلوا عندنا مش في الـ client.
 * دايمًا بيرد 204 — التتبّع ما يستاهلش يظهر له خطأ.
 */
export async function POST(request: Request) {
  try {
    const ua = request.headers.get("user-agent") ?? "";
    if (!ua || BOT_UA_PATTERN.test(ua)) return new NextResponse(null, { status: 204 });

    const body = (await request.json()) as { type?: unknown };
    if (isGowebClickType(body.type)) {
      await sendGowebClick(body.type, await getStoredGowebSource());
    }
  } catch {
    /* body غير صالح — نتجاهل */
  }
  return new NextResponse(null, { status: 204 });
}
