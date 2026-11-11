-- ═══════════════════════════════════════════════════════════════════════════
-- استيراد شانجان السفن 2027 — 50 لوحة من ملف الإكسل
-- MySQL 5.7+ / 8 / MariaDB — شغّل الملف كله مرة واحدة (آمن لو اتشغّل تاني: مش بيكرّر)
--
-- ترتيب البيانات في القاعدة:
--   Brand (الماركة)  →  CarModel (الموديل + الأسعار)  →  VehicleUnit (اللوحات)
--                                                    →  Fleet (الكمية لكل فرع = اللي بيحدد التوفّر في الموقع)
-- ═══════════════════════════════════════════════════════════════════════════
SET NAMES utf8mb4;

-- ─── (0) إعدادات راجعها قبل التنفيذ ─────────────────────────────────────────
-- الأسعار من الإكسل، والقاعدة بتخزّنها «دون ضريبة». لو أرقام الإكسل شاملة الضريبة اقسمها على 1.15.
SET @price_day       = 150;
SET @price_day_min   = 135;
SET @price_month     = 2750;
SET @price_month_min = 2500;
-- 0 = مخفية من صفحة الأسطول لحد ما تضيف صورة للموديل من لوحة الإدارة، ثم فعّلها. 1 = تظهر فوراً.
SET @fleet_visible   = 1;

START TRANSACTION;

-- ─── (1) الماركة: شانجان (غير موجودة حالياً) ───────────────────────────────
INSERT INTO Brand (name, nameEn, updatedAt)
SELECT 'شانجان', 'Changan', NOW(3) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM Brand WHERE name = 'شانجان');
SET @brand_id = (SELECT id FROM Brand WHERE name = 'شانجان');

-- ─── (2) الموديل: السفن 2027 — فئة «سيدان صغيرة» زي اكسنت/بيجاس/يارس ─────────
INSERT INTO CarModel
  (name, nameEn, brandId, categoryId, year, chairs, engine, transmission, fuel,
   price, priceMonthlyExclTax, vatRatePercent, minPricePerDayExclTax, minPriceMonthlyExclTax,
   displayOrder, updatedAt)
SELECT 'السفن', 'Alsvin', @brand_id, (SELECT id FROM FleetCategory WHERE slug = 'sedan-small'),
       2027, 5, 'غير محدد', 'AUTOMATIC', 'GASOLINE',
       @price_day, @price_month, 15, @price_day_min, @price_month_min,
       (SELECT COALESCE(MAX(displayOrder), 0) + 1 FROM CarModel cm2), NOW(3)
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM CarModel WHERE brandId = @brand_id AND name = 'السفن' AND year = 2027);
SET @model_id = (SELECT id FROM CarModel WHERE brandId = @brand_id AND name = 'السفن' AND year = 2027);

