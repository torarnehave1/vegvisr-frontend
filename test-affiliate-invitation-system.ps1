# Test Affiliate Invitation System
# PowerShell Script for Superadmin Testing

Write-Host "🚀 Testing Affiliate Invitation System" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Test data
$testEmail = "jane.doe@example.com"
$testName = "Jane Doe"
$senderName = "Superadmin"

$headers = @{
    "Content-Type" = "application/json"
}

$body = @{
    recipientEmail = $testEmail
    recipientName = $testName
    senderName = $senderName
    siteName = "Vegvisr.org"
    commissionRate = 15
    domain = "vegvisr.org"
} | ConvertTo-Json

Write-Host "📧 Sending invitation to: $testEmail" -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "https://test.vegvisr.org/send-affiliate-invitation" -Method Post -Headers $headers -Body $body

    Write-Host "✅ SUCCESS! Invitation sent successfully" -ForegroundColor Green
    Write-Host "📋 Response Details:" -ForegroundColor White
    Write-Host ($response | ConvertTo-Json -Depth 3) -ForegroundColor Gray

    if ($response.invitationToken) {
        Write-Host "🎫 Invitation Token: $($response.invitationToken)" -ForegroundColor Magenta
        Write-Host "⏰ Expires: $($response.expiresAt)" -ForegroundColor Magenta
    }
}
catch {
    Write-Host "❌ ERROR: Failed to send invitation" -ForegroundColor Red
    Write-Host "Details: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n💡 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Check recipient's email for invitation" -ForegroundColor White
Write-Host "2. Verify invitation appears in database" -ForegroundColor White
Write-Host "3. Test the registration flow" -ForegroundColor White
