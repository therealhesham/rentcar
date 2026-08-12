-- نوع فترة التسعير وقت الحجز: DAILY | MONTHLY.
-- لازم لإعادة التسعير الصحيحة عند تبديل موديل السيارة من الإدارة — الأرضية والسعر
-- يُحسبان بطريقتين مختلفتين (انظر lib/min-price-floor.ts:applyPriceFloorPerDay).
-- NULL = حجوزات أقدم من هذا الحقل؛ يُرفض عندها تبديل الموديل برسالة واضحة للموظف.
ALTER TABLE `BookingRequest` ADD COLUMN `rentalPeriodKind` VARCHAR(8) NULL;
