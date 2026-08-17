-- جدول مشاهدات صفحات لوحة التحكم — مصدر قسم «الموظفون الأكثر فتحاً» في /admin/insights.
-- نفّذ بعد النسخ الاحتياطي. أو استخدم: npx prisma db push
--
-- الجدول مستقل عن `ActivityLog` عن قصد: سجل النشاط يقيس زوّار الموقع العام (وهو
-- مصدر باقي أقسام الصفحة)، وفي `/admin/logs` استعلامات تقرأه بلا تصفية `kind`
-- (خريطة الزوّار، إحصاء المتصفحات، أكثر المسارات). خلط حركة الموظفين بها كان
-- سيفسد تلك الأرقام بصمت.
--
-- لا يوجد مفتاح أجنبي على `AdminEmployee` عن قصد كذلك: حذف موظف يجب ألا يمحو
-- تاريخ استخدامه ولا يفشل، ولهذا يُخزَّن اسمه نصاً في `employeeLabel`.

CREATE TABLE IF NOT EXISTS `AdminPageView` (
  `id`            INT          NOT NULL AUTO_INCREMENT,
  `employeeId`    INT          NULL,
  `employeeLabel` VARCHAR(255) NULL,
  `isSuperAdmin`  TINYINT(1)   NOT NULL DEFAULT 0,
  `path`          VARCHAR(512) NOT NULL,
  `ip`            VARCHAR(64)  NULL,
  `userAgent`     VARCHAR(512) NULL,
  `createdAt`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `AdminPageView_createdAt_idx` (`createdAt`),
  INDEX `AdminPageView_employeeId_createdAt_idx` (`employeeId`, `createdAt`),
  -- الفهرس على البادئة فقط: MySQL يحدّ مفتاح InnoDB بـ 3072 بايت، و VARCHAR(512)
  -- بترميز utf8mb4 يتجاوزه (512 × 4 = 2048 بايت + عمود التاريخ).
  INDEX `AdminPageView_path_createdAt_idx` (`path`(191), `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
