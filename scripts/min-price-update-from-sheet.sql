-- تحديث الحد الأدنى للسعر اليومي (دون ضريبة) — CarModel.minPricePerDayExclTax
-- المصدر: جدول الإكسل (الصفوف 9 → 30) — عمود الحد الأدنى الجديد بنفس ترتيب الصفوف.
-- الأرقام بتتحط زي ما هي في عمود «دون ضريبة».
--
-- الاستخدام في phpMyAdmin:
--   1) شغّل «الخطوة 1» لوحدها وراجع النتيجة (عمود will_change = 1 هي اللي هتتغير).
--   2) لو تمام، شغّل «الخطوة 2».
--   3) شغّل «الخطوة 3» لو عايز الفروع اللي ليها حد خاص ترجع تاخد حد الموديل.
--   4) شغّل «الخطوة 1» تاني للتأكد إن كل الصفوف بقت will_change = 0.
--
-- ملاحظة: اسم ماركة/موديل وينجل مختلف بين الداتابيزات («Wingle 7» / «وينجل 7»،
-- «Wingle Pickup» / «ونيت بيك اب»)، فصفوف وينجل (‎~wingle‎) بتطابق أي ماركة فيها
-- «وينجل» أو «wingle» وأي موديل في نفس السنة. راجع عمودي db_brand و db_model
-- في المعاينة للتأكد إن الموديلات اللي اتطابقت هي المقصودة.


-- ═══════════════════════ الخطوة 1: معاينة (مفيش تعديل) ═══════════════════════

SELECT
  t.brand, t.model, t.yr,
  b.name                    AS db_brand,
  cm.name                   AS db_model,
  cm.id                     AS model_id,
  cm.price                  AS base_price,
  cm.minPricePerDayExclTax  AS current_min,
  t.new_min,
  CASE
    WHEN cm.id IS NULL THEN 'NOT FOUND'
    WHEN cm.minPricePerDayExclTax <=> t.new_min THEN '0'
    ELSE '1'
  END AS will_change,
  (SELECT GROUP_CONCAT(CONCAT('branch ', f.branchId, ' = ', f.minPricePerDayExclTax))
     FROM Fleet f
    WHERE f.modelId = cm.id AND f.minPricePerDayExclTax IS NOT NULL) AS branch_overrides
FROM (
            SELECT 'كيا'      AS brand, 'بيجاس'          AS model, 2023 AS yr, 86.00 AS new_min
  UNION ALL SELECT 'كيا',      'بيجاس',          2024,  89.00
  UNION ALL SELECT 'كيا',      'بيجاس',          2025,  92.00
  UNION ALL SELECT 'هيونداي',  'جراند اي 10',    2024,  86.00
  UNION ALL SELECT 'هيونداي',  'جراند اي 10',    2025,  86.00
  UNION ALL SELECT 'سوزوكي',   'ديزاير',         2024,  86.00
  UNION ALL SELECT 'تويوتا',   'رايز',           2023,  94.00
  UNION ALL SELECT 'هيونداي',  'ستاريا',         2024, 312.00
  UNION ALL SELECT 'هيونداي',  'سوناتا',         2023, 164.00
  UNION ALL SELECT 'هيونداي',  'سوناتا',         2024, 180.00
  UNION ALL SELECT 'هيونداي',  'سوناتا',         2025, 213.00
  UNION ALL SELECT 'تويوتا',   'فيلوز',          2023, 148.00
  UNION ALL SELECT 'هيونداي',  'فينو',           2024, 107.00
  UNION ALL SELECT 'هيونداي',  'فينو',           2025, 115.00
  UNION ALL SELECT 'كيا',      'كارينز',         2024, 174.00
  UNION ALL SELECT 'تويوتا',   'كامرى',          2023, 164.00
  UNION ALL SELECT 'تويوتا',   'كورولا',         2023, 123.00
  UNION ALL SELECT '~wingle',  '~any',           2025, 179.00
  UNION ALL SELECT '~wingle',  '~any',           2024, 179.00
  UNION ALL SELECT '~wingle',  '~any',           2023, 179.00
  UNION ALL SELECT 'تويوتا',   'يارس',           2023,  90.00
  UNION ALL SELECT 'تويوتا',   'يارس',           2024,  90.00
) t
LEFT JOIN Brand b    ON b.name = t.brand
                     OR (t.brand = '~wingle' AND (b.name LIKE '%وينجل%' OR LOWER(b.name) LIKE '%wingle%'))
LEFT JOIN CarModel cm ON cm.brandId = b.id AND cm.year = t.yr
                     AND (cm.name = t.model OR t.model = '~any')
ORDER BY will_change DESC, t.brand, t.model, t.yr;


-- ═══════════════════════ الخطوة 2: التحديث ═══════════════════════
-- بيغيّر بس الصفوف اللي قيمتها مختلفة (will_change = 1).

