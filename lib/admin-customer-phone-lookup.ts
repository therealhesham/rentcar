import { prisma } from "@/lib/prisma";
import { saudiLocalNineToE164 } from "@/lib/normalize-saudi-phone";

const AGE_OPTIONS = new Set(["25-35", "35-50", "50+"]);

export type AdminCustomerPhoneLookup = {
  found: true;
  phoneLocal: string;
  phoneE164: string;
  fullName: string;
  ageRange: string;
  customerId: number | null;
  source: "account" | "booking";
  email: string | null;
  bookingCount: number;
  lastBookingAt: string | null;
};

export async function lookupAdminCustomerByPhone(
  localNine: string,
): Promise<{ ok: true; data: AdminCustomerPhoneLookup | null } | { ok: false; error: string }> {
  const phoneE164 = saudiLocalNineToE164(localNine);
  if (!phoneE164) {
    return { ok: false, error: "رقم الجوال غير صالح." };
  }

  const [user, lastBooking, bookingCount] = await Promise.all([
    prisma.user.findUnique({
      where: { phone: phoneE164 },
      select: { id: true, name: true, email: true },
    }),
    prisma.bookingRequest.findFirst({
      where: { phone: phoneE164 },
      orderBy: { createdAt: "desc" },
      select: {
        fullName: true,
        ageRange: true,
        customerId: true,
        createdAt: true,
      },
    }),
    prisma.bookingRequest.count({ where: { phone: phoneE164 } }),
  ]);

  if (user) {
    const fullName = (user.name?.trim() || lastBooking?.fullName?.trim() || "").trim();
    if (fullName.length < 3) {
      return { ok: true, data: null };
    }
    const ageRaw = lastBooking?.ageRange?.trim() ?? "";
    const ageRange = AGE_OPTIONS.has(ageRaw) ? ageRaw : "25-35";
    return {
      ok: true,
      data: {
        found: true,
        phoneLocal: localNine,
        phoneE164,
        fullName,
        ageRange,
        customerId: user.id,
        source: "account",
        email: user.email,
        bookingCount,
        lastBookingAt: lastBooking?.createdAt.toISOString() ?? null,
      },
    };
  }

  if (lastBooking) {
    const fullName = lastBooking.fullName.trim();
    if (fullName.length < 3) {
      return { ok: true, data: null };
    }
    const ageRaw = lastBooking.ageRange?.trim() ?? "";
    const ageRange = AGE_OPTIONS.has(ageRaw) ? ageRaw : "25-35";
    return {
      ok: true,
      data: {
        found: true,
        phoneLocal: localNine,
        phoneE164,
        fullName,
        ageRange,
        customerId:
          lastBooking.customerId != null && lastBooking.customerId > 0
            ? lastBooking.customerId
            : null,
        source: "booking",
        email: null,
        bookingCount,
        lastBookingAt: lastBooking.createdAt.toISOString(),
      },
    };
  }

  return { ok: true, data: null };
}
