-- قائمة سوداء للعملاء: العميل المحظور يُرفض حجزه تلقائياً برسالة عامة
-- (لا يُكشف سبب الرفض). الافتراضي false = لا تأثير على الحسابات القائمة.
ALTER TABLE `User`
    ADD COLUMN `isBlacklisted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `blacklistedAt` DATETIME(3) NULL,
    ADD COLUMN `blacklistReason` VARCHAR(500) NULL;

CREATE INDEX `User_isBlacklisted_idx` ON `User`(`isBlacklisted`);
