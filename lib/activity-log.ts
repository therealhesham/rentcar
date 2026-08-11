import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export type ActivityKind =
  | "CUSTOMER_LOGIN"
  | "ADMIN_LOGIN"
  | "PAGE_VIEW"
  | "CAR_VIEW"
  | "BOOK_NOW_CLICK"
  | "OR_SIMILAR_CONFIRM"
  | "OR_SIMILAR_DISMISS"
  | "DATES_MODAL_SHOWN"
  | "DATES_MODAL_CONFIRM"
  | "CAR_UNAVAILABLE"
  | "CHECKOUT_SUBMIT"
  | "CHECKOUT_ERROR"
  | "BOOKING_PAYMENT"
  | "BOOKING_REFUND";

/**
 * الأحداث التي يُسمح للمتصفح بإرسالها عبر `/api/track/view`. تسجيلات الدخول
 * والدفع تُدوَّن من الخادم فقط، وإلا لأمكن لأي زائر تلفيقها.
 */
export const CLIENT_TRACKABLE_KINDS = [
  "PAGE_VIEW",
  "CAR_VIEW",
  "BOOK_NOW_CLICK",
  "OR_SIMILAR_CONFIRM",
  "OR_SIMILAR_DISMISS",
  "DATES_MODAL_SHOWN",
  "DATES_MODAL_CONFIRM",
  "CAR_UNAVAILABLE",
  "CHECKOUT_SUBMIT",
  "CHECKOUT_ERROR",
] as const satisfies readonly ActivityKind[];

export type ClientTrackableKind = (typeof CLIENT_TRACKABLE_KINDS)[number];

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
 * تطبيع المصدر إلى نطاقه فقط (`google.com`, `instagram.com`…) — الرابط الكامل يطول
 * ويحمل معرّفات تتبّع لا تفيدنا. المصادر الداخلية تُعاد كـ `null` لأنها تنقّل لا مصدر.
 */
export function normalizeReferrer(raw: string | null | undefined, selfHost?: string | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  let host: string;
  try {
    host = new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
  if (!host) return null;
  if (selfHost && host === selfHost.replace(/^www\./, "").toLowerCase()) return null;
  return host.slice(0, 255);
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
  referrer?: string | null;
  detail?: string | null;
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
        referrer: entry.referrer?.slice(0, 255) ?? null,
        detail: entry.detail?.slice(0, 255) ?? null,
      },
    });
  } catch (e) {
    console.error("activity-log: failed to record", e);
  }
}
