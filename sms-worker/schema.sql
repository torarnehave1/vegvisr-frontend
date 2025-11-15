-- SMS Recipient Lists Database Schema
-- Created: 2025-11-15

-- Recipient Lists Table
CREATE TABLE IF NOT EXISTS sms_recipient_lists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Recipients Table
CREATE TABLE IF NOT EXISTS sms_recipients (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL,
  name TEXT,
  phone_number TEXT NOT NULL,
  notes TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (list_id) REFERENCES sms_recipient_lists(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lists_user_email ON sms_recipient_lists(user_email);
CREATE INDEX IF NOT EXISTS idx_lists_user_id ON sms_recipient_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_recipients_list ON sms_recipients(list_id);
CREATE INDEX IF NOT EXISTS idx_recipients_phone ON sms_recipients(phone_number);
