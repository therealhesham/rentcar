import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { isAdminVehiclesWritePath, isSuperAdminOnlyPath } from "@/lib/admin-routes";
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

    if (
      !session.isSuperAdmin &&
      (isSuperAdminOnlyPath(pathname) || isAdminVehiclesWritePath(pathname))
    ) {
      return NextResponse.redirect(new URL("/admin", request.url));
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
