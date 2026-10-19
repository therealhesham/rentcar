import { NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { isAlwaysAllowedAdminPage } from "@/lib/admin-nav";
import { resolveAdminPagePermissionId } from "@/lib/admin-routes";
import { parseAdminSessionTokenEdge } from "@/lib/admin-session-edge";
import { GCLID_COOKIE, GCLID_MAX_AGE_SECONDS, sanitizeGclid } from "@/lib/ads-click-id";

const handleI18nRouting = createIntlMiddleware(routing);

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

  return withGclidCookie(request, handleI18nRouting(request));
}

/** يحفظ `?gclid=` في كوكي 90 يوماً (الأحدث يكتب فوق القديم، كسلوك كوكي Google نفسه). */
function withGclidCookie(request: NextRequest, response: NextResponse): NextResponse {
  const gclid = sanitizeGclid(request.nextUrl.searchParams.get("gclid"));
  if (gclid) {
    response.cookies.set(GCLID_COOKIE, gclid, {
      maxAge: GCLID_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
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
