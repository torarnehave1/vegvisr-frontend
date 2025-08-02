# AFFILIATE SYSTEM BACKEND WORKER ANALYSIS

**VEGVISR PROTOCOL - STEP 3: BACKEND ARCHITECTURE**

## Overview

Analysis of Cloudflare Workers involved in the affiliate system architecture. This documentation identifies all workers in the system and their top-level responsibilities without diving into endpoint details.

---

## 🏗️ CLOUDFLARE WORKERS ARCHITECTURE

### Core System Workers (Affiliate-Related)

#### 1. `main-worker/`

**Primary Role**: Central application worker and main entry point
**Top-Level Description**: Handles primary application logic including user registration, authentication, and core business functions
**Affiliate Involvement**: Contains the VEGVISR protocol implementation for affiliate invitation processing

#### 2. `aff-worker/`

**Primary Role**: Dedicated affiliate management worker
**Top-Level Description**: Specialized worker for affiliate-specific operations and invitation handling
**Affiliate Involvement**: Direct affiliate system implementation (alternative to main-worker approach)

#### 3. `email-worker/`

**Primary Role**: Email processing and delivery worker
**Top-Level Description**: Handles email template processing and message delivery operations
**Affiliate Involvement**: Potential email delivery for affiliate invitations (simulation mode detected)

---

## 🔗 SUPPORTING SYSTEM WORKERS

#### 4. `auth-worker/`

**Primary Role**: Authentication and authorization services
**Top-Level Description**: Manages user authentication, session handling, and authorization checks
**Affiliate Involvement**: User verification for affiliate registration process

#### 5. `api-worker/`

**Primary Role**: General API services and utilities
**Top-Level Description**: Provides common API functionalities and service integrations
**Affiliate Involvement**: Supporting services for affiliate system operations

#### 6. `proxy-worker/`

**Primary Role**: Request routing and proxy services
**Top-Level Description**: Handles request routing between different workers and external services
**Affiliate Involvement**: May route affiliate-related requests between workers

---

## 🎯 SPECIALIZED WORKERS (Non-Affiliate)

#### 7. `chat-worker/`

**Primary Role**: Chat and messaging services
**Top-Level Description**: Handles real-time chat functionality and room management

#### 8. `social-worker/`

**Primary Role**: Social networking features
**Top-Level Description**: Manages social interactions, connections, and community features

#### 9. `subscription-worker/`

**Primary Role**: Subscription and billing management
**Top-Level Description**: Handles user subscriptions, payment processing, and billing cycles

#### 10. `dashboard-worker/` (dash-worker)

**Primary Role**: User dashboard and analytics
**Top-Level Description**: Provides dashboard functionality and user interface services

#### 11. `menu-worker/`

**Primary Role**: Navigation and menu services
**Top-Level Description**: Manages application navigation and menu generation

#### 12. `brand-worker/`

**Primary Role**: Branding and customization services
**Top-Level Description**: Handles brand-specific customizations and theming

---

## 🧠 AI/ML WORKERS

#### 13. `autorag-sandbox-worker/`

**Primary Role**: AI-powered retrieval and generation
**Top-Level Description**: Provides AI-based content retrieval and automated generation services

#### 14. `rag-manager-worker/`

**Primary Role**: RAG (Retrieval-Augmented Generation) management
**Top-Level Description**: Manages retrieval-augmented generation workflows and data

#### 15. `vector-search-worker/`

**Primary Role**: Vector search and similarity matching
**Top-Level Description**: Handles vector-based search operations and semantic matching

#### 16. `norwegian-text-worker/`

**Primary Role**: Norwegian language text processing
**Top-Level Description**: Specialized text processing for Norwegian language content

#### 17. `norwegian-transcription-worker/`

**Primary Role**: Norwegian speech-to-text services
**Top-Level Description**: Audio transcription services for Norwegian language

#### 18. `whisper-worker/`

**Primary Role**: Speech recognition and transcription
**Top-Level Description**: AI-powered speech recognition using Whisper technology

---

## 📁 CONTENT & MEDIA WORKERS

#### 19. `image-analysis-worker/`

**Primary Role**: Image processing and analysis
**Top-Level Description**: Handles image upload, processing, and AI-based analysis

#### 20. `audio-portfolio-worker/`

**Primary Role**: Audio content management
**Top-Level Description**: Manages audio portfolios and media content

#### 21. `youtube-worker/`

**Primary Role**: YouTube integration services
**Top-Level Description**: Handles YouTube API integration and video management

#### 22. `youtube-audio-service/`

**Primary Role**: YouTube audio extraction
**Top-Level Description**: Extracts and processes audio from YouTube content

---

## 🛠️ UTILITY WORKERS

#### 23. `dev-worker/`

**Primary Role**: Development and testing utilities
**Top-Level Description**: Provides development tools and testing environments

#### 24. `sandbox-worker/`

**Primary Role**: Safe execution environment
**Top-Level Description**: Provides isolated sandbox environment for code execution

#### 25. `sweet-worker/`

**Primary Role**: Unknown specialized function
**Top-Level Description**: Purpose to be determined through further analysis

---

## 🎯 AFFILIATE SYSTEM WORKER SUMMARY

### Primary Affiliate Workers:

1. **main-worker** - VEGVISR protocol implementation (confirmed active)
2. **aff-worker** - Dedicated affiliate management (alternative implementation)
3. **email-worker** - Email delivery services (simulation mode)

### Supporting Workers:

- **auth-worker** - User authentication
- **api-worker** - API services
- **proxy-worker** - Request routing

### Total Workers in System: **25 identified workers**

---

**Step 3 Status**: ✅ **WORKER IDENTIFICATION COMPLETE**
**Analysis Level**: Top-level worker identification and general purpose only
**Next Analysis**: Deeper dive into the 3 primary affiliate workers (main-worker, aff-worker, email-worker) routing and relationships

---

## 🔑 TOKEN SYSTEM INTEGRATION NOTE

**IMPORTANT**: The affiliate system integrates with **TWO TOKEN SYSTEMS**:

### **slowyou.io Email Verification Tokens**

- **Generated by**: slowyou.io API (external service)
- **Managed by**: main-worker (VEGVISR protocol integration)
- **Purpose**: User account email verification (permanent)
- **Example**: `b1ca2967e8165ec02fdf039d9e916af4005f7388`

### **Affiliate Invitation Tokens**

- **Generated by**: main-worker (`crypto.randomUUID()`)
- **Managed by**: main-worker affiliate invitation system
- **Purpose**: Affiliate invitation verification (temporary, one-time use)
- **Example**: `9a533b5b-a9f6-4df7-be6b-73c0f3ab2e53`

**Worker Responsibilities**:

- **main-worker**: Handles both token types and their respective verification flows
- **aff-worker**: Alternative implementation (currently not used for primary flow)
- **email-worker**: Email delivery support (simulation mode detected)
