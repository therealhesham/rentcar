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
  /** لحظة الاستلام كاملة (تاريخ + وقت) — المودال يعدّل الوقت أيضاً فلا يكفي اليوم. */
  pickupIso: string;
  /**
   * لحظة التسليم المتفق عليها (`bookingOccupiedUntil`): تشمل الساعات الإضافية
   * المحفوظة في لقطة التسعير. اشتقاقها من الاستلام + الأيام فقط كان يُسقط تلك
   * الساعات من المودال، فيمحوها أول حفظ.
   */
  dropoffIso: string;
  numberOfDays: number;
  /** حجز شهري: المدة ثابتة (سعر الشهر مقسوم على أيامه) — لا يُسمح بتغييرها. */
  fixedDuration: boolean;
  /** حجز يومي مؤكَّد النوع — وحده تُحتسب له ساعات التأخير (الأقدم من الحقل: غير معروف). */
  isDailyRental: boolean;
  /** سعر اليوم المجمَّد دون ضريبة — لعرض رسوم ساعات التأخير داخل المودال. */
  rentalPricePerDayExclTax: number | null;
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
  vehiclePlateNumber?: string | null;
  adminNotes?: string | null;
  cancellationReasonAr?: string | null;
  rejectionReasonAr?: string | null;
};


