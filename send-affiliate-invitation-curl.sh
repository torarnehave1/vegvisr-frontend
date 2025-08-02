# cURL command to send affiliate invitation

curl -X POST "https://vegvisr-frontend.torarnehave.workers.dev/send-affiliate-invitation" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientEmail": "new-affiliate@example.com",
    "recipientName": "John Smith", 
    "senderName": "Your Name",
    "siteName": "Vegvisr.org",
    "commissionRate": 15,
    "domain": "vegvisr.org"
  }'
