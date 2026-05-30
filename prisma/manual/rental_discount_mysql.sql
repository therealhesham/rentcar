-- خصومات التأجير اليومي (MySQL)
-- نفّذ بعد النسخ الاحتياطي. أو استخدم: npx prisma db push

CREATE TABLE IF NOT EXISTS `RentalDiscount` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `labelAr` VARCHAR(255) NOT NULL,
  `kind` ENUM('PERCENT', 'FIXED_DAILY') NOT NULL,
  `value` INT NOT NULL,
  `startsAt` DATETIME(3) NULL,
  `endsAt` DATETIME(3) NULL,
  `brandId` INT NULL,
  `carModelId` INT NULL,
  `branchId` INT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `RentalDiscount_isActive_sortOrder_idx` (`isActive`, `sortOrder`),
  INDEX `RentalDiscount_brandId_idx` (`brandId`),
  INDEX `RentalDiscount_carModelId_idx` (`carModelId`),
  INDEX `RentalDiscount_branchId_idx` (`branchId`),
  INDEX `RentalDiscount_startsAt_endsAt_idx` (`startsAt`, `endsAt`),
  CONSTRAINT `RentalDiscount_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `Brand`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `RentalDiscount_carModelId_fkey` FOREIGN KEY (`carModelId`) REFERENCES `CarModel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `RentalDiscount_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
