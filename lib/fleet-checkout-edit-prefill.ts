import { e164ToLocalNine } from "@/lib/normalize-saudi-phone";
import { prisma } from "@/lib/prisma";

export type FleetCheckoutEditPrefill = {
  bookingRequestId: number;
  fullName: string;
  phoneLocal: string;
  email: string | null;
  ageRange: string;
  idDocumentKind: string | null;
  nationalIdNumber: string;
  passportNumber: string;
  licenseNumber: string;
  licenseExpiryYmd: string | null;
  idCardImageUrl: string | null;
  driverLicenseImageUrl: string | null;
  addonIds: number[];
};

const AGE_OPTIONS = new Set(["25-35", "35-50", "50+"]);

function addonIdsFromAddonsJson(raw: string | null): number[] {
  if (!raw?.trim()) return [];
  try {
    const o = JSON.parse(raw) as { items?: unknown };
    if (!Array.isArray(o.items)) return [];
    const ids: number[] = [];
    for (const it of o.items) {
      if (it && typeof it === "object" && "id" in it) {
        const n = Number((it as { id: unknown }).id);
        if (Number.isInteger(n) && n >= 1) ids.push(n);
      }
    }
    return [...new Set(ids)];
  } catch {
    return [];
  }
}

/** إذا لم تُعرَف صيغة +966 — نحاول آخر 9 أرقام تبدأ بـ 5 */
function bookingPhoneToLocalDigits(stored: string): string {
  const via = e164ToLocalNine(stored);
  if (via) return via;
  const d = stored.replace(/\D/g, "");
  if (d.length >= 9) {
    const tail = d.slice(-9);
    if (/^5\d{8}$/.test(tail)) return tail;
  }
  return "";
}

/**
 * بيانات طلب حجز مباشر قائم لملء نموذج الإتمام عند «تعديل الحجز» أو «إعادة حجز» (prefill فقط).
 * يُحمَّل فقط إذا كان الطلب لنفس العميل (حساب أو جوال مسجّل) ولنفس موديل السيارة.
 */
export async function loadFleetCheckoutEditPrefill(args: {
  profile: {
    id: number;
    phone: string | null;
    idDocumentKind: string | null;
    nationalIdNumber: string | null;
    passportNumber: string | null;
    licenseNumber: string | null;
    licenseExpiryDate: Date | null;
    idCardImageUrl: string | null;
    driverLicenseImageUrl: string | null;
  };
  carModelId: number;
  bookingRequestId: number;
}): Promise<FleetCheckoutEditPrefill | null> {
  const { profile, carModelId, bookingRequestId } = args;
  const row = await prisma.bookingRequest.findFirst({
    where: {
      id: bookingRequestId,
      kind: "DIRECT",
      carModelId,
      OR: [
        { customerId: profile.id },
        ...(profile.phone ? [{ phone: profile.phone }] : []),
      ],
    },
    select: {
      id: true,
      fullName: true,
      phone: true,
      contactEmail: true,
      ageRange: true,
      addonsJson: true,
    },
  });
  if (!row) return null;

  const licenseYmd =
    profile.licenseExpiryDate != null && !Number.isNaN(profile.licenseExpiryDate.getTime())
      ? profile.licenseExpiryDate.toISOString().slice(0, 10)
      : null;

  const ar = row.ageRange.trim();
  const ageRange = AGE_OPTIONS.has(ar) ? ar : "25-35";

  const kind = profile.idDocumentKind?.trim().toUpperCase() ?? "";
  const isVisitor =
    kind === "VISITOR" || kind === "RESIDENT_VISITOR";
  const nid = (profile.nationalIdNumber ?? "").replace(/\D/g, "").slice(0, 10);
  const pass = (profile.passportNumber ?? "").trim().toUpperCase().slice(0, 24);

  return {
    bookingRequestId: row.id,
    fullName: row.fullName.trim(),
    phoneLocal: bookingPhoneToLocalDigits(row.phone),
    email: row.contactEmail?.trim() || null,
    ageRange,
    idDocumentKind: kind || null,
    nationalIdNumber: isVisitor ? "" : nid,
    passportNumber: isVisitor ? pass : "",
    licenseNumber: (profile.licenseNumber ?? "").replace(/\D/g, "").slice(0, 10),
    licenseExpiryYmd: licenseYmd,
    idCardImageUrl: profile.idCardImageUrl?.trim() || null,
    driverLicenseImageUrl: profile.driverLicenseImageUrl?.trim() || null,
    addonIds: addonIdsFromAddonsJson(row.addonsJson),
  };
}
