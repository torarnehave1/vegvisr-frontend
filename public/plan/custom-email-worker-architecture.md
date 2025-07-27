# Custom Email Worker Architecture Plan

**Date:** July 27, 2025  
**Last Updated:** July 27, 2025  
**Rollback ID:** email-worker-architecture-v1.0

## Complete emailVerificationToken Flow Analysis

Based on actual code investigation in the vegvisr.org system, here is the **correct** architectural flow:

### **Token Generation: slowyou.io**

```javascript
// In slowyou.io user_routes_fixed.js (line 158)
const emailVerificationToken = crypto.randomBytes(20).toString('hex')
```

- **slowyou.io generates** the `emailVerificationToken` using `crypto.randomBytes(20).toString('hex')`
- This happens in the `/reg-user-vegvisr` endpoint when a new user is registered
- The token is stored in slowyou.io's MongoDB database

### **Email Sending: slowyou.io**

```javascript
// In slowyou.io user_routes_fixed.js (lines 185-198)
const mailOptions = {
  from: 'vegvisr.org@gmail.com',
  to: email,
  cc: 'slowyou.net@gmail.com',
  subject: template.subject,
  html: template.body.replace(
    '{verificationLink}',
    `https://test.vegvisr.org/verify-email?token=${emailVerificationToken}`,
  ),
}
```

- **slowyou.io sends** the verification email using nodemailer
- The email contains a link pointing to `https://test.vegvisr.org/verify-email?token=${emailVerificationToken}`
- Email templates are stored in slowyou.io's language JSON files

### **Token Verification: slowyou.io**

```javascript
// In slowyou.io user_routes_fixed.js (lines 54-83)
router.get('/verify-email', async (req, res) => {
  const token = req.query.token

  // Find the email verification token in the database
  const emailVerificationToken = await EmailVerificationToken.findOne({
    emailVerificationToken: token,
  })

  // If the token is found, set the verified field to true
  emailVerificationToken.verified = true
  await emailVerificationToken.save()

  res.status(200).json({
    message: 'Email verified successfully.',
    email: emailVerificationToken.email,
    emailVerificationToken: token,
  })
})
```

- **slowyou.io verifies** the token in its MongoDB database
- Sets the `verified` field to `true`
- Returns the email and token to vegvisr.org

### **User Storage: vegvisr.org**

```javascript
// In vegvisr.org main-worker/index.js (lines 302-391)
if (parsedBody.message === 'Email verified successfully.' && parsedBody.emailVerificationToken) {
  // Check if user exists in vegvisr.org D1 database
  const existingUser = await db
    .prepare('SELECT emailVerificationToken FROM config WHERE email = ?')
    .bind(parsedBody.email)
    .first()

  if (existingUser) {
    // Update existing user's emailVerificationToken
    await db
      .prepare('UPDATE config SET emailVerificationToken = ? WHERE email = ?')
      .bind(parsedBody.emailVerificationToken, parsedBody.email)
      .run()
  } else {
    // Create new user in vegvisr.org D1 database
    const userId = uuidv4()
    await db
      .prepare(
        'INSERT INTO config (user_id, email, emailVerificationToken, data, role) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(
        userId,
        parsedBody.email,
        parsedBody.emailVerificationToken,
        JSON.stringify({}),
        'ViewOnly',
      )
      .run()
  }

  // Generate JWT token and redirect to login
  const jwtToken = await new SignJWT({ emailVerificationToken: parsedBody.emailVerificationToken })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('730d')
    .sign(jwtSecret)

  return Response.redirect(
    `https://www.vegvisr.org/login?email=${parsedBody.email}&token=${jwtToken}`,
  )
}
```

- **vegvisr.org stores** the verified user in its D1 database
- Creates or updates the user record with the `emailVerificationToken`
- Generates a JWT token for authentication
- Redirects to the login page

### **Complete Flow Summary**

1. **Registration Request** → vegvisr.org calls slowyou.io `/reg-user-vegvisr`
2. **Token Generation** → slowyou.io creates `emailVerificationToken` and stores in MongoDB
3. **Email Sending** → slowyou.io sends verification email with link to vegvisr.org
4. **User Clicks Link** → vegvisr.org `/verify-email` endpoint receives the token
5. **Token Verification** → vegvisr.org calls slowyou.io `/verify-email` to verify the token
6. **User Storage** → vegvisr.org stores the verified user in D1 database
7. **Authentication** → vegvisr.org generates JWT and redirects to login

### **Key Architectural Points**

- **slowyou.io responsibilities:**

  - Token generation (`crypto.randomBytes(20).toString('hex')`)
  - Email sending (nodemailer with Gmail)
  - Token verification (MongoDB lookup and verification)
  - Email template management (language JSON files)

- **vegvisr.org responsibilities:**

  - User storage in D1 database
  - JWT token generation for authentication
  - Session management
  - Login flow handling

- **Data Flow:**
  - Token flows from slowyou.io → vegvisr.org during verification
  - User data is stored in both systems (MongoDB in slowyou.io, D1 in vegvisr.org)
  - Authentication is handled entirely by vegvisr.org

This analysis corrects all previous misunderstandings about token generation and provides the definitive architectural flow based on actual code implementation.

---

## 🎯 **Executive Summary**

Transform the current centralized email system (`vegvisr.org@gmail.com`) into a distributed, user-controlled email infrastructure where:

- **Room owners** send invitations from their own professional email addresses
- **Brand managers** control email templates, subject lines, and branding
- **Users** configure their Gmail/Outlook credentials securely in their profile
- **Email delivery** is handled by a dedicated Cloudflare Worker

This enables professional, branded communication while maintaining security and scalability.

**🎯 Key Architectural Advantage:** The email-worker operates independently and generates registration links to the existing, proven slowyou.io → vegvisr.org verification system - requiring **zero changes** to your current user management infrastructure.

**🎯 Clear Service Separation:**

**slowyou.io Responsibilities:**

- User registration and authentication
- **Email verification token generation** (`emailVerificationToken`)
- **Email sending** (using nodemailer with `vegvisr.org@gmail.com`)
- **Token verification** (MongoDB lookup and verification)
- User data storage in MongoDB
- Role assignment (`subscriber`, `user`, `admin`)
- Email template management (language JSON files)

**vegvisr.org email-worker Responsibilities:**

- **Email template management** (custom branding, multi-language)
- **Invitation link generation** (to slowyou.io registration)
- **User email configuration** (for custom sender addresses)
- **Template rendering** with variables
- **Link coordination** between systems

**vegvisr.org main-worker Responsibilities:**

- **User storage** in D1 database
- **JWT token generation** for authentication
- **Session management** and login flow handling
- **Token coordination** with slowyou.io verification

**🎯 Subscriber Strategy:** Non-registered users are automatically registered as `subscribers` via slowyou.io, creating a natural onboarding funnel that grows your user base while providing appropriate access levels for chat room participation.

---

## 🏗️ **System Architecture**

### **Current State:**

```
Frontend → main-worker → slowyou.io → Gmail (vegvisr.org@gmail.com)
```

### **Target State:**

```
Frontend → main-worker → email-worker → slowyou.io → User's Email (owner@company.com)
                    ↓                       ↓                    ↓
                Template Engine        Generates Links to    Email Sending
                Brand Config          slowyou.io API        (nodemailer)
                Link Generation       (reg-user-vegvisr)    (vegvisr.org@gmail.com)
