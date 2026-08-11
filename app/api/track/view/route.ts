import { NextResponse } from "next/server";
import {
  CLIENT_TRACKABLE_KINDS,
  currentRequestMeta,
  logActivity,
  normalizeReferrer,
  type ClientTrackableKind,
} from "@/lib/activity-log";
import { getCustomerSessionUserId } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

/**
 * بوتات ومكتبات HTTP. القائمة أوسع من مجرد `bot` لأن السجل أظهر بوتات تتنكّر
 * بـ User-Agent متصفح عادي — تلك تُصفّى في اللوحة عبر تحليل الجلسة لا هنا.
 */
const BOT_UA_PATTERN =
  /bot|crawler|spider|crawling|preview|lighthouse|headless|scrapy|semrush|ahrefs|mj12|dotbot|slurp|yandex|petalbot|applebot|facebookexternalhit|gptbot|ccbot|perplexity|python-requests|axios\/|node-fetch|go-http-client|okhttp|java\/|curl\/|wget/i;

const TRACKABLE = new Set<string>(CLIENT_TRACKABLE_KINDS);

export async function POST(request: Request) {
  let path = "";
  let carModelId: number | null = null;
  let kind: ClientTrackableKind | null = null;
  let referrerRaw: string | null = null;
  let detail: string | null = null;

  try {
    const body = (await request.json()) as {
      path?: unknown;
      carModelId?: unknown;
      kind?: unknown;
      referrer?: unknown;
      detail?: unknown;
    };
    path = String(body.path ?? "").trim();
    const rawModelId = Number(body.carModelId);
    if (Number.isInteger(rawModelId) && rawModelId >= 1) carModelId = rawModelId;
    const rawKind = typeof body.kind === "string" ? body.kind : "";
    if (rawKind && TRACKABLE.has(rawKind)) kind = rawKind as ClientTrackableKind;
    referrerRaw = typeof body.referrer === "string" ? body.referrer : null;
    detail = typeof body.detail === "string" ? body.detail.trim().slice(0, 255) || null : null;
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
  // نوع غير معروف = عميل قديم مخزَّن مؤقتاً أو محاولة تلفيق؛ نتجاهله بصمت.
  if (!kind) {
    kind = carModelId ? "CAR_VIEW" : "PAGE_VIEW";
  }

  const meta = await currentRequestMeta();
  if (meta.userAgent && BOT_UA_PATTERN.test(meta.userAgent)) {
    return NextResponse.json({ ok: true });
  }

  // ربط المشاهدة بالعميل المسجّل دخول — الاسم يُستخرج وقت العرض من `userId`
  // حتى لا نضيف استعلاماً على كل مشاهدة ولا نخزّن اسماً يتقادم.
  const userId = await getCustomerSessionUserId();

  await logActivity({
    kind,
    path,
    carModelId,
    userId,
    detail,
    referrer: normalizeReferrer(referrerRaw, new URL(request.url).hostname),
    ...meta,
  });
  return NextResponse.json({ ok: true });
}
