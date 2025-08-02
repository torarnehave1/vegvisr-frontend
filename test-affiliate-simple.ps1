# Test Affiliate Invitation System
Write-Host "Testing Affiliate Invitation System" -ForegroundColor Cyan

$headers = @{
    "Content-Type" = "application/json"
}

$body = @{
    recipientEmail = "test-affiliate@example.com"
    recipientName = "Test User"
    senderName = "Superadmin"
    siteName = "Vegvisr.org"
    commissionRate = 15
    domain = "vegvisr.org"
} | ConvertTo-Json

Write-Host "Sending invitation..." -ForegroundColor Yellow

$response = Invoke-RestMethod -Uri "https://vegvisr-frontend.torarnehave.workers.dev/send-affiliate-invitation" -Method Post -Headers $headers -Body $body

Write-Host "SUCCESS! Response:" -ForegroundColor Green
$response | ConvertTo-Json -Depth 3
