-- فرع Branch — يطابق prisma/schema.prisma (نفّذه على MySQL يدويًا ثم: npx prisma generate)
-- UTF-8: تأكد أن الاتصال/القاعدة utf8mb4

CREATE TABLE `Branch` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(64) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `tagline` VARCHAR(255) NULL,
  `image` TEXT NULL,
  `alt` TEXT NULL,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `isNew` BOOLEAN NOT NULL DEFAULT FALSE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Branch_slug_key` (`slug`),
  KEY `Branch_sortOrder_idx` (`sortOrder`),
  KEY `Branch_isActive_idx` (`isActive`),
  KEY `Branch_isNew_idx` (`isNew`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- بيانات أولية تتوافق مع النماذج الحالية (قيم branch في الحجز)
INSERT INTO `Branch` (`slug`, `name`, `sortOrder`, `isActive`, `isNew`, `createdAt`, `updatedAt`) VALUES
  ('jeddah', 'جدة', 10, TRUE, FALSE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('madinah', 'المدينة المنورة', 20, TRUE, FALSE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('tabuk', 'تبوك', 30, TRUE, FALSE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

-- إن كان جدول Branch موجودًا من قبل بدون isNew، نفّذ:
-- ALTER TABLE `Branch` ADD COLUMN `isNew` BOOLEAN NOT NULL DEFAULT FALSE AFTER `isActive`;
-- CREATE INDEX `Branch_isNew_idx` ON `Branch` (`isNew`);
