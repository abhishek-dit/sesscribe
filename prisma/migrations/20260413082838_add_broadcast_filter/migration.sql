-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "broadcastFilter" TEXT NOT NULL DEFAULT 'no_tags',
ADD COLUMN     "broadcastTag" TEXT;
