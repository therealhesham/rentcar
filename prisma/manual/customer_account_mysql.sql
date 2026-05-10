-- حساب عميل: كلمة مرور وجوال على User + ربط الحجز (MySQL)
-- نفّذ بعد النسخ الاحتياطي أو استخدم: npx prisma db push

ALTER TABLE `User`
  MODIFY COLUMN `email` VARCHAR(255) NOT NULL,
  ADD COLUMN `passwordHash` VARCHAR(255) NULL,
  MODIFY COLUMN `name` VARCHAR(255) NULL,
  ADD COLUMN `phone` VARCHAR(16) NULL;

CREATE UNIQUE INDEX `User_phone_key` ON `User` (`phone`);

ALTER TABLE `BookingRequest`
  ADD COLUMN `customerId` INT NULL,
  ADD INDEX `BookingRequest_customerId_idx` (`customerId`);

ALTER TABLE `BookingRequest`
  ADD CONSTRAINT `BookingRequest_customerId_fkey`
  FOREIGN KEY (`customerId`) REFERENCES `User` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `User`
  ADD COLUMN `isAdmin` BOOLEAN NOT NULL DEFAULT false;
