-- مبلغ مستحق يُحصَّل عند الفرع بعد تعديل/تمديد العميل لحجز مدفوع (فرق السعر)
ALTER TABLE `BookingRequest`
    ADD COLUMN `balanceDueAtBranchSar` DOUBLE NULL;
