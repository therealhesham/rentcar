-- إعادة تسمية الجدول واستبدال عمود الجوال بمفتاح وجهة عام (جوال أو بريد)
RENAME TABLE `BookingPhoneOtp` TO `BookingCheckoutOtp`;

ALTER TABLE `BookingCheckoutOtp` ADD COLUMN `destinationKey` VARCHAR(320) NULL;

UPDATE `BookingCheckoutOtp` SET `destinationKey` = CONCAT('phone:', `phoneNorm`) WHERE `destinationKey` IS NULL;

ALTER TABLE `BookingCheckoutOtp` DROP INDEX `BookingPhoneOtp_phoneNorm_key`;

ALTER TABLE `BookingCheckoutOtp` DROP COLUMN `phoneNorm`;

ALTER TABLE `BookingCheckoutOtp` MODIFY `destinationKey` VARCHAR(320) NOT NULL;

CREATE UNIQUE INDEX `BookingCheckoutOtp_destinationKey_key` ON `BookingCheckoutOtp`(`destinationKey`);
