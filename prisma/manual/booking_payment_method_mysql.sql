-- طريقة الدفع على طلب الحجز (MySQL)
-- نفّذ بعد إنشاء جدول الطلبات؛ إذا كان العمود موجوداً تجاهل خطأ التكرار.

ALTER TABLE `BookingRequest`
  ADD COLUMN `paymentMethod` VARCHAR(24) NULL;
