-- إضافة نسبة الضريبة لجدول CarModel (يطابق prisma/schema.prisma)
-- نفّذه على MySQL ثم: npx prisma generate

ALTER TABLE `CarModel`
  ADD COLUMN `vatRatePercent` INT NOT NULL DEFAULT 15 AFTER `price`;
