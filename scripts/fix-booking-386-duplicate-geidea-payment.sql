-- إصلاح الحجز #386 — دفعة جيديا واحدة (1,028.10) اتسجّلت مرتين في الدفتر:
--   • «دفعة أولى»  INITIAL_PAYMENT   (صحيحة)
--   • «سداد فرق»   BALANCE_PAYMENT   (مكررة — نفس gatewayRef)
-- النتيجة: «إجمالي المدفوع» = 2,056.20 بدل 1,028.10، والرصيد المستحق (الفرق بين
-- إجمالي الحجز والمدفوع) اتصفّر غلط، وصفحة الاسترداد بتقترح 2,056.20.
--
-- الإصلاح:
--   1) السطر المكرر يتعلّم REVERSED (مش بيتمسح — يفضل للتتبع).
--   2) paidAmountSar يرجع = مجموع الدفعات الحقيقية (1,028.10).
--   3) balanceDueAtBranchSar يرجع = إجمالي الحجز − المدفوع (لو موجب).
--
-- شغّل «الخطوة 1» وراجع، وبعدين «الخطوة 2»، وبعدين «الخطوة 1» تاني.


-- ═══════════ (اختياري) هل في حجوزات تانية فيها نفس المشكلة؟ ═══════════
-- أي حجز فيه أكتر من دفعة COMPLETED بنفس gatewayRef (جيديا/تابي/إمكان).
SELECT pt.bookingId, pt.gatewayRef, COUNT(*) AS times_recorded,
       GROUP_CONCAT(CONCAT(pt.kind, ' ', pt.amountSar) ORDER BY pt.id SEPARATOR ' | ') AS rows_
FROM PaymentTransaction pt
WHERE pt.direction = 'CREDIT' AND pt.status = 'COMPLETED' AND pt.gatewayRef IS NOT NULL
GROUP BY pt.bookingId, pt.gatewayRef
HAVING COUNT(*) > 1
ORDER BY pt.bookingId;


-- ═══════════════════════ الخطوة 1: معاينة (مفيش تعديل) ═══════════════════════

-- (أ) سطور الدفتر — المكرر هو BALANCE_PAYMENT اللي gatewayRef بتاعه = gatewayRef الدفعة الأولى
SELECT pt.id, pt.kind, pt.status, pt.direction, pt.amountSar, pt.gatewayRef, pt.sessionRef,
       pt.actorName, pt.createdAt,
       CASE WHEN pt.kind = 'BALANCE_PAYMENT' AND EXISTS (
              SELECT 1 FROM PaymentTransaction i
               WHERE i.bookingId = pt.bookingId AND i.kind = 'INITIAL_PAYMENT'
                 AND i.gatewayRef = pt.gatewayRef AND i.id < pt.id)
            THEN 'DUPLICATE → REVERSED' ELSE '' END AS action
FROM PaymentTransaction pt
WHERE pt.bookingId = 386
ORDER BY pt.id;

-- (ب) الحجز — القيم الحالية والقيم بعد الإصلاح
SELECT b.id, b.paymentStatus, b.paymentGatewayRef, b.paymentSessionRef,
       b.snapshotTotalAmountSar                           AS booking_total,
       b.paidAmountSar                                    AS current_paid,
       b.balanceDueAtBranchSar                            AS current_balance,
       ROUND(b.paidAmountSar - dup.amt, 2)                AS new_paid,
       CASE WHEN ROUND(b.snapshotTotalAmountSar - (b.paidAmountSar - dup.amt), 2) > 0
            THEN ROUND(b.snapshotTotalAmountSar - (b.paidAmountSar - dup.amt), 2)
            ELSE NULL END                                 AS new_balance
FROM BookingRequest b
JOIN (
  SELECT pt.bookingId, SUM(pt.amountSar) AS amt
  FROM PaymentTransaction pt
  WHERE pt.bookingId = 386 AND pt.kind = 'BALANCE_PAYMENT' AND pt.status = 'COMPLETED'
    AND EXISTS (SELECT 1 FROM PaymentTransaction i
                 WHERE i.bookingId = pt.bookingId AND i.kind = 'INITIAL_PAYMENT'
                   AND i.gatewayRef = pt.gatewayRef AND i.id < pt.id)
  GROUP BY pt.bookingId
) dup ON dup.bookingId = b.id
WHERE b.id = 386;
-- تأكد إن: new_paid = 1028.10 وإن booking_total هو الإجمالي الصحيح للحجز (1,198.30)،
-- فـ new_balance = 170.20 (المبلغ اللي لسه على العميل). لو (ب) رجّعت صفر صفوف،
-- يبقى مفيش سطر مكرر — متشغّلش الخطوة 2.


-- ═══════════════════════ الخطوة 2: الإصلاح ═══════════════════════
-- شغّل الخطوة 2 كلها مرة واحدة (نفس الطلب) — الأوامر بالترتيب ده بالظبط:
-- @dup بيتحسب الأول من السطور اللي لسه COMPLETED، وبعدين الحجز، وبعدين الدفتر.

SET @dup := (
  SELECT SUM(pt.amountSar)
  FROM PaymentTransaction pt
  WHERE pt.bookingId = 386 AND pt.kind = 'BALANCE_PAYMENT' AND pt.status = 'COMPLETED'
    AND EXISTS (SELECT 1 FROM PaymentTransaction i
                 WHERE i.bookingId = pt.bookingId AND i.kind = 'INITIAL_PAYMENT'
                   AND i.gatewayRef = pt.gatewayRef AND i.id < pt.id)
);

-- balanceDue قبل paidAmount عمداً: MySQL بيقيّم الـ SET من الشمال لليمين، فالرصيد
-- بيتحسب من قيمة المدفوع القديمة (paidAmountSar - @dup = المدفوع الحقيقي).
UPDATE BookingRequest
SET balanceDueAtBranchSar =
      CASE WHEN ROUND(snapshotTotalAmountSar - (paidAmountSar - @dup), 2) > 0
           THEN ROUND(snapshotTotalAmountSar - (paidAmountSar - @dup), 2)
           ELSE NULL END,
    paidAmountSar = ROUND(paidAmountSar - @dup, 2),
    updatedAt = NOW(3)
WHERE id = 386 AND @dup IS NOT NULL AND @dup > 0;

UPDATE PaymentTransaction pt
JOIN PaymentTransaction i
  ON i.bookingId = pt.bookingId AND i.kind = 'INITIAL_PAYMENT'
 AND i.gatewayRef = pt.gatewayRef AND i.id < pt.id
SET pt.status = 'REVERSED',
    pt.notes  = CONCAT(COALESCE(pt.notes, ''), ' — مكرر: نفس طلب جيديا المسجّل كدفعة أولى (#', i.id, ')')
WHERE pt.bookingId = 386 AND pt.kind = 'BALANCE_PAYMENT' AND pt.status = 'COMPLETED';
