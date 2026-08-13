import type { BranchOpeningHoursSchedule } from "@/lib/branch-opening-hours";

/** خيار فرع في نماذج الحجز (المعرّف slug يُرسل للـ URL والحجز). */
export type BookingBranchOption = {
  slug: string;
  name: string;
  /** من لوحة الإدارة؛ null = بدون تقييد بمواعيد */
  openingHours: BranchOpeningHoursSchedule | null;
  lat?: number | null;
  lng?: number | null;
  address?: string;
  mapUrl?: string | null;
  deliveryFeePerKmSar?: number;
  phone?: string | null;
};

/** مدينة نشطة مع فروعها المعروضة في البحث. */
export type BookingCityBranchesOption = {
  slug: string;
  name: string;
  branches: BookingBranchOption[];
  /** مركز تقريبي للمدينة (من فروع قاعدة البيانات أو جدول معروف) — للتعرف على مدينة التوصيل. */
  centerLat?: number | null;
  centerLng?: number | null;
};
