/** تسميات عربية موحّدة لأنواع وحالات صيانة المركبات. */

export const MAINTENANCE_KINDS = [
  "PERIODIC",
  "OIL_CHANGE",
  "TIRES",
  "REPAIR",
  "ACCIDENT",
  "INSPECTION",
  "OTHER",
] as const;

export type MaintenanceKind = (typeof MAINTENANCE_KINDS)[number];

export const MAINTENANCE_STATUSES = ["IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const MAINTENANCE_KIND_LABELS_AR: Record<string, string> = {
  PERIODIC: "صيانة دورية",
  OIL_CHANGE: "تغيير زيت",
  TIRES: "إطارات",
  REPAIR: "إصلاح عطل",
  ACCIDENT: "حادث",
  INSPECTION: "فحص دوري",
  OTHER: "أخرى",
};

export const MAINTENANCE_STATUS_LABELS_AR: Record<string, string> = {
  IN_PROGRESS: "جارية",
  COMPLETED: "منتهية",
  CANCELLED: "ملغاة",
};

export function maintenanceKindLabelAr(kind: string): string {
  return MAINTENANCE_KIND_LABELS_AR[kind.trim().toUpperCase()] ?? kind;
}

export function maintenanceStatusLabelAr(status: string): string {
  return MAINTENANCE_STATUS_LABELS_AR[status.trim().toUpperCase()] ?? status;
}

export function isMaintenanceKind(value: string): value is MaintenanceKind {
  return (MAINTENANCE_KINDS as readonly string[]).includes(value);
}

export function isMaintenanceStatus(value: string): value is MaintenanceStatus {
  return (MAINTENANCE_STATUSES as readonly string[]).includes(value);
}
