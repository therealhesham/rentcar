

-- CreateTable
CREATE TABLE `BookingPhoneOtp` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `phoneNorm` VARCHAR(16) NOT NULL,
    `codeHash` VARCHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `verifyAttempts` INTEGER NOT NULL DEFAULT 0,
    `lastSentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BookingPhoneOtp_phoneNorm_key`(`phoneNorm`),
    INDEX `BookingPhoneOtp_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
