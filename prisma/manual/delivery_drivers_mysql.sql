-- سواقو التوصيل + تعيين سواق لرحلتَي التسليم والاستلام على الحجز.
-- تطبيق السواق (NestJS) يقرأ نفس الجداول؛ لوحة الإدارة تنشئ السواقين وتعيّنهم فقط.
CREATE TABLE IF NOT EXISTS `DeliveryDriver` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(255) NOT NULL,
  `phone`        VARCHAR(20)  NOT NULL,
  `passwordHash` VARCHAR(255) NOT NULL,
  `isActive`     BOOLEAN      NOT NULL DEFAULT true,
  `createdAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`    DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `DeliveryDriver_phone_key` (`phone`),
  INDEX `DeliveryDriver_isActive_idx` (`isActive`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `BookingRequest`
  ADD COLUMN `deliveryDriverId` INT NULL,
  ADD COLUMN `deliveryDriverAssignedAt` DATETIME(3) NULL,
  ADD COLUMN `returnDriverId` INT NULL,
  ADD COLUMN `returnDriverAssignedAt` DATETIME(3) NULL;

CREATE INDEX `BookingRequest_deliveryDriverId_idx` ON `BookingRequest`(`deliveryDriverId`);
CREATE INDEX `BookingRequest_returnDriverId_idx` ON `BookingRequest`(`returnDriverId`);

ALTER TABLE `BookingRequest`
  ADD CONSTRAINT `BookingRequest_deliveryDriverId_fkey`
    FOREIGN KEY (`deliveryDriverId`) REFERENCES `DeliveryDriver`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `BookingRequest_returnDriverId_fkey`
    FOREIGN KEY (`returnDriverId`) REFERENCES `DeliveryDriver`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
