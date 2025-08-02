# Check and Insert Affiliate Template
$checkQuery = "SELECT id, template_name FROM email_templates WHERE id LIKE '%affiliate%';"

$headers = @{
    "Content-Type" = "application/json"
}

# First check if template exists
$checkBody = @{
    query = $checkQuery
} | ConvertTo-Json

Write-Host "Checking existing affiliate templates..." -ForegroundColor Cyan

try {
    $checkResponse = Invoke-RestMethod -Uri "https://api-worker.torarnehave.workers.dev/execute-sql" -Method Post -Headers $headers -Body $checkBody
    Write-Host "Existing templates:" -ForegroundColor Yellow
    $checkResponse | ConvertTo-Json -Depth 3
} catch {
    Write-Host "Error checking templates: $($_.Exception.Message)" -ForegroundColor Red
}

# Now insert our template
$insertQuery = "INSERT OR REPLACE INTO email_templates (id, template_name, template_type, language_code, subject, body, variables, is_default, created_by, created_at, updated_at, is_active) VALUES ('affiliate_registration_invitation', 'Affiliate Registration Invitation', 'affiliate_invitation', 'en', 'Join {{siteName}} as an Affiliate Partner!', '<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px}.header{background:#4f46e5;color:white;padding:20px;text-align:center}.content{background:#f9fafb;padding:30px}.button{background:#10b981;color:white;padding:12px 24px;text-decoration:none;border-radius:6px}</style></head><body><div class=\"header\"><h1>Affiliate Partner Invitation</h1></div><div class=\"content\"><p>Hello {{recipientName}},</p><p>{{senderName}} has invited you to join {{siteName}} as an affiliate partner!</p><p>Earn {{commissionRate}}% commission on all referrals!</p><p><a href=\"{{affiliateRegistrationUrl}}\" class=\"button\">Get Started</a></p><p>Best regards,<br>The {{siteName}} Team</p></div></body></html>', '[\"recipientName\", \"senderName\", \"siteName\", \"commissionRate\", \"affiliateRegistrationUrl\"]', 1, 'system', datetime('now'), datetime('now'), 1);"

$insertBody = @{
    query = $insertQuery
} | ConvertTo-Json

Write-Host "Inserting affiliate template..." -ForegroundColor Yellow

try {
    $insertResponse = Invoke-RestMethod -Uri "https://api-worker.torarnehave.workers.dev/execute-sql" -Method Post -Headers $headers -Body $insertBody
    Write-Host "Template inserted successfully!" -ForegroundColor Green
    $insertResponse | ConvertTo-Json -Depth 3
} catch {
    Write-Host "Error inserting template: $($_.Exception.Message)" -ForegroundColor Red
}
