-- CreateTable: CustomizedCoupon
-- كود خصم مخصَّص لعميل واحد بعينه (برقم جواله) — يُفحص أولاً قبل جدول CouponCode
-- العام عند إدخال العميل لأي كود في صفحة الدفع. نسخة مبسّطة: بلا
-- appliesTo/canBypassMinPrice/perCustomerLimit، واستخدام واحد فقط ثم يُقفل الكود.
CREATE TABLE IF NOT EXISTS `CustomizedCoupon` (
  `id`                     INT                                NOT NULL AUTO_INCREMENT,
  `code`                   VARCHAR(32)                        NOT NULL,
  `customerPhone`          VARCHAR(20)                        NOT NULL,
  `kind`                   ENUM('PERCENT', 'FIXED')           NOT NULL,
  `value`                  INT                                NOT NULL,
  `scope`                  ENUM('RENTAL_ONLY', 'FULL_TOTAL')  NOT NULL,
  `endsAt`                 DATETIME(3)                        NULL,
  `isActive`               BOOLEAN                            NOT NULL DEFAULT true,
  `isUsed`                 BOOLEAN                            NOT NULL DEFAULT false,
  `usedAt`                 DATETIME(3)                        NULL,
  `usedByBookingRequestId` INT                                NULL,
  `createdByEmployeeId`    INT                                NULL,
  `createdAt`              DATETIME(3)                        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`              DATETIME(3)                        NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `CustomizedCoupon_code_customerPhone_key` (`code`, `customerPhone`),
  INDEX `CustomizedCoupon_customerPhone_idx` (`customerPhone`),
  INDEX `CustomizedCoupon_isActive_idx` (`isActive`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
