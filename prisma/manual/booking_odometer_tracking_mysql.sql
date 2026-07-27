-- تتبع الكيلومترات على الحجز: قراءة العداد عند التسليم وعند الإرجاع (MySQL)
-- نفّذ بعد النسخ الاحتياطي. أو استخدم: npx prisma db push

ALTER TABLE `BookingRequest`
  ADD COLUMN `odometerAtPickupKm` INT NULL,
  ADD COLUMN `odometerAtReturnKm` INT NULL;
