-- CreateTable
CREATE TABLE `CustomerLoginOtp` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `destinationKey` VARCHAR(320) NOT NULL,
    `codeHash` VARCHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `verifyAttempts` INTEGER NOT NULL DEFAULT 0,
    `lastSentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CustomerLoginOtp_destinationKey_key`(`destinationKey`),
    INDEX `CustomerLoginOtp_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
