-- Add soft-delete (archive) columns to groups table
ALTER TABLE groups ADD COLUMN archived_at INTEGER;
ALTER TABLE groups ADD COLUMN archived_by TEXT;
