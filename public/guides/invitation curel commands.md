# Invitation System Test Commands

## Test the Full Invitation Endpoint

```bash
curl -X POST "https://vegvisr-frontend.torarnehave.workers.dev/api/chat-rooms/room_1753439025194/invite" -H "Authorization: Bearer 9694a8927b21247a9fc80f599ce5b961a7ee6bde" -H "Content-Type: application/json" -d '{"recipientEmail":"alivenesslab.org@gmail.com","invitationMessage":"Test invitation from WSL"}'
```

## Test Email Worker Generate Invitation

```bash
curl -X POST "https://email-worker.torarnehave.workers.dev/generate-invitation" -H "Content-Type: application/json" -d '{"recipientEmail":"alivenesslab.org@gmail.com","roomId":"room_1753439025194","inviterName":"msneeggen@gmail.com","inviterUserId":"4a36e010-131a-44fc-9537-c73c0cea96f0","invitationMessage":"Test invitation from WSL"}'
```

## Test Email Worker Render Template

```bash
curl -X POST "https://email-worker.torarnehave.workers.dev/render-template" -H "Content-Type: application/json" -d '{"templateId":"default-chat-invitation-en","variables":{"roomName":"Vegvisr.org Test Room","inviterName":"msneeggen@gmail.com","invitationLink":"https://slowyou.io/api/reg-user-vegvisr?email=alivenesslab.org%40gmail.com&role=subscriber&callback=https%3A%2F%2Fwww.vegvisr.org%2Fjoin-room%3Finvitation%3Dadeb39af-4ff7-435e-b899-9b8f4f446f64"}}'
```

## Check Email Worker Health

```bash
curl "https://email-worker.torarnehave.workers.dev/health"
```

## Check Room Membership

```bash
curl -X GET "https://vegvisr-frontend.torarnehave.workers.dev/api/chat-rooms/room_1753439025194/members" -H "Authorization: Bearer 9694a8927b21247a9fc80f599ce5b961a7ee6bde"
```

## Expected Results

- **Command 1**: Should either succeed or show specific error about slowyou.io
- **Command 2**: Should return invitation token and slowyou.io link
- **Command 3**: Should return rendered HTML email template
- **Command 4**: Should return `{"status":"ok","worker":"email-worker","phase":"2"}`
- **Command 5**: Should show your membership with `"role":"owner"`
