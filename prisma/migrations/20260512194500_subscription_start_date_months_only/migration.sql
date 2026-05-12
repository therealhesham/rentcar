-- يوم بدء الباقة المختار عند الطلب، وتضييق قيمة افتراضية لخيارات الأشهر إلى 1 أو 3 أو 6 أشهر

ALTER TABLE `UserSubscription`
    ADD COLUMN `plannedStartDate` DATETIME(3) NULL AFTER `durationMonths`;

ALTER TABLE `SubscriptionPlan`
    MODIFY `durationOptionsCsv` VARCHAR(32) NOT NULL DEFAULT '1,3,6';