-- ─── (3) اللوحات — لو لوحة موجودة بالفعل بتتحدّث ─────────────────────────────
INSERT INTO VehicleUnit (plateNumber, color, carModelId, branchId, status, notes, updatedAt)
VALUES
  ('س ص ق 7833', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='ared'), 'AVAILABLE', 'العداد عند الإضافة: 483 كم', NOW(3)),
  ('س ص ق 7840', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='ared'), 'RENTED', 'العداد عند الإضافة: 741 كم', NOW(3)),
  ('س ص ق 7846', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='ared'), 'RENTED', 'العداد عند الإضافة: 588 كم', NOW(3)),
  ('س ص ق 7850', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='ared'), 'RENTED', 'العداد عند الإضافة: 1571 كم', NOW(3)),
  ('س ص ق 7857', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='ared'), 'RENTED', 'العداد عند الإضافة: 0 كم', NOW(3)),
  ('س ص ق 7858', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='ared'), 'RENTED', 'العداد عند الإضافة: 0 كم', NOW(3)),
  ('س ص ق 7859', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='ared'), 'RENTED', 'العداد عند الإضافة: 0 كم', NOW(3)),
  ('س ص ق 7860', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='ared'), 'RENTED', 'العداد عند الإضافة: 0 كم', NOW(3)),
  ('س ص ق 7861', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='ared'), 'RENTED', 'العداد عند الإضافة: 0 كم', NOW(3)),
  ('س ص ق 7862', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='ared'), 'RENTED', 'العداد عند الإضافة: 699 كم', NOW(3)),
  ('س ص ق 7866', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='ared'), 'RENTED', 'العداد عند الإضافة: 0 كم', NOW(3)),
  ('س ص ق 7867', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='ared'), 'RENTED', 'العداد عند الإضافة: 27 كم', NOW(3)),
  ('س ص ق 7868', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='ared'), 'RENTED', 'العداد عند الإضافة: 0 كم', NOW(3)),
  ('س ص ق 7874', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='ared'), 'RENTED', 'العداد عند الإضافة: 1101 كم', NOW(3)),
  ('س ص ق 7883', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='ared'), 'AVAILABLE', 'العداد عند الإضافة: 1393 كم', NOW(3)),
  ('س ص ق 7855', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='aziziyah'), 'AVAILABLE', 'العداد عند الإضافة: 1382 كم', NOW(3)),
  ('س ص ق 7865', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='aziziyah'), 'RENTED', 'العداد عند الإضافة: 227 كم', NOW(3)),
  ('س ص ق 7870', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='aziziyah'), 'AVAILABLE', 'العداد عند الإضافة: 1561 كم', NOW(3)),
  ('س ص ق 7873', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='aziziyah'), 'AVAILABLE', 'العداد عند الإضافة: 488 كم', NOW(3)),
  ('س ص ق 7879', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='aziziyah'), 'AVAILABLE', 'العداد عند الإضافة: 813 كم', NOW(3)),
  ('س ص ق 7880', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='aziziyah'), 'AVAILABLE', 'العداد عند الإضافة: 1631 كم', NOW(3)),
  ('س ص ق 7881', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='aziziyah'), 'RENTED', 'العداد عند الإضافة: 576 كم', NOW(3)),
  ('س ص ق 7882', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='aziziyah'), 'RENTED', 'العداد عند الإضافة: 1303 كم', NOW(3)),
  ('س ص ق 7834', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='anbryiah'), 'AVAILABLE', 'العداد عند الإضافة: 2508 كم', NOW(3)),
  ('س ص ق 7842', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='anbryiah'), 'AVAILABLE', 'العداد عند الإضافة: 319 كم', NOW(3)),
  ('س ص ق 7853', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='anbryiah'), 'AVAILABLE', 'العداد عند الإضافة: 2508 كم', NOW(3)),
  ('س ص ق 7863', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='anbryiah'), 'RENTED', 'العداد عند الإضافة: 1131 كم', NOW(3)),
  ('س ص ق 7864', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='anbryiah'), 'AVAILABLE', 'العداد عند الإضافة: 2266 كم', NOW(3)),
  ('س ص ق 7872', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='anbryiah'), 'RENTED', 'العداد عند الإضافة: 1260 كم', NOW(3)),
  ('س ص ق 7875', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='anbryiah'), 'AVAILABLE', 'العداد عند الإضافة: 1656 كم', NOW(3)),
  ('س ص ق 7876', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='anbryiah'), 'RENTED', 'العداد عند الإضافة: 436 كم', NOW(3)),
  ('س ص ق 7832', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='mruj'), 'AVAILABLE', 'العداد عند الإضافة: 298 كم', NOW(3)),
  ('س ص ق 7837', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='mruj'), 'AVAILABLE', 'العداد عند الإضافة: 710 كم', NOW(3)),
  ('س ص ق 7838', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='mruj'), 'RENTED', 'العداد عند الإضافة: 48 كم', NOW(3)),
  ('س ص ق 7844', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='mruj'), 'AVAILABLE', 'العداد عند الإضافة: 1060 كم', NOW(3)),
  ('س ص ق 7849', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='mruj'), 'RENTED', 'العداد عند الإضافة: 443 كم', NOW(3)),
  ('س ص ق 7852', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='mruj'), 'RENTED', 'العداد عند الإضافة: 276 كم', NOW(3)),
  ('س ص ق 7854', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='mruj'), 'RENTED', 'العداد عند الإضافة: 43 كم', NOW(3)),
  ('س ص ق 7856', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='mruj'), 'RENTED', 'العداد عند الإضافة: 244 كم', NOW(3)),
  ('س ص ق 7835', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='palastine-sehaba'), 'AVAILABLE', 'العداد عند الإضافة: 1 كم', NOW(3)),
  ('س ص ق 7836', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='palastine-sehaba'), 'RENTED', 'العداد عند الإضافة: 626 كم', NOW(3)),
  ('س ص ق 7839', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='palastine-sehaba'), 'AVAILABLE', 'العداد عند الإضافة: 1 كم', NOW(3)),
  ('س ص ق 7841', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='palastine-sehaba'), 'AVAILABLE', 'العداد عند الإضافة: 100 كم', NOW(3)),
  ('س ص ق 7845', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='palastine-sehaba'), 'AVAILABLE', 'العداد عند الإضافة: 1 كم', NOW(3)),
  ('س ص ق 7847', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='palastine-sehaba'), 'AVAILABLE', 'العداد عند الإضافة: 603 كم', NOW(3)),
  ('س ص ق 7848', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='palastine-sehaba'), 'AVAILABLE', 'العداد عند الإضافة: 1 كم', NOW(3)),
  ('س ص ق 7851', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='palastine-sehaba'), 'AVAILABLE', 'العداد عند الإضافة: 3333 كم', NOW(3)),
  ('س ص ق 7843', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='king-abdelziz-rd'), 'AVAILABLE', 'العداد عند الإضافة: 791 كم', NOW(3)),
  ('س ص ق 7869', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='king-abdelziz-rd'), 'AVAILABLE', 'العداد عند الإضافة: 727 كم', NOW(3)),
  ('س ص ق 7871', 'ابيض', @model_id, (SELECT id FROM Branch WHERE slug='king-abdelziz-rd'), 'AVAILABLE', 'العداد عند الإضافة: 1086 كم', NOW(3))
