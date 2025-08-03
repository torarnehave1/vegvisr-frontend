-- DROP and rebuild affiliates table with correct constraints
-- This fixes the UNIQUE constraint issue to allow multiple deals per user

-- Step 1: Drop the existing table
DROP TABLE IF EXISTS affiliates;

-- Step 2: Create the new table with proper constraints
CREATE TABLE affiliates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    affiliate_id TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    referral_code TEXT NOT NULL UNIQUE,
    domain TEXT DEFAULT 'vegvisr.org',
    referred_by TEXT,
    status TEXT DEFAULT 'active',
    commission_rate REAL DEFAULT 15.0,
    commission_type TEXT DEFAULT 'percentage',
    commission_amount REAL,
    deal_name TEXT NOT NULL DEFAULT 'default',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Composite unique constraint: same email can have multiple deals, but not duplicate (email, deal_name, domain) combinations
    UNIQUE(email, deal_name, domain)
);

-- Create indexes for performance
CREATE INDEX idx_affiliates_email ON affiliates(email);
CREATE INDEX idx_affiliates_referral_code ON affiliates(referral_code);
CREATE INDEX idx_affiliates_deal_name ON affiliates(deal_name);
CREATE INDEX idx_affiliates_status ON affiliates(status);
