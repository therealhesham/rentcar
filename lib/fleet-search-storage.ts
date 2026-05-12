/** حفظ سياق البحث من الرئيسية لتعبئة نموذج «حجز مباشر» في صفحة الأسطول. */
export const FLEET_SEARCH_STORAGE_KEY = "rawaes:fleet-search-v1";

export type StoredFleetSearchContext = {
  rental: "daily" | "weekly" | "monthly" | "monthly_packages";
  mode: "pickup" | "delivery";
  pickupBranch?: string;
  returnBranch: string;
  /** slug مدينة الاستلام أو مدينة عنوان التوصيل (لرسوم الشحن بين المدن) */
  pickupCitySlug?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  /** عنوان توصيل نصّي (بديل أو إضافة للخريطة). */
  deliveryAddress?: string;
  /** YYYY-MM-DD لحقل تاريخ الحجز */
  pickupDate: string;
  days: number;
};
