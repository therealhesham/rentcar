-- طلبات تواصل حجز الشركات من الويدجت الرئيسية

CREATE TABLE `CorporateBookingLead` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyName` VARCHAR(255) NOT NULL,
    `companyEmail` VARCHAR(255) NOT NULL,
    `taxNumber` VARCHAR(64) NOT NULL,
    `details` TEXT NOT NULL,
    `phone` VARCHAR(32) NOT NULL,
    `status` VARCHAR(24) NOT NULL DEFAULT 'NEW',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `CorporateBookingLead_status_createdAt_idx` ON `CorporateBookingLead`(`status`, `createdAt`);
