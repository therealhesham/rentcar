-- مصدر الزيارة وتفصيل الحدث في سجل النشاط (/admin/logs)
-- `referrer`: نطاق المصدر (google.com, instagram.com…) — لمعرفة من أين يأتي الزوار.
-- `detail`:   سياق قصير للحدث، أهمه سبب فشل نموذج الحجز في CHECKOUT_ERROR.
-- نفّذ بعد النسخ الاحتياطي. أو استخدم: npx prisma db push

ALTER TABLE `ActivityLog`
  ADD COLUMN `referrer` VARCHAR(255) NULL,
  ADD COLUMN `detail` VARCHAR(255) NULL;
