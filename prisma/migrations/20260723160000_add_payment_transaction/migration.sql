-- CreateTable: PaymentTransaction
-- عملية مالية مرتبطة بحجز — كل دفعة أو استرداد يُسجَّل هنا بدلاً من الكتابة المباشرة على BookingRequest.
CREATE TABLE `PaymentTransaction` (
  `id`          INTEGER       NOT NULL AUTO_INCREMENT,
  `bookingId`   INTEGER       NOT NULL,
  `kind`        VARCHAR(32)   NOT NULL,
  `status`      VARCHAR(24)   NOT NULL DEFAULT 'COMPLETED',
  `direction`   VARCHAR(8)    NOT NULL,
  `amountSar`   DOUBLE        NOT NULL,
  `method`      VARCHAR(24)   NULL,
  `actorKind`   VARCHAR(16)   NOT NULL,
  `actorName`   VARCHAR(128)  NULL,
  `gatewayRef`  VARCHAR(128)  NULL,
  `sessionRef`  VARCHAR(128)  NULL,
  `externalRef` VARCHAR(128)  NULL,
  `notes`       VARCHAR(500)  NULL,
  `createdAt`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `PaymentTransaction_bookingId_createdAt_idx` (`bookingId`, `createdAt`),
  INDEX `PaymentTransaction_gatewayRef_idx`          (`gatewayRef`),
  INDEX `PaymentTransaction_sessionRef_idx`          (`sessionRef`),
  INDEX `PaymentTransaction_kind_status_createdAt_idx` (`kind`, `status`, `createdAt`),

  CONSTRAINT `PaymentTransaction_bookingId_fkey`
    FOREIGN KEY (`bookingId`) REFERENCES `BookingRequest` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
