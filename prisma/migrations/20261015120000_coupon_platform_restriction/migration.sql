-- أكواد مقصورة على قناة واحدة: isMobileOnly يرفضه الموقع الإلكتروني (newrent)،
-- isWebOnly يرفضه سيرفر تطبيق الجوال (rentapi). الافتراضي false = بلا تغيير
-- على الأكواد القائمة، تسري على كل القنوات كالمعتاد.
ALTER TABLE `CouponCode`
    ADD COLUMN `isMobileOnly` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isWebOnly` BOOLEAN NOT NULL DEFAULT false;
