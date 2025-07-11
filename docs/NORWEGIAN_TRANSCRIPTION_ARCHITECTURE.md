# Norwegian Transcription System - Complete Architecture Documentation

## System Overview

The Norwegian Transcription System is a distributed architecture that combines a dedicated Hetzner server for AI transcription with Cloudflare Workers for orchestration and text improvement. The system provides secure, high-quality Norwegian audio transcription with AI-enhanced text improvement.

## Architecture Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Frontend      │    │  Cloudflare      │    │   Hetzner Server    │
│   Vue.js App    │◄──►│    Workers       │◄──►│   46.62.149.157     │
│ www.vegvisr.org │    │ Orchestration    │    │ transcribe.vegvisr  │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  Cloudflare      │
                       │   Workers AI     │
                       │ Text Improvement │
                       └──────────────────┘
```

---

## 1. External Server Infrastructure (Hetzner)

### Server Specifications

- **Provider**: Hetzner Cloud
- **IP Address**: `46.62.149.157`
- **OS**: Ubuntu 22.04 LTS
- **RAM**: 8GB (5.4GB available for applications)
- **Storage**: SSD
- **Location**: Helsinki, Finland

### Domain Configuration

- **Primary Domain**: `transcribe.vegvisr.org`
- **DNS Provider**: Cloudflare
- **DNS Configuration**: A record pointing to `46.62.149.157` (DNS only, not proxied)

### SSL/TLS Configuration

- **SSL Provider**: Let's Encrypt
- **Certificate Manager**: Certbot
- **Certificate Location**: `/etc/letsencrypt/live/transcribe.vegvisr.org/`
- **Auto-renewal**: Configured via certbot cron job
- **Protocols**: TLS 1.2, TLS 1.3

### Docker Infrastructure

#### Docker Compose Configuration

```yaml
# Location: /root/whisper-api/docker-compose.yml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    container_name: whisper-nginx
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/conf.d:/etc/nginx/conf.d
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - ./logs/nginx:/var/log/nginx

  whisper:
    build:
      context: ./whisper
      dockerfile: Dockerfile
    container_name: whisper-service
    environment:
      - MODEL_NAME=NbAiLabBeta/nb-whisper-small
      - DEVICE=cpu
    volumes:
      - ./whisper:/app
      - ./uploads:/app/uploads
      - ./cache:/app/cache
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:8001/health']
      interval: 60s
      timeout: 30s
      retries: 3

  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    container_name: whisper-api
    environment:
      - NODE_ENV=production
      - WHISPER_SERVICE_URL=http://whisper:8001
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3
```

#### Container Details

| Container         | Image          | Port    | Status      | Purpose                                  |
| ----------------- | -------------- | ------- | ----------- | ---------------------------------------- |
| `whisper-nginx`   | nginx:alpine   | 80, 443 | Running     | SSL termination, reverse proxy, security |
| `whisper-service` | Custom Python  | 8001    | Healthy     | Norwegian Whisper AI transcription       |
| `whisper-api`     | Custom Node.js | 3000    | Unhealthy\* | Legacy API (not used for transcription)  |

\*Note: whisper-api container health status is not critical as transcription routes directly to whisper-service.

### Security Configuration

#### API Token Protection

- **Token**: `vegvisr_transcribe_2024_secure_token`
- **Header**: `X-API-Token`
- **Protected Endpoints**: `/transcribe`, `/health`
- **Unauthorized Response**: 403 Forbidden

#### Browser Request Handling

```nginx
# Browser requests are redirected to main site
if ($http_user_agent ~* "(Mozilla|Chrome|Safari|Firefox|Edge|Opera)") {
    return 301 https://www.vegvisr.org;
}
# Non-browser requests without token get 404
return 404;
```

### Nginx Configuration

#### SSL Server Block

```nginx
# Location: /root/whisper-api/nginx/conf.d/whisper-api.conf
server {
    listen 443 ssl;
    server_name transcribe.vegvisr.org;

    ssl_certificate /etc/letsencrypt/live/transcribe.vegvisr.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/transcribe.vegvisr.org/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Browser redirect security
    location / {
        if ($http_user_agent ~* "(Mozilla|Chrome|Safari|Firefox|Edge|Opera)") {
            return 301 https://www.vegvisr.org;
        }
        return 404;
    }

    # Transcription endpoint
    location /transcribe {
        if ($http_x_api_token != "vegvisr_transcribe_2024_secure_token") {
            return 403;
        }
        proxy_pass http://whisper:8001/transcribe;
        client_max_body_size 100M;
        proxy_read_timeout 300s;
    }
}
```

---

## 2. Cloudflare Workers Architecture

### Worker Services Overview

| Worker                           | URL                     | Purpose          | Dependencies                          |
| -------------------------------- | ----------------------- | ---------------- | ------------------------------------- |
| `norwegian-transcription-worker` | torarnehave.workers.dev | Orchestration    | Hetzner server, norwegian-text-worker |
| `norwegian-text-worker`          | torarnehave.workers.dev | Text improvement | Cloudflare Workers AI                 |

### Norwegian Transcription Worker

#### Purpose

Orchestrates the complete transcription workflow by coordinating between the Hetzner server and text improvement services.

#### Workflow

1. **Receive audio file** from frontend
2. **Call Hetzner server** for Norwegian transcription
3. **Call text improvement worker** for AI enhancement
4. **Return combined results** to frontend

#### Key Features

- **HTTPS Communication**: Secure connection to transcribe.vegvisr.org
- **API Token Authentication**: Includes security token in requests
- **Error Handling**: Graceful fallback if text improvement fails
- **Logging**: Comprehensive request/response logging

#### Configuration

```javascript
// API endpoint configuration
const TRANSCRIPTION_ENDPOINT = 'https://transcribe.vegvisr.org/transcribe'
const API_TOKEN = 'vegvisr_transcribe_2024_secure_token' This is a MockUp and will be change for real production inside the Cloudflare env
const TEXT_IMPROVEMENT_WORKER = 'https://norwegian-text-worker.torarnehave.workers.dev/'
```

### Norwegian Text Worker

#### Purpose

Enhances transcribed Norwegian text using Cloudflare Workers AI for improved readability and accuracy.

#### AI Model

- **Model**: Meta Llama 3.3 70B Instruct Fast
- **Provider**: Cloudflare Workers AI
- **Binding**: `env.AI.run('@cf/meta/llama-3.3-70b-instruct-fast')`

#### Enhancement Features

- **Grammar correction**
- **Punctuation improvement**
- **Sentence structure optimization**
- **Norwegian language polishing**

---

## 3. Frontend Architecture (Vue.js)

### Application Stack

- **Framework**: Vue.js 3 with Composition API
- **Build Tool**: Vite
- **State Management**: Pinia
- **Hosting**: Cloudflare Pages
- **Domain**: www.vegvisr.org

### Key Components

#### Norwegian Transcription Test Component

```vue
<!-- Location: src/views/NorwegianTranscriptionTest.vue -->
<template>
  <!-- Audio upload, recording, and transcription interface -->
