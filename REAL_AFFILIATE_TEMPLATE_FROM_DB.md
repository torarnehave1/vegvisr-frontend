# ACTUAL AFFILIATE TEMPLATE FROM REMOTE DATABASE

## Template Configuration (Real Data)

**Template ID**: `affiliate_registration_invitation_simple`  
**Template Name**: `Affiliate Registration Invitation (Single Braces)`  
**Template Type**: `affiliate_invitation`  
**Language Code**: `en`  
**Is Default**: `1`  
**Created By**: `system`  
**Created At**: `2025-08-02 20:05:43`  
**Updated At**: `2025-08-02 20:05:43`  
**Is Active**: `1`  

## Email Subject (Real)
```
Join {siteName} as an Affiliate Partner! 🚀
```

## Template Variables (Real)
```json
[
  "recipientName", 
  "recipientEmail", 
  "senderName", 
  "siteName", 
  "commissionRate", 
  "commissionType", 
  "commissionAmount", 
  "commissionDisplay", 
  "commissionDetails", 
  "affiliateRegistrationUrl"
]
```

## Key Differences from Expected

⚠️ **IMPORTANT**: The actual template uses **SINGLE BRACES** `{variable}` instead of double braces `{{variable}}`!

**Expected**: `{{siteName}}`  
**Actual**: `{siteName}`

This explains the template name: "Affiliate Registration Invitation (Single Braces)"

## HTML Email Body (Real Data - Formatted)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: #4f46e5;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background: #f9fafb;
      padding: 30px;
      border: 1px solid #e5e7eb;
    }
    .button {
      display: inline-block;
      background: #10b981;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: bold;
      margin: 10px 5px;
    }
    .commission-highlight {
      background: #fef3c7;
      padding: 15px;
      border-left: 4px solid #f59e0b;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      color: #6b7280;
      font-size: 14px;
      margin-top: 20px;
    }
    .step-box {
      background: #e5f3ff;
      padding: 15px;
      border-radius: 6px;
      margin: 15px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎯 Affiliate Partner Invitation</h1>
  </div>
  
  <div class="content">
    <p>Hello {recipientName},</p>
    
    <p>{senderName} has invited you to join <strong>{siteName}</strong> as an affiliate partner!</p>
    
    <div class="commission-highlight">
      <h3>💰 Earn {commissionDisplay}</h3>
      <p>Start earning money by promoting {siteName} to your network. Every successful referral puts money in your pocket!</p>
    </div>
    
    <div class="step-box">
      <h4>📝 Getting Started (2 Simple Steps):</h4>
      <p><strong>Step 1:</strong> Create your account and verify your email<br>
      <strong>Step 2:</strong> Complete your affiliate registration</p>
    </div>
    
    <p><strong>What you get:</strong></p>
    <ul>
      <li>{commissionDetails} on all referrals</li>
      <li>Real-time tracking dashboard</li>
      <li>Professional marketing materials</li>
      <li>Monthly payouts via PayPal</li>
      <li>Dedicated affiliate support</li>
    </ul>
    
    <p><strong>Ready to start earning?</strong></p>
    
    <p style="text-align:center;margin:30px 0">
      <a href="{affiliateRegistrationUrl}" class="button">
        Get Started - Step 1: Create Account
      </a><br>
      <small style="color:#666;">
        Already have an account? The link will take you directly to affiliate registration.
      </small>
    </p>
    
    <p><em>This invitation expires in 7 days. Don't miss out on this opportunity!</em></p>
    
    <p>Questions? Reply to this email or contact our affiliate team.</p>
    
    <p>Best regards,<br>The {siteName} Team</p>
  </div>
  
  <div class="footer">
    <p>{siteName} | Affiliate Program<br>
    <small>This email was sent because {senderName} invited you to become an affiliate partner.</small></p>
  </div>
</body>
</html>
```

## Variable Examples (Single Braces)

When the template is processed, variables are replaced:

```javascript
{
  "recipientName": "John Smith",           // {recipientName}
  "recipientEmail": "john@example.com",    // {recipientEmail}
  "senderName": "Superadmin",              // {senderName}
  "siteName": "Vegvisr.org",               // {siteName}
  "commissionRate": "15",                  // {commissionRate}
  "commissionType": "percentage",          // {commissionType}
  "commissionAmount": "",                  // {commissionAmount}
  "commissionDisplay": "15% Commission",   // {commissionDisplay}
  "commissionDetails": "15% commission",   // {commissionDetails}
  "affiliateRegistrationUrl": "https://test.vegvisr.org/verify-email?invitationtoken=invite_123..." // {affiliateRegistrationUrl}
}
```

## 🔍 Key Insights

1. **Single Braces**: Template uses `{variable}` format, not `{{variable}}`
2. **Created**: August 2, 2025 at 20:05:43
3. **System Template**: Created by "system" user
4. **Active**: Template is currently active and set as default
5. **Professional Design**: Same visual elements (purple header, yellow commission box, blue steps, green button)

This is the actual template that's being used in production for affiliate invitations!
