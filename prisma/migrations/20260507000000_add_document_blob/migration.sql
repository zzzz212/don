-- AlterTable: store original uploaded file in object storage
ALTER TABLE "Document" ADD COLUMN "mimeType" TEXT;
ALTER TABLE "Document" ADD COLUMN "blobUrl" TEXT;
ALTER TABLE "Document" ADD COLUMN "blobKey" TEXT;
