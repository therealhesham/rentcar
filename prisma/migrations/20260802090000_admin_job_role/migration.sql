-- وظائف إدارية: قالب صلاحيات صفحات مستقل عن الفرع والمدينة.
-- الصلاحيات الفعلية للموظف = صلاحيات وظيفته + AdminEmployee.permissionsJson (إضافات فردية).

CREATE TABLE `AdminJobRole` (
  `id`              INT NOT NULL AUTO_INCREMENT,
  `slug`            VARCHAR(64) NOT NULL,
  `name`            VARCHAR(255) NOT NULL,
  `permissionsJson` TEXT NULL,
  `isActive`        BOOLEAN NOT NULL DEFAULT true,
  `sortOrder`       INT NOT NULL DEFAULT 0,
  `createdAt`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`       DATETIME(3) NOT NULL,

  UNIQUE INDEX `AdminJobRole_slug_key`(`slug`),
  INDEX `AdminJobRole_isActive_idx`(`isActive`),
  INDEX `AdminJobRole_sortOrder_idx`(`sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AdminEmployee` ADD COLUMN `jobRoleId` INT NULL;

CREATE INDEX `AdminEmployee_jobRoleId_idx` ON `AdminEmployee`(`jobRoleId`);

ALTER TABLE `AdminEmployee`
  ADD CONSTRAINT `AdminEmployee_jobRoleId_fkey`
  FOREIGN KEY (`jobRoleId`) REFERENCES `AdminJobRole`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- وظيفة افتراضية: موظف فرع (صفحات التشغيل اليومي). النطاق يظل من فرع/مدينة الموظف.
INSERT INTO `AdminJobRole` (`slug`, `name`, `permissionsJson`, `isActive`, `sortOrder`, `updatedAt`)
VALUES (
  'branch-staff',
  'موظف فرع',
  '["/admin/car-bookings","/admin/bookings","/admin/missed-bookings","/admin/cancelled-bookings","/admin/branch-returns","/admin/late-returns","/admin/customers","/admin/direct-booking","/admin/fleet-availability","/admin/vehicles"]',
  true,
  0,
  CURRENT_TIMESTAMP(3)
);
