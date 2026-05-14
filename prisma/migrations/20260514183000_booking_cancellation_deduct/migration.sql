-- AlterTable
ALTER TABLE `BookingRequest` ADD COLUMN `cancelledAt` DATETIME(3) NULL,
    ADD COLUMN `cancellationDeductedDays` DOUBLE NULL;
