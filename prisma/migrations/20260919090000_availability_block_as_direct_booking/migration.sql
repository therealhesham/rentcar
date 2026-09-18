-- تراجع عن قيمة BLOCK في enum kind (أضيفت بالميجريشن 20260918120000 ولم تُستخدم في أي
-- صف حي — تم التأكد قبل هذه الميجريشن). القرار النهائي: حجوزات "تحديث الاتاحة" تُعامَل
-- كحجز مباشر عادي (kind=DIRECT) لتفادي عشرات نقاط التسريب في لوحة التحكم/الإحصائيات/
-- الإشعارات/تابي التي تفترض أن كل صف = حجز عميل حقيقي بنوع واحد من اثنين فقط.
ALTER TABLE `BookingRequest`
  MODIFY `kind` ENUM('INQUIRY', 'DIRECT') NOT NULL DEFAULT 'INQUIRY';

-- علامة عرض/فلترة فقط لتمييز حجوزات "تحديث الاتاحة" المستوردة بالجملة عن حجز مباشر
-- عادي — إضافية بالكامل، الافتراضي FALSE لكل الصفوف الحالية والجديدة.
ALTER TABLE `BookingRequest`
  ADD COLUMN `isBulkAvailabilityImport` BOOLEAN NOT NULL DEFAULT FALSE;
