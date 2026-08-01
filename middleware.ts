import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { resolveAdminPagePermissionId } from "@/lib/admin-routes";
import { parseAdminSessionTokenEdge } from "@/lib/admin-session-edge";

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

    // لوحة التحكم الرئيسية دائماً متاحة لأي موظف مسجّل دخول (صفحة هبوط بعد تسجيل الدخول،
    // وهدف إعادة التوجيه أدناه) — تُحدَّد محتوياتها حسب صلاحياته في مكان آخر.
    if (!session.isSuperAdmin && pathname !== "/admin") {
      const permId = resolveAdminPagePermissionId(pathname);
      if (permId == null || !session.permissions.includes(permId)) {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
    }

    return NextResponse.next();
  }

  return handleI18nRouting(request);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
