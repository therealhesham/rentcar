
ALTER TABLE `BookingRequest`
  ADD COLUMN `pickupMode` VARCHAR(16) NULL AFTER `branch`,
  ADD COLUMN `deliveryLat` DOUBLE NULL AFTER `pickupMode`,
  ADD COLUMN `deliveryLng` DOUBLE NULL AFTER `deliveryLat`;