```

**🎯 Key Insight:** slowyou.io requires **zero changes** - email-worker generates proper registration links to the existing, proven system. **slowyou.io continues to handle all email sending** using its existing nodemailer setup.

### **Components:**

1. **email-worker** - Dedicated Cloudflare Worker for **template management and link generation**
2. **Template Engine** - Custom email template rendering system (vegvisr.org)
3. **User Email Config** - Secure credential storage per user (for future custom SMTP)
4. **Brand Configuration** - Email templates and branding per room/domain
5. **slowyou.io** - **Email sending service** (existing nodemailer system)

### **🎯 Subscriber Role Strategy**

**Automatic Subscriber Registration for Invited Users:**

When non-registered users are invited to chat rooms, they are automatically registered with `role=subscriber` in the slowyou.io system. This creates a strategic onboarding funnel with multiple benefits:

#### **✅ Business Benefits:**

- **Lower Barrier to Entry** → Easy for people to join discussions without complex registration
- **User Base Growth** → Chat invitations naturally expand subscriber base
- **Freemium Model** → Gets users into ecosystem with potential for future upgrades
- **Community Building** → Enables external collaborators and guest participation

#### **✅ Technical Benefits:**

- **Appropriate Permissions** → Subscribers get chat access with controlled privileges
- **Scalable Architecture** → Supports many subscribers without system strain
- **Role Hierarchy** → Clear distinction between subscribers, users, and admins
- **Future Flexibility** → Subscribers can be upgraded to full users later

#### **✅ Use Cases:**

- **Guest Speakers** → Invited for specific discussions or events
- **External Collaborators** → Access to relevant project rooms
- **Community Members** → Participation in public discussions
- **Conference Attendees** → Temporary access to workshop/event rooms
- **Beta Testers** → Limited access for feedback and testing

#### **✅ User Journey:**

```
Invitation → Subscriber Registration → Email Verification → Room Access → Potential Upgrade
```

This strategy transforms chat room invitations from simple access grants into strategic user acquisition opportunities.

---

## 📋 **Implementation Phases**

### **Phase 1: Database Schema & Core Infrastructure**

**Timeline:** Week 1  
**Deliverables:**

- New database tables for email templates and user email configuration
- Default system templates
- Basic email-worker structure

### **Phase 2: email-worker Development**

**Timeline:** Week 2  
**Deliverables:**

- Complete email-worker with slowyou.io link generation
- Template rendering engine for custom branding
- slowyou.io API integration testing
- Link generation with invitation tokens

### **Phase 3: Template Engine & Link Generation**

**Timeline:** Week 2-3  
**Deliverables:**

- Template variable system
- Custom email rendering (for slowyou.io integration)
- slowyou.io link generation (no slowyou.io changes needed)
- main-worker API updates for email-worker communication
- Multi-language template support

### **Phase 4: Frontend User Interface**

**Timeline:** Week 3-4  
**Deliverables:**

- Email configuration UI in UserDashboard
- Template editor for room owners
- Email testing interface

### **Phase 5: Security & Production Readiness**

**Timeline:** Week 4  
**Deliverables:**

- Password encryption
- Rate limiting
- Audit logging
- Production deployment

---

## 🗄️ **Database Schema**

### **Email Templates Table**

```sql
CREATE TABLE email_templates (
    id TEXT PRIMARY KEY,                    -- UUID
    owner_type TEXT NOT NULL,               -- 'brand', 'room', 'system'
    owner_id TEXT NOT NULL,                 -- brand domain, room_id, or 'default'
    template_type TEXT NOT NULL,            -- 'invitation', 'verification', 'welcome'
    language TEXT DEFAULT 'en',             -- 'en', 'no', 'sv', etc.
    subject_template TEXT NOT NULL,         -- "Join {roomName} discussion"
    body_template TEXT NOT NULL,            -- HTML template with placeholders
    variables JSON,                         -- Available template variables
    created_by TEXT,                        -- user_id who created template
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1
);

