/** تسميات عربية موحّدة لحالة وحدة السيارة (اللوحة). */

export const VEHICLE_UNIT_STATUSES = [
  "AVAILABLE",
  "RENTED",
  "MAINTENANCE",
  "INACTIVE",
] as const;

export type VehicleUnitStatus = (typeof VEHICLE_UNIT_STATUSES)[number];

export const VEHICLE_UNIT_STATUS_LABELS_AR: Record<string, string> = {
  AVAILABLE: "متاحة",
  RENTED: "مؤجرة حالياً",
  MAINTENANCE: "في الصيانة",
  INACTIVE: "غير مفعّلة",
};

export function vehicleUnitStatusLabelAr(status: string): string {
  return VEHICLE_UNIT_STATUS_LABELS_AR[status.trim().toUpperCase()] ?? status;
}
