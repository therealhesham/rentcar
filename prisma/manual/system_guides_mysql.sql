-- شروحات النظام: أقسام + شروحات (ملفات على Spaces) — MySQL
-- نفّذ بعد النسخ الاحتياطي. أو استخدم: npx prisma db push

CREATE TABLE IF NOT EXISTS `SystemGuideSection` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `SystemGuideSection_isActive_sortOrder_idx` (`isActive`, `sortOrder`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SystemGuide` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `sectionId` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `kind` ENUM('VIDEO', 'IMAGE', 'PDF') NOT NULL,
  `fileUrl` VARCHAR(1024) NOT NULL,
  `fileKey` VARCHAR(512) NOT NULL,
  `originalFileName` VARCHAR(255) NOT NULL,
  `mimeType` VARCHAR(128) NOT NULL,
  `sizeBytes` INT NOT NULL,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `SystemGuide_sectionId_isActive_sortOrder_idx` (`sectionId`, `isActive`, `sortOrder`),
  CONSTRAINT `SystemGuide_sectionId_fkey` FOREIGN KEY (`sectionId`)
    REFERENCES `SystemGuideSection` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