ON DUPLICATE KEY UPDATE
  color = VALUES(color), carModelId = VALUES(carModelId), branchId = VALUES(branchId),
  status = VALUES(status), notes = VALUES(notes), updatedAt = NOW(3);

-- ─── (4) الكمية في كل فرع (Fleet) = عدد اللوحات في الفرع ────────────────────
-- الأسعار مش متكرّرة هنا (null) لأنها نفسها في كل الفروع → بتتاخد من الموديل.
INSERT INTO Fleet (modelId, branchId, quantity, isVisible, updatedAt)
VALUES
  (@model_id, (SELECT id FROM Branch WHERE slug='ared'), 15, @fleet_visible, NOW(3)),
  (@model_id, (SELECT id FROM Branch WHERE slug='aziziyah'), 8, @fleet_visible, NOW(3)),
  (@model_id, (SELECT id FROM Branch WHERE slug='anbryiah'), 8, @fleet_visible, NOW(3)),
  (@model_id, (SELECT id FROM Branch WHERE slug='mruj'), 8, @fleet_visible, NOW(3)),
  (@model_id, (SELECT id FROM Branch WHERE slug='palastine-sehaba'), 8, @fleet_visible, NOW(3)),
  (@model_id, (SELECT id FROM Branch WHERE slug='king-abdelziz-rd'), 3, @fleet_visible, NOW(3))
ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), updatedAt = NOW(3);

COMMIT;

-- ─── (5) تحقّق ──────────────────────────────────────────────────────────────
SELECT @brand_id AS brand_id, @model_id AS model_id;
SELECT b.name AS branch, f.quantity, f.isVisible,
       (SELECT COUNT(*) FROM VehicleUnit vu WHERE vu.carModelId = f.modelId AND vu.branchId = f.branchId) AS plates
FROM Fleet f JOIN Branch b ON b.id = f.branchId
WHERE f.modelId = @model_id ORDER BY b.id;
-- المتوقّع: العريض 15، العزيزية 8، العنبرية 8، المروج (تبوك) 8، فلسطين الصحافة 8، طريق الملك عبدالعزيز 3 — المجموع 50
