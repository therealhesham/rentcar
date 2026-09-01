-- نسخة تنفيذ مباشرة — من غير START TRANSACTION/COMMIT، عشان phpMyAdmin بيقفل
-- الاتصال بعد كل طلب وبيرجع (rollback) أي معاملة مفتوحة من غير COMMIT صريح.
-- كل UPDATE هنا بيتنفّذ ويتثبّت (commit) فوراً لوحده (autocommit الافتراضي في MySQL).
-- انسخ الملف كله والصقه وشغّله دفعة واحدة في مربع SQL بتاع phpMyAdmin.

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

-- تحقق فوري بعد التنفيذ (لازم تشوف 170.43 / 3474.78 على السطر ده لو التنفيذ نجح)
SELECT id, name, year, minPricePerDayExclTax, minPriceMonthlyExclTax
FROM CarModel WHERE id = 125;
