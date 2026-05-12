/** خيار فرع في نماذج الحجز (المعرّف slug يُرسل للـ URL والحجز). */
export type BookingBranchOption = {
  slug: string;
  name: string;
};

/** مدينة نشطة مع فروعها المعروضة في البحث. */
export type BookingCityBranchesOption = {
  slug: string;
  name: string;
  branches: BookingBranchOption[];
};
