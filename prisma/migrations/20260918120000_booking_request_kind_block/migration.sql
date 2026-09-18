-- إضافة قيمة BLOCK لعمود kind على BookingRequest — حجب إتاحة إداري (صيانة/تأجير خارجي)
-- عبر استيراد Excel، دون أي حذف أو تعديل على القيم الحالية (INQUIRY/DIRECT). تعديل إضافي
-- بالكامل: الصفوف الحالية غير متأثرة، والـ DEFAULT يبقى INQUIRY كما هو.
ALTER TABLE `BookingRequest`
  MODIFY `kind` ENUM('INQUIRY', 'DIRECT', 'BLOCK') NOT NULL DEFAULT 'INQUIRY';
