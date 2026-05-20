import type { AdminBookingDetail } from "@/lib/admin-booking-detail";
import type { EditableBookingRow } from "@/lib/admin-booking-edit-types";

export function toEditableBookingRow(booking: AdminBookingDetail): EditableBookingRow {
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
    pickupDateYmd: booking.pickupDate.toISOString().slice(0, 10),
    numberOfDays: booking.numberOfDays,
    termsAccepted: booking.termsAccepted,
    status: booking.status,
    carModelId: booking.carModelId,
    carModelLabel: booking.carModel
      ? `${booking.carModel.brand.name} ${booking.carModel.name}`
      : null,
    addonsJson: booking.addonsJson,
    paymentStatus: booking.paymentStatus,
    paidAt: booking.paidAt ? booking.paidAt.toISOString() : null,
    paymentMethod: booking.paymentMethod,
    idDocumentKind: booking.idDocumentKind,
    nationalIdNumber: booking.nationalIdNumber,
    passportNumber: booking.passportNumber,
    licenseNumber: booking.licenseNumber,
    licenseExpiryDate: booking.licenseExpiryDate
      ? booking.licenseExpiryDate.toISOString().slice(0, 10)
      : null,
    idCardImageUrl: booking.idCardImageUrl,
    driverLicenseImageUrl: booking.driverLicenseImageUrl,
    cancelledAt: booking.cancelledAt ? booking.cancelledAt.toISOString() : null,
    cancellationDeductedDays: booking.cancellationDeductedDays,
    cancellationRefundAmountSar: booking.cancellationRefundAmountSar,
    cancellationRefundExternalRef: booking.cancellationRefundExternalRef,
  };
}
