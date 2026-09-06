-- ═══════════════════════════════════════════════════════════════════════════
-- تصحيح بيانات الحجز #244 التالفة بسبب باگ «إشعار الاسترداد يُقرأ كدفعة جديدة»
--
-- ما حدث: بعد استرداد 2026-09-06 14:06:35، أطلقت تابي webhook للاسترداد، فقرأه
-- النظام كتأكيد دفع (الدفعة تبقى `CLOSED` لدى تابي بعد الاسترداد) فأنشأ سطر
-- INITIAL_PAYMENT مكرراً بعد 1.3 ثانية وكتب فوق paidAt بتاريخ الاسترداد.
-- الباگ نفسه أُصلح في الكود (lib/tabby/mark-paid.ts + lib/geidea/mark-paid.ts +
-- app/api/payments/tabby/webhook/route.ts). هذا السكربت يصحّح الأثر المتبقي فقط.
--
-- ⚠️ نفّذه بنفسك بعد المراجعة. تأكّد أنك على قاعدة البيانات الصحيحة أولاً:
--    SELECT DATABASE();
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── (1) قبل التنفيذ: تحقّق أن الحالة كما هو موصوف ───────────────────────────
-- المتوقَّع: 5 أسطر، والسطر id=83 هو المكرر (INITIAL_PAYMENT بعد REFUND مباشرةً)
SELECT id, kind, direction, amountSar, actorName, createdAt
FROM PaymentTransaction
WHERE bookingId = 244
ORDER BY createdAt;

-- المتوقَّع: paidAt = 2026-09-06 14:06:36.807 (خاطئ — تاريخ الاسترداد لا الدفع)
SELECT id, paymentStatus, paidAmountSar, cancellationRefundAmountSar, paidAt
FROM BookingRequest
WHERE id = 244;


-- ─── (2) نسخة احتياطية من السطر قبل حذفه (احتفظ بالمخرجات) ──────────────────
SELECT * FROM PaymentTransaction WHERE id = 83;


-- ─── (3) التصحيح ────────────────────────────────────────────────────────────
START TRANSACTION;

-- حذف سطر الدفعة المكرر. الشروط الإضافية حارس: لو لم تطابق، يُحذف 0 سطر
-- بدل حذف السطر الخطأ.
DELETE FROM PaymentTransaction
WHERE id        = 83
  AND bookingId = 244
  AND kind      = 'INITIAL_PAYMENT'
  AND amountSar = 294.91
  AND createdAt = '2026-09-06 14:06:36.816';
-- تحقّق: يجب أن يكون Rows matched = 1

-- إعادة paidAt لتاريخ الدفعة الحقيقية (createdAt للسطر id=81 الأصلي).
UPDATE BookingRequest
SET paidAt = '2026-09-02 12:46:10.522'
WHERE id     = 244
  AND paidAt = '2026-09-06 14:06:36.807';
-- تحقّق: يجب أن يكون Rows matched = 1

-- لا تُنفَّذ إلا بعد التأكد أن كلا الأمرين طابَق سطراً واحداً:
COMMIT;
-- في حال أي خطأ: ROLLBACK;


-- ─── (4) بعد التنفيذ: تحقّق من النتيجة ──────────────────────────────────────
-- المتوقَّع: 4 أسطر، ومجموع (CREDIT - DEBIT) = 0  ← مدفوع ثم مسترد بالكامل
SELECT id, kind, direction, amountSar, createdAt
FROM PaymentTransaction
WHERE bookingId = 244
ORDER BY createdAt;

SELECT
  SUM(CASE WHEN direction = 'CREDIT' THEN amountSar ELSE -amountSar END) AS net_should_be_zero
FROM PaymentTransaction
WHERE bookingId = 244;

-- المتوقَّع: paidAt = 2026-09-02 12:46:10.522
SELECT id, paymentStatus, paidAmountSar, cancellationRefundAmountSar, paidAt
FROM BookingRequest
WHERE id = 244;


-- ═══════════════════════════════════════════════════════════════════════════
-- ملاحظة عن السطرين id=87 (REFUND_REVERSAL) و id=88 (REFUND):
-- هذان إجراءان يدويان نفّذهما الأدمن (عكس الاسترداد ثم استرداد مجدداً) وليسا من
-- الباگ — تُركا كما هما. بعد حذف id=83 يصبح صافي الدفتر صفراً وهو الصحيح.
--
-- للبحث عن حجوزات أخرى أصابها الباگ نفسه (سطر دفعة أُنشئ بعد استرداد):
--   SELECT p.bookingId, p.id, p.kind, p.createdAt
--   FROM PaymentTransaction p
--   WHERE p.kind IN ('INITIAL_PAYMENT','BALANCE_PAYMENT')
--     AND EXISTS (
--       SELECT 1 FROM PaymentTransaction r
--       WHERE r.bookingId = p.bookingId
--         AND r.kind = 'REFUND'
--         AND r.createdAt < p.createdAt
--     )
--   ORDER BY p.bookingId, p.createdAt;
-- ═══════════════════════════════════════════════════════════════════════════
