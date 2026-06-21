import { createHmac, timingSafeEqual } from "crypto";

export type AdminSession = {
  exp: number;
  employeeId: number | null;
  isSuperAdmin: boolean;
  branchId: number | null;
  branchSlug: string | null;
  /** اسم الفرع بالعربية (من Branch.name) */
  branchName: string | null;
  /** اسم الموظف أو البريد — ليس اسم الفرع */
  displayName: string;
  /** مصفوفة الصلاحيات الممنوحة للموظف (فارغة لمدير النظام) */
  permissions: string[];
};

function getSessionSecret(): string | undefined {
  return process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function parseAdminSessionToken(raw: string | undefined | null): AdminSession | null {
  const secret = getSessionSecret();
  if (!secret || !raw) return null;
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
  const expected = signPayload(payload, secret);
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  let data: AdminSession;
  try {
    data = JSON.parse(payload) as AdminSession;
  } catch {
    return null;
  }
  if (typeof data.exp !== "number" || data.exp <= Date.now()) return null;
  if (typeof data.isSuperAdmin !== "boolean") return null;
  if (data.employeeId != null && typeof data.employeeId !== "number") return null;
  if (data.branchId != null && typeof data.branchId !== "number") return null;
  if (data.branchSlug != null && typeof data.branchSlug !== "string") return null;
  if (data.branchName != null && typeof data.branchName !== "string") return null;
  if (typeof data.displayName !== "string") return null;
  if (!Array.isArray(data.permissions)) return null;
  if (!data.isSuperAdmin && !data.branchSlug && data.permissions.length === 0) {
    // We used to block no-branch entirely, but now a headquarters employee might have no branch but HAS permissions.
    // However, if they have no branch AND no permissions, they're useless. We'll allow it anyway for valid tokens, 
    // access control will handle the rest.
  }
  return data;
}

export function createAdminSessionTokenPayload(
  session: Omit<AdminSession, "exp">,
): string {
  const secret = getSessionSecret();
  if (!secret) throw new Error("ADMIN_SESSION_SECRET or ADMIN_PASSWORD is not set");
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = JSON.stringify({ ...session, exp } satisfies AdminSession);
  const sig = signPayload(payload, secret);
  return Buffer.from(payload).toString("base64url") + "." + sig;
}
