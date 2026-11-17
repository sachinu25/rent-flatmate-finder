-- CreateEnum
CREATE TYPE "SleepSchedule" AS ENUM ('EARLY_BIRD', 'NIGHT_OWL', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "WorkSchedule" AS ENUM ('OFFICE', 'REMOTE', 'HYBRID', 'SHIFTS', 'STUDENT');

-- CreateEnum
CREATE TYPE "FoodPreference" AS ENUM ('VEGETARIAN', 'NON_VEGETARIAN', 'VEGAN', 'EGGETARIAN', 'NO_PREFERENCE');

-- CreateEnum
CREATE TYPE "SmokingHabit" AS ENUM ('NON_SMOKER', 'OCCASIONAL', 'SMOKER');

-- CreateEnum
CREATE TYPE "RoomSharingPreference" AS ENUM ('PRIVATE_ROOM', 'SHARED_ROOM', 'ENTIRE_PLACE', 'NO_PREFERENCE');

-- CreateEnum
CREATE TYPE "GenderPreference" AS ENUM ('ANY', 'MALE', 'FEMALE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'LISTING_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'NEW_MATCH';

-- DropIndex
DROP INDEX "users_email_idx";

-- DropIndex
DROP INDEX "listings_status_idx";

-- DropIndex
DROP INDEX "chat_messages_conversation_id_idx";

-- DropIndex
DROP INDEX "chat_messages_created_at_idx";

-- DropIndex
DROP INDEX "notifications_user_id_idx";

-- DropIndex
DROP INDEX "notifications_read_idx";

-- DropIndex
DROP INDEX "notifications_created_at_idx";

-- AlterTable
ALTER TABLE "tenant_profiles" ADD COLUMN     "cleanliness" INTEGER,
ADD COLUMN     "food_preference" "FoodPreference",
ADD COLUMN     "has_pets" BOOLEAN,
ADD COLUMN     "room_sharing" "RoomSharingPreference",
ADD COLUMN     "sleep_schedule" "SleepSchedule",
ADD COLUMN     "smoking" "SmokingHabit",
ADD COLUMN     "work_schedule" "WorkSchedule";

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "food_policy" "FoodPreference",
ADD COLUMN     "gender_preference" "GenderPreference" NOT NULL DEFAULT 'ANY',
ADD COLUMN     "household_cleanliness" INTEGER,
ADD COLUMN     "household_sleep_schedule" "SleepSchedule",
ADD COLUMN     "locality" TEXT,
ADD COLUMN     "pets_allowed" BOOLEAN,
ADD COLUMN     "smoking_allowed" BOOLEAN,
ADD COLUMN     "view_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "listing_photos" ADD COLUMN     "public_id" TEXT;

-- AlterTable
ALTER TABLE "compatibility_scores" ADD COLUMN     "factors" JSONB,
ADD COLUMN     "input_hash" TEXT;

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_at" TIMESTAMP(3),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_listings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_listings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "saved_listings_user_id_created_at_idx" ON "saved_listings"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "saved_listings_user_id_listing_id_key" ON "saved_listings"("user_id", "listing_id");

-- CreateIndex
CREATE INDEX "listings_status_created_at_idx" ON "listings"("status", "created_at");

-- CreateIndex
CREATE INDEX "listings_status_location_idx" ON "listings"("status", "location");

-- CreateIndex
CREATE INDEX "chat_messages_conversation_id_created_at_idx" ON "chat_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_created_at_idx" ON "notifications"("user_id", "read", "created_at");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_listings" ADD CONSTRAINT "saved_listings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_listings" ADD CONSTRAINT "saved_listings_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