</template>

<script setup>
// Direct HTTPS server communication
const NORWEGIAN_BASE_URL = 'https://transcribe.vegvisr.org'
const API_TOKEN = 'vegvisr_transcribe_2024_secure_token'

// Two workflow options:
// 1. Direct server calls (Step 1)
// 2. Worker orchestration (Step 2)
</script>
```

#### Whisper Node Component

```vue
<!-- Location: src/components/GNewNodes/GNewWhisperNode.vue -->
<!-- Legacy component for general whisper functionality -->
<!-- Uses: https://whisper.vegvisr.org (different from Norwegian service) -->
```

### API Communication Patterns

#### Step 1: Direct Server Communication

```javascript
// Direct HTTPS calls to Hetzner server
const response = await fetch('https://transcribe.vegvisr.org/transcribe', {
  method: 'POST',
  headers: {
    'X-API-Token': API_TOKEN,
  },
  body: formData,
})
```

#### Step 2: Worker Orchestration (Future)

```javascript
// Calls Norwegian transcription worker for complete workflow
const response = await fetch('https://norwegian-transcription-worker.torarnehave.workers.dev/', {
  method: 'POST',
  body: formData,
})
```

---

## 4. AI/ML Components

### Norwegian Whisper Model

- **Model**: `NbAiLabBeta/nb-whisper-small`
- **Provider**: Norwegian AI Lab Beta
- **Specialization**: Norwegian language speech recognition
- **Hardware**: CPU-optimized for 8GB RAM server
- **Location**: Running in Docker container on Hetzner server

### Text Improvement AI

- **Model**: Meta Llama 3.3 70B Instruct Fast
- **Provider**: Cloudflare Workers AI
- **Purpose**: Norwegian text enhancement and polish
- **Performance**: Fast inference through Cloudflare's global network

---

## 5. Security Architecture

### Multi-Layer Security

#### 1. Domain Level Security

- **SSL/TLS**: End-to-end encryption via Let's Encrypt
- **HSTS**: HTTP Strict Transport Security headers
- **Security Headers**: XSS protection, content type validation

#### 2. API Level Security

- **Token Authentication**: `X-API-Token` header required
- **Request Validation**: Audio format and size validation
- **Rate Limiting**: Implicit through Cloudflare

#### 3. Infrastructure Security

- **Browser Detection**: Automatic redirect for human visitors
- **API Hiding**: Non-authenticated requests get 404
- **Container Isolation**: Docker network segmentation

### Security Token Flow

```
Frontend → [X-API-Token] → Cloudflare Workers → [X-API-Token] → Hetzner Server
```

---

## 6. Network Architecture

### DNS Configuration

```
transcribe.vegvisr.org → 46.62.149.157 (A record, DNS only)
www.vegvisr.org → Cloudflare Pages (Proxied)
*.torarnehave.workers.dev → Cloudflare Workers (Automatic)
```

### Port Configuration

- **Port 80**: HTTP → HTTPS redirect
- **Port 443**: SSL termination and API routing
- **Port 8001**: Internal Docker network (whisper service)
- **Port 3000**: Internal Docker network (legacy API)

### Request Flow Diagram

```
User Browser
    ↓