-- Indexes for performance
CREATE INDEX idx_email_templates_owner ON email_templates(owner_type, owner_id);
CREATE INDEX idx_email_templates_type ON email_templates(template_type, language);
```

### **User Email Configuration**

```sql
-- Option A: Extend existing config table
ALTER TABLE config ADD COLUMN email_config JSON;

-- Option B: Separate table (recommended for security)
CREATE TABLE user_email_config (
    user_id TEXT PRIMARY KEY,              -- References config.user_id
    email_address TEXT NOT NULL,           -- user@company.com
    email_password TEXT NOT NULL,          -- App-specific password (encrypted)
    email_service TEXT DEFAULT 'Gmail',    -- 'Gmail', 'Outlook', 'Custom'
    smtp_host TEXT,                        -- For custom SMTP
    smtp_port INTEGER DEFAULT 587,         -- For custom SMTP
    smtp_secure INTEGER DEFAULT 0,         -- 0/1 for TLS
    is_active INTEGER DEFAULT 1,           -- Enable/disable
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_email_config_user ON user_email_config(user_id);
```

### **Invitation Tokens Table**

```sql
-- Store invitation context for seamless room joining
CREATE TABLE invitation_tokens (
    id TEXT PRIMARY KEY,                    -- UUID invitation token
    recipient_email TEXT NOT NULL,         -- Invited user email
    room_id TEXT NOT NULL,                  -- Target room
    inviter_name TEXT NOT NULL,             -- Person who sent invitation
    inviter_user_id TEXT NOT NULL,          -- Inviter's user_id
    invitation_message TEXT,                -- Custom message from inviter
    expires_at DATETIME NOT NULL,           -- Token expiration (7 days)
    used_at DATETIME,                       -- When invitation was used
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1
);

-- Indexes for performance
CREATE INDEX idx_invitation_tokens_email ON invitation_tokens(recipient_email);
CREATE INDEX idx_invitation_tokens_room ON invitation_tokens(room_id);
CREATE INDEX idx_invitation_tokens_expires ON invitation_tokens(expires_at);
```

### **Extend Chat Rooms**

```sql
-- Add template configuration to existing site_chat_rooms
ALTER TABLE site_chat_rooms ADD COLUMN email_template_id TEXT;
ALTER TABLE site_chat_rooms ADD COLUMN custom_branding JSON;
```

---

## 🔧 **Technical Implementation**

### **email-worker Structure**

```
email-worker/
├── index.js          # Main worker file
├── wrangler.toml      # Worker configuration
├── package.json       # Dependencies (no nodemailer needed)
└── README.md          # Documentation
```

### **Key Endpoints:**

#### **POST /generate-invitation**

Generate invitation link to slowyou.io with user's branding

```javascript
{
  "senderUserId": "user_123",
  "recipientEmail": "invitee@company.com",
  "roomId": "room_456",
  "invitationMessage": "Join our discussion!",
  "templateLanguage": "en"
}

// Response:
{
  "success": true,
  "invitationLink": "https://slowyou.io/api/reg-user-vegvisr?email=invitee@company.com&role=subscriber&callback=https%3A%2F%2Fwww.vegvisr.org%2Fjoin-room%3Finvitation%3Dabc123",
  "templateData": {
    "subject": "Join Project Alpha Discussion",
    "body": "<html>...</html>"
  }
}
```

#### **POST /test-slowyou-connection**

Test connection to slowyou.io API

```javascript
{
  "userId": "user_123",
  "testEmail": "test@example.com"
}

// Response:
{
  "success": true,
  "message": "Successfully connected to slowyou.io API",
  "slowyouResponse": {
    "status": "ready",
    "emailService": "nodemailer",
    "senderEmail": "vegvisr.org@gmail.com"
  }
}
```

#### **GET /templates/system/{language}/{templateType}**

Get system email templates by language (leveraging existing GraphAdmin language infrastructure)

```javascript
// Request: GET /templates/system/tr/chat_invitation
// Response:
{
  "success": true,
  "template": {
    "subject": "Sohbet odamıza katılın: {roomName}",
    "body": "<html><body><p>Merhaba,</p><p><strong>{inviterName}</strong> tarafından <strong>{roomName}</strong> sohbet odasına davet edildiniz.</p><p><a href=\"{joinLink}\">Sohbet Odasına Katıl</a></p></body></html>",
    "language": "tr",
    "templateType": "chat_invitation"
  }
}
```

#### **GET /join-room?invitation={token}** (in main-worker)

Seamless invitation processing with automatic registration and room access

```javascript
// User clicks invitation link: https://www.vegvisr.org/join-room?invitation=abc123
// Flow:
// 1. If not registered → redirect to slowyou.io with callback
// 2. If registered → auto-add to room and redirect to chat
// 3. Perfect user experience with zero manual steps

// Example Response (registered user):
HTTP 302 Redirect
Location: /xchat?room=room_123&welcome=true

// Example Response (unregistered user):
HTTP 302 Redirect
Location: https://slowyou.io/api/reg-user-vegvisr?email=post@universi.no&role=subscriber&callback=https%3A%2F%2Fwww.vegvisr.org%2Fjoin-room%3Finvitation%3Dabc123
```

### **Template Variable System & Invitation Token Generation**

```javascript
const TEMPLATE_VARIABLES = {
  invitation: [
    '{inviterName}', // "John Smith"
    '{inviterEmail}', // "john@company.com"
    '{roomName}', // "Project Alpha Discussion"
    '{roomDescription}', // "Strategic planning for Q1"
    '{invitationMessage}', // Personal message from inviter
    '{joinLink}', // "https://www.vegvisr.org/join-room?invitation=abc123def456"
    '{brandName}', // "Acme Corporation"
    '{brandLogo}', // URL to logo image
    '{recipientEmail}', // Invitee's email
    '{currentDate}', // "July 27, 2025"
  ],
}

// Invitation Token Generation (Complete Flow)
const generateInvitationToken = async (
  recipientEmail,
  roomId,
  inviterName,
  inviterUserId,
  customMessage,
) => {
  const invitationToken = uuidv4()

  // Store invitation in database with 7-day expiration
  await env.vegvisr_org
    .prepare(
      `
      INSERT INTO invitation_tokens 
      (id, recipient_email, room_id, inviter_name, inviter_user_id, invitation_message, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .bind(
      invitationToken,
      recipientEmail,
      roomId,
      inviterName,
      inviterUserId,
      customMessage,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    )
    .run()

  // Return our controlled invitation link
  return `https://www.vegvisr.org/join-room?invitation=${invitationToken}`
}

// Complete Dual-Path Invitation Flow Handler (in main-worker)
const handleJoinRoom = async (request, env) => {
  const url = new URL(request.url)
  const invitationToken = url.searchParams.get('invitation')

  // Get invitation details
  const invitation = await env.vegvisr_org
    .prepare('SELECT * FROM invitation_tokens WHERE id = ? AND is_active = 1 AND expires_at > ?')
    .bind(invitationToken, new Date().toISOString())
    .first()

  if (!invitation) {
    return new Response('Invitation expired or invalid', { status: 400 })
  }

  // Check if recipient is already registered in vegvisr.org system
  const existingUser = await env.vegvisr_org
    .prepare('SELECT user_id, email FROM config WHERE email = ?')
    .bind(invitation.recipient_email)
    .first()

  if (!existingUser) {
    // PATH A: Non-registered user → Full slowyou.io registration flow
    const callbackUrl = `https://www.vegvisr.org/join-room?invitation=${invitationToken}`
    const registerUrl = `https://slowyou.io/api/reg-user-vegvisr?email=${invitation.recipient_email}&role=subscriber&callback=${encodeURIComponent(callbackUrl)}`
    return Response.redirect(registerUrl)
  }

  // PATH B: Registered user → Simple room access verification
  // Check if user is currently logged in
  const userStore = getUserFromSession(request)

  if (!userStore.loggedIn || userStore.email !== invitation.recipient_email) {
    // User exists but not logged in or wrong user → redirect to login with room context
    const loginUrl = `https://www.vegvisr.org/login?email=${encodeURIComponent(invitation.recipient_email)}&redirect=/join-room?invitation=${invitationToken}`
    return Response.redirect(loginUrl)
  }

  // User is registered and logged in → direct room access
  await addUserToRoom(invitation.room_id, existingUser.user_id, 'member')

  // Mark invitation as used
  await env.vegvisr_org
    .prepare('UPDATE invitation_tokens SET used_at = ? WHERE id = ?')
    .bind(new Date().toISOString(), invitationToken)
    .run()

  // Redirect to chat room
  return Response.redirect(`/xchat?room=${invitation.room_id}&welcome=true`)
}
```

### **Multi-Language Integration (Leveraging Existing System)**

**🎯 Strategic Advantage:** The system already has a **sophisticated translation architecture** used in GraphAdmin:

#### **Current Language Infrastructure:**

- **Language JSON files** (`public/languages/nb.json`, `en.json`, `tr.json`, etc.)
- **Language selection UI** (Turkish, English, German, Spanish, Norwegian)
- **AI translation integration** with Grok API for dynamic content
- **Auto-detect capabilities** from user profiles

#### **Language File Structure (Following Current Pattern):**

```javascript
// public/languages/en.json
{
  "emailvegvisrorg": {
    "chat_invitation": {
      "subject": "Join our chat room: {roomName}",
      "body": "<html><body><p>Hello,</p><p>You've been invited by <strong>{inviterName}</strong> to join <strong>{roomName}</strong>.</p><p><a href=\"{joinLink}\">Join Chat Room</a></p></body></html>"
    },
    "room_welcome": {
      "subject": "Welcome to {roomName}",
      "body": "<html><body><p>Welcome! Room: <strong>{roomName}</strong></p><p><a href=\"{joinLink}\">Start Chatting</a></p></body></html>"
    }
  }
}

// public/languages/tr.json
{
  "emailvegvisrorg": {
    "chat_invitation": {
      "subject": "Sohbet odamıza katılın: {roomName}",
      "body": "<html><body><p>Merhaba,</p><p><strong>{inviterName}</strong> tarafından <strong>{roomName}</strong> sohbet odasına davet edildiniz.</p><p><a href=\"{joinLink}\">Sohbet Odasına Katıl</a></p></body></html>"
    }
  }
}
```

#### **Language Selection API Integration:**

```javascript
// In email-worker/index.js
const getEmailTemplate = async (language, templateType, roomConfig) => {
  // Default to English if language not supported
  const supportedLanguages = ['nb', 'en', 'tr', 'de', 'es']
  const lang = supportedLanguages.includes(language) ? language : 'en'

  // Check for custom room template first
  if (roomConfig?.custom_template) {
    return roomConfig.custom_template
  }

  // Load system language template (following GraphAdmin pattern)
  const templates = await import(`../languages/${lang}.json`)
  return templates.emailvegvisrorg[templateType]
}
```

### **Template Rendering Engine**

```javascript
const renderEmailTemplate = (template, variables) => {
  let subject = template.subject_template
  let body = template.body_template

  // Replace all variables
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{${key}}`
    subject = subject.replace(new RegExp(placeholder, 'g'), value)
    body = body.replace(new RegExp(placeholder, 'g'), value)
  })

  return { subject, body }
}
```

---

## 🎨 **Frontend Implementation**

### **Email Configuration UI**

**Location:** `src/views/UserDashboard.vue`

**Features:**

- Email address input
- App password configuration
- Service selection (Gmail, Outlook, Yahoo)
- Configuration testing
- Success/error feedback

### **Template Editor UI (Enhanced with Language Support)**

**Location:** `src/components/EmailTemplateModal.vue`

**Features:**

- **Language selection dropdown** (following GraphAdmin pattern: Norwegian, English, Turkish, German, Spanish)
- **Auto-detect option** from user profile language
- **Use system template toggle** (like GraphAdmin's "keepOriginalLanguage" checkbox)
- Subject line editor with multi-language templates
- HTML email body editor with language-specific content
- Variable insertion buttons
- Live preview with language switching
- Save/reset functionality

**Language Selection UI (Following GraphAdmin Pattern):**

```vue
<template>
  <div class="email-template-editor">
    <!-- Language Selection (same pattern as TranscriptProcessorModal) -->
    <div class="form-group">
      <label>Email Language:</label>
      <select v-model="selectedLanguage" class="form-control">
        <option value="auto">Auto-detect from user profile</option>
        <option value="nb">🇳🇴 Norwegian</option>
        <option value="en">🇺🇸 English</option>
        <option value="tr">🇹🇷 Turkish</option>
        <option value="de">🇩🇪 German</option>
        <option value="es">🇪🇸 Spanish</option>
      </select>
    </div>

    <!-- Use System Template Toggle (like keepOriginalLanguage) -->
    <div class="form-check">
      <input
        id="useSystemTemplate"
        v-model="useSystemTemplate"
        type="checkbox"
        class="form-check-input"
      />
      <label class="form-check-label" for="useSystemTemplate"> Use System Default Template </label>
    </div>

    <!-- Custom Template Editor (only if not using system template) -->
    <div v-if="!useSystemTemplate" class="custom-template-section">
      <!-- Subject and body editors... -->
    </div>
  </div>
</template>
```

### **Room Email Settings**

**Location:** `src/components/BrandingModal.vue`

**Features:**

- Select custom email template
- Override sender email
- Brand logo/colors configuration
- Template preview

---

## 🔐 **Security Implementation**

### **Password Encryption**

```javascript
// Use Web Crypto API in Cloudflare Workers
const encryptPassword = async (password, key) => {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)

  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'AES-GCM' }, false, [
    'encrypt',
  ])

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, data)

  return { encrypted: Array.from(new Uint8Array(encrypted)), iv: Array.from(iv) }
}
```

### **Rate Limiting**

```javascript
// Implement per-user email sending limits
const checkRateLimit = async (userId, env) => {
  const key = `email_rate_limit:${userId}`
  const count = await env.RATE_LIMIT_KV.get(key)

  if (count && parseInt(count) > 50) {
    // 50 emails per hour
    throw new Error('Rate limit exceeded')
  }

  await env.RATE_LIMIT_KV.put(key, (parseInt(count || '0') + 1).toString(), {
    expirationTtl: 3600, // 1 hour
  })
}
```

### **Input Validation**

```javascript
const validateEmailConfig = (config) => {
  if (!config.emailAddress || !config.emailAddress.includes('@')) {
    throw new Error('Invalid email address')
  }

  if (!config.emailPassword || config.emailPassword.length < 8) {
    throw new Error('Invalid email password')
  }

  const allowedServices = ['Gmail', 'Outlook', 'Yahoo']
  if (!allowedServices.includes(config.emailService)) {
    throw new Error('Unsupported email service')
  }
}
```

---

## 📊 **Default Templates**

### **System Default Invitation Template**

```sql
INSERT INTO email_templates (
  id, owner_type, owner_id, template_type,
  subject_template, body_template, variables
) VALUES (
  'default_invitation',
  'system',
  'default',
  'invitation',
  'Join {roomName} - Invitation from {inviterName}',
  '<!DOCTYPE html>
  <html>
  <head>
    <style>
      .email-container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
      .header { background: #007bff; color: white; padding: 20px; text-align: center; }
      .content { padding: 20px; }
      .button { background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
      .footer { background: #f8f9fa; padding: 15px; text-align: center; color: #6c757d; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <h1>You''re Invited!</h1>
      </div>
      <div class="content">
        <h2>Join {roomName}</h2>
        <p><strong>{inviterName}</strong> ({inviterEmail}) has invited you to join a discussion.</p>

        <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0;">
          <p><strong>Room:</strong> {roomName}</p>
          <p><strong>Description:</strong> {roomDescription}</p>
        </div>

        <blockquote style="font-style: italic; border-left: 3px solid #ddd; padding-left: 15px; margin: 20px 0;">
          "{invitationMessage}"
        </blockquote>

        <div style="text-align: center;">
          <a href="{verificationLink}" class="button">Join Discussion</a>
        </div>

        <p><small>This invitation was sent on {currentDate}</small></p>
      </div>
      <div class="footer">
        <p>Powered by Vegvisr • <a href="https://vegvisr.org">vegvisr.org</a></p>
      </div>
    </div>
  </body>
  </html>',
  '["inviterName", "inviterEmail", "roomName", "roomDescription", "invitationMessage", "verificationLink", "currentDate"]'
);
```

---

## 🚀 **Migration Strategy (Simplified)**

### **Phase 1: Additive System**

- Deploy email-worker alongside existing slowyou.io system
- **No changes to slowyou.io required** - email-worker generates registration links to existing system
- Allow users to optionally configure custom email credentials
- Fallback to system email (`vegvisr.org@gmail.com`) for users without email config

### **Phase 2: User Adoption**

- Encourage power users to configure custom email
- Room owners can customize invitation templates and branding
- Monitor email delivery success rates and user satisfaction

### **Phase 3: Enhanced Features**

- Advanced template customization becomes standard
- **slowyou.io continues unchanged** - remains the trusted registration system
- Focus shifts to email deliverability and user experience improvements

---

## 📈 **Success Metrics**

### **Technical Metrics:**

- Email delivery rate > 95%
- Email configuration success rate > 90%
- System uptime > 99.9%
- Average email send time < 5 seconds

### **User Experience Metrics:**

- Template customization adoption > 60%
- User email configuration completion > 70%
- Invitation acceptance rate improvement > 25%
- User satisfaction score > 4.0/5.0

### **Business Metrics:**

- Reduced dependency on external email services
- Increased professional appearance of invitations
- Enhanced brand consistency
- Improved deliverability rates

---

## 🔧 **Development Tasks**

### **Backend Tasks:**

- [ ] Create email-worker project structure
- [ ] Implement slowyou.io link generation
- [ ] Design database schema (including `invitation_tokens` table)
- [ ] Build template rendering engine
- [ ] **Create language email templates** (`public/languages/en.json`, `tr.json`, `de.json`, `es.json` with `emailvegvisrorg.chat_invitation` sections)
- [ ] **Implement language detection API** following GraphAdmin pattern
- [ ] **Build dual-path invitation token system** (Path A: strategic subscriber onboarding, Path B: direct access)
- [ ] **Add GET /join-room endpoint** in main-worker with smart user detection
- [ ] **Add automatic room membership** for both registered and newly-registered users
- [ ] **Implement user existence check** (query config table by email)
- [ ] **Add login redirect logic** for registered but not logged-in users
- [ ] Add password encryption
- [ ] Implement rate limiting
- [ ] Create audit logging
- [ ] Add comprehensive error handling

### **Frontend Tasks:**

- [ ] Design email configuration UI
- [ ] Build template editor component with **language selection dropdown** (following GraphAdmin TranscriptProcessorModal pattern)
- [ ] Add **"Use System Template" toggle** (like GraphAdmin's keepOriginalLanguage checkbox)
- [ ] Add configuration testing interface
- [ ] Implement template preview **with language switching**
- [ ] Add validation and error handling
- [ ] Create onboarding flow

### **Infrastructure Tasks:**

- [ ] Set up email-worker deployment
- [ ] Configure KV storage for rate limiting
- [ ] Set up monitoring and alerts
- [ ] Create backup and recovery procedures
- [ ] Implement security scanning
- [ ] Set up performance monitoring

---

## 🛡️ **Security Checklist**

- [ ] Encrypt email passwords at rest
- [ ] Validate all input parameters
- [ ] Implement rate limiting per user
- [ ] Add audit logging for all email sends
- [ ] Sanitize email templates for XSS
- [ ] Validate email addresses before storage
- [ ] Implement proper error handling without data leakage
- [ ] Add authentication for all API endpoints
- [ ] Use HTTPS for all communications
- [ ] Implement proper CORS headers

---

## 📚 **Documentation Requirements**

- [ ] API documentation for email-worker endpoints
- [ ] User guide for email configuration
- [ ] Template creation tutorial
- [ ] Troubleshooting guide
- [ ] Security best practices
- [ ] Deployment guide
- [ ] Monitoring and maintenance procedures

---

## ⚠️ **Additional Considerations & Potential Gaps**

### **1. Email Deliverability & DNS Configuration**

- **SPF Records**: Users need to configure SPF records for their domains
- **DKIM Signing**: Implement DKIM signatures for better deliverability
- **DMARC Policy**: Guide users on DMARC configuration
- **Reputation Management**: Monitor sender reputation scores
- **Bounce Handling**: Process bounce notifications and update user status

### **2. Legal & Compliance Requirements**

- **GDPR Compliance**: Data retention policies, right to be forgotten
- **CAN-SPAM Act**: Unsubscribe mechanisms, sender identification
- **Data Privacy**: Where email credentials are stored (EU vs US data centers)
- **Audit Trail**: Legal requirement for email communication logging
- **Consent Management**: Track user consent for receiving invitations

### **3. User Experience & Registration Flow (Complete Invitation Token System)**

**🎯 Perfect Seamless Flow - Complete User Journey:**

#### **Step 1: Invitation Email (Our Control)**

- User receives beautifully branded invitation email
- **ONE perfect button**: "Join Discussion"
- **Our custom link**: `https://www.vegvisr.org/join-room?invitation=abc123`

#### **Step 2: Smart Registration Handling (Dual-Path System)**

**Path A - Non-registered User:**

- **If NOT registered**: Auto-redirected to slowyou.io with callback URL preserved
- **Becomes subscriber** through full emailVerificationToken flow

**Path B - Registered User:**

- **If registered**: Simple room invitation verification (roomid + email only)
- **No token needed** - direct room access verification
- **Much faster process** - skips full registration

#### **Step 3: slowyou.io Registration & Verification (Existing System)**

- User registers with `role=subscriber`
- **slowyou.io creates** `emailVerificationToken: "b1ca2967e8165ec02fdf039d9e916af4005f7388"`
- Receives verification email: _"Bekreft din e-postadresse"_
- **Email links to vegvisr.org**: `https://test.vegvisr.org/verify-email?token=b1ca2967...`
- User clicks → **vegvisr.org calls slowyou.io** to verify the token
- **slowyou.io verifies** token in MongoDB and returns success
- **vegvisr.org stores** verified user in D1 database
- **vegvisr.org handles** callback redirect back to our invitation URL

#### **Step 4: Automatic Room Access**

- User now registered and logged in
- Automatically added to `site_room_members` as 'member'
- Redirected to `/xchat?room=room_123&welcome=true`
- **User starts chatting immediately**

**✅ Key Advantages:**

- **Zero slowyou.io changes** - uses existing callback parameter
- **Complete context preservation** through invitation tokens
- **Perfect user experience** - feels like one seamless flow
- **We control everything** - email template, branding, language, flow

### **4. Scalability & Performance**

- **Email Queue System**: Handle bulk invitations (100+ recipients)
- **Connection Pooling**: Optimize SMTP connections for high-volume sending
- **Worker Concurrency**: Multiple email-workers for load distribution
- **Rate Limiting Per Domain**: Prevent overwhelming recipient email servers
- **Caching Strategy**: Cache templates, user configs, DNS lookups

### **5. Error Handling & Resilience**

- **Fallback Email Service**: If user's Gmail fails, fallback to system email
- **Retry Logic**: Exponential backoff for temporary failures
- **Dead Letter Queue**: Handle permanently failed emails
- **Circuit Breaker**: Prevent cascading failures from email service outages
- **Graceful Degradation**: Continue chat functionality even if email fails

### **6. Email Analytics & Monitoring**

- **Delivery Tracking**: Track sent, delivered, bounced, failed emails
- **Open Rate Tracking**: Optional pixel tracking for email opens
- **Click Tracking**: Track invitation link clicks and conversions
- **Dashboard Metrics**: Room owner dashboard showing invitation success rates
- **Alert System**: Notify room owners of delivery issues

### **7. Testing & Quality Assurance**

- **Email Sandbox Mode**: Test mode that doesn't send real emails
- **Template Preview**: Live preview across different email clients (Gmail, Outlook, Apple Mail)
- **A/B Testing**: Test different invitation templates for better conversion
- **Load Testing**: Simulate high-volume email sending scenarios
- **Cross-client Testing**: Ensure templates render correctly across all email clients

### **8. Integration Advantages (Simplified Architecture)**

- **✅ Zero slowyou.io Changes**: email-worker generates links to existing registration system - no modifications needed
- **✅ Proven Registration Flow**: Leverage existing slowyou.io → dashboard.vegvisr.org → main-worker authentication
- **✅ Clean Separation**: Email delivery completely separate from user management
- **Remaining Integration Tasks**:
  - **API Authentication**: Secure communication between main-worker and email-worker
  - **User Email Config Sync**: Keep email credentials accessible to email-worker
  - **Session Management**: Handle user authentication for email configuration UI

### **9. Cost & Resource Management**

- **Email Sending Costs**: Gmail API quotas, SMTP service costs
- **Worker Execution Costs**: Cloudflare Worker CPU time and requests
- **Storage Costs**: Email template storage, credential encryption
- **Cost Monitoring**: Track per-user email sending costs
- **Budget Alerts**: Notify when approaching cost thresholds

### **10. Advanced Features (Future Considerations)**

- **Email Template Versioning**: Handle template updates without breaking existing rooms
- **Dynamic Content**: Personalize emails based on user profile data
- **Email Scheduling**: Schedule invitation emails for optimal delivery times
- **Multi-language Auto-detection**: Detect recipient's preferred language from profile
- **Rich Media Support**: Embedded images, videos in email templates
- **Email Encryption**: End-to-end encryption for sensitive room invitations

---

## 🎉 **Complete Invitation Token System Summary**

### **🔥 The Perfect Dual-Path User Experience:**

#### **For All Users:**

1. **Beautiful Email** → User receives branded invitation with ONE button: "Join Discussion"
2. **One Click** → `https://www.vegvisr.org/join-room?invitation=abc123`

#### **Path A - Non-registered User (Strategic Subscriber Onboarding):**

3. **Auto-register** → slowyou.io registration with `role=subscriber`
4. **Strategic growth** → Chat invitation becomes user acquisition
5. **Email verification** → Complete `emailVerificationToken` security process
6. **Automatic room access** → Added to room and redirected to chat
7. **Future potential** → Subscriber can be upgraded to full user later

#### **Path B - Registered User (Simple & Fast):**

3. **Login check** → If not logged in, simple login redirect
4. **Direct room access** → No token verification needed (just roomid + email)
5. **Immediate chatting** → Straight to `/xchat?room=room_123&welcome=true`

### **🏗️ Technical Architecture Benefits:**

- ✅ **Zero slowyou.io changes** - uses existing callback parameter
- ✅ **Complete context preservation** - invitation tokens store everything
- ✅ **Perfect security** - tokens expire in 7 days and are single-use
- ✅ **Full control** - we own the email, branding, flow, and user experience
- ✅ **Seamless integration** - leverages existing proven registration system
- ✅ **Multi-language support** - follows GraphAdmin translation patterns
- ✅ **Dual-path efficiency** - Fast track for registered users, strategic onboarding for new users
- ✅ **Strategic user acquisition** - Chat invitations automatically grow subscriber base
- ✅ **Automatic subscriber role** - Non-registered users become subscribers with appropriate permissions
- ✅ **Smart user detection** - System automatically chooses optimal path per user
- ✅ **Future upgrade potential** - Subscribers can be promoted to full users as needed

### **🎯 Key Innovation:**

**We created a smart dual-path bridge system** that automatically detects user status and provides the optimal experience:

- **Non-registered users** → Strategic subscriber onboarding via slowyou.io (grows user base + preserves context)
- **Registered users** → Fast-track room access (just roomid + email verification)

This gives us complete control over the invitation experience while leveraging your existing, proven infrastructure with maximum efficiency for all user types.

---

## 🎯 **Next Steps**

1. **Immediate:** Create database schema and default templates
2. **Week 1:** Implement core email-worker functionality
3. **Week 2:** Build template engine and main-worker integration
4. **Week 3:** Develop frontend interfaces
5. **Week 4:** Security hardening and production deployment

---

**Contact:** Development Team  
**Last Updated:** July 27, 2025  
**Version:** 1.0
