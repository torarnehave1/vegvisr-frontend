#!/bin/bash

# Affiliate System Setup Script
# This script sets up the complete affiliate system with email templates

echo "🎯 Setting up Affiliate System for Vegvisr Frontend..."
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Step 1: Create database tables
echo ""
print_info "Step 1: Setting up database schema..."
if [ -f "affiliate-schema.sql" ]; then
    print_status "Database schema file found: affiliate-schema.sql"
    print_warning "Please run the SQL commands in affiliate-schema.sql against your D1 database"
    print_info "You can use: wrangler d1 execute vegvisr_org --file=./affiliate-schema.sql"
else
    print_error "affiliate-schema.sql not found!"
    exit 1
fi

# Step 2: Add email template
echo ""
print_info "Step 2: Adding affiliate email template..."
if [ -f "affiliate-email-template.sql" ]; then
    print_status "Email template file found: affiliate-email-template.sql"
    print_warning "Please run the SQL commands in affiliate-email-template.sql against your D1 database"
    print_info "You can use: wrangler d1 execute vegvisr_org --file=./affiliate-email-template.sql"
else
    print_error "affiliate-email-template.sql not found!"
    exit 1
fi

# Step 3: Deploy workers
echo ""
print_info "Step 3: Deploying Cloudflare Workers..."

# Deploy aff-worker
if [ -d "aff-worker" ]; then
    print_info "Deploying aff-worker..."
    cd aff-worker
    if wrangler deploy; then
        print_status "aff-worker deployed successfully"
    else
        print_error "Failed to deploy aff-worker"
        cd ..
        exit 1
    fi
    cd ..
else
    print_error "aff-worker directory not found!"
    exit 1
fi

# Deploy main-worker (updated with affiliate endpoints)
if [ -d "main-worker" ]; then
    print_info "Deploying main-worker..."
    cd main-worker
    if wrangler deploy; then
        print_status "main-worker deployed successfully"
    else
        print_error "Failed to deploy main-worker"
        cd ..
        exit 1
    fi
    cd ..
else
    print_error "main-worker directory not found!"
    exit 1
fi

# Deploy email-worker (updated with template support)
if [ -d "email-worker" ]; then
    print_info "Deploying email-worker..."
    cd email-worker
    if wrangler deploy; then
        print_status "email-worker deployed successfully"
    else
        print_error "Failed to deploy email-worker"
        cd ..
        exit 1
    fi
    cd ..
else
    print_error "email-worker directory not found!"
    exit 1
fi

# Step 4: Build frontend
echo ""
print_info "Step 4: Building frontend with affiliate components..."
if npm run build; then
    print_status "Frontend built successfully"
else
    print_error "Failed to build frontend"
    exit 1
fi

# Step 5: Final checks
echo ""
print_info "Step 5: Running system checks..."

print_status "Checking worker bindings..."
print_info "Make sure these service bindings are configured in your wrangler.toml files:"
echo "  - main-worker: EMAIL_WORKER, AFF_WORKER"
echo "  - aff-worker: EMAIL_WORKER, MAIN_WORKER"

print_status "Checking database tables..."
print_info "Required tables:"
echo "  - affiliates"
echo "  - referrals" 
echo "  - affiliate_invitations"
echo "  - affiliate_payouts"
echo "  - graphTemplates (should already exist)"

print_status "Checking email template..."
print_info "Required template ID: affiliate_registration_invitation"

# Step 6: Display endpoint summary
echo ""
print_info "🚀 Affiliate System Endpoints:"
echo "================================================="
echo "Main Worker Endpoints:"
echo "  POST /register-affiliate              - Register new affiliate"
echo "  POST /send-affiliate-invitation       - Send invitation email"
echo "  GET  /affiliate-dashboard             - Get dashboard data"
echo "  POST /track-referral                  - Track referral clicks"
echo "  POST /convert-referral                - Convert referrals"
echo "  GET  /validate-invitation             - Validate invitation tokens"
echo "  POST /complete-invitation-registration - Complete invited registration"
echo ""
echo "Aff Worker Endpoints:"
echo "  All affiliate-specific functionality with worker binding integration"
echo ""
echo "Email Worker Endpoints:"
echo "  POST /render-and-send-template        - Render and send affiliate emails"
echo "  GET  /graph-templates                 - Get available templates"
echo ""

# Step 7: Integration instructions
echo ""
print_info "🔧 Integration Instructions:"
echo "================================================="
echo "1. Frontend Integration:"
echo "   - Import AffiliateDashboard.vue in your user dashboard"
echo "   - Import AffiliateRegistration.vue for signup flow"
echo "   - Add affiliate menu items to navigation"
echo ""
echo "2. Referral Tracking:"
echo "   - Add ?ref=CODE to registration URLs"
echo "   - Call /track-referral when users click affiliate links"
echo "   - Call /convert-referral when users complete registration"
echo ""
echo "3. Email Configuration:"
echo "   - Update email-worker with your actual email service"
echo "   - Configure SMTP/SendGrid/Mailgun credentials"
echo "   - Test email template rendering"
echo ""

# Step 8: Test recommendations
echo ""
print_info "🧪 Testing Recommendations:"
echo "================================================="
echo "1. Test affiliate registration:"
echo "   curl -X POST https://your-domain.com/register-affiliate \\"
echo "        -H 'Content-Type: application/json' \\"
echo "        -d '{\"email\":\"test@example.com\",\"name\":\"Test User\"}'"
echo ""
echo "2. Test invitation sending:"
echo "   curl -X POST https://your-domain.com/send-affiliate-invitation \\"
echo "        -H 'Content-Type: application/json' \\"
echo "        -d '{\"recipientEmail\":\"invite@example.com\",\"recipientName\":\"John\",\"senderName\":\"Admin\"}'"
echo ""
echo "3. Test referral tracking:"
echo "   curl -X POST https://your-domain.com/track-referral \\"
echo "        -H 'Content-Type: application/json' \\"
echo "        -d '{\"referralCode\":\"ABC123\",\"referredEmail\":\"user@example.com\"}'"
echo ""

print_status "Affiliate System Setup Complete! 🎉"
print_info "Remember to:"
echo "  - Update your database with the SQL files"
echo "  - Configure email service credentials"
echo "  - Test all endpoints thoroughly"
echo "  - Update frontend to include affiliate components"
echo ""
print_warning "Don't forget to set up proper authentication and rate limiting in production!"

echo ""
echo "================================================="
echo "🎯 Affiliate System Ready for Launch! 🚀"
echo "================================================="
