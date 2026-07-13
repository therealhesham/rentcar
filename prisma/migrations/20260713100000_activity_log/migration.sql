-- سجل النشاط: تسجيلات الدخول (عملاء/موظفون) ومشاهدات الصفحات — يُعرض في /admin/logs
CREATE TABLE `ActivityLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kind` VARCHAR(32) NOT NULL,
    `path` VARCHAR(512) NULL,
    `actorLabel` VARCHAR(255) NULL,
    `userId` INTEGER NULL,
    `ip` VARCHAR(64) NULL,
    `userAgent` VARCHAR(512) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ActivityLog_kind_createdAt_idx`(`kind`, `createdAt`),
    INDEX `ActivityLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
