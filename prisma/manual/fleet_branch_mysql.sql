-- ربط جدول Fleet بالفرع: كل موديل له كمية مستقلة لكل فرع.
-- شغّل مرة واحدة على قاعدة الإنتاج/التطوير بعد نسخ احتياطي.

ALTER TABLE `Fleet` ADD COLUMN `branchId` INT NULL AFTER `modelId`;

-- تعيين الصفوف الحالية لأول فرع نشط (حسب sortOrder)
UPDATE `Fleet` f
SET f.`branchId` = (
  SELECT b.`id` FROM `Branch` b
  WHERE b.`isActive` = 1
  ORDER BY b.`sortOrder` ASC, b.`id` ASC
  LIMIT 1
)
WHERE f.`branchId` IS NULL;

-- نسخ المخزون لباقي الفروع النشطة (نفس الكمية الابتدائية)
INSERT INTO `Fleet` (`modelId`, `branchId`, `quantity`, `createdAt`, `updatedAt`)
SELECT f.`modelId`, b.`id`, f.`quantity`, NOW(3), NOW(3)
FROM `Fleet` f
INNER JOIN `Branch` b ON b.`isActive` = 1 AND b.`id` <> f.`branchId`
WHERE NOT EXISTS (
  SELECT 1 FROM `Fleet` x
  WHERE x.`modelId` = f.`modelId` AND x.`branchId` = b.`id`
);

ALTER TABLE `Fleet`
  ADD CONSTRAINT `Fleet_branchId_fkey`
  FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Fleet`
  ADD UNIQUE INDEX `Fleet_modelId_branchId_key` (`modelId`, `branchId`);

ALTER TABLE `Fleet`
  MODIFY `branchId` INT NOT NULL;
