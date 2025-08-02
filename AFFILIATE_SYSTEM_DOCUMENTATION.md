# Affiliate System with Email Template Integration

## Overview

This enhanced affiliate system integrates with the existing Vegvisr email template infrastructure to provide a comprehensive affiliate marketing solution. The system uses Cloudflare Workers with proper worker bindings for inter-worker communication, as requested.

## Architecture

### Worker Structure

```
main-worker     (Entry point, user registration, affiliate endpoints)
    ↓ (bindings)
aff-worker      (Affiliate logic, tracking, invitations)
    ↓ (bindings)
email-worker    (Email template rendering, affiliate invitations)
```

### Database Schema

- **affiliates** - Affiliate user information and referral codes
- **referrals** - Tracking of referral clicks and conversions
- **affiliate_invitations** - Email invitation tokens and expiry
- **affiliate_payouts** - Commission payment tracking
- **graphTemplates** - Email template definitions (existing table)

## Key Features

### 🎯 Affiliate Management

- **Registration**: Direct signup or invitation-based
- **Dashboard**: Real-time statistics and earnings
- **Referral Codes**: Automatic generation and tracking
- **Commission Tracking**: 15% default rate, configurable per affiliate

### 📧 Email Template Integration

- **Professional Templates**: HTML and text versions
- **Variable Substitution**: Dynamic content with {{variable}} syntax
- **Invitation System**: Branded email invitations with referral links
- **Template Management**: Stored in existing graphTemplates table

### 📊 Analytics & Tracking

- **Real-time Tracking**: Click and conversion monitoring
- **Performance Metrics**: Conversion rates, earnings, referral counts
- **Payout Management**: Automated commission calculations

## Implementation Details

### 1. Worker Bindings Configuration

**main-worker/wrangler.toml**

```toml
[[services]]
binding = "AFF_WORKER"
service = "aff-worker"

[[services]]
binding = "EMAIL_WORKER"
service = "email-worker"
```

**aff-worker/wrangler.toml**

```toml
[[services]]
binding = "EMAIL_WORKER"
service = "email-worker"
```

### 2. Email Template Structure

The affiliate invitation template uses the graphTemplates table:

```sql
INSERT INTO graphTemplates (id, name, template, variables) VALUES (
  'affiliate_registration_invitation',
  'Affiliate Registration Invitation',
  '{
    "subject": "Join {{siteName}} as an Affiliate Partner! 🚀",
    "html": "...",
    "text": "..."
  }',
  '[
    {"name": "recipientName", "type": "string", "required": true},
    {"name": "senderName", "type": "string", "required": true},
    {"name": "siteName", "type": "string", "required": true},
    {"name": "commissionRate", "type": "string", "required": true},
    {"name": "affiliateRegistrationUrl", "type": "string", "required": true}
  ]'
);
```

### 3. API Endpoints

#### Main Worker Endpoints

- `POST /register-affiliate` - Register new affiliate
- `POST /send-affiliate-invitation` - Send invitation email
- `GET /affiliate-dashboard` - Get dashboard data
- `POST /track-referral` - Track referral clicks
- `POST /convert-referral` - Convert referrals to commissions
- `GET /validate-invitation` - Validate invitation tokens
- `POST /complete-invitation-registration` - Complete invited registration

#### Email Worker Endpoints

- `POST /render-and-send-template` - Render and send affiliate emails
- `GET /graph-templates` - Get available templates

### 4. Frontend Components

**AffiliateDashboard.vue**

- Overview with earnings and statistics
- Referral link management with copy-to-clipboard
- Send invitations interface
- Analytics and performance metrics

**AffiliateRegistration.vue**

- Modal-based registration form
- Invitation token validation
- Terms acceptance and commission display
- Success state with affiliate details

## Integration Workflow

### 1. User Registration Flow

