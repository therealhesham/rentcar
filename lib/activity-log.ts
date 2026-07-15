import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export type ActivityKind =
  | "CUSTOMER_LOGIN"
  | "ADMIN_LOGIN"
  | "PAGE_VIEW"
  | "CAR_VIEW"
  | "BOOKING_PAYMENT"
  | "BOOKING_REFUND";

/** استخراج IP ومتصفح الزائر من ترويسات الطلب الحالي (server action / route handler). */
export async function currentRequestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const ip = (forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "").slice(0, 64) || null;
    const userAgent = h.get("user-agent")?.slice(0, 512) ?? null;
    return { ip, userAgent };
  } catch {
    return { ip: null, userAgent: null };
  }
}

/**
 * تسجيل حدث في سجل النشاط. لا يرمي أخطاء أبداً — فشل التسجيل يجب ألا يكسر
 * تسجيل الدخول أو تصفح الموقع.
 */
export async function logActivity(entry: {
  kind: ActivityKind;
  path?: string | null;
  actorLabel?: string | null;
  userId?: number | null;
  carModelId?: number | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        kind: entry.kind,
        path: entry.path?.slice(0, 512) ?? null,
        actorLabel: entry.actorLabel?.slice(0, 255) ?? null,
        userId: entry.userId ?? null,
        carModelId: entry.carModelId ?? null,
        ip: entry.ip?.slice(0, 64) ?? null,
        userAgent: entry.userAgent?.slice(0, 512) ?? null,
      },
    });
  } catch (e) {
    console.error("activity-log: failed to record", e);
  }
}
