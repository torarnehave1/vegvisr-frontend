# Test Affiliate Invitation System - Now Fixed
Write-Host "Testing Affiliate Invitation System with Fixed Email Worker" -ForegroundColor Cyan

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

try {
    $response = Invoke-RestMethod -Uri "https://vegvisr-frontend.torarnehave.workers.dev/send-affiliate-invitation" -Method Post -Headers $headers -Body $body
    
    Write-Host "SUCCESS! Invitation sent successfully!" -ForegroundColor Green
    Write-Host "Response Details:" -ForegroundColor White
    $response | ConvertTo-Json -Depth 3
    
    if ($response.invitationToken) {
        Write-Host "`nInvitation Token: $($response.invitationToken)" -ForegroundColor Magenta
        Write-Host "Expires: $($response.expiresAt)" -ForegroundColor Magenta
    }
    
} catch {
    Write-Host "ERROR: Failed to send invitation" -ForegroundColor Red
    Write-Host "Details: $($_.Exception.Message)" -ForegroundColor Red
    
    # Try to get more error details
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Error Response: $responseBody" -ForegroundColor Yellow
    }
}
