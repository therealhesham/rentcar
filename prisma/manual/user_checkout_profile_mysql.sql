-- نقل بيانات الهوية/الرخصة إلى حساب العميل (User)
-- نفّذ بعد النسخ الاحتياطي. أو استخدم: npx prisma db push

ALTER TABLE `User`
  ADD COLUMN `idDocumentKind` VARCHAR(24) NULL,
  ADD COLUMN `nationalIdNumber` VARCHAR(16) NULL,
  ADD COLUMN `passportNumber` VARCHAR(32) NULL,
  ADD COLUMN `licenseNumber` VARCHAR(64) NULL,
  ADD COLUMN `licenseExpiryDate` DATE NULL,
  ADD COLUMN `idCardImageUrl` TEXT NULL,
  ADD COLUMN `driverLicenseImageUrl` TEXT NULL;

