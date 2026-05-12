-- إنشاء جدول المدن وربط الفروع بها (MySQL / InnoDB).
-- طبّق هذا الملف على قاعدتك إن لم تستخدم `prisma migrate deploy` بعد.

CREATE TABLE `City` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(64) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `City_slug_key`(`slug`),
    INDEX `City_sortOrder_idx`(`sortOrder`),
    INDEX `City_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `City` (`slug`, `name`, `sortOrder`, `isActive`, `createdAt`, `updatedAt`)
VALUES ('general', 'عام', 0, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

ALTER TABLE `Branch` ADD COLUMN `cityId` INTEGER NULL;

UPDATE `Branch` SET `cityId` = (SELECT `id` FROM `City` WHERE `slug` = 'general' LIMIT 1);

ALTER TABLE `Branch` MODIFY COLUMN `cityId` INTEGER NOT NULL;

CREATE INDEX `Branch_cityId_idx` ON `Branch`(`cityId`);

ALTER TABLE `Branch` ADD CONSTRAINT `Branch_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `City`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
