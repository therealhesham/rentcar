-- AlterTable: BookingRequest — تتبع الكيلومترات
-- قراءة العداد عند تسليم السيارة للعميل وعند إرجاعها؛ الفرق = المسافة المقطوعة.
ALTER TABLE `BookingRequest`
  ADD COLUMN `odometerAtPickupKm` INTEGER NULL,
  ADD COLUMN `odometerAtReturnKm` INTEGER NULL;
