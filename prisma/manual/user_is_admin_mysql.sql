-- عمود isAdmin على جدول المستخدمين (MySQL)
-- نفّذ بعد النسخ الاحتياطي؛ أو: npx prisma db push

ALTER TABLE `User`
  ADD COLUMN `isAdmin` BOOLEAN NOT NULL DEFAULT false;
