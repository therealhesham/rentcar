-- سجل صيانة وحدات السيارات (اللوحات) — يظهر في «سجل السيارة» بجانب الحجوزات (MySQL)
-- نفّذ بعد النسخ الاحتياطي. أو استخدم: npx prisma db push

CREATE TABLE IF NOT EXISTS `VehicleMaintenanceLog` (
  `id`                INT          NOT NULL AUTO_INCREMENT,
  `vehicleUnitId`     INT          NOT NULL,
  `kind`              VARCHAR(32)  NOT NULL,
  `status`            VARCHAR(16)  NOT NULL DEFAULT 'IN_PROGRESS',
  `description`       TEXT         NOT NULL,
  `startedAt`         DATETIME(3)  NOT NULL,
  `completedAt`       DATETIME(3)  NULL,
  `costSar`           DOUBLE       NULL,
  `vendorName`        VARCHAR(191) NULL,
  `invoiceRef`        VARCHAR(128) NULL,
  `odometerKm`        INT          NULL,
  `nextDueDate`       DATETIME(3)  NULL,
  `nextDueOdometerKm` INT          NULL,
  `branchId`          INT          NULL,
  `createdBy`         VARCHAR(128) NULL,
  `notes`             VARCHAR(500) NULL,
  `createdAt`         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`         DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `VehicleMaintenanceLog_vehicleUnitId_startedAt_idx` (`vehicleUnitId`, `startedAt`),
  INDEX `VehicleMaintenanceLog_status_startedAt_idx`        (`status`, `startedAt`),
  INDEX `VehicleMaintenanceLog_branchId_idx`                (`branchId`),
  INDEX `VehicleMaintenanceLog_nextDueDate_idx`             (`nextDueDate`),
  CONSTRAINT `VehicleMaintenanceLog_vehicleUnitId_fkey`
    FOREIGN KEY (`vehicleUnitId`) REFERENCES `VehicleUnit` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `VehicleMaintenanceLog_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `Branch` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
