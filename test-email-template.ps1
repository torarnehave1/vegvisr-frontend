# Test Email Template Rendering Directly
Write-Host "Testing Email Template Rendering" -ForegroundColor Cyan

$headers = @{
    "Content-Type" = "application/json"
}

$templateTest = @{
    templateId = "affiliate_registration_invitation"
    variables = @{
        recipientName = "John Smith"
        recipientEmail = "john@example.com"
        senderName = "Admin User"
        siteName = "Vegvisr.org"
        commissionRate = "15"
        affiliateRegistrationUrl = "https://vegvisr.org/affiliate-register?token=test123"
    }
} | ConvertTo-Json -Depth 3

Write-Host "Testing template rendering..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "https://email-worker.torarnehave.workers.dev/render-template" -Method Post -Headers $headers -Body $templateTest
    
    Write-Host "Template rendered successfully!" -ForegroundColor Green
    Write-Host "Subject: $($response.template.subject)" -ForegroundColor White
    Write-Host "Body length: $($response.template.body.Length) characters" -ForegroundColor White
    
} catch {
    Write-Host "Template rendering failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    # Try to get more details
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Yellow
    }
}
