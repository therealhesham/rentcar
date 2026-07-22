CREATE TABLE `BookingLog` (
  `id`          INT           NOT NULL AUTO_INCREMENT,
  `bookingId`   INT           NOT NULL,
  `event`       VARCHAR(64)   NOT NULL,
  `actorKind`   VARCHAR(16)   NOT NULL,
  `actorName`   VARCHAR(128)  NULL,
  `fromStatus`  VARCHAR(32)   NULL,
  `toStatus`    VARCHAR(32)   NULL,
  `notes`       VARCHAR(500)  NULL,
  `metaJson`    TEXT          NULL,
  `createdAt`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `BookingLog_bookingId_createdAt_idx` (`bookingId`, `createdAt`),
  CONSTRAINT `BookingLog_bookingId_fkey`
    FOREIGN KEY (`bookingId`) REFERENCES `BookingRequest` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
