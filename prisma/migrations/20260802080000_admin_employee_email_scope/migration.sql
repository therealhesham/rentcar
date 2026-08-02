-- توسعة إشعارات الإيميل: مشرف مدينة (cityId) + TO/CC عام بمعزل عن isSuperAdmin
ALTER TABLE `AdminEmployee`
  ADD COLUMN `cityId` INT NULL,
  ADD COLUMN `notifyGlobalTo` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `notifyGlobalCc` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `AdminEmployee`
  ADD CONSTRAINT `AdminEmployee_cityId_fkey`
  FOREIGN KEY (`cityId`) REFERENCES `City`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
