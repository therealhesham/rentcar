-- اشتراك شهري بالسيارة: خطط اشتراك، اشتراك العميل، المدفوعات، وبيانات الوثائق (MySQL / InnoDB).

CREATE TABLE `SubscriptionPlan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(128) NOT NULL,
    `carModelId` INTEGER NOT NULL,
    `marketingTitleAr` VARCHAR(255) NULL,
    `descriptionAr` TEXT NULL,
    `monthlyPriceSar` INTEGER NOT NULL,
    `mileageKmPerMonth` INTEGER NOT NULL,
    `insuranceIncluded` BOOLEAN NOT NULL DEFAULT true,
    `maintenanceIncluded` BOOLEAN NOT NULL DEFAULT true,
    `depositAmountSar` INTEGER NOT NULL DEFAULT 0,
    `extraKmFeeSarPerKm` INTEGER NOT NULL DEFAULT 3,
    `durationOptionsCsv` VARCHAR(32) NOT NULL DEFAULT '1,3,6,12',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SubscriptionPlan_slug_key`(`slug`),
    INDEX `SubscriptionPlan_carModelId_idx`(`carModelId`),
    INDEX `SubscriptionPlan_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `UserSubscription` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `planId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `durationMonths` INTEGER NOT NULL,
    `startAt` DATETIME(3) NULL,
    `endAt` DATETIME(3) NULL,
    `monthlyPriceSnapshotSar` INTEGER NOT NULL,
    `mileageAllowanceKm` INTEGER NOT NULL,
    `mileageUsedKm` INTEGER NOT NULL DEFAULT 0,
    `depositSnapshotSar` INTEGER NOT NULL DEFAULT 0,
    `autoRenew` BOOLEAN NOT NULL DEFAULT false,
    `rejectionReasonAr` VARCHAR(500) NULL,
    `suspendedReasonAr` VARCHAR(500) NULL,
    `cancelReasonAr` VARCHAR(500) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `lastRenewalReminderAt` DATETIME(3) NULL,
    `nextPaymentDueAt` DATETIME(3) NULL,
    `unpaidNotifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UserSubscription_userId_status_idx`(`userId`, `status`),
    INDEX `UserSubscription_planId_idx`(`planId`),
    INDEX `UserSubscription_status_endAt_idx`(`status`, `endAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SubscriptionPayment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscriptionId` INTEGER NOT NULL,
    `amountSar` INTEGER NOT NULL,
    `vatRatePercent` INTEGER NOT NULL DEFAULT 15,
    `paymentKind` VARCHAR(32) NOT NULL DEFAULT 'INITIAL',
    `status` ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `paymentMethod` VARCHAR(24) NULL,
    `externalRef` VARCHAR(255) NULL,
    `paidAt` DATETIME(3) NULL,
    `idempotencyKey` VARCHAR(128) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SubscriptionPayment_idempotencyKey_key`(`idempotencyKey`),
    INDEX `SubscriptionPayment_subscriptionId_createdAt_idx`(`subscriptionId`, `createdAt`),
    INDEX `SubscriptionPayment_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SubscriptionDocument` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subscriptionId` INTEGER NOT NULL,
    `kind` ENUM('DRIVERS_LICENSE', 'NATIONAL_ID', 'OTHER') NOT NULL,
    `storageRelativePath` VARCHAR(512) NOT NULL,
    `originalFileName` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(128) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `verifiedAt` DATETIME(3) NULL,

    INDEX `SubscriptionDocument_subscriptionId_idx`(`subscriptionId`),
    UNIQUE INDEX `SubscriptionDocument_subscriptionId_kind_key`(`subscriptionId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SubscriptionPlan`
ADD CONSTRAINT `SubscriptionPlan_carModelId_fkey`
FOREIGN KEY (`carModelId`) REFERENCES `CarModel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `UserSubscription`
ADD CONSTRAINT `UserSubscription_planId_fkey`
FOREIGN KEY (`planId`) REFERENCES `SubscriptionPlan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `UserSubscription`
ADD CONSTRAINT `UserSubscription_userId_fkey`
FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `SubscriptionPayment`
ADD CONSTRAINT `SubscriptionPayment_subscriptionId_fkey`
FOREIGN KEY (`subscriptionId`) REFERENCES `UserSubscription`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `SubscriptionDocument`
ADD CONSTRAINT `SubscriptionDocument_subscriptionId_fkey`
FOREIGN KEY (`subscriptionId`) REFERENCES `UserSubscription`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
