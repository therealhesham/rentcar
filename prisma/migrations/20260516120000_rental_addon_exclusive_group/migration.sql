-- مجموعات تعارض الإضافات (إما/أو)
ALTER TABLE `RentalAddon` ADD COLUMN `exclusiveGroup` VARCHAR(64) NULL;

UPDATE `RentalAddon`
SET `exclusiveGroup` = 'key-protection'
WHERE `slug` IN ('key-protection', 'key-protection-plus');
