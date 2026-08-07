-- الحد الأدنى للسعر (دون ضريبة) + نطاق الخصم (يومي / يومي وشهري)
--
-- 1) حدود السعر الأدنى على مستوى الموديل، مع تجاوز اختياري لكل فرع في `Fleet`.
--    NULL = بلا حد (السلوك الحالي بالضبط) — لذلك الترحيل غير مؤثر على الحجوزات القائمة.
ALTER TABLE `CarModel`
    ADD COLUMN `minPricePerDayExclTax` DOUBLE NULL,
    ADD COLUMN `minPriceMonthlyExclTax` DOUBLE NULL;

ALTER TABLE `Fleet`
    ADD COLUMN `minPricePerDayExclTax` DOUBLE NULL,
    ADD COLUMN `minPriceMonthlyExclTax` DOUBLE NULL;

-- 2) نطاق الخصم. الافتراضي DAILY_ONLY = سلوك النظام قبل هذا التغيير
--    (الخصومات وأكواد الخصم ما كانتش بتمسّ تبويب «شهري» إطلاقاً).
ALTER TABLE `RentalDiscount`
    ADD COLUMN `appliesTo` ENUM('DAILY_ONLY', 'MONTHLY_ONLY', 'DAILY_AND_MONTHLY') NOT NULL DEFAULT 'DAILY_ONLY';

ALTER TABLE `CouponCode`
    ADD COLUMN `appliesTo` ENUM('DAILY_ONLY', 'MONTHLY_ONLY', 'DAILY_AND_MONTHLY') NOT NULL DEFAULT 'DAILY_ONLY';

-- 3) تصريح استثنائي لكود خصم بالنزول تحت الحد الأدنى للسعر.
--    الافتراضي false = الحد الأدنى يقصّ الخصم لكل الأكواد القائمة.
ALTER TABLE `CouponCode`
    ADD COLUMN `canBypassMinPrice` BOOLEAN NOT NULL DEFAULT false;
