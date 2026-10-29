import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { isAlwaysAllowedAdminPage } from "@/lib/admin-nav";
import { resolveAdminPagePermissionId } from "@/lib/admin-routes";
import { parseAdminSessionTokenEdge } from "@/lib/admin-session-edge";
import {
  ADS_CLICK_ID_KEYS,
  ADS_CLICK_ID_MAX_AGE_SECONDS,
  adsClickIdCookieName,
  sanitizeClickId,
} from "@/lib/ads-click-id";

import {
  DEFAULT_UNDER_CONSTRUCTION,
  normalizeUnderConstruction,
  renderUnderConstructionHtml,
  type UnderConstructionSettings,
} from "@/lib/under-construction";

const handleI18nRouting = createIntlMiddleware(routing);

const UNDER_CONSTRUCTION_TTL_MS = 5000;
let underConstructionCache: { at: number; value: UnderConstructionSettings } | null = null;

/**
 * Edge لا يصل لـ Prisma، فنسأل `/api/under-construction` ونخزّن الجواب 5 ثوانٍ في الذاكرة.
 * عند فشل الطلب نُبقي آخر قيمة معروفة (أو «معطّل») حتى لا يتوقف الموقع بسبب عطل عابر.
 */
async function getUnderConstruction(request: NextRequest): Promise<UnderConstructionSettings> {
  const now = Date.now();
  if (underConstructionCache && now - underConstructionCache.at < UNDER_CONSTRUCTION_TTL_MS) {
    return underConstructionCache.value;
  }
  try {
    // في الإنتاج (Docker) نخاطب الخادم نفسه عبر الـ loopback: origin الطلب قد يكون نطاقاً
    // عاماً خلف proxy لا يصله الكونتينر، أو 0.0.0.0 من HOSTNAME.
    const base =
      process.env.INTERNAL_APP_URL?.trim() ||
      (process.env.NODE_ENV === "production"
        ? `http://127.0.0.1:${process.env.PORT || 3000}`
        : request.nextUrl.origin);
    const res = await fetch(new URL("/api/under-construction", base), {
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const value = normalizeUnderConstruction(await res.json());
      underConstructionCache = { at: now, value };
      return value;
    }
    console.error("[under-construction] status check failed:", res.status);
  } catch (e) {
    // نعتمد آخر قيمة معروفة، لكن نسجّل السبب كي لا يفشل الحجب بصمت.
    console.error("[under-construction] status check error:", e);
  }
  const stale = underConstructionCache?.value ?? DEFAULT_UNDER_CONSTRUCTION;
  underConstructionCache = { at: now, value: stale };
  return stale;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
      return NextResponse.next();
    }

    const session = await parseAdminSessionTokenEdge(
      request.cookies.get("admin_session")?.value,
    );
    if (!session) {
      const login = new URL("/admin/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }

    // صفحات alwaysAllowed متاحة لأي موظف مسجّل دخول: لوحة التحكم الرئيسية (صفحة هبوط بعد
    // تسجيل الدخول، وهدف إعادة التوجيه أدناه — تُحدَّد محتوياتها حسب صلاحياته في مكان آخر)
    // وشروحات النظام (مرجع للجميع؛ الرفع والتعديل فيها محصوران بمدير النظام داخل الصفحة).
    if (!session.isSuperAdmin && !isAlwaysAllowedAdminPage(pathname)) {
      const permId = resolveAdminPagePermissionId(pathname);
      if (permId == null || !session.permissions.includes(permId)) {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
    }

    return NextResponse.next();
  }

  const underConstruction = await getUnderConstruction(request);
  if (underConstruction.enabled) {
    // المسؤول المسجّل دخوله يتصفح الموقع طبيعياً ليراجع التعديلات.
    const adminSession = await parseAdminSessionTokenEdge(
      request.cookies.get("admin_session")?.value,
    );
    if (!adminSession) {
      // 200 + noindex عمداً: جوجل لا يقرأ noindex من ردود 5xx فتبقى الصفحات المفهرسة.
      return new NextResponse(renderUnderConstructionHtml(underConstruction.message), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
          "Cache-Control": "no-store",
        },
      });
    }
  }

  // زواحف المعاينة (واتساب/فيسبوك/إكس…) ترسل Accept-Language إنجليزياً، فكانت كروت
  // مشاركة صفحات السيارات تظهر بالإنجليزية لموقع لغته الأساسية العربية. بدون الهيدر
  // يرجع next-intl للافتراضي (ar) — ما لم يكن هناك كوكي لغة صريح.
  if (
    pathname.startsWith("/fleet/car/") &&
    LINK_PREVIEW_BOT_RE.test(request.headers.get("user-agent") ?? "") &&
    !request.cookies.has("NEXT_LOCALE")
  ) {
    const headers = new Headers(request.headers);
    headers.delete("accept-language");
    return handleI18nRouting(new NextRequest(request, { headers }));
  }

  return withAdsClickIdCookies(request, handleI18nRouting(request));
}

/**
 * يحفظ معرّف نقرة Google (`gclid` أو `gbraid` أو `wbraid`) في كوكي 90 يوماً.
 * النقرة الأحدث تكتب فوق القديمة وتمسح بقية المعرّفات (النقرة الواحدة تحمل معرّفاً واحداً فقط).
 */
function withAdsClickIdCookies(request: NextRequest, response: NextResponse): NextResponse {
  const found = ADS_CLICK_ID_KEYS.find((key) =>
    sanitizeClickId(request.nextUrl.searchParams.get(key)),
  );
  if (!found) return response;
  const value = sanitizeClickId(request.nextUrl.searchParams.get(found))!;
  for (const key of ADS_CLICK_ID_KEYS) {
    if (key === found) {
      response.cookies.set(adsClickIdCookieName(key), value, {
        maxAge: ADS_CLICK_ID_MAX_AGE_SECONDS,
        path: "/",
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
      });
    } else {
      response.cookies.delete(adsClickIdCookieName(key));
    }
  }
  return response;
}

const LINK_PREVIEW_BOT_RE =
  /facebookexternalhit|facebot|whatsapp|twitterbot|linkedinbot|telegrambot|slackbot|discordbot|pinterest|snapchat|skypeuripreview|applebot|googlebot|bingbot/i;

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
