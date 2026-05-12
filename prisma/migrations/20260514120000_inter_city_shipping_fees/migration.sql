-- CreateTable
CREATE TABLE `InterCityShippingFee` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fromCityId` INTEGER NOT NULL,
    `toCityId` INTEGER NOT NULL,
    `feeExclVatSar` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InterCityShippingFee_fromCityId_toCityId_key`(`fromCityId`, `toCityId`),
    INDEX `InterCityShippingFee_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `InterCityShippingFee` ADD CONSTRAINT `InterCityShippingFee_fromCityId_fkey` FOREIGN KEY (`fromCityId`) REFERENCES `City`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InterCityShippingFee` ADD CONSTRAINT `InterCityShippingFee_toCityId_fkey` FOREIGN KEY (`toCityId`) REFERENCES `City`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
