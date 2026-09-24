-- تصريح استثنائي لكود خصم مخصَّص بالنزول تحت الحد الأدنى للسعر — نفس فكرة
-- CouponCode.canBypassMinPrice بالضبط. الافتراضي false = الحد الأدنى يقصّ
-- الخصم كالمعتاد لكل الأكواد المخصَّصة القائمة (سلوك غير مؤثر رجعياً).
ALTER TABLE `CustomizedCoupon`
    ADD COLUMN `canBypassMinPrice` BOOLEAN NOT NULL DEFAULT false;
