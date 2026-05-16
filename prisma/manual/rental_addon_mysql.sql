-- إضافات التأجير + عمود لقطة الإضافات على طلب الحجز (MySQL)
-- نفّذ بعد النسخ الاحتياطي. أو استخدم: npx prisma db push

CREATE TABLE IF NOT EXISTS `RentalAddon` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(64) NOT NULL,
  `titleAr` VARCHAR(255) NOT NULL,
  `descriptionAr` TEXT NULL,
  `pricePerDay` INT NOT NULL,
  `iconKey` VARCHAR(32) NULL,
  `exclusiveGroup` VARCHAR(64) NULL,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `RentalAddon_slug_key` (`slug`),
  INDEX `RentalAddon_isActive_sortOrder_idx` (`isActive`, `sortOrder`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `BookingRequest`
  ADD COLUMN `addonsJson` TEXT NULL;

INSERT IGNORE INTO `RentalAddon` (`slug`, `titleAr`, `descriptionAr`, `pricePerDay`, `iconKey`, `exclusiveGroup`, `sortOrder`, `isActive`, `updatedAt`)
VALUES
  ('key-protection', 'أمان المفتاح', NULL, 15, 'key', 'key-protection', 10, true, CURRENT_TIMESTAMP(3)),
  ('key-protection-plus', 'أمان المفتاح بلس', NULL, 35, 'key-plus', 'key-protection', 20, true, CURRENT_TIMESTAMP(3)),
  ('child-seat', 'مقعد طفل', NULL, 10, 'child', NULL, 30, true, CURRENT_TIMESTAMP(3)),
  ('unlimited-km', 'كيلومتر مفتوح', NULL, 40, 'gauge', NULL, 40, true, CURRENT_TIMESTAMP(3));

UPDATE `RentalAddon`
SET `exclusiveGroup` = 'key-protection'
WHERE `slug` IN ('key-protection', 'key-protection-plus')
  AND (`exclusiveGroup` IS NULL OR `exclusiveGroup` = '');
