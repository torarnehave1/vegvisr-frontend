-- Email System Database Schema
-- Phase 1: Core Infrastructure
-- Rollback ID: phase1-db-schema-2025-07-27

-- Email Templates Table
-- Stores customizable email templates for different scenarios
CREATE TABLE email_templates (
    id TEXT PRIMARY KEY,                    -- UUID template ID
    template_name TEXT NOT NULL,            -- Human-readable name (e.g., "Chat Room Invitation")
    template_type TEXT NOT NULL,            -- Template category (e.g., "chat_invitation", "welcome", "notification")
    language_code TEXT NOT NULL,            -- Language code (e.g., "en", "tr", "de", "es")
    subject TEXT NOT NULL,                  -- Email subject line
    body TEXT NOT NULL,                     -- Email body (HTML format)
    variables TEXT,                         -- JSON array of available variables ["{userName}", "{roomName}", etc.]
    is_default INTEGER DEFAULT 0,           -- Whether this is the default template for this type/language
    created_by TEXT,                        -- User ID who created this template
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1             -- Soft delete flag
);

-- User Email Configuration Table
-- Stores user-specific email sending credentials and preferences
CREATE TABLE user_email_config (
    id TEXT PRIMARY KEY,                    -- UUID config ID
    user_id TEXT NOT NULL,                  -- Owner of this email configuration
    config_name TEXT NOT NULL,              -- Human-readable name (e.g., "Vegvisr Official", "My Band")
    email_provider TEXT NOT NULL,           -- Provider (e.g., "gmail", "outlook", "custom")
    email_address TEXT NOT NULL,            -- Sender email address
    encrypted_password TEXT NOT NULL,       -- Encrypted SMTP password
    smtp_host TEXT,                         -- SMTP server host (for custom providers)
    smtp_port INTEGER,                      -- SMTP server port (for custom providers)
    smtp_secure INTEGER DEFAULT 1,          -- Use SSL/TLS (1=yes, 0=no)
    daily_limit INTEGER DEFAULT 100,        -- Daily email sending limit
    monthly_limit INTEGER DEFAULT 1000,     -- Monthly email sending limit
    is_verified INTEGER DEFAULT 0,          -- Email configuration verified
    verification_token TEXT,                -- Token for email verification
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1,            -- Soft delete flag
    UNIQUE(user_id, config_name)            -- One config name per user
);

-- Invitation Tokens Table
-- Stores invitation context for seamless room joining
CREATE TABLE invitation_tokens (
    id TEXT PRIMARY KEY,                    -- UUID invitation token
    recipient_email TEXT NOT NULL,          -- Invited user email
    room_id TEXT NOT NULL,                  -- Target room
    inviter_name TEXT NOT NULL,             -- Person who sent invitation
    inviter_user_id TEXT NOT NULL,          -- Inviter's user_id
    invitation_message TEXT,                -- Custom message from inviter
    expires_at DATETIME NOT NULL,           -- Token expiration (7 days)
    used_at DATETIME,                       -- When invitation was used
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1             -- Soft delete flag
);

-- Email Sending Log Table
-- Audit trail for all sent emails
CREATE TABLE email_sending_log (
    id TEXT PRIMARY KEY,                    -- UUID log entry
    template_id TEXT,                       -- Reference to email_templates
    config_id TEXT,                         -- Reference to user_email_config
    recipient_email TEXT NOT NULL,          -- Recipient email address
    subject TEXT NOT NULL,                  -- Email subject sent
    variables_used TEXT,                    -- JSON of variables used in template
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL,                   -- "sent", "failed", "bounced"
    error_message TEXT,                     -- Error details if failed
    ip_address TEXT,                        -- Sender IP for rate limiting
    user_agent TEXT                         -- User agent for analytics
);

-- Rate Limiting Table
-- Tracks email sending rates per configuration
CREATE TABLE email_rate_limits (
    id TEXT PRIMARY KEY,                    -- UUID rate limit entry
    config_id TEXT NOT NULL,                -- Reference to user_email_config
    date_key TEXT NOT NULL,                 -- Date key (YYYY-MM-DD or YYYY-MM)
    emails_sent INTEGER DEFAULT 0,          -- Number of emails sent on this date
    last_reset DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(config_id, date_key)             -- One entry per config per date
); 