UPDATE CarModel cm
JOIN Brand b ON b.id = cm.brandId
JOIN (
            SELECT 'كيا'      AS brand, 'بيجاس'          AS model, 2023 AS yr, 86.00 AS new_min
  UNION ALL SELECT 'كيا',      'بيجاس',          2024,  89.00
  UNION ALL SELECT 'كيا',      'بيجاس',          2025,  92.00
  UNION ALL SELECT 'هيونداي',  'جراند اي 10',    2024,  86.00
  UNION ALL SELECT 'هيونداي',  'جراند اي 10',    2025,  86.00
  UNION ALL SELECT 'سوزوكي',   'ديزاير',         2024,  86.00
  UNION ALL SELECT 'تويوتا',   'رايز',           2023,  94.00
  UNION ALL SELECT 'هيونداي',  'ستاريا',         2024, 312.00
  UNION ALL SELECT 'هيونداي',  'سوناتا',         2023, 164.00
  UNION ALL SELECT 'هيونداي',  'سوناتا',         2024, 180.00
  UNION ALL SELECT 'هيونداي',  'سوناتا',         2025, 213.00
  UNION ALL SELECT 'تويوتا',   'فيلوز',          2023, 148.00
  UNION ALL SELECT 'هيونداي',  'فينو',           2024, 107.00
  UNION ALL SELECT 'هيونداي',  'فينو',           2025, 115.00
  UNION ALL SELECT 'كيا',      'كارينز',         2024, 174.00
  UNION ALL SELECT 'تويوتا',   'كامرى',          2023, 164.00
  UNION ALL SELECT 'تويوتا',   'كورولا',         2023, 123.00
  UNION ALL SELECT '~wingle',  '~any',           2025, 179.00
  UNION ALL SELECT '~wingle',  '~any',           2024, 179.00
  UNION ALL SELECT '~wingle',  '~any',           2023, 179.00
  UNION ALL SELECT 'تويوتا',   'يارس',           2023,  90.00
  UNION ALL SELECT 'تويوتا',   'يارس',           2024,  90.00
) t ON (b.name = t.brand
        OR (t.brand = '~wingle' AND (b.name LIKE '%وينجل%' OR LOWER(b.name) LIKE '%wingle%')))
     AND cm.year = t.yr
     AND (cm.name = t.model OR t.model = '~any')
SET cm.minPricePerDayExclTax = t.new_min,
    cm.updatedAt = NOW(3)
WHERE NOT (cm.minPricePerDayExclTax <=> t.new_min);


-- ═══════════ الخطوة 3: إلغاء الحد الأدنى الخاص بالفروع لنفس الموديلات ═══════════
-- حد الفرع (Fleet.minPricePerDayExclTax) بيغلب حد الموديل. حالياً:
--   • بيجاس 2025: كل الفروع عاملة حد خاص = 115 → من غير الخطوة دي هيفضل 115 مش 92.
--   • Wingle Pickup 2025: فرع 11 حد خاص = 1 → الحد ملغي عملياً في الفرع ده.
-- الأمر ده بيمسح حد الفروع بتاع موديلات الجدول بس، فترجع تاخد حد الموديل الجديد.

UPDATE Fleet f
JOIN CarModel cm ON cm.id = f.modelId
JOIN Brand b ON b.id = cm.brandId
SET f.minPricePerDayExclTax = NULL, f.updatedAt = NOW(3)
WHERE f.minPricePerDayExclTax IS NOT NULL
  AND (b.name, cm.name, cm.year) IN (
    ('كيا', 'بيجاس', 2023), ('كيا', 'بيجاس', 2024), ('كيا', 'بيجاس', 2025),
    ('هيونداي', 'جراند اي 10', 2024), ('هيونداي', 'جراند اي 10', 2025),
    ('سوزوكي', 'ديزاير', 2024), ('تويوتا', 'رايز', 2023),
    ('هيونداي', 'ستاريا', 2024),
    ('هيونداي', 'سوناتا', 2023), ('هيونداي', 'سوناتا', 2024), ('هيونداي', 'سوناتا', 2025),
    ('تويوتا', 'فيلوز', 2023),
    ('هيونداي', 'فينو', 2024), ('هيونداي', 'فينو', 2025),
    ('كيا', 'كارينز', 2024), ('تويوتا', 'كامرى', 2023), ('تويوتا', 'كورولا', 2023),
    ('تويوتا', 'يارس', 2023), ('تويوتا', 'يارس', 2024)
  )
  OR (f.minPricePerDayExclTax IS NOT NULL
      AND (b.name LIKE '%وينجل%' OR LOWER(b.name) LIKE '%wingle%')
      AND cm.year IN (2023, 2024, 2025));
