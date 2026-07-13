-- مشاهدات السيارات: ربط سجل النشاط بموديل السيارة لعرض «السيارات الأكثر زيارة»
ALTER TABLE `ActivityLog`
    ADD COLUMN `carModelId` INTEGER NULL;

CREATE INDEX `ActivityLog_kind_carModelId_idx` ON `ActivityLog`(`kind`, `carModelId`);
