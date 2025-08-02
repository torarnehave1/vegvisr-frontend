# Affiliate System Frontend Analysis

## STEP 1: FRONTEND COMPONENTS

### 1. UserDashboard.vue - Main Dashboard

**Location**: `src/views/UserDashboard.vue`
**Role**: Contains the main dashboard with affiliate management modal

**Key Elements:**

- **Modal Trigger Button**: Opens affiliate management
- **Modal Container**: Bootstrap modal that holds AffiliateManagement component
- **State Management**: `showAffiliateManagement: false`

**Functions:**

```javascript
openAffiliateManagement() {
  this.showAffiliateManagement = true
}
closeAffiliateManagement() {
  this.showAffiliateManagement = false
}
```

**Modal Structure:**

```vue
<div v-if="showAffiliateManagement" class="modal fade show d-block">
  <div class="modal-dialog modal-xl">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="btn-close" @click="closeAffiliateManagement"></button>
      </div>
      <div class="modal-body">
        <AffiliateManagement />
      </div>
    </div>
  </div>
</div>
```

### 2. AffiliateManagement.vue - Main Affiliate Component

**Location**: `src/components/AffiliateManagement.vue`
**Role**: Handles affiliate invitation sending and management

**Form Structure:**

- **Recipient Information**: Email, Name
- **Sender Information**: Sender Name, Site Name
- **Commission Settings**: Type (percentage/fixed), Rate/Amount
- **Domain Configuration**: Target domain

**Key Form Fields:**

```javascript
form: {
  recipientEmail: '',
  recipientName: '',
  senderName: '',
  siteName: 'Vegvisr.org',
  commissionType: 'percentage', // 'percentage' or 'fixed'
  commissionRate: 15,
  commissionAmount: 50,
  domain: 'vegvisr.org'
}
```

### 3. AffiliateDashboard.vue - Affiliate User Dashboard

**Location**: `src/components/AffiliateDashboard.vue`
**Role**: Dashboard for users who are already affiliates

**Features:**

- Displays affiliate stats and commission info
- Shows referral links
- Contains invitation sending functionality

## FRONTEND API CALLS

### AffiliateManagement.vue API Endpoints:

1. **Send Invitation**: `POST https://test.vegvisr.org/send-affiliate-invitation`
2. **List Invitations**: `GET https://test.vegvisr.org/api/affiliate-invitations?limit=10`

### AffiliateDashboard.vue API Endpoints:

1. **Get Dashboard Data**: `GET /affiliate-dashboard?affiliateId=${userId}`
2. **Send Invitation**: `POST /send-affiliate-invitation`

## FRONTEND FLOW

**Superadmin User Journey:**

1. **Access Dashboard** → UserDashboard.vue loads
2. **Click Affiliate Button** → `openAffiliateManagement()` called
3. **Modal Opens** → AffiliateManagement.vue component loads
4. **Fill Form** → Recipient info, commission settings
5. **Submit Invitation** → API call to backend
6. **View Results** → Success/error messages displayed

## IDENTIFIED FRONTEND ISSUES

### ✅ Working Components:

- Modal system is properly implemented
- Form validation exists
- Commission type switching (percentage vs fixed)
- Error handling and success messages

### ❌ Potential Issues:

- **URL Inconsistency**: Different components call different URLs
  - AffiliateManagement: `https://test.vegvisr.org/send-affiliate-invitation`
  - AffiliateDashboard: `/send-affiliate-invitation` (relative)
- **API Mismatch**: Frontend sends fields that may not match backend schema
- **No Loading States**: Forms don't show loading indicators properly

## NEXT ANALYSIS STEP

Ready to analyze: **Backend Workers & Routing**
