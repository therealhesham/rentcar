-- نوع خصم جديد: TO_MIN_PRICE — ينزّل السعر للحد الأدنى المسجّل للمركبة بالضبط.
-- إضافة قيمة للـ enum فقط؛ لا صفوف قائمة تتأثر.
ALTER TABLE `RentalDiscount`
    MODIFY COLUMN `kind` ENUM('PERCENT', 'FIXED_DAILY', 'TO_MIN_PRICE') NOT NULL;
