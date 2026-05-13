-- AlterTable: مستندات الهوية والرخصة قبل إتمام الحجز المباشر
ALTER TABLE `BookingRequest` ADD COLUMN `idDocumentKind` VARCHAR(24) NULL;
ALTER TABLE `BookingRequest` ADD COLUMN `nationalIdNumber` VARCHAR(16) NULL;
ALTER TABLE `BookingRequest` ADD COLUMN `passportNumber` VARCHAR(32) NULL;
ALTER TABLE `BookingRequest` ADD COLUMN `licenseNumber` VARCHAR(64) NULL;
ALTER TABLE `BookingRequest` ADD COLUMN `idCardImageUrl` TEXT NULL;
ALTER TABLE `BookingRequest` ADD COLUMN `driverLicenseImageUrl` TEXT NULL;
