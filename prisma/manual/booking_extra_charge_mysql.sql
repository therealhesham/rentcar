-- بنود رسوم إضافية على الحجز (تلفيات، وقود، مخالفات...) — تُضاف لـ balanceDueAtBranchSar (MySQL)
-- نفّذ بعد النسخ الاحتياطي. أو استخدم: npx prisma db push

CREATE TABLE IF NOT EXISTS `BookingExtraCharge` (
  `id`               INT          NOT NULL AUTO_INCREMENT,
  `bookingId`        INT          NOT NULL,
  `kind`             VARCHAR(32)  NOT NULL,
  `description`      TEXT         NOT NULL,
  `amountExclTaxSar` DOUBLE       NOT NULL,
  `isTaxable`        BOOLEAN      NOT NULL DEFAULT false,
  `vatRatePercent`   INT          NOT NULL DEFAULT 0,
  `amountInclTaxSar` DOUBLE       NOT NULL,
  `status`           VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',
  `voidedAt`         DATETIME(3)  NULL,
  `voidedBy`         VARCHAR(128) NULL,
  `voidReason`       VARCHAR(500) NULL,
  `createdBy`        VARCHAR(128) NULL,
  `createdAt`        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`        DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `BookingExtraCharge_bookingId_createdAt_idx` (`bookingId`, `createdAt`),
  INDEX `BookingExtraCharge_status_createdAt_idx`    (`status`, `createdAt`),
  CONSTRAINT `BookingExtraCharge_bookingId_fkey`
    FOREIGN KEY (`bookingId`) REFERENCES `BookingRequest` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
