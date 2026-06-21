/** بيانات الحجز القابلة للتعديل من لوحة الإدارة */
export type EditableBookingRow = {
  id: number;
  kind: "INQUIRY" | "DIRECT";
  fullName: string;
  phone: string;
  ageRange: string;
  carType: string;
  /** slug فرع الإرجاع (حقل النموذج `branch`) */
  branch: string;
  pickupMode: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryAddress: string | null;
  pickupDateYmd: string;
  numberOfDays: number;
  termsAccepted: boolean;
  status: string;
  carModelId: number | null;
  carModelLabel: string | null;
  addonsJson: string | null;
  paymentStatus: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  idDocumentKind: string | null;
  nationalIdNumber: string | null;
  passportNumber: string | null;
  licenseNumber: string | null;
  licenseExpiryDate: string | null;
  idCardImageUrl: string | null;
  driverLicenseImageUrl: string | null;
  cancelledAt: string | null;
  cancellationDeductedDays: number | null;
  cancellationRefundAmountSar: number | null;
  cancellationRefundExternalRef: string | null;
  balanceDueAtBranchSar?: number | null;
};
