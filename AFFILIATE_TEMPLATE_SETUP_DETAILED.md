# AFFILIATE REGISTRATION INVITATION TEMPLATE SETUP

## Template Configuration

**Template ID**: `affiliate_registration_invitation_simple`  
**Template Name**: `Affiliate Registration Invitation (Simple)`  
**Template Type**: `affiliate_invitation`  
**Language Code**: `en`  
**Is Default**: `1` (Yes)  
**Status**: `is_active = 1`  

## Email Subject

```
Join {{siteName}} as an Affiliate Partner! 🚀
```

## Template Variables

The template supports these variables:

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

## HTML Email Body (Formatted)

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
    <p>Hello {{recipientName}},</p>
    
    <p>{{senderName}} has invited you to join <strong>{{siteName}}</strong> as an affiliate partner!</p>
    
    <div class="commission-highlight">
      <h3>💰 Earn {{commissionDisplay}}</h3>
      <p>Start earning money by promoting {{siteName}} to your network. Every successful referral puts money in your pocket!</p>
    </div>
    
    <div class="step-box">
      <h4>📝 Getting Started (2 Simple Steps):</h4>
      <p><strong>Step 1:</strong> Create your account and verify your email<br>
      <strong>Step 2:</strong> Complete your affiliate registration</p>
    </div>
    
    <p><strong>What you get:</strong></p>
    <ul>
      <li>{{commissionDetails}} on all referrals</li>
      <li>Real-time tracking dashboard</li>
      <li>Professional marketing materials</li>
      <li>Monthly payouts via PayPal</li>
      <li>Dedicated affiliate support</li>
    </ul>
    
    <p><strong>Ready to start earning?</strong></p>
    
    <p style="text-align:center;margin:30px 0">
      <a href="{{affiliateRegistrationUrl}}" class="button">
        Get Started - Step 1: Create Account
      </a><br>
      <small style="color:#666;">
        Already have an account? The link will take you directly to affiliate registration.
      </small>
    </p>
    
    <p><em>This invitation expires in 7 days. Don't miss out on this opportunity!</em></p>
    
    <p>Questions? Reply to this email or contact our affiliate team.</p>
    
    <p>Best regards,<br>The {{siteName}} Team</p>
  </div>
  
  <div class="footer">
    <p>{{siteName}} | Affiliate Program<br>
    <small>This email was sent because {{senderName}} invited you to become an affiliate partner.</small></p>
  </div>
</body>
</html>
```

## Database Insert Statement

```sql
INSERT INTO email_templates (
  id,
  template_name,
  template_type,
  language_code,
  subject,
  body,
  variables,
  is_default,
  created_by,
  created_at,
  updated_at,
  is_active
) VALUES (
  'affiliate_registration_invitation_simple',
  'Affiliate Registration Invitation (Simple)',
  'affiliate_invitation',
  'en',
  'Join {{siteName}} as an Affiliate Partner! 🚀',
  '[HTML_BODY_CONTENT]', -- The formatted HTML above
  '["recipientName", "recipientEmail", "senderName", "siteName", "commissionRate", "commissionType", "commissionAmount", "commissionDisplay", "commissionDetails", "affiliateRegistrationUrl"]',
  1,
  'system',
  datetime('now'),
  datetime('now'),
  1
) ON CONFLICT(id) DO UPDATE SET
  template_name = excluded.template_name,
  subject = excluded.subject,
  body = excluded.body,
  variables = excluded.variables,
  updated_at = datetime('now');
```

## Variable Examples

When the template is processed, variables are replaced with actual values:

```javascript
{
  "recipientName": "John Smith",
  "recipientEmail": "john@example.com",
  "senderName": "Superadmin",
  "siteName": "Vegvisr.org",
  "commissionRate": "15",
  "commissionType": "percentage",
  "commissionAmount": "",
  "commissionDisplay": "15% Commission",
  "commissionDetails": "15% commission",
  "affiliateRegistrationUrl": "https://test.vegvisr.org/verify-email?invitationtoken=invite_123..."
}
```

## Visual Features

The template includes:

🎯 **Professional Header** - Purple background with invitation title  
💰 **Commission Highlight** - Yellow box showcasing earnings potential  
📝 **Step Box** - Blue background with getting started steps  
🔗 **Green Call-to-Action Button** - Prominent registration link  
📧 **Clean Footer** - Program branding and context information  

This template provides a professional, engaging affiliate invitation email that effectively communicates the opportunity and guides recipients through the registration process.
