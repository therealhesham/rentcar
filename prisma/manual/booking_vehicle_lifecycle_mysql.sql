-- مراحل استلام/إرجاع المركبة (PICKED_UP / RETURNED)
ALTER TABLE `BookingRequest`
  ADD COLUMN `vehiclePickedUpAt` DATETIME(3) NULL,
  ADD COLUMN `vehicleReturnedAt` DATETIME(3) NULL;
