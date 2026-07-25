import type { FleetCardPriceParts } from "@/lib/pricing";

/** أيقونة + رقم/نص قصير لعرض بطاقة الأسطول */
export type FleetCarSpec = { icon: string; value: string };

export type FleetCar = {
  /** صف `Fleet` — للعرض والمفتاح فقط */
  id: number;
  /** معرّف `CarModel` — للحجز المباشر */
  modelId: number;
  /** اسم الماركة من `Brand.name` */
  brand: string;
  /** اسم الموديل من `CarModel.name` */
  name: string;
  /** سنة الصنع */
  year: number;
  /** ماركة + موديل — للملخصات و`alt` الافتراضي */
  fullTitle: string;
  subtitle: string;
  /** عرض السعر اليومي للزائر (بحسب إعداد الموقع) */
  priceUi: FleetCardPriceParts;
  image: string;
  alt: string;
  badge?: string | null;
  specs: FleetCarSpec[];
  /** المعرفات النصية (slugs) للفروع التي تحتوي كمية متاحة (> 0) من هذا الموديل */
  availableBranchSlugs?: string[];
};
