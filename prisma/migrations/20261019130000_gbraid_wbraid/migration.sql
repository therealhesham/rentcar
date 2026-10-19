-- معرّفا نقرة إعلانات Google على iOS (gbraid / wbraid) بجوار gclid — يحلّان محله عندما تمنع
-- قيود الخصوصية تمرير gclid. أعمدة اختيارية، لا أثر على السجلات القديمة.
ALTER TABLE `BookingRequest` ADD COLUMN `gbraid` VARCHAR(200) NULL, ADD COLUMN `wbraid` VARCHAR(200) NULL;
ALTER TABLE `ContactMessage` ADD COLUMN `gbraid` VARCHAR(200) NULL, ADD COLUMN `wbraid` VARCHAR(200) NULL;
ALTER TABLE `CorporateBookingLead` ADD COLUMN `gbraid` VARCHAR(200) NULL, ADD COLUMN `wbraid` VARCHAR(200) NULL;
