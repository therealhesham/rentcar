-- AlterTable: add isVisible and displayOrder to Fleet
ALTER TABLE `Fleet` ADD COLUMN `isVisible` BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE `Fleet` ADD COLUMN `displayOrder` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `Fleet_isVisible_displayOrder_idx` ON `Fleet`(`isVisible`, `displayOrder`);
