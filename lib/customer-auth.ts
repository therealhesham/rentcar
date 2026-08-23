import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { isCookieSecure } from "@/lib/cookie-config";

const COOKIE_NAME = "customer_session";

function getSecret(): string | undefined {
  return process.env.CUSTOMER_SESSION_SECRET ?? process.env.AUTH_SECRET;
}

function requireSecret(): string {
  const s = getSecret();
  if (s) return s;
  if (process.env.NODE_ENV !== "production") {
    return "rentcar-dev-customer-session-secret-change-me";
  }
  throw new Error("CUSTOMER_SESSION_SECRET or AUTH_SECRET must be set in production");
}

export async function signCustomerSession(userId: number): Promise<string> {
  const secret = requireSecret();
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const payload = JSON.stringify({ uid: userId, exp });
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(payload).toString("base64url") + "." + sig;
}

/** يعيد معرف المستخدم أو null إن انتهت الجلسة أو غير صالحة */
export async function getCustomerSessionUserId(): Promise<number | null> {
  const secret =
    getSecret() ??
    (process.env.NODE_ENV !== "production"
      ? "rentcar-dev-customer-session-secret-change-me"
      : undefined);
  if (!secret) return null;

  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const dot = raw.indexOf(".");
  if (dot < 0) return null;
  const payloadPart = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(payloadPart, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  const { uid, exp } = parsed as { uid?: unknown; exp?: unknown };
  if (typeof exp !== "number" || exp <= Date.now()) return null;
  if (typeof uid !== "number" || !Number.isInteger(uid) || uid < 1) return null;
  return uid;
}

export async function setCustomerSessionCookie(userId: number): Promise<void> {
  const token = await signCustomerSession(userId);
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}

export async function clearCustomerSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getCustomerProfile(): Promise<{
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  idDocumentKind: string | null;
  nationalIdNumber: string | null;
  passportNumber: string | null;
  licenseNumber: string | null;
  licenseExpiryDate: Date | null;
  idCardImageUrl: string | null;
  driverLicenseImageUrl: string | null;
} | null> {
  const id = await getCustomerSessionUserId();
  if (id == null) return null;
  const row = (await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      idDocumentKind: true,
      nationalIdNumber: true,
      passportNumber: true,
      licenseNumber: true,
      licenseExpiryDate: true,
      idCardImageUrl: true,
      driverLicenseImageUrl: true,
    },
  } as any)) as
    | {
        id: number;
        email: string;
        name: string | null;
        phone: string | null;
        idDocumentKind?: string | null;
        nationalIdNumber?: string | null;
        passportNumber?: string | null;
        licenseNumber?: string | null;
        licenseExpiryDate?: Date | null;
        idCardImageUrl?: string | null;
        driverLicenseImageUrl?: string | null;
      }
    | null;
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    idDocumentKind: row.idDocumentKind ?? null,
    nationalIdNumber: row.nationalIdNumber ?? null,
    passportNumber: row.passportNumber ?? null,
    licenseNumber: row.licenseNumber ?? null,
    licenseExpiryDate: row.licenseExpiryDate ?? null,
    idCardImageUrl: row.idCardImageUrl ?? null,
    driverLicenseImageUrl: row.driverLicenseImageUrl ?? null,
  };
}
