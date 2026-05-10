-- إضافة حقول الدفع التجريبي على طلب الحجز (MySQL)
-- نفّذ بعد النسخ الاحتياطي. أو استخدم: npx prisma db push

ALTER TABLE `BookingRequest`
  ADD COLUMN `paymentStatus` VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `paidAt` DATETIME(3) NULL;
