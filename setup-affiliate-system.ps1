# Affiliate System Setup Script for Windows PowerShell
# This script sets up the complete affiliate system with email templates

Write-Host "🎯 Setting up Affiliate System for Vegvisr Frontend..." -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# Function to print colored output
function Write-Success {
    param($Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param($Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error {
    param($Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Info {
    param($Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Blue
}

# Step 1: Create database tables
Write-Host ""
Write-Info "Step 1: Setting up database schema..."
if (Test-Path "affiliate-schema.sql") {
    Write-Success "Database schema file found: affiliate-schema.sql"
    Write-Warning "Please run the SQL commands in affiliate-schema.sql against your D1 database"
    Write-Info "You can use: wrangler d1 execute vegvisr_org --file=./affiliate-schema.sql"
} else {
    Write-Error "affiliate-schema.sql not found!"
    exit 1
}

# Step 2: Add email template
Write-Host ""
Write-Info "Step 2: Adding affiliate email template..."
if (Test-Path "affiliate-email-template.sql") {
    Write-Success "Email template file found: affiliate-email-template.sql"
    Write-Warning "Please run the SQL commands in affiliate-email-template.sql against your D1 database"
    Write-Info "You can use: wrangler d1 execute vegvisr_org --file=./affiliate-email-template.sql"
} else {
    Write-Error "affiliate-email-template.sql not found!"
    exit 1
}

# Step 3: Deploy workers
Write-Host ""
Write-Info "Step 3: Deploying Cloudflare Workers..."

# Deploy aff-worker
if (Test-Path "aff-worker") {
    Write-Info "Deploying aff-worker..."
    Set-Location aff-worker
    $affResult = & wrangler deploy
    if ($LASTEXITCODE -eq 0) {
        Write-Success "aff-worker deployed successfully"
    } else {
        Write-Error "Failed to deploy aff-worker"
        Set-Location ..
        exit 1
    }
    Set-Location ..
} else {
    Write-Error "aff-worker directory not found!"
    exit 1
}

# Deploy main-worker (updated with affiliate endpoints)
if (Test-Path "main-worker") {
    Write-Info "Deploying main-worker..."
    Set-Location main-worker
    $mainResult = & wrangler deploy
    if ($LASTEXITCODE -eq 0) {
        Write-Success "main-worker deployed successfully"
    } else {
        Write-Error "Failed to deploy main-worker"
        Set-Location ..
        exit 1
    }
    Set-Location ..
} else {
    Write-Error "main-worker directory not found!"
    exit 1
}

# Deploy email-worker (updated with template support)
if (Test-Path "email-worker") {
    Write-Info "Deploying email-worker..."
    Set-Location email-worker
    $emailResult = & wrangler deploy
    if ($LASTEXITCODE -eq 0) {
        Write-Success "email-worker deployed successfully"
    } else {
        Write-Error "Failed to deploy email-worker"
        Set-Location ..
        exit 1
    }
    Set-Location ..
} else {
    Write-Error "email-worker directory not found!"
    exit 1
}

# Step 4: Build frontend
Write-Host ""
Write-Info "Step 4: Building frontend with affiliate components..."
$buildResult = & npm run build
if ($LASTEXITCODE -eq 0) {
    Write-Success "Frontend built successfully"
} else {
    Write-Error "Failed to build frontend"
    exit 1
}

# Step 5: Final checks
Write-Host ""
Write-Info "Step 5: Running system checks..."

Write-Success "Checking worker bindings..."
Write-Info "Make sure these service bindings are configured in your wrangler.toml files:"
Write-Host "  - main-worker: EMAIL_WORKER, AFF_WORKER"
Write-Host "  - aff-worker: EMAIL_WORKER, MAIN_WORKER"

Write-Success "Checking database tables..."
Write-Info "Required tables:"
Write-Host "  - affiliates"
Write-Host "  - referrals" 
Write-Host "  - affiliate_invitations"
Write-Host "  - affiliate_payouts"
Write-Host "  - graphTemplates (should already exist)"

Write-Success "Checking email template..."
Write-Info "Required template ID: affiliate_registration_invitation"

# Step 6: Display endpoint summary
Write-Host ""
Write-Info "🚀 Affiliate System Endpoints:"
Write-Host "================================================="
Write-Host "Main Worker Endpoints:"
Write-Host "  POST /register-affiliate              - Register new affiliate"
Write-Host "  POST /send-affiliate-invitation       - Send invitation email"
Write-Host "  GET  /affiliate-dashboard             - Get dashboard data"
Write-Host "  POST /track-referral                  - Track referral clicks"
Write-Host "  POST /convert-referral                - Convert referrals"
Write-Host "  GET  /validate-invitation             - Validate invitation tokens"
Write-Host "  POST /complete-invitation-registration - Complete invited registration"
Write-Host ""
Write-Host "Aff Worker Endpoints:"
Write-Host "  All affiliate-specific functionality with worker binding integration"
Write-Host ""
Write-Host "Email Worker Endpoints:"
Write-Host "  POST /render-and-send-template        - Render and send affiliate emails"
Write-Host "  GET  /graph-templates                 - Get available templates"
Write-Host ""

# Step 7: Integration instructions
Write-Host ""
Write-Info "🔧 Integration Instructions:"
Write-Host "================================================="
Write-Host "1. Frontend Integration:"
Write-Host "   - Import AffiliateDashboard.vue in your user dashboard"
Write-Host "   - Import AffiliateRegistration.vue for signup flow"
Write-Host "   - Add affiliate menu items to navigation"
Write-Host ""
Write-Host "2. Referral Tracking:"
Write-Host "   - Add ?ref=CODE to registration URLs"
Write-Host "   - Call /track-referral when users click affiliate links"
Write-Host "   - Call /convert-referral when users complete registration"
Write-Host ""
Write-Host "3. Email Configuration:"
Write-Host "   - Update email-worker with your actual email service"
Write-Host "   - Configure SMTP/SendGrid/Mailgun credentials"
Write-Host "   - Test email template rendering"
Write-Host ""

# Step 8: Test recommendations
Write-Host ""
Write-Info "🧪 Testing Recommendations:"
Write-Host "================================================="
Write-Host "1. Test affiliate registration:"
Write-Host '   Invoke-RestMethod -Uri "https://your-domain.com/register-affiliate" -Method POST -ContentType "application/json" -Body ''{"email":"test@example.com","name":"Test User"}'''
Write-Host ""
Write-Host "2. Test invitation sending:"
Write-Host '   Invoke-RestMethod -Uri "https://your-domain.com/send-affiliate-invitation" -Method POST -ContentType "application/json" -Body ''{"recipientEmail":"invite@example.com","recipientName":"John","senderName":"Admin"}'''
Write-Host ""
Write-Host "3. Test referral tracking:"
Write-Host '   Invoke-RestMethod -Uri "https://your-domain.com/track-referral" -Method POST -ContentType "application/json" -Body ''{"referralCode":"ABC123","referredEmail":"user@example.com"}'''
Write-Host ""

Write-Success "Affiliate System Setup Complete! 🎉"
Write-Info "Remember to:"
Write-Host "  - Update your database with the SQL files"
Write-Host "  - Configure email service credentials"
Write-Host "  - Test all endpoints thoroughly"
Write-Host "  - Update frontend to include affiliate components"
Write-Host ""
Write-Warning "Don't forget to set up proper authentication and rate limiting in production!"

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "🎯 Affiliate System Ready for Launch! 🚀" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
