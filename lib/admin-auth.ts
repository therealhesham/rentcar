import { cookies } from "next/headers";
import {
  createAdminSessionTokenPayload,
  parseAdminSessionToken,
  type AdminSession,
} from "@/lib/admin-session-token";
import { isCookieSecure } from "@/lib/cookie-config";

export type { AdminSession };

const COOKIE_NAME = "admin_session";

export { parseAdminSessionToken };

export async function createAdminSessionToken(
  session: Omit<AdminSession, "exp" | "v">,
): Promise<string> {
  return createAdminSessionTokenPayload(session);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  return parseAdminSessionToken(jar.get(COOKIE_NAME)?.value);
}

export async function verifyAdminSession(): Promise<boolean> {
  return (await getAdminSession()) != null;
}

export async function setAdminSessionCookie(session: Omit<AdminSession, "exp" | "v">): Promise<void> {
  const token = await createAdminSessionToken(session);
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
