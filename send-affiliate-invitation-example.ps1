# PowerShell script to send affiliate invitation as Superadmin
# Replace with actual values

$headers = @{
    "Content-Type" = "application/json"
    # Add authorization if needed
}

$body = @{
    recipientEmail = "new-affiliate@example.com"
    recipientName = "John Smith"
    senderName = "Your Name"
    siteName = "Vegvisr.org"
    commissionRate = 15
    domain = "vegvisr.org"
    inviterAffiliateId = $null  # Optional: if sent by existing affiliate
} | ConvertTo-Json

# Send to main-worker endpoint (which forwards to aff-worker)
$response = Invoke-RestMethod -Uri "https://vegvisr-frontend.torarnehave.workers.dev/send-affiliate-invitation" -Method Post -Headers $headers -Body $body

Write-Host "Invitation sent successfully!" -ForegroundColor Green
Write-Host "Response: $($response | ConvertTo-Json -Depth 3)"
