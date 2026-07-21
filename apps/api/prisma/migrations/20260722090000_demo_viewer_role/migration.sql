-- Add the restricted read-only role used by the public demonstration account.
ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'DEMO_VIEWER';
