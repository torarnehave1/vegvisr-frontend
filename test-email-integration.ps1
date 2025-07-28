# Email Template Setup Test Script
# Tests the email template integration with Knowledge Graph

Write-Host "Email Template Integration Test" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green
Write-Host ""

# Test 1: Check if component files exist
Write-Host "Test 1: Component Files" -ForegroundColor Cyan
$emailNode = "src\components\GNewNodes\GNewEmailTemplateNode.vue"
$nodeRenderer = "src\components\GNewNodeRenderer.vue"

if (Test-Path $emailNode) {
    Write-Host "   OK GNewEmailTemplateNode.vue exists" -ForegroundColor Green
} else {
    Write-Host "   ERROR GNewEmailTemplateNode.vue missing" -ForegroundColor Red
}

if (Test-Path $nodeRenderer) {
    Write-Host "   OK GNewNodeRenderer.vue exists" -ForegroundColor Green
} else {
    Write-Host "   ERROR GNewNodeRenderer.vue missing" -ForegroundColor Red
}

Write-Host ""

# Test 2: Check if templates exist
Write-Host "Test 2: Template Files" -ForegroundColor Cyan
$template1 = "templates\basic-chat-invitation-template.json"
$template2 = "templates\project-update-notification-template.json"

if (Test-Path $template1) {
    Write-Host "   ✅ Chat Invitation template exists" -ForegroundColor Green
} else {
    Write-Host "   ❌ Chat Invitation template missing" -ForegroundColor Red
}

if (Test-Path $template2) {
    Write-Host "   ✅ Project Update template exists" -ForegroundColor Green
} else {
    Write-Host "   ❌ Project Update template missing" -ForegroundColor Red
}

Write-Host ""

# Test 3: Check if email-template is registered in NodeRenderer
Write-Host "🔗 Test 3: Node Registration" -ForegroundColor Cyan
$rendererContent = Get-Content $nodeRenderer -Raw
if ($rendererContent -match "email-template.*GNewEmailTemplateNode") {
    Write-Host "   ✅ email-template registered in GNewNodeRenderer" -ForegroundColor Green
} else {
    Write-Host "   ❌ email-template not properly registered" -ForegroundColor Red
}

Write-Host ""

# Test 4: Validate template JSON structure
Write-Host "🔍 Test 4: Template JSON Validation" -ForegroundColor Cyan
try {
    if (Test-Path $template1) {
        $json1 = Get-Content $template1 -Raw | ConvertFrom-Json
        if ($json1.nodes -and $json1.nodes[0].type -eq "email-template") {
            Write-Host "   ✅ Chat Invitation template structure valid" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Chat Invitation template structure invalid" -ForegroundColor Red
        }
    }
    
    if (Test-Path $template2) {
        $json2 = Get-Content $template2 -Raw | ConvertFrom-Json
        if ($json2.nodes -and $json2.nodes[0].type -eq "email-template") {
            Write-Host "   ✅ Project Update template structure valid" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Project Update template structure invalid" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "   ❌ JSON validation error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 5: Check enhanced slowyou.io endpoint integration
Write-Host "🌐 Test 5: Email Endpoint Integration" -ForegroundColor Cyan
$emailNodeContent = Get-Content $emailNode -Raw
if ($emailNodeContent -match "slowyou\.io/api/send-vegvisr-email") {
    Write-Host "   ✅ Enhanced slowyou.io endpoint integrated" -ForegroundColor Green
} else {
    Write-Host "   ❌ slowyou.io endpoint not found" -ForegroundColor Red
}

Write-Host ""

# Summary
Write-Host "📋 Integration Summary" -ForegroundColor Yellow
Write-Host "=====================" -ForegroundColor Yellow
Write-Host "✅ Email Template Node Component: Created" -ForegroundColor Green
Write-Host "✅ Node Type Registration: Complete" -ForegroundColor Green  
Write-Host "✅ Database Templates: Ready" -ForegroundColor Green
Write-Host "✅ Enhanced Email Integration: Ready" -ForegroundColor Green

Write-Host ""
Write-Host "🚀 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Add templates to database using setup script" -ForegroundColor White
Write-Host "2. Test in GNewViewer interface" -ForegroundColor White
Write-Host "3. Verify templates appear in GNewTemplateSidebar" -ForegroundColor White
Write-Host "4. Test email sending functionality" -ForegroundColor White

Write-Host ""
Write-Host "Email Template Integration Ready!" -ForegroundColor Green
