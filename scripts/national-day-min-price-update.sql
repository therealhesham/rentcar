-- تحديث الحد الأدنى للسعر (يومي/شهري) على مستوى **الموديل** (CarModel) فقط —
-- وهو المصدر الأساسي اللي كل الفروع بترث سعرها منه ما لم يكن عندها تجاوز خاص
-- في جدول Fleet (per-branch override). هذا السكربت لا يلمس جدول Fleet إطلاقاً.
--
-- المطابقة بـ Brand + CarModel.name + CarModel.year (تطابق القيد الفريد
-- @@unique([brandId, name, year]) في schema.prisma) لتفادي أي التباس لو تكرر
-- نفس الاسم/السنة تحت ماركة مختلفة.
--
-- 1) شغّل SELECT التحقق أولاً وقارن العدد = 29 والقيم "الحالي" مع القيم المتوقعة.
-- 2) شغّل UPDATE داخل معاملة، تحقق من عدد الصفوف المتأثرة، ثم COMMIT يدوياً.

-- ============ 1) تحقق قبل التنفيذ ============
SELECT b.name AS brand, cm.id, cm.name, cm.year,
       cm.minPricePerDayExclTax   AS current_min_day,
       cm.minPriceMonthlyExclTax  AS current_min_month
FROM CarModel cm
JOIN Brand b ON b.id = cm.brandId
WHERE (b.name, cm.name, cm.year) IN (
  ('هيونداي', 'ستاريا', 2024),
  ('وينجل 7', 'ونيت بيك اب', 2025),
  ('وينجل 7', 'ونيت بيك اب', 2024),
  ('هيونداي', 'سوناتا', 2025),
  ('وينجل 7', 'ونيت بيك اب', 2023),
  ('هيونداي', 'سوناتا', 2024),
  ('كيا', 'كارينز', 2024),
  ('كيا', 'K4', 2026),
  ('هيونداي', 'سوناتا', 2023),
  ('تويوتا', 'كامرى', 2023),
  ('تويوتا', 'فيلوز', 2023),
  ('هيونداي', 'النترا', 2024),
  ('هيونداي', 'النترا', 2023),
  ('تويوتا', 'كورولا', 2023),
  ('هيونداي', 'فينو', 2025),
  ('هيونداي', 'اكسنت', 2025),
  ('هيونداي', 'فينو', 2024),
  ('هيونداي', 'اكسنت', 2024),
  ('هيونداي', 'اكسنت', 2023),
  ('كيا', 'بيجاس', 2025),
  ('تويوتا', 'رايز', 2023),
  ('تويوتا', 'يارس', 2024),
  ('كيا', 'بيجاس', 2024),
  ('هيونداي', 'جراند اي 10', 2024),
  ('هيونداي', 'جراند اي 10', 2025),
  ('سوزوكي', 'ديزاير', 2024),
  ('كيا', 'بيجاس', 2023),
  ('كيا', 'بيجاس', 2022),
  ('تويوتا', 'يارس', 2023)
)
ORDER BY b.name, cm.name, cm.year;
-- المتوقع: 29 صف، و current_min_day/current_min_month تطابق عمود "الحالي" في الجدول.

