$headers = @{
    "Content-Type" = "application/json"
}

$body = @{
    prompt = "Create a simple worker that returns a JSON STRING saying hei Tor Arne"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "https://knowledge-graph-worker.torarnehave.workers.dev/generate-worker-ai" -Method Post -Headers $headers -Body $body

Write-Output "Response:"
Write-Output ($response | ConvertTo-Json -Depth 10) 