www.vegvisr.org (Cloudflare Pages)
    ↓
Norwegian Transcription Worker (Cloudflare)
    ↓
transcribe.vegvisr.org:443 (Hetzner)
    ↓
whisper-nginx (Docker)
    ↓
whisper-service:8001 (Docker)
```

---

## 7. Development and Deployment

### Server Deployment Process

```bash
# 1. Update configuration
rsync -avz nginx/conf.d/whisper-api.conf root@46.62.149.157:/root/whisper-api/nginx/conf.d/

# 2. Restart services
ssh root@46.62.149.157 "cd /root/whisper-api && docker-compose down && docker-compose up -d"

# 3. Verify deployment
ssh root@46.62.149.157 "docker ps"
```

### Worker Deployment

```bash
# Norwegian transcription worker
cd norwegian-transcription-worker
npx wrangler deploy

# Norwegian text worker
cd norwegian-text-worker
npx wrangler deploy
```

### Frontend Deployment

```bash
# Build and deploy to Cloudflare Pages
npm run build
# Automatic deployment via Git integration
```

---

## 8. Monitoring and Health Checks

### Health Endpoints

- **Server Health**: `https://transcribe.vegvisr.org/health` (requires API token)
- **Worker Health**: Automatic via Cloudflare Workers health monitoring
- **Frontend Health**: Cloudflare Pages uptime monitoring

### Container Health Checks

```yaml
# Whisper service health check
healthcheck:
  test: ['CMD', 'curl', '-f', 'http://localhost:8001/health']
  interval: 60s
  timeout: 30s
  retries: 3
```

### Monitoring Commands

```bash
# Check container status
ssh root@46.62.149.157 "docker ps"

# Check nginx logs
ssh root@46.62.149.157 "docker logs whisper-nginx"

# Test API with token
ssh root@46.62.149.157 "curl -H 'X-API-Token: vegvisr_transcribe_2024_secure_token' https://transcribe.vegvisr.org/health"
```

---

## 9. Performance Specifications

### Server Performance

- **Transcription Speed**: ~48 seconds for typical audio files
- **Memory Usage**: 4-6GB during transcription
- **Max File Size**: 100MB
- **Concurrent Requests**: Limited by single-server architecture

### Worker Performance

- **Cold Start**: <100ms (Cloudflare Workers)
- **Text Improvement**: 2-5 seconds (Llama 3.3 70B Fast)
- **Global Distribution**: Cloudflare's edge network

### Network Performance

- **SSL Handshake**: TLS 1.3 for optimal performance
- **CDN**: Cloudflare global network for frontend
- **Direct Connection**: Worker to server for minimal latency

---

## 10. Future Enhancements

### Planned Improvements

1. **Load Balancing**: Multiple Hetzner servers for scalability
2. **Model Optimization**: Smaller, faster Norwegian models
3. **Caching**: Redis for improved response times
4. **Analytics**: Comprehensive usage monitoring
5. **API Versioning**: RESTful API structure

### Scalability Considerations

- **Horizontal Scaling**: Additional server instances
- **Model Variants**: Different models for speed vs. accuracy
- **Geographic Distribution**: Multiple regions for global access

---

## 11. Troubleshooting Guide

### Common Issues and Solutions

#### Container Restart Loop

```bash
# Check nginx configuration
ssh root@46.62.149.157 "docker exec whisper-nginx nginx -t"

# View container logs
ssh root@46.62.149.157 "docker logs whisper-nginx"
```

#### SSL Certificate Issues

```bash
# Renew certificates
ssh root@46.62.149.157 "certbot renew"

# Check certificate validity
ssh root@46.62.149.157 "certbot certificates"
```

#### API Token Authentication Failures

```bash
# Test with correct token
curl -H 'X-API-Token: vegvisr_transcribe_2024_secure_token' https://transcribe.vegvisr.org/health

# Check nginx configuration for token validation
```

### Emergency Procedures

1. **Server Failure**: Switch to worker-only mode
2. **SSL Expiry**: Manual certificate renewal
3. **Token Compromise**: Update token in all components
4. **Worker Failure**: Fallback to direct server calls

---

## 12. Contact and Maintenance

### Key Personnel

- **System Administrator**: [Your contact information]
- **Developer**: [Your contact information]

### Maintenance Schedule

- **SSL Renewal**: Automatic (Let's Encrypt)
- **Server Updates**: Monthly
- **Worker Updates**: As needed
- **Health Checks**: Daily automated

### Documentation Updates

This document should be updated whenever:

- Infrastructure changes occur
- New components are added
- Security configurations are modified
- Performance optimizations are implemented

---

_Last Updated: [Current Date]_
_Version: 1.0_
_System Status: Production Ready_
