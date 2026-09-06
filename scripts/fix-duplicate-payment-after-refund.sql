-- ═══════════════════════════════════════════════════════════════════════════
-- تصحيح الحجزين #243 و #244 — أثر باگ «إشعار الاسترداد يُقرأ كدفعة جديدة»
--
-- ما حدث: تابي تُطلق webhook عند الاسترداد، والدفعة تبقى لديها `CLOSED`، فقرأه
-- النظام كتأكيد دفع جديد فأنشأ سطر INITIAL_PAYMENT مكرراً (بعد ثانية إلى ثانيتين
-- من الاسترداد) وكتب فوق `paidAt` بتاريخ الاسترداد.
--
-- أُصلح في الكود: lib/tabby/mark-paid.ts + app/api/payments/tabby/webhook/route.ts
-- (جيديا تُركت بلا إصلاح عمداً بقرار المستخدم).
-- تحقّق عملي: الحجز #245 استُرد بعد الإصلاح فلم يتكرر السطر (صافي دفتره = 0).
--
-- ⚠️ نفّذه بنفسك بعد المراجعة. تأكّد أولاً من قاعدة البيانات:  SELECT DATABASE();
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── (1) قبل التنفيذ: تحقّق أن الحالة كما هو موصوف ───────────────────────────
-- المتوقَّع 243: 4 أسطر، id=85 مكرر (INITIAL_PAYMENT بعد REFUND بثانيتين)
-- المتوقَّع 244: 5 أسطر، id=83 مكرر (INITIAL_PAYMENT بعد REFUND بثانية)
SELECT bookingId, id, kind, direction, amountSar, actorName, createdAt
FROM PaymentTransaction
WHERE bookingId IN (243, 244)
ORDER BY bookingId, createdAt;

-- المتوقَّع: paidAt في كليهما = تاريخ الاسترداد (خاطئ)
SELECT id, paymentStatus, paidAmountSar, cancellationRefundAmountSar, paidAt
FROM BookingRequest
WHERE id IN (243, 244);


-- ─── (2) نسخة احتياطية من السطرين قبل الحذف (احتفظ بالمخرجات) ───────────────
SELECT * FROM PaymentTransaction WHERE id IN (83, 85);


-- ─── (3) التصحيح ────────────────────────────────────────────────────────────
START TRANSACTION;

-- حذف سطرَي الدفعة المكررين. الشروط الإضافية حارس: إن لم تطابق يُحذف 0 سطر
-- بدلاً من حذف السطر الخطأ.
DELETE FROM PaymentTransaction
WHERE id        = 85
  AND bookingId = 243
  AND kind      = 'INITIAL_PAYMENT'
  AND amountSar = 1501.9
  AND createdAt = '2026-09-06 14:07:56.317';
-- تحقّق: Rows matched = 1

DELETE FROM PaymentTransaction
WHERE id        = 83
  AND bookingId = 244
  AND kind      = 'INITIAL_PAYMENT'
  AND amountSar = 294.91
  AND createdAt = '2026-09-06 14:06:36.816';
-- تحقّق: Rows matched = 1

-- إعادة paidAt لتاريخ الدفعة الحقيقية (createdAt للسطر الأصلي id=80 / id=81).
UPDATE BookingRequest
SET paidAt = '2026-09-02 12:04:45.107'
WHERE id     = 243
  AND paidAt = '2026-09-06 14:07:56.312';
-- تحقّق: Rows matched = 1

UPDATE BookingRequest
SET paidAt = '2026-09-02 12:46:10.522'
WHERE id     = 244
  AND paidAt = '2026-09-06 14:06:36.807';
-- تحقّق: Rows matched = 1

-- لا تُنفَّذ إلا بعد التأكد أن الأوامر الأربعة طابَق كلٌّ منها سطراً واحداً:
COMMIT;
-- في حال أي خطأ: ROLLBACK;


-- ─── (4) بعد التنفيذ: تحقّق من النتيجة ──────────────────────────────────────
-- المتوقَّع: صافي كل حجز = 0 (مدفوع ثم مسترد بالكامل) — مثل الحجز #245 السليم
SELECT bookingId,
       SUM(CASE WHEN direction = 'CREDIT' THEN amountSar ELSE -amountSar END) AS net_should_be_zero,
       SUM(kind = 'INITIAL_PAYMENT') AS initial_rows_should_be_1
FROM PaymentTransaction
WHERE bookingId IN (243, 244, 245)
GROUP BY bookingId;

-- المتوقَّع: paidAt = 2026-09-02 (تاريخ الدفع الحقيقي) لا 2026-09-06
SELECT id, paymentStatus, paidAmountSar, cancellationRefundAmountSar, paidAt
FROM BookingRequest
WHERE id IN (243, 244);


-- ═══════════════════════════════════════════════════════════════════════════
-- ملاحظات:
-- • الأسطر الأخرى (REFUND / REFUND_REVERSAL) إجراءات يدوية نفّذها الأدمن وليست
--   من الباگ — تُركت كما هي. في #243 الاستردادان (500 ثم 1001.9 = 1501.9) صحيحان.
-- • للكشف عن أي حجز آخر أصابه الباگ (يعمل على تابي وجيديا معاً):
--     SELECT p.bookingId, p.id, p.kind, p.createdAt,
--            TIMESTAMPDIFF(SECOND, r.createdAt, p.createdAt) AS secs_after_refund
--     FROM PaymentTransaction p
--     JOIN PaymentTransaction r
--       ON r.bookingId = p.bookingId AND r.kind='REFUND' AND r.createdAt < p.createdAt
--     WHERE p.kind IN ('INITIAL_PAYMENT','BALANCE_PAYMENT')
--     ORDER BY p.bookingId, p.createdAt;
--   آخر تشغيل (2026-09-06): أعاد 243 و 244 فقط.
-- ═══════════════════════════════════════════════════════════════════════════
