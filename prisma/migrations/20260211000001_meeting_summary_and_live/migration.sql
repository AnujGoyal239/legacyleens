-- Add summary, source, and make fileUrl optional for live meetings
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'upload';
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "summary" TEXT;
ALTER TABLE "meetings" ALTER COLUMN "file_url" DROP NOT NULL;
