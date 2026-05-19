-- موظفو لوحة الإدارة (فرع / سوبر أدمن)
CREATE TABLE IF NOT EXISTS `AdminEmployee` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `passwordHash` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NULL,
  `branchId` INT NULL,
  `isSuperAdmin` BOOLEAN NOT NULL DEFAULT false,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `AdminEmployee_email_key`(`email`),
  INDEX `AdminEmployee_branchId_idx`(`branchId`),
  INDEX `AdminEmployee_isActive_idx`(`isActive`),
  CONSTRAINT `AdminEmployee_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
