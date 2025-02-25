/*
  Warnings:

  - You are about to drop the column `company` on the `referral` table. All the data in the column will be lost.
  - You are about to drop the column `message` on the `referral` table. All the data in the column will be lost.
  - Added the required column `fieldOfWork` to the `Referral` table without a default value. This is not possible if the table is not empty.
  - Added the required column `program` to the `Referral` table without a default value. This is not possible if the table is not empty.
  - Added the required column `referrerId` to the `Referral` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `referral` DROP COLUMN `company`,
    DROP COLUMN `message`,
    ADD COLUMN `fieldOfWork` VARCHAR(191) NOT NULL,
    ADD COLUMN `program` VARCHAR(191) NOT NULL,
    ADD COLUMN `referrerId` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `Referrer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `referralCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Referrer_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Referral_referrerId_idx` ON `Referral`(`referrerId`);

-- AddForeignKey
ALTER TABLE `Referral` ADD CONSTRAINT `Referral_referrerId_fkey` FOREIGN KEY (`referrerId`) REFERENCES `Referrer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
