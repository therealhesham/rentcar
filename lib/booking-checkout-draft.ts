import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

/** أطول من صلاحية رمز OTP ليعطي المستخدم وقتاً لإدخال الرمز بعد التحقق من البيانات. */
export const BOOKING_CHECKOUT_DRAFT_TTL_MS = 45 * 60 * 1000;

export function newBookingCheckoutDraftToken(): string {
  return randomBytes(32).toString("hex");
}

export async function purgeExpiredBookingCheckoutDrafts(): Promise<void> {
  await prisma.bookingCheckoutDraft.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}

export async function saveBookingCheckoutDraft(opts: {
  token: string;
  payloadJson: string;
  expiresAt: Date;
}): Promise<void> {
  await purgeExpiredBookingCheckoutDrafts();
  await prisma.bookingCheckoutDraft.create({
    data: {
      token: opts.token,
      payloadJson: opts.payloadJson,
      expiresAt: opts.expiresAt,
    },
  });
}

export async function getBookingCheckoutDraftByToken(token: string) {
  return prisma.bookingCheckoutDraft.findUnique({
    where: { token },
  });
}

export async function deleteBookingCheckoutDraftByToken(token: string): Promise<void> {
  await prisma.bookingCheckoutDraft.delete({ where: { token } }).catch(() => {});
}

export type BookingCheckoutDraftPayloadV1 = { v: 1; body: Record<string, unknown> };

export function parseBookingCheckoutDraftPayload(json: string): BookingCheckoutDraftPayloadV1 | null {
  try {
    const raw = JSON.parse(json) as unknown;
    if (!raw || typeof raw !== "object") return null;
    const rec = raw as Record<string, unknown>;
    if (rec.v !== 1) return null;
    const b = rec.body;
    if (!b || typeof b !== "object") return null;
    return { v: 1, body: b as Record<string, unknown> };
  } catch {
    return null;
  }
}
