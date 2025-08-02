-- Email template for affiliate invitations to existing users
-- This template is for users who already have accounts and just need to accept the affiliate invitation

INSERT OR REPLACE INTO email_templates (
    id, 
    template_name, 
    subject, 
    body, 
    template_type, 
    language_code,
    is_active, 
    created_at, 
    updated_at
) VALUES (
    'affiliate_invitation_existing_user',
    'Affiliate Invitation - Existing User',
    'Affiliate Partnership Invitation from {senderName} 🤝',
    '<!DOCTYPE html>
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
            border-radius: 6px;
        }
        .footer {
            text-align: center;
            color: #6b7280;
            font-size: 14px;
            margin-top: 20px;
        }
        .welcome-back {
            background: #dbeafe;
            padding: 15px;
            border-radius: 6px;
            margin: 15px 0;
            border-left: 4px solid #3b82f6;
        }
        .benefits-list {
            background: #f0f9ff;
            padding: 20px;
            border-radius: 6px;
            margin: 15px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🤝 Affiliate Partnership Invitation</h1>
    </div>
    <div class="content">
        <div class="welcome-back">
            <h3>👋 Welcome back, {recipientName}!</h3>
            <p>Since you already have an account with {siteName}, you can jump straight into our affiliate program.</p>
        </div>
        
        <p>{senderName} has invited you to become an affiliate partner with <strong>{siteName}</strong>!</p>
        
        <div class="commission-highlight">
            <h3>💰 Earn {commissionDisplay}</h3>
            <p>Start earning money immediately by promoting {siteName} to your network. Every successful referral puts money in your pocket!</p>
        </div>
        
        <div class="benefits-list">
            <h4>🎯 What you get as an affiliate:</h4>
            <ul>
                <li><strong>{commissionDetails}</strong> on all successful referrals</li>
                <li>Real-time tracking dashboard</li>
                <li>Professional marketing materials</li>
                <li>Monthly payouts via PayPal</li>
                <li>Dedicated affiliate support</li>
                <li>Performance bonuses for top performers</li>
            </ul>
        </div>
        
        <p><strong>Ready to start earning?</strong></p>
        <p>Since you already have an account, just click the button below to accept this affiliate invitation and activate your affiliate status:</p>
        
        <p style="text-align: center; margin: 30px 0;">
            <a href="{affiliateAcceptanceUrl}" class="button">Accept Affiliate Invitation</a>
        </p>
        
        <p style="font-size: 14px; color: #666;">
            <strong>What happens next:</strong><br>
            1. Click the button above to accept the invitation<br>
            2. You''ll be logged into your existing account<br>
            3. Your affiliate dashboard will be activated immediately<br>
            4. Start promoting and earning right away!
        </p>
        
        <p><em>This invitation expires in 7 days. Don''t miss out on this opportunity!</em></p>
        
        <p>Questions? Reply to this email or contact our affiliate team.</p>
        
        <p>Best regards,<br>
        The {siteName} Team</p>
    </div>
    <div class="footer">
        <p>{siteName} | Affiliate Program<br>
        <small>This email was sent because {senderName} invited you to become an affiliate partner.</small></p>
    </div>
</body>
</html>',
    'affiliate',
    'en',
    1,
    datetime('now'),
    datetime('now')
);
