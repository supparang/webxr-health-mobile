-- ACTIVA-AI V1.0.3
-- Separate organizational position from system authorization role.
ALTER TABLE "User" ADD COLUMN "positionTitle" TEXT;
