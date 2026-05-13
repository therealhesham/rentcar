-- مواعيد عمل الفروع (JSON اختياري؛ NULL = بدون تقييد)
ALTER TABLE `Branch` ADD COLUMN `openingHoursJson` TEXT NULL;
