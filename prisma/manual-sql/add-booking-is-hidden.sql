-- أرشفة الحجوزات: عمود isHidden على BookingRequest.
-- يُنفَّذ يدوياً على قاعدة الإنتاج (car_rental) — سجل الميجريشن غير متزامن فلا تُستخدم prisma migrate.
-- آمن على البيانات القائمة: كل الصفوف تأخذ false افتراضياً فلا يختفي أي حجز.

ALTER TABLE `BookingRequest`
  ADD COLUMN `isHidden` BOOLEAN NOT NULL DEFAULT false;

-- يخدم استعلامات اللوحة وكل الأقسام المالية (فلترة isHidden ثم ترتيب بالتاريخ).
CREATE INDEX `BookingRequest_isHidden_createdAt_idx`
  ON `BookingRequest` (`isHidden`, `createdAt`);
