# Test Multi-Deal Affiliate System
# Testing the enhanced affiliate system with deal support

Write-Host "Testing Multi-Deal Affiliate System..."

# Test 1: Send invitation for "premium-deal" with fixed commission
Write-Host "`n1. Testing premium deal invitation (fixed $100 commission)..."
$premiumInvite = @{
    recipientEmail = "test.premium@example.com"
    recipientName = "Premium Test User" 
    senderName = "Deal Manager"
    siteName = "Vegvisr Premium"
    commissionType = "fixed"
    commissionAmount = 100
    domain = "vegvisr.org"
    dealName = "premium-deal"
} | ConvertTo-Json

curl -X POST "https://aff.vegvisr.org/send-affiliate-invitation" `
  -H "Content-Type: application/json" `
  -d $premiumInvite

Write-Host "`n2. Testing standard deal invitation (15% commission)..."
$standardInvite = @{
    recipientEmail = "test.standard@example.com"
    recipientName = "Standard Test User"
    senderName = "Deal Manager" 
    siteName = "Vegvisr Standard"
    commissionType = "percentage"
    commissionRate = 15
    domain = "vegvisr.org"
    dealName = "standard-deal"
} | ConvertTo-Json

curl -X POST "https://aff.vegvisr.org/send-affiliate-invitation" `
  -H "Content-Type: application/json" `
  -d $standardInvite

Write-Host "`n3. Testing SAME user with different deal..."
$sameUserDifferentDeal = @{
    recipientEmail = "test.premium@example.com"  # Same email as test 1
    recipientName = "Premium Test User"
    senderName = "Deal Manager"
    siteName = "Vegvisr VIP"
    commissionType = "fixed"
    commissionAmount = 250
    domain = "vegvisr.org" 
    dealName = "vip-deal"  # Different deal name
} | ConvertTo-Json

curl -X POST "https://aff.vegvisr.org/send-affiliate-invitation" `
  -H "Content-Type: application/json" `
  -d $sameUserDifferentDeal

Write-Host "`nTesting complete. Check the results above."
Write-Host "Expected: All 3 invitations should succeed, allowing same user multiple deals."
