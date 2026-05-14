-- AlterTable: أوسع لحالات الاسترداد + حقول الاسترداد
ALTER TABLE `BookingRequest` MODIFY `paymentStatus` VARCHAR(24) NOT NULL DEFAULT 'PENDING';

ALTER TABLE `BookingRequest`
    ADD COLUMN `cancellationRefundAmountSar` DOUBLE NULL,
    ADD COLUMN `cancellationRefundExternalRef` VARCHAR(128) NULL;
