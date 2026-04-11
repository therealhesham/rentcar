import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "admin_session";

function getSecret(): string | undefined {
  return process.env.ADMIN_PASSWORD;
}

export async function signAdminSession(): Promise<string> {
  const secret = getSecret();
  if (!secret) throw new Error("ADMIN_PASSWORD is not set");
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = JSON.stringify({ exp });
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(payload).toString("base64url") + "." + sig;
}

export async function verifyAdminSession(): Promise<boolean> {
  const secret = getSecret();
  if (!secret) return false;
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return false;
  const dot = raw.indexOf(".");
  if (dot < 0) return false;
  const payloadPart = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(payloadPart, "base64url").toString("utf8");
  } catch {
    return false;
  }
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    if (!timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  const { exp } = JSON.parse(payload) as { exp: number };
  return typeof exp === "number" && exp > Date.now();
}

export async function setAdminSessionCookie(): Promise<void> {
  const token = await signAdminSession();
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
