-- تتبّع العملاء الذين طلبوا رمز تحقق (OTP) لإتمام الحجز ولم يكملوا خلال 5 دقائق.
-- alertSentAt NULL = لم يُرسَل تنبيه واتساب للمطوّر بعد؛ يُملأ عند الإرسال حتى لا يتكرر عبر تشغيلات الكرون.
ALTER TABLE `BookingCheckoutDraft` ADD COLUMN `alertSentAt` DATETIME(3) NULL;
CREATE INDEX `BookingCheckoutDraft_createdAt_alertSentAt_idx` ON `BookingCheckoutDraft`(`createdAt`, `alertSentAt`);
