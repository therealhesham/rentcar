import type { AdminBookingDetail } from "@/lib/admin-booking-detail";
import type { EditableBookingRow } from "@/lib/admin-booking-edit-types";
import { resolveBookingKycForDisplay } from "@/lib/booking-kyc-display";
import { resolveBookingRentalPricePerDayExclTax } from "@/lib/booking-pricing-snapshot";
import { bookingOccupiedUntil } from "@/lib/direct-booking";

export function toEditableBookingRow(booking: AdminBookingDetail): EditableBookingRow {
  const kyc = resolveBookingKycForDisplay(booking, booking.customer);

  return {
    id: booking.id,
    kind: booking.kind,
    fullName: booking.fullName,
    phone: booking.phone,
    ageRange: booking.ageRange,
    carType: booking.carType,
    branch:
      booking.returnBranch?.slug ?? booking.pickupBranch?.slug ?? "jeddah",
    pickupMode: booking.pickupMode,
    deliveryLat: booking.deliveryLat,
    deliveryLng: booking.deliveryLng,
    deliveryAddress: booking.deliveryAddress,
    pickupIso: booking.pickupDate.toISOString(),
    dropoffIso: bookingOccupiedUntil({
      pickupDate: booking.pickupDate,
      numberOfDays: booking.numberOfDays,
      addonsJson: booking.addonsJson,
    }).toISOString(),
    numberOfDays: booking.numberOfDays,
    fixedDuration: booking.rentalPeriodKind?.trim().toUpperCase() === "MONTHLY",
    isDailyRental: booking.rentalPeriodKind?.trim().toUpperCase() === "DAILY",
    rentalPricePerDayExclTax: booking.carModel
      ? resolveBookingRentalPricePerDayExclTax(booking.carModel.price, booking.addonsJson)
      : null,
    termsAccepted: booking.termsAccepted,
    status: booking.status,
    carModelId: booking.carModelId,
    carModelLabel: booking.carModel
      ? `${booking.carModel.brand.name} ${booking.carModel.name} ${booking.carModel.year}`
      : null,
    addonsJson: booking.addonsJson,
    paymentStatus: booking.paymentStatus,
    paidAt: booking.paidAt ? booking.paidAt.toISOString() : null,
    paymentMethod: booking.paymentMethod,
    idDocumentKind: kyc.idDocumentKind,
    nationalIdNumber: kyc.nationalIdNumber,
    passportNumber: kyc.passportNumber,
    licenseNumber: kyc.licenseNumber,
    licenseExpiryDate: kyc.licenseExpiryDate,
    idCardImageUrl: kyc.idCardImageUrl,
    driverLicenseImageUrl: kyc.driverLicenseImageUrl,
    cancelledAt: booking.cancelledAt ? booking.cancelledAt.toISOString() : null,
    cancellationDeductedDays: booking.cancellationDeductedDays,
    cancellationRefundAmountSar: booking.cancellationRefundAmountSar,
    cancellationRefundExternalRef: booking.cancellationRefundExternalRef,
    vehiclePlateNumber: booking.vehiclePlateNumber,
    adminNotes: booking.adminNotes,
    cancellationReasonAr: booking.cancellationReasonAr,
    rejectionReasonAr: booking.rejectionReasonAr,
  };
}