-- ============ 2) التحديث الفعلي ============
START TRANSACTION;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 344.35, cm.minPriceMonthlyExclTax = 5040.00
WHERE b.name = 'هيونداي' AND cm.name = 'ستاريا' AND cm.year = 2024;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 257.39, cm.minPriceMonthlyExclTax = 4431.30
WHERE b.name = 'وينجل 7' AND cm.name = 'ونيت بيك اب' AND cm.year = 2025;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 257.39, cm.minPriceMonthlyExclTax = 4692.17
WHERE b.name = 'وينجل 7' AND cm.name = 'ونيت بيك اب' AND cm.year = 2024;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 257.39, cm.minPriceMonthlyExclTax = 4866.09
WHERE b.name = 'هيونداي' AND cm.name = 'سوناتا' AND cm.year = 2025;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 250.00, cm.minPriceMonthlyExclTax = 3996.52
WHERE b.name = 'وينجل 7' AND cm.name = 'ونيت بيك اب' AND cm.year = 2023;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 220.00, cm.minPriceMonthlyExclTax = 3909.57
WHERE b.name = 'هيونداي' AND cm.name = 'سوناتا' AND cm.year = 2024;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 217.39, cm.minPriceMonthlyExclTax = 3387.83
WHERE b.name = 'كيا' AND cm.name = 'كارينز' AND cm.year = 2024;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 170.43, cm.minPriceMonthlyExclTax = 3822.61
WHERE b.name = 'كيا' AND cm.name = 'K4' AND cm.year = 2026;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 170.43, cm.minPriceMonthlyExclTax = 3474.78
WHERE b.name = 'هيونداي' AND cm.name = 'سوناتا' AND cm.year = 2023;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 170.43, cm.minPriceMonthlyExclTax = 3474.78
WHERE b.name = 'تويوتا' AND cm.name = 'كامرى' AND cm.year = 2023;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 170.43, cm.minPriceMonthlyExclTax = 2692.17
WHERE b.name = 'تويوتا' AND cm.name = 'فيلوز' AND cm.year = 2023;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 160.00, cm.minPriceMonthlyExclTax = 2866.09
WHERE b.name = 'هيونداي' AND cm.name = 'النترا' AND cm.year = 2024;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 150.00, cm.minPriceMonthlyExclTax = 2692.17
WHERE b.name = 'هيونداي' AND cm.name = 'النترا' AND cm.year = 2023;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 150.00, cm.minPriceMonthlyExclTax = 2344.35
WHERE b.name = 'تويوتا' AND cm.name = 'كورولا' AND cm.year = 2023;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 140.00, cm.minPriceMonthlyExclTax = 2605.22
WHERE b.name = 'هيونداي' AND cm.name = 'فينو' AND cm.year = 2025;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 130.00, cm.minPriceMonthlyExclTax = 2257.39
WHERE b.name = 'هيونداي' AND cm.name = 'اكسنت' AND cm.year = 2025;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 130.00, cm.minPriceMonthlyExclTax = 2518.26
WHERE b.name = 'هيونداي' AND cm.name = 'فينو' AND cm.year = 2024;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 120.00, cm.minPriceMonthlyExclTax = 2083.48
WHERE b.name = 'هيونداي' AND cm.name = 'اكسنت' AND cm.year = 2024;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 115.00, cm.minPriceMonthlyExclTax = 1996.52
WHERE b.name = 'هيونداي' AND cm.name = 'اكسنت' AND cm.year = 2023;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 115.00, cm.minPriceMonthlyExclTax = 1909.57
WHERE b.name = 'كيا' AND cm.name = 'بيجاس' AND cm.year = 2025;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 115.00, cm.minPriceMonthlyExclTax = 2344.35
WHERE b.name = 'تويوتا' AND cm.name = 'رايز' AND cm.year = 2023;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 113.00, cm.minPriceMonthlyExclTax = 2083.48
WHERE b.name = 'تويوتا' AND cm.name = 'يارس' AND cm.year = 2024;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 83.48, cm.minPriceMonthlyExclTax = 1735.65
WHERE b.name = 'كيا' AND cm.name = 'بيجاس' AND cm.year = 2024;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 83.48, cm.minPriceMonthlyExclTax = 1735.65
WHERE b.name = 'هيونداي' AND cm.name = 'جراند اي 10' AND cm.year = 2024;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 83.48, cm.minPriceMonthlyExclTax = 1735.65
WHERE b.name = 'هيونداي' AND cm.name = 'جراند اي 10' AND cm.year = 2025;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 83.48, cm.minPriceMonthlyExclTax = 1735.65
WHERE b.name = 'سوزوكي' AND cm.name = 'ديزاير' AND cm.year = 2024;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 83.48, cm.minPriceMonthlyExclTax = 1735.65
WHERE b.name = 'كيا' AND cm.name = 'بيجاس' AND cm.year = 2023;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 83.48, cm.minPriceMonthlyExclTax = 1735.65
WHERE b.name = 'كيا' AND cm.name = 'بيجاس' AND cm.year = 2022;

UPDATE CarModel cm JOIN Brand b ON b.id = cm.brandId
SET cm.minPricePerDayExclTax = 83.48, cm.minPriceMonthlyExclTax = 1996.52
WHERE b.name = 'تويوتا' AND cm.name = 'يارس' AND cm.year = 2023;

-- ============ 3) تحقق بعد التنفيذ (لسه داخل نفس المعاملة) ============
SELECT ROW_COUNT() AS last_statement_affected_rows;

SELECT b.name AS brand, cm.id, cm.name, cm.year,
       cm.minPricePerDayExclTax   AS new_min_day,
       cm.minPriceMonthlyExclTax  AS new_min_month
FROM CarModel cm
JOIN Brand b ON b.id = cm.brandId
WHERE (b.name, cm.name, cm.year) IN (
  ('هيونداي', 'ستاريا', 2024), ('وينجل 7', 'ونيت بيك اب', 2025), ('وينجل 7', 'ونيت بيك اب', 2024),
  ('هيونداي', 'سوناتا', 2025), ('وينجل 7', 'ونيت بيك اب', 2023), ('هيونداي', 'سوناتا', 2024),
  ('كيا', 'كارينز', 2024), ('كيا', 'K4', 2026), ('هيونداي', 'سوناتا', 2023),
  ('تويوتا', 'كامرى', 2023), ('تويوتا', 'فيلوز', 2023), ('هيونداي', 'النترا', 2024),
  ('هيونداي', 'النترا', 2023), ('تويوتا', 'كورولا', 2023), ('هيونداي', 'فينو', 2025),
  ('هيونداي', 'اكسنت', 2025), ('هيونداي', 'فينو', 2024), ('هيونداي', 'اكسنت', 2024),
  ('هيونداي', 'اكسنت', 2023), ('كيا', 'بيجاس', 2025), ('تويوتا', 'رايز', 2023),
  ('تويوتا', 'يارس', 2024), ('كيا', 'بيجاس', 2024), ('هيونداي', 'جراند اي 10', 2024),
  ('هيونداي', 'جراند اي 10', 2025), ('سوزوكي', 'ديزاير', 2024), ('كيا', 'بيجاس', 2023),
  ('كيا', 'بيجاس', 2022), ('تويوتا', 'يارس', 2023)
)
ORDER BY b.name, cm.name, cm.year;

-- تأكّد إن القيم صحّت ثم:
-- COMMIT;
-- (أو ROLLBACK; لو حصل خطأ)
