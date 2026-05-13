-- CreateTable
CREATE TABLE `BookingCheckoutDraft` (
    `token` VARCHAR(64) NOT NULL,
    `payloadJson` LONGTEXT NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`token`),
    INDEX `BookingCheckoutDraft_expiresAt_idx`(`expiresAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
