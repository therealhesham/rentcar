-- معرّف نقرة إعلانات Google (GCLID): يُلتقط من رابط الزيارة ويُحفظ مع الحجز ورسائل التواصل
-- وطلبات الشركات لتصديره لاحقاً ورفع الإحالات دون اتصال. أعمدة اختيارية، لا أثر على السجلات القديمة.
ALTER TABLE `BookingRequest` ADD COLUMN `gclid` VARCHAR(200) NULL;
ALTER TABLE `ContactMessage` ADD COLUMN `gclid` VARCHAR(200) NULL;
ALTER TABLE `CorporateBookingLead` ADD COLUMN `gclid` VARCHAR(200) NULL;
