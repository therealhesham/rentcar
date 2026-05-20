-- BookingRequest: branchId (pickup) + returnBranchId (return)
-- Field meanings (AR): see docs/booking-request-branch-fields.md
-- Run after fleet_branch_mysql.sql if needed.

ALTER TABLE `BookingRequest`
  ADD COLUMN `branchId` INT NULL AFTER `carType`,
  ADD COLUMN `returnBranchId` INT NULL AFTER `branchId`;

-- returnBranchId <= old `branch` column (was return branch slug)
UPDATE `BookingRequest` br
INNER JOIN `Branch` rb ON rb.`slug` = LOWER(TRIM(br.`branch`)) AND rb.`isActive` = 1
SET br.`returnBranchId` = rb.`id`;

-- branchId <= old pickupBranchSlug, else same as old branch (except DELIVERY)
UPDATE `BookingRequest` br
INNER JOIN `Branch` pb ON pb.`slug` = LOWER(TRIM(
  COALESCE(
    NULLIF(TRIM(br.`pickupBranchSlug`), ''),
    TRIM(br.`branch`)
  )
)) AND pb.`isActive` = 1
SET br.`branchId` = pb.`id`
WHERE br.`pickupMode` IS NULL OR br.`pickupMode` <> 'DELIVERY';

-- DELIVERY: branchId NULL, returnBranchId from old branch
UPDATE `BookingRequest` br
INNER JOIN `Branch` rb ON rb.`slug` = LOWER(TRIM(br.`branch`)) AND rb.`isActive` = 1
SET br.`returnBranchId` = rb.`id`, br.`branchId` = NULL
WHERE br.`pickupMode` = 'DELIVERY';

ALTER TABLE `BookingRequest`
  ADD CONSTRAINT `BookingRequest_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `BookingRequest_returnBranchId_fkey`
    FOREIGN KEY (`returnBranchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX `BookingRequest_branchId_idx` ON `BookingRequest`(`branchId`);
CREATE INDEX `BookingRequest_returnBranchId_idx` ON `BookingRequest`(`returnBranchId`);

ALTER TABLE `BookingRequest`
  DROP INDEX `BookingRequest_branch_idx`,
  DROP INDEX `BookingRequest_pickupBranchSlug_idx`,
  DROP COLUMN `branch`,
  DROP COLUMN `pickupBranchSlug`;
