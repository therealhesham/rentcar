import type { BookingKycAttachmentInput } from "@/components/admin/BookingAttachmentsPanel";

/** حقول KYC/المرفقات من جدول User (للاستعلام في Prisma). */
export const customerKycSelect = {
  idDocumentKind: true,
  nationalIdNumber: true,
  passportNumber: true,
  licenseNumber: true,
  licenseExpiryDate: true,
  idCardImageUrl: true,
  driverLicenseImageUrl: true,
} as const;

export type CustomerKycSnapshot = {
  idDocumentKind: string | null;
  nationalIdNumber: string | null;
  passportNumber: string | null;
  licenseNumber: string | null;
  licenseExpiryDate: Date | null;
  idCardImageUrl: string | null;
  driverLicenseImageUrl: string | null;
};

type BookingKycLegacy = CustomerKycSnapshot;

function pickStr(booking: string | null | undefined, customer: string | null | undefined): string | null {
  const b = booking?.trim();
  if (b) return b;
  const c = customer?.trim();
  return c || null;
}

/** دمج بيانات الطلب (قديمة) مع حساب العميل (الجديدة) لعرض المرفقات في الإدارة. */
export function resolveBookingKycForDisplay(
  booking: BookingKycLegacy,
  customer: CustomerKycSnapshot | null | undefined,
): BookingKycAttachmentInput {
  const licenseExpiry =
    booking.licenseExpiryDate ?? customer?.licenseExpiryDate ?? null;

  return {
    idDocumentKind: pickStr(booking.idDocumentKind, customer?.idDocumentKind),
    nationalIdNumber: pickStr(booking.nationalIdNumber, customer?.nationalIdNumber),
    passportNumber: pickStr(booking.passportNumber, customer?.passportNumber),
    licenseNumber: pickStr(booking.licenseNumber, customer?.licenseNumber),
    licenseExpiryDate: licenseExpiry
      ? licenseExpiry instanceof Date
        ? licenseExpiry.toISOString().slice(0, 10)
        : String(licenseExpiry).slice(0, 10)
      : null,
    idCardImageUrl: pickStr(booking.idCardImageUrl, customer?.idCardImageUrl),
    driverLicenseImageUrl: pickStr(
      booking.driverLicenseImageUrl,
      customer?.driverLicenseImageUrl,
    ),
  };
}
