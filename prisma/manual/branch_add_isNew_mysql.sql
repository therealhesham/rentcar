-- ترقية: إضافة isNew لجدول Branch موجود مسبقًا
-- نفّذ مرة واحدة إذا أنشأت الجدول قبل إضافة العمود

ALTER TABLE `Branch`
  ADD COLUMN `isNew` BOOLEAN NOT NULL DEFAULT FALSE AFTER `isActive`;

CREATE INDEX `Branch_isNew_idx` ON `Branch` (`isNew`);