```
1. User clicks affiliate link: https://vegvisr.org?ref=ABC123
2. System tracks referral: POST /track-referral
3. User completes registration: POST /sve2
4. System converts referral: POST /convert-referral
5. Commission credited to affiliate
```

### 2. Invitation Workflow

```
1. Affiliate sends invitation: POST /send-affiliate-invitation
2. Email worker renders template: POST /render-and-send-template
3. Recipient receives professional email with invitation link
4. Recipient clicks link and validates token: GET /validate-invitation
5. Registration completed: POST /complete-invitation-registration
```

### 3. Email Template Rendering

```
1. Template requested from graphTemplates table
2. Variables substituted: {{siteName}} → "Vegvisr"
3. HTML and text versions rendered
4. Email sent via configured service (SendGrid/Mailgun/etc.)
```

## Configuration

### Environment Variables

```bash
# Database
VEGVISR_ORG_DB_ID=your-d1-database-id

# Email Service (configure in email-worker)
SENDGRID_API_KEY=your-sendgrid-key
# or
MAILGUN_API_KEY=your-mailgun-key
```

### Default Settings

- **Commission Rate**: 15%
- **Invitation Expiry**: 7 days
- **Referral Tracking**: 30 days
- **Payment Schedule**: Monthly

## Testing

### 1. Database Setup

```bash
# Run schema creation
wrangler d1 execute vegvisr_org --file=./affiliate-schema.sql

# Add email template
wrangler d1 execute vegvisr_org --file=./affiliate-email-template.sql
```

### 2. Worker Deployment

```bash
# Deploy workers with bindings
cd aff-worker && wrangler deploy
cd ../main-worker && wrangler deploy
cd ../email-worker && wrangler deploy
```

### 3. API Testing

```bash
# Test affiliate registration
curl -X POST https://your-domain.com/register-affiliate \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","name":"Test User"}'

# Test invitation sending
curl -X POST https://your-domain.com/send-affiliate-invitation \
  -H 'Content-Type: application/json' \
  -d '{"recipientEmail":"invite@example.com","recipientName":"John","senderName":"Admin"}'
```

## Security Considerations

### 1. Authentication

- JWT token validation for affiliate endpoints
- Rate limiting on invitation sending
- Email validation and sanitization

### 2. Data Protection

- Secure storage of affiliate information
- GDPR compliance for email data
- Encrypted referral tracking

### 3. Fraud Prevention

- Duplicate referral detection
- Conversion validation
- Commission audit trails

## Monitoring & Analytics

### Key Metrics

- **Affiliate Performance**: Clicks, conversions, earnings per affiliate
- **System Health**: Email delivery rates, API response times
- **Revenue Impact**: Total commissions, top performers, growth trends

### Dashboards

- Real-time affiliate dashboard for users
- Admin analytics for system monitoring
- Financial reports for commission payouts

## Future Enhancements

### 1. Advanced Features

- Multi-tier commission structures
- Performance bonuses and incentives
- Advanced analytics and reporting
- Mobile app integration

### 2. Marketing Tools

- Custom landing pages for affiliates
- A/B testing for email templates
- Social media integration
- Automated marketing campaigns

### 3. Payment Integration

- PayPal automated payouts
- Stripe Connect integration
- Tax reporting and 1099 generation
- Multi-currency support

## Support & Maintenance

### Regular Tasks

- Monitor email delivery rates
- Review affiliate performance
- Update commission rates
- Process monthly payouts

### Troubleshooting

- Check worker logs in Cloudflare dashboard
- Verify database connections
- Test email template rendering
- Validate referral tracking accuracy

## Conclusion

This affiliate system provides a robust foundation for growing your user base through referral marketing. The integration with the existing email template system ensures professional communications, while the worker binding architecture maintains scalability and performance.

The system is designed to be production-ready with proper error handling, monitoring, and security considerations. Regular maintenance and monitoring will ensure optimal performance and affiliate satisfaction.

For questions or support, refer to the Cloudflare Workers documentation and the email template architecture documentation.
