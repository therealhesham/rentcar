-- ═══════════════════════════════════════════════════════════════════════════
-- إضافة الرمز البريدي للفرع — `Branch.postalCode`
--
-- السبب: بوابة تابي تشترط `shipping_address.zip` في حمولة إنشاء الجلسة (حقل
-- إلزامي في سكيمتها). كنّا نرسل رمزاً واحداً ثابتاً لكل الفروع من
-- `lib/tabby/constants.ts`، وطلب مهندس التكامل (Egor) بيانات عنوان صحيحة.
--
-- العمود اختياري (NULL) عمداً: الفروع القائمة تبقى صالحة، ويظل الثابت
-- `TABBY_FALLBACK_ZIP` احتياطاً لأي فرع لم يُملأ رمزه بعد.
--
-- ⚠️ نفّذه بنفسك. تأكّد أولاً من قاعدة البيانات:  SELECT DATABASE();
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── (1) قبل التنفيذ: تأكّد أن العمود غير موجود ─────────────────────────────
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME   = 'Branch'
  AND COLUMN_NAME  = 'postalCode';
-- المتوقَّع: 0 صفوف


-- ─── (2) الإضافة ────────────────────────────────────────────────────────────
ALTER TABLE `Branch`
  ADD COLUMN `postalCode` VARCHAR(10) NULL AFTER `addressEn`;


-- ─── (3) تعبئة الفروع الحالية ───────────────────────────────────────────────
-- ⚠️ هذه أرقام مدن تقريبية وليست أرقام أحياء المباني الفعلية — **راجعها وصحّحها
-- قبل التنفيذ**. الرمز البريدي السعودي 5 أرقام ويختلف باختلاف الحي.
-- الفروع الفعلية في القاعدة وقت كتابة السكربت:
--   id=6  ared             العريض            (المدينة المنورة)
--   id=7  anbryiah         العنبرية          (المدينة المنورة)
--   id=8  aziziyah         العزيزية          (المدينة المنورة)
--   id=9  palastine-sehaba فلسطين الصحافة    (جدة)
--   id=10 ajawed           الاجاويد          (جدة)
--   id=11 king-abdelziz-rd طريق الملك عبدالعزيز (ينبع)
--   id=12 mruj             حي المروج         (تبوك)

UPDATE `Branch` SET `postalCode` = '42311' WHERE `slug` = 'ared'             AND `postalCode` IS NULL;
UPDATE `Branch` SET `postalCode` = '42311' WHERE `slug` = 'anbryiah'         AND `postalCode` IS NULL;
UPDATE `Branch` SET `postalCode` = '42311' WHERE `slug` = 'aziziyah'         AND `postalCode` IS NULL;
UPDATE `Branch` SET `postalCode` = '23442' WHERE `slug` = 'palastine-sehaba' AND `postalCode` IS NULL;
UPDATE `Branch` SET `postalCode` = '23442' WHERE `slug` = 'ajawed'           AND `postalCode` IS NULL;
UPDATE `Branch` SET `postalCode` = '46455' WHERE `slug` = 'king-abdelziz-rd' AND `postalCode` IS NULL;
UPDATE `Branch` SET `postalCode` = '47912' WHERE `slug` = 'mruj'             AND `postalCode` IS NULL;


-- ─── (4) بعد التنفيذ: تحقّق ─────────────────────────────────────────────────
SELECT id, slug, name, postalCode FROM `Branch` ORDER BY id;
-- أي فرع يبقى NULL سيستخدم `TABBY_FALLBACK_ZIP` تلقائياً — لا يتعطّل شيء.


-- ═══════════════════════════════════════════════════════════════════════════
-- بعد التنفيذ على القاعدة، شغّل محلياً:  npx prisma generate
-- الرمز البريدي قابل للتعديل لاحقاً من لوحة الإدارة (نموذج الفروع).
-- ═══════════════════════════════════════════════════════════════════════════
