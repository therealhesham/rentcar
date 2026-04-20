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
  /** تنسيق عرض لسعر اليوم (القيمة الأصلية دون ضريبة) */
  price: string;
  image: string;
  alt: string;
  badge?: string | null;
  specs: FleetCarSpec[];
};
