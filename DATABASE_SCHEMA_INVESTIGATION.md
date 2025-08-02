# DATABASE SCHEMA INVESTIGATION RESULTS

**VEGVISR PROTOCOL - SYSTEMATIC TESTING PHASE**  
**Investigation Focus**: Database schema vs API response mismatch  
**Status**: ✅ **SCHEMA IS CORRECT**

---

## 🎯 INVESTIGATION FINDINGS

### Database Schema Analysis

**User-Provided Correct Schema**:

```sql
CREATE TABLE affiliate_invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    site_name TEXT,                              ✅ EXISTS
    commission_type TEXT DEFAULT 'percentage',   ✅ EXISTS
    commission_rate REAL DEFAULT 15.0,          ✅ EXISTS
    commission_amount REAL,                      ✅ EXISTS
    inviter_affiliate_id TEXT,
    domain TEXT DEFAULT 'vegvisr.org',
    expires_at TEXT NOT NULL,
    status TEXT DEFAULT 'pending',               ✅ EXISTS
    used INTEGER DEFAULT 0,
    used_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (inviter_affiliate_id) REFERENCES affiliates(affiliate_id)
)
```

**Main-Worker INSERT Fields**:

```javascript
INSERT INTO affiliate_invitations (
  token, recipient_email, recipient_name, sender_name, site_name,     ✅
  commission_type, commission_rate, commission_amount, domain,        ✅
  expires_at, created_at, status                                      ✅
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
```

**Result**: ✅ **PERFECT MATCH** - All fields exist in schema!

---

## 🔍 THE REAL ISSUE: API RESPONSE FILTERING

**Problem**: GET `/api/affiliate-invitations` endpoint is **NOT returning all fields**

**What we tested**:

- ✅ A1 (Percentage): `commissionType: "percentage"`, `commissionRate: 20`
- ✅ A2 (Fixed): `commissionType: "fixed"`, `commissionAmount: 75`

**What database should contain**:

- A1: `commission_type: "percentage"`, `commission_rate: 20`, `commission_amount: null`
- A2: `commission_type: "fixed"`, `commission_rate: 15`, `commission_amount: 75`

**What API returns**:

```json
{
  "token": "...",
  "recipient_email": "...",
  "commission_rate": 20, // ❌ Only this field, missing commission_type & commission_amount
  "expires_at": "..."
  // Missing: site_name, commission_type, commission_amount, status
}
```

---

## 🧪 HYPOTHESIS: API ENDPOINT INCOMPLETE SELECT

The GET `/api/affiliate-invitations` endpoint likely has an incomplete SELECT statement:

**Current (Probable)**:

```sql
SELECT token, recipient_email, recipient_name, sender_name,
       commission_rate, expires_at, created_at, used_at, used
FROM affiliate_invitations
```

**Should be**:

```sql
SELECT token, recipient_email, recipient_name, sender_name, site_name,
       commission_type, commission_rate, commission_amount, domain,
       expires_at, created_at, status, used_at, used
FROM affiliate_invitations
```

---

## 🔧 NEXT INVESTIGATION STEPS

### Step 1: Verify Data is Actually Stored

Let me check the main-worker GET endpoint code to see the SELECT statement.

### Step 2: Test Direct Database Query

If possible, test a direct database query to verify the data is stored correctly.

### Step 3: Fix API Response

Update the GET endpoint to return all fields including commission_type and commission_amount.

---

## 📊 CURRENT STATUS

**Frontend Form**: ✅ Working (sends all data correctly)  
**Database Schema**: ✅ Correct (has all required fields)  
**Backend INSERT**: ✅ Should work (matches schema)  
**Backend GET**: ❌ Incomplete (missing fields in response)

**Root Cause**: The API response is filtered and doesn't show the commission_type and commission_amount fields that ARE being stored.

---

## 🎯 IMMEDIATE ACTION NEEDED

1. **Check main-worker GET endpoint** to see the SELECT statement
2. **Verify data is actually being stored** with all fields
3. **Update GET endpoint** to return commission_type and commission_amount
4. **Retest** to confirm fixed commission amounts are properly stored and retrieved

**Status**: ✅ **SCHEMA CORRECT** - Issue is API endpoint filtering, not database design!
