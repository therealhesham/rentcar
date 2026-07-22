ALTER TABLE `CarModel` ADD COLUMN `displayOrder` INTEGER NOT NULL DEFAULT 0;
CREATE INDEX `CarModel_displayOrder_idx` ON `CarModel`(`displayOrder`);
