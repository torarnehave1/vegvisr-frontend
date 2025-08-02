-- Affiliate System Database Schema
-- Run this SQL to create the necessary tables for the affiliate system

-- Affiliates table
CREATE TABLE IF NOT EXISTS affiliates (
    affiliate_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    referral_code TEXT UNIQUE NOT NULL,
    domain TEXT DEFAULT 'vegvisr.org',
    referred_by TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    commission_rate REAL DEFAULT 15.0,
    paypal_email TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (referred_by) REFERENCES affiliates(affiliate_id)
);

-- Referrals table
CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    affiliate_id TEXT NOT NULL,
    referred_email TEXT,
    referral_code TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'invalid')),
    commission_rate REAL NOT NULL,
    commission_amount REAL DEFAULT 0,
    order_id TEXT,
    metadata TEXT, -- JSON for additional tracking data
    paid INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    converted_at TEXT,
    FOREIGN KEY (affiliate_id) REFERENCES affiliates(affiliate_id)
);

-- Affiliate invitations table
CREATE TABLE IF NOT EXISTS affiliate_invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    inviter_affiliate_id TEXT,
    domain TEXT DEFAULT 'vegvisr.org',
    commission_rate REAL DEFAULT 15.0,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    used_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (inviter_affiliate_id) REFERENCES affiliates(affiliate_id)
);

-- Affiliate payouts table
CREATE TABLE IF NOT EXISTS affiliate_payouts (
    id TEXT PRIMARY KEY,
    affiliate_id TEXT NOT NULL,
    amount REAL NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
    paypal_transaction_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    paid_at TEXT,
    FOREIGN KEY (affiliate_id) REFERENCES affiliates(affiliate_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_affiliates_referral_code ON affiliates(referral_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_email ON affiliates(email);
CREATE INDEX IF NOT EXISTS idx_referrals_affiliate_id ON referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_email ON referrals(referred_email);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON affiliate_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_recipient_email ON affiliate_invitations(recipient_email);
CREATE INDEX IF NOT EXISTS idx_payouts_affiliate_id ON affiliate_payouts(affiliate_id);
