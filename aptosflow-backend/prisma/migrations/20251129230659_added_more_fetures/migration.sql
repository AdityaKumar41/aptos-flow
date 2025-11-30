-- AlterTable
ALTER TABLE "workflows" ADD COLUMN     "cronExpression" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "triggerConfig" JSONB,
ADD COLUMN     "triggerType" TEXT NOT NULL DEFAULT 'manual';
