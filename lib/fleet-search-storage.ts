/** حفظ سياق البحث من الرئيسية لتعبئة نموذج «حجز مباشر» في صفحة الأسطول. */
export const FLEET_SEARCH_STORAGE_KEY = "rawaes:fleet-search-v1";

export type StoredFleetSearchContext = {
  rental: "daily" | "weekly";
  mode: "pickup" | "delivery";
  pickupBranch?: string;
  returnBranch: string;
  deliveryLat?: number;
  deliveryLng?: number;
  /** YYYY-MM-DD لحقل تاريخ الحجز */
  pickupDate: string;
  days: number;
};
