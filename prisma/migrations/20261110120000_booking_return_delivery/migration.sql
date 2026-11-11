-- إرجاع السيارة من عنوان العميل (رسوم التوصيل نفسها بالكيلو من فرع الإرجاع).
ALTER TABLE `BookingRequest`
  ADD COLUMN `returnMode` VARCHAR(16) NULL,
  ADD COLUMN `returnLat` DOUBLE NULL,
  ADD COLUMN `returnLng` DOUBLE NULL,
  ADD COLUMN `returnAddress` TEXT NULL;
