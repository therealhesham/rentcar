-- باقات الاشتراك: الحد الأدنى 3 أشهر (3، 6، 12) بدل شهر واحد
ALTER TABLE `SubscriptionPlan` MODIFY `durationOptionsCsv` VARCHAR(32) NOT NULL DEFAULT '3,6,12';
UPDATE `SubscriptionPlan` SET `durationOptionsCsv` = '3,6,12' WHERE `durationOptionsCsv` = '1,3,6';
