# Vegvisr Frontend Architecture Overview

_This document will be updated with detailed architectural information as we proceed._

## Introduction

Vegvisr.org is a web application designed to empower users with advanced tools for knowledge management, visualization, and integration with external services. The platform provides a personalized dashboard experience, allowing users to manage their profiles, customize settings, and interact with various data sources. Vegvisr.org aims to facilitate the creation, editing, and exploration of knowledge graphs, enabling users to organize information, collaborate, and gain insights through intuitive visual interfaces. Key features include the interactive Graph Viewer for exploring and exporting graphs, the Graph Portfolio for browsing and managing collections of knowledge graphs, a robust API Worker that powers AI, search, file upload, and integration features, a dedicated Dev Worker for advanced knowledge graph operations and versioning, a Main Worker that handles core application logic, user data, and profile image uploads, a GitHub Issues View for tracking and managing project roadmap and feature requests, and advanced Custom Domain Management capabilities for branded deployments. The application emphasizes user experience, flexibility, and extensibility, making it suitable for a wide range of use cases from personal knowledge management to collaborative research and education.

## Purpose of This Document

This document is intended to give developers a high-level overview of the main components and structure of the Vegvisr.org frontend system. It serves as a starting point for understanding how the application is organized, how data flows, and where to find key features and integrations.

## Custom Domain Management System

Vegvisr.org features a sophisticated **Custom Domain Registration and Management System** that enables users to create personalized branded subdomains across multiple root domains. This system represents a major advancement in platform flexibility and white-label capabilities.

### Core Domain Management Features

#### 🌐 **Multi-Domain Support**

- **Supported Root Domains**: vegvisr.org, norsegong.com, xyzvibe.com, slowyou.training, movemetime.com
- **Automatic Zone ID Resolution**: Intelligent mapping of domains to Cloudflare Zone IDs
- **Dynamic DNS Management**: Automated CNAME record creation with Cloudflare API integration
- **Worker Route Configuration**: Automatic routing setup for brand-worker integration

#### 🔒 **Advanced Security Framework**

- **Protected Subdomain System**: Critical infrastructure subdomains (api, www, admin, mail, blog, knowledge, auth, brand, dash, dev, test, staging, cdn, static) are protected from user registration
- **Security Validation**: Real-time verification of subdomain availability and protection status
- **Cross-Domain Protection**: Consistent security policies across all supported root domains
- **Access Control**: Role-based domain management with comprehensive error handling

#### ⚡ **Automated Deployment Pipeline**

- **DNS Record Creation**: Automatic CNAME record setup pointing to brand-worker infrastructure
- **Cloudflare Integration**: Direct API integration for DNS management and worker route configuration
- **Real-time Validation**: Comprehensive validation and error reporting for all domain operations
- **Rollback Capability**: Support for domain deletion and cleanup operations

### Technical Architecture

#### **API Endpoints**

- **POST /create-custom-domain**: Create new custom subdomain with DNS and worker routing
- **POST /delete-custom-domain**: Remove custom domain with complete cleanup
- **Domain Validation**: Real-time subdomain availability checking and security validation

#### **Integration Components**

- **Cloudflare API Integration**: Direct DNS record management via Cloudflare API
- **Brand Worker Routing**: Automatic routing configuration to brand-worker.torarnehave.workers.dev
- **Security Middleware**: Protected subdomain validation and access control
- **KV Store Management**: Domain configuration storage and retrieval

### Domain Configuration

#### **Supported Domains and Zone IDs**

```javascript
const DOMAIN_ZONE_MAPPING = {
  'norsegong.com': 'ZONE_ID_NORSEGONG',
  'xyzvibe.com': 'ZONE_ID_XYZVIBE',
  'vegvisr.org': 'ZONE_ID_VEGVISR',
  'slowyou.training': 'ZONE_ID_SLOWYOU',
  'movemetime.com': 'ZONE_ID_MOVEMETIME',
}
```

#### **Protected Infrastructure Subdomains**

Critical subdomains protected from user registration across all domains:

- `api` - API Worker infrastructure
- `www` - Main website
- `admin` - Administrative interface
- `mail` - Email services
- `blog` - Blog subdomain
- `knowledge` - Knowledge worker
- `auth` - Authentication worker
- `brand` - Brand worker
- `dash` - Dashboard worker
- `dev` - Development environment
- `test` - Testing environment
- `staging` - Staging environment
- `cdn` - Content delivery network
- `static` - Static asset hosting

## Google Photos Integration System

Vegvisr.org now includes comprehensive **Google Photos OAuth Integration** enabling users to seamlessly access and embed their personal photo collections directly within knowledge graphs and content creation workflows.

### Core Google Photos Features

#### 🔐 **OAuth 2.0 Authentication Flow**

- **Secure Authorization**: Complete OAuth 2.0 implementation with PKCE support
- **Callback Handling**: Dedicated OAuth callback interface with user-friendly status updates
- **Token Management**: Secure access token handling and refresh capabilities
- **Cross-Origin Support**: Full CORS support for frontend integration

#### 📷 **Photo Library Access**

- **Recent Photos**: Access to user's most recent Google Photos
- **Advanced Search**: Content-based photo search with filtering capabilities
- **High-Quality Access**: Direct access to full-resolution images via Google Photos API
- **Metadata Retrieval**: Complete photo metadata including creation dates, geolocation, and EXIF data

#### 🖼️ **Content Integration**

- **Direct Embedding**: Seamless photo embedding in knowledge graphs and blog posts
- **Responsive Display**: Automatic image sizing and responsive display optimization
- **Batch Operations**: Support for multiple photo selection and embedding
- **Format Compatibility**: Support for all major image formats supported by Google Photos

### Technical Implementation

#### **OAuth Flow Components**

- **Authorization Endpoint**: `/auth/google/callback.html` - Interactive OAuth callback handler
- **Authentication API**: `/google-photos-auth` - Token exchange and validation
- **Search API**: `/google-photos-search` - Content-based photo search
- **Recent Photos API**: `/google-photos-recent` - Latest photos retrieval

#### **Security Features**

- **Secure Token Storage**: Encrypted token handling with environment variable protection
- **CORS Compliance**: Comprehensive cross-origin resource sharing support
- **Error Handling**: Robust error handling with user-friendly feedback
- **Session Management**: Secure session handling and token lifecycle management

## YouTube Integration System

Vegvisr.org includes advanced **YouTube Search and Integration** capabilities enabling users to discover, analyze, and embed video content directly within their knowledge graphs and content workflows.

### Core YouTube Features

#### 🔍 **Advanced Video Search**

- **YouTube Data API v3**: Direct integration with YouTube's official API
- **Comprehensive Metadata**: Full video metadata including titles, descriptions, thumbnails, and channel information
- **Search Optimization**: Advanced search parameters with result filtering and sorting
- **Batch Processing**: Support for multiple video results with efficient API usage

#### 📺 **Content Analysis**

- **Full Description Access**: Complete video descriptions for content analysis
- **Channel Integration**: Channel information and creator details
- **Publication Metadata**: Video publication dates and engagement metrics
- **Thumbnail Management**: Multiple thumbnail size support for various display contexts

#### 🎯 **Knowledge Graph Integration**

- **Video Node Creation**: Automatic creation of YouTube nodes in knowledge graphs
- **Content Summarization**: AI-powered video content analysis and summarization
- **Educational Workflows**: Optimized for educational and research content discovery
- **Contextual Embedding**: Smart video embedding based on content relevance

### API Endpoints

- **GET /youtube-search**: Video search with query parameters and filtering
- **Video Analysis**: Content extraction and metadata processing
- **Integration Tools**: Direct embedding and knowledge graph node creation

## Enhanced AI Image Generation System

Vegvisr.org features a sophisticated **Multi-Model AI Image Generation System** supporting multiple AI providers and advanced image creation workflows with approval-based deployment.

### Core AI Image Features

#### 🤖 **Multi-Model Support**

- **DALL-E 2**: Standard quality image generation with 256x256, 512x512, 1024x1024 sizes
- **DALL-E 3**: High-definition image generation with 1024x1024, 1024x1792, 1792x1024 sizes and HD quality
- **GPT-Image-1**: Advanced image generation with auto, high, medium, low quality settings and flexible sizing
- **Quality Control**: Model-specific quality parameter validation and optimization

#### 🎨 **Advanced Generation Pipeline**

- **Preview System**: Non-destructive image preview before final deployment
- **Approval Workflow**: User approval required before saving images to R2 storage
- **Context-Aware Prompts**: AI-enhanced prompt generation based on content context
- **Image Type Classification**: Specialized handling for header, leftside, rightside, and general images

#### 📤 **Professional Deployment**

- **R2 Storage Integration**: Automatic upload to Cloudflare R2 with optimized file naming
- **Imgix Integration**: Professional image delivery via vegvisr.imgix.net CDN
- **Markdown Generation**: Automatic markdown creation with proper sizing and positioning
- **Metadata Tracking**: Complete generation metadata including model, quality, and prompt tracking

### API Endpoints

#### **Image Generation Pipeline**

- **POST /gpt4-vision-image**: Multi-model image generation with preview support
- **POST /save-approved-image**: Final image deployment after user approval
- **POST /generate-header-image**: Specialized header image creation with DALL-E 3
- **POST /generate-image-prompt**: AI-powered prompt enhancement and optimization
- **GET /list-r2-images**: R2 storage image inventory and management

## Norwegian Audio Transcription System

Vegvisr.org features a specialized **Norwegian Audio Transcription Worker** that provides high-quality audio-to-text transcription specifically optimized for Norwegian language content, with automatic audio format detection and text improvement capabilities.

### Core Transcription Features

#### 🎙️ **Advanced Audio Processing**

- **Multi-Format Support**: Automatic detection and processing of WAV, MP3, M4A, FLAC, and WebM audio formats
- **Audio Format Detection**: Intelligent header analysis to detect actual audio format regardless of file extension
- **R2 Storage Integration**: Secure audio file storage using Cloudflare R2 with metadata preservation
- **Quality Optimization**: Audio preprocessing and format correction for optimal transcription accuracy

#### 🇳🇴 **Norwegian Language Specialization**

- **Norwegian Whisper Models**: Dedicated Norwegian Whisper models (nb-whisper-small) for superior accuracy
- **Cultural Context Preservation**: Norwegian-specific language processing maintaining cultural nuances
- **Text Improvement Integration**: Post-transcription text enhancement using Norwegian text improvement worker
- **Contextual Processing**: Support for context-aware transcription with background information

#### ⚡ **Dual Processing Pipeline**

- **Primary Transcription**: High-performance transcription via Hetzner-hosted Norwegian Whisper service
- **Text Enhancement**: Secondary processing using Cloudflare Workers AI (Llama 3.3 70B Fast) for text improvement
- **Combined Output**: Both raw and improved transcription text provided in response
- **Fallback Handling**: Graceful degradation if text improvement is unavailable

### Technical Implementation

#### **Norwegian Transcription Worker Endpoints**

- **POST /**: Main transcription endpoint accepting direct audio file uploads
- **POST /upload**: Audio file upload to R2 storage with format validation
- **POST /transcribe-from-url**: Transcription from pre-uploaded R2 audio URLs
- **GET /health**: Service health check with feature enumeration

#### **Audio Processing Pipeline**

- **Format Detection**: Binary header analysis for accurate format identification
- **Content Validation**: MIME type and file extension validation for security
- **R2 Storage**: Secure cloud storage with custom metadata and content type preservation
- **Service Integration**: Direct integration with Hetzner Norwegian transcription service

#### **Quality & Performance Features**

- **Error Handling**: Comprehensive error reporting with detailed debugging information
- **Processing Metrics**: Response time tracking for both transcription and improvement phases
- **Service Binding**: Efficient worker-to-worker communication for text improvement
- **Metadata Preservation**: Complete audio file metadata tracking throughout pipeline

### Integration Architecture

#### **External Service Integration**

- **Hetzner Transcription Service**: Primary Norwegian Whisper service at `https://transcribe.vegvisr.org/transcribe`
- **API Token Authentication**: Secure API token-based authentication with external service
- **Norwegian Text Worker**: Service binding integration for post-transcription text improvement
- **Cloudflare R2**: Audio file storage with domain-consistent URL structure (`audio.vegvisr.org`)

#### **Response Format**

```json
{
  "success": true,
  "transcription": {
    "raw_text": "Original transcription from Whisper",
    "improved_text": "Enhanced text from AI improvement",
    "language": "no",
    "processing_time": 2340,
    "improvement_time": 890
  },
  "metadata": {
    "model": "nb-whisper-small",
    "transcription_server": "Hetzner",
    "text_improvement": "Cloudflare Workers AI - Llama 3.3 70B Fast"
  }
}
```

## Transcript Processing System

Vegvisr.org includes an advanced **AI-Powered Transcript Processing System** that transforms existing audio/video transcripts into comprehensive Norwegian knowledge graphs using sophisticated language processing and content structuring.

### Core Transcript Features

#### 🗣️ **Multi-Language Processing**

- **Auto-Language Detection**: Intelligent source language identification
- **Norwegian Translation**: High-quality translation to Norwegian with cultural context preservation
- **Content Scaling**: Adaptive processing for both short and long-form transcripts
- **Contextual Translation**: Nuanced translation maintaining technical accuracy and cultural relevance

#### 🧠 **AI-Powered Structuring**

- **Grok-3-Beta Integration**: Advanced AI model for content analysis and structuring
- **Thematic Segmentation**: Intelligent content division into logical thematic sections
- **Comprehensive Processing**: 6-15 detailed nodes for thorough content coverage
- **Rich Formatting**: Full markdown formatting with headers, lists, emphasis, and citations

#### 📚 **Knowledge Graph Generation**

- **Structured Output**: Direct creation of Cytoscape-compatible knowledge graphs
- **Node Optimization**: Substantial content nodes (150-800 words) with detailed explanations
- **Metadata Integration**: Complete node metadata with visibility, path, and formatting controls
- **Quality Assurance**: JSON validation and error handling for reliable output

### Technical Implementation

#### **Processing Pipeline**

- **POST /process-transcript**: Main transcript processing endpoint
- **Content Analysis**: AI-powered content theme identification and structuring
- **Translation Engine**: Context-aware Norwegian translation with cultural preservation
- **Graph Assembly**: Automated knowledge graph construction with full metadata

#### **Quality Features**

- **Error Handling**: Comprehensive error handling with detailed debugging information
- **Content Validation**: JSON structure validation and node integrity checking
- **Scalable Processing**: Adaptive token limits based on content length and complexity
- **Performance Optimization**: Efficient processing for both small and large transcripts

## AI-Powered Content Enhancement System

Vegvisr.org features a sophisticated **Enhanced PagesStyleTemplates System** that transforms plain text content into rich, visually appealing, professionally formatted knowledge graph nodes using artificial intelligence. This system represents a major advancement in automated content enhancement and visual design.

### Core AI Enhancement Features

#### 🤖 **Intelligent Content Formatting**

- **AI-Powered Templates**: Four specialized formatting templates (Complete Enhancer, Visual Content Formatter, Work Note Enhancer, Header Sections Basic) that automatically structure and enhance content
- **Grok AI Integration**: Uses XAI's Grok-3-beta model for intelligent content analysis and formatting decisions
- **Context-Aware Processing**: AI analyzes content themes and applies appropriate formatting patterns

#### 🖼️ **Real-Time Image Integration**

- **Pexels API Integration**: Automatically searches and integrates contextual, professional-quality images based on content analysis
- **Smart Image Placement**: AI determines optimal placement for header images, leftside images, and rightside images
- **Content-Driven Selection**: Images are selected based on AI analysis of the text content, ensuring visual relevance

#### 🎨 **Harmonious Color Theme System**

- **Six Professional Themes**: Curated color palettes including Sunset Gradient, Lavender Dream, Ocean Blue, Forest Green, Midnight Dark, and Coral Reef
- **AI Color Application**: Intelligent application of selected color themes to FANCY headers, SECTION blocks, and overall design elements
- **Visual Harmony**: Colors are coordinated across all formatting elements to create cohesive, professional designs

#### ⚡ **User Experience Enhancements**

- **Template Selector Modal**: Intuitive interface for choosing formatting templates and color themes
- **Quick Format Buttons**: One-click formatting options for common use cases (visual formatting, work notes)
- **Loading Overlays**: Professional loading animations with progress indicators during AI processing
- **Confirmation Dialogs**: User-friendly confirmations with detailed descriptions of template actions

### Technical Architecture

#### **Frontend Components**

- **TemplateSelector.vue**: Advanced modal for template and theme selection with responsive design
- **NodeControlBar.vue**: Enhanced control bar with formatting options integrated into the graph viewer
- **GraphViewer.vue**: Updated to support template formatting workflow and user interactions

#### **Backend Processing (api-worker)**

- **Template System**: Four pre-defined templates with specialized AI instructions for different content types
- **Color Theme Engine**: Dynamic color application system that injects theme-specific styling instructions
- **Pexels Integration**: Real-time image search and URL replacement system
- **AI Content Analysis**: Grok AI analyzes content to generate relevant image search keywords

#### **Processing Workflow**

1. **Content Analysis**: AI analyzes the original node content to understand themes and context
2. **Template Application**: Selected template's AI instructions are applied to structure the content
3. **Color Integration**: Chosen color theme is intelligently applied to all formatting elements
4. **Image Enhancement**: Content-relevant images are searched and integrated via Pexels API
5. **Final Formatting**: Complete, professionally formatted content is returned to the user

### API Endpoints

#### **Style Template Management**

- `GET /style-templates`: Retrieve available formatting templates filtered by node type
- `POST /apply-style-template`: Apply AI-powered formatting with color themes and image integration
- `POST /pexels-search`: Search for contextual images based on content analysis

#### **Enhanced Features**

- **Graceful Fallback**: System works without Pexels API key (uses placeholder images)
- **Performance Optimization**: Efficient image processing and caching
- **Error Handling**: Comprehensive error handling with user-friendly messages

### Impact and Benefits

#### **For Content Creators**

- **Professional Quality**: Transform simple text into visually stunning, professionally formatted content
- **Time Efficiency**: Automated formatting eliminates manual design work
- **Consistency**: Ensures harmonious color schemes and professional layout standards
- **Accessibility**: Easy-to-use interface makes advanced formatting available to all users

#### **For Platform Quality**

- **Visual Excellence**: Dramatically improves the visual quality of knowledge graphs
- **Brand Consistency**: Professional color themes maintain platform aesthetic standards
- **Content Engagement**: Rich, visual content increases user engagement and comprehension
- **Scalability**: AI-powered system scales formatting capabilities across all content

This AI enhancement system positions Vegvisr.org as a leader in intelligent content transformation, providing users with enterprise-quality formatting capabilities through an intuitive, AI-powered interface.

#### **Development & Versioning**

The AI enhancement system follows a structured rollback versioning approach for tracking implementation phases:

- **Rollback ID: 2024-12-19-006** - Pexels API Integration Enhancement
- **Rollback ID: 2024-12-19-007** - Color Theme System Implementation
- **Rollback ID: 2024-12-19-008** - Layout Optimization for Color Theme Selector

This versioning system ensures reliable deployment and easy rollback capabilities for all AI enhancement features.

## Document Update System

Vegvisr.org features an advanced **Document Update System** that enables users to intelligently update existing knowledge graphs by pasting new markdown documents. This system preserves existing node formatting, maintains non-document content, and creates new versions for comparison while preventing data loss.

### Core Document Update Features

#### 📄 **Intelligent Document Analysis**

- **Smart Markdown Parsing**: Analyzes documents using major headers (# and ##) as section boundaries, filtering meaningful content over 200 characters
- **Content Matching Algorithm**: Uses similarity scoring to match existing nodes with new document sections based on title similarity, content overlap, and content type analysis
- **Format Detection**: Identifies different content types (architecture, bibliography, technical documentation) to prevent incorrect matching
- **Section Optimization**: Creates 6-16 meaningful sections from documents rather than fragmenting into dozens of tiny pieces

#### 🛡️ **Comprehensive Node Preservation**

- **Formatting Preservation**: Maintains SECTION blocks, FANCY blocks, QUOTE blocks, header images, side images, and custom HTML elements
- **Non-Text Node Protection**: Automatically preserves portfolio images, charts, maps, and other non-textual content
- **Bibliography Content Handling**: Special handling for bibliographic references and citation content with heavy penalties to prevent incorrect matching
- **Metadata Preservation**: Maintains all node properties including `bibl` arrays, image dimensions, visibility settings, colors, and node types

#### 🔄 **Version Management Integration**

- **Fresh Data Fetching**: Always fetches latest graph data from API to ensure current metadata is preserved
- **History Creation**: Creates new versions using `saveGraphWithHistory` endpoint to maintain consistency between `knowledge_graphs` and `knowledge_graph_history` tables
- **Metadata Synchronization**: Ensures portfolio metadata updates are properly preserved in document updates
- **Rollback Support**: Maintains complete version history for easy rollback if updates don't meet expectations

#### ⚡ **User Experience Design**

- **Three-Step Process**: Input → Analysis → Processing with clear progress indicators
- **Real-Time Analysis**: Shows matching confidence scores, preserved nodes, and new sections before applying changes
- **Comprehensive Debugging**: Detailed console logging for troubleshooting and transparency
- **Error Recovery**: Graceful error handling with specific user-friendly messages for different failure scenarios

### Technical Architecture

#### **Frontend Component (DocumentUpdateModal.vue)**

- **Modal Interface**: Overlay modal integrated into GraphAdmin view with step-by-step workflow
- **Analysis Engine**: Client-side content parsing and matching algorithms with intelligent scoring
- **Preview System**: Shows users exactly what will be updated, preserved, and added before applying changes
- **Progress Tracking**: Visual indicators and status messages throughout the update process

#### **Intelligent Matching Algorithm**

```javascript
// Enhanced scoring system for content matching
const calculateMatchScore = (existingNode, newSection) => {
  let score = 0

  // Architecture content detection
  if (isArchitectureContent(node.info) && isArchitectureContent(section.content)) {
    score += 0.4
  }

  // Title similarity with exact match boost
  const titleSim = calculateSimilarity(node.label, section.title)
  if (titleSim > 0.9) score += 0.4
  else if (titleSim > 0.5) score += titleSim * 0.3

  // Content similarity with formatting consideration
  const contentSim = calculateContentSimilarity(node.info, section.content)
  score += contentSim * 0.3

  // Strong penalties for different content types
  if (isDifferentContentType(node.info, section.content)) score -= 0.5
  if (isBibliographyContent(node.info)) score -= 0.3

  return score
}
```

#### **Formatting Preservation System**

- **Element Extraction**: Identifies and extracts header images, SECTION blocks, QUOTE blocks, side images, and custom HTML
- **Intelligent Placement**: Rebuilds content with preserved elements in appropriate locations
- **Structure Analysis**: Analyzes existing formatting patterns to maintain visual consistency
- **Property Preservation**: Maintains all node properties including bibliographic references and metadata

### Processing Workflow

1. **Document Input**: User pastes new markdown document into the modal interface
2. **Fresh Data Fetch**: System fetches latest graph data from API to ensure current metadata
3. **Intelligent Parsing**: Document is parsed into meaningful sections using smart header detection
4. **Content Matching**: Existing nodes are matched against new sections using multi-factor scoring
5. **Preservation Analysis**: Non-matching nodes and non-text nodes are identified for preservation
6. **User Review**: Analysis results are presented with match confidence scores and preservation details
7. **Format-Aware Updates**: Matched nodes are updated while preserving all formatting and metadata
8. **Version Creation**: New version is saved to history with preserved metadata and fresh timestamp

### API Integration

#### **Knowledge Graph Operations**

- **GET /getknowgraph**: Fetches fresh graph data to ensure latest metadata is used
- **POST /saveGraphWithHistory**: Creates new versions while maintaining table synchronization
- **Metadata Preservation**: Ensures portfolio updates are reflected in document updates
- **Error Handling**: Comprehensive error responses with specific guidance for different failure types

#### **Quality Assurance Features**

- **Version Mismatch Prevention**: Always fetches latest version before applying updates
- **Table Synchronization**: Uses proper endpoints to maintain consistency between database tables
- **Comprehensive Logging**: Detailed debugging information for troubleshooting and transparency
- **Graceful Degradation**: Handles API failures and network issues with user-friendly error messages

### Development History

The Document Update System was developed through an iterative process with structured rollback versioning:

- **Rollback ID: 2025-01-20-001** - Initial DocumentUpdateModal implementation with core parsing and matching
- **Rollback ID: 2025-01-20-002** - GraphPortfolio metadata synchronization fix using saveGraphWithHistory
- **Rollback ID: 2025-01-20-003** - Enhanced success handling with flexible version extraction
- **Rollback ID: 2025-01-20-004** - Removed alert messages for cleaner user experience
- **Rollback ID: 2025-01-20-005** - Fixed bibliographic reference preservation in node formatting
- **Rollback ID: 2025-01-20-006** - Enhanced bibliography content detection with stronger preservation penalties
- **Rollback ID: 2025-01-20-007** - Added comprehensive metadata preservation debugging and validation

### Impact and Benefits

#### **For Content Creators**

- **Efficient Updates**: Update large documents without losing existing formatting and metadata
- **Safe Iteration**: Preview changes before applying them with complete rollback capability
- **Format Preservation**: Maintain professional styling and visual elements across updates
- **Content Protection**: Automatic preservation of non-document content like images and charts

#### **For Platform Quality**

- **Data Integrity**: Prevents accidental loss of formatted content and metadata
- **Version Control**: Complete history tracking for all document updates
- **Metadata Consistency**: Ensures portfolio changes are properly reflected in updates
- **User Confidence**: Transparent process with detailed analysis and preview capabilities

This Document Update System represents a significant advancement in knowledge graph management, providing users with powerful tools to iterate on their content while maintaining the integrity and quality of their existing work.

## Brand Worker Proxy System

Vegvisr.org includes a sophisticated **Brand Worker Proxy System** that enables seamless white-label deployments and intelligent request routing for custom domains. This system provides the infrastructure layer that powers the custom domain management capabilities.

### Core Proxy Features

#### 🌐 **Intelligent Request Routing**

- **Knowledge Graph Requests**: Automatically routes graph-related endpoints (`/getknowgraphs`, `/getknowgraph`, `/saveknowgraph`, `/updateknowgraph`, `/deleteknowgraph`, `/saveGraphWithHistory`) to the knowledge-graph-worker
- **API Requests**: Routes API endpoints (`/mystmkrasave`, `/generate-header-image`, `/grok-ask`, `/grok-elaborate`, `/apply-style-template`) to api.vegvisr.org
- **Frontend Requests**: Routes all other requests to the main frontend at www.vegvisr.org
- **Hostname Preservation**: Adds `x-original-hostname` header to maintain domain context throughout the request chain

#### 🔒 **Transparent Proxy Architecture**

- **Method Preservation**: Maintains original HTTP methods (GET, POST, PUT, DELETE) across proxy calls
- **Header Forwarding**: Forwards all original request headers while adding domain context
- **Body Streaming**: Streams request bodies efficiently for large payloads
- **Redirect Handling**: Follows redirects transparently while maintaining proxy context

#### 🛡️ **CORS and Response Management**

- **Automatic CORS Headers**: Adds `Access-Control-Allow-Origin: *` to all responses
- **JSON Response Handling**: Intelligent JSON parsing and re-serialization for API responses
- **Error Handling**: Comprehensive error handling with structured JSON error responses
- **Content Type Management**: Preserves original content types while ensuring CORS compliance

### Technical Implementation

#### **Routing Logic**

```javascript
// Knowledge Graph Routes
if (
  url.pathname.startsWith('/getknowgraphs') ||
  url.pathname.startsWith('/getknowgraph') ||
  url.pathname.startsWith('/saveknowgraph')
) {
  targetUrl = 'https://knowledge-graph-worker.torarnehave.workers.dev' + url.pathname + url.search
}
// API Routes
else if (
  url.pathname.startsWith('/mystmkrasave') ||
  url.pathname.startsWith('/generate-header-image')
) {
  targetUrl = 'https://api.vegvisr.org' + url.pathname + url.search
}
// Frontend Routes
else {
  targetUrl = 'https://www.vegvisr.org' + url.pathname + url.search
}
```

#### **Domain Context Preservation**

- **Original Hostname Header**: `x-original-hostname` header preserves the custom domain throughout the request chain
- **Search Parameter Forwarding**: Maintains all query parameters across proxy calls
- **Path Preservation**: Ensures exact path matching and forwarding

## Branding Management Interface

Vegvisr.org features a comprehensive **Branding Management Interface** implemented through the BrandingModal.vue component, providing users with an intuitive way to configure multiple custom domains with unique branding and content filtering.

### Core Branding Features

#### 🎨 **Multi-Domain Management**

- **Domain List View**: Centralized dashboard for viewing and managing all configured custom domains
- **Per-Domain Configuration**: Independent branding, logos, and content filtering for each domain
- **Domain Actions**: Edit, remove, and test functionality for each configured domain
- **Live Domain Links**: Direct links to visit and test configured domains

#### 🖼️ **Advanced Logo Management**

- **URL-Based Logos**: Support for external logo URLs with live preview
- **File Upload**: Direct logo upload to Cloudflare R2 storage with automatic URL generation
- **AI Logo Generation**: Integration with AI image generation for automated logo creation
- **Logo Validation**: Real-time logo URL validation and error handling
- **Responsive Preview**: Live preview showing how logos appear on the branded site

#### 🎯 **Content Filtering System**

- **Meta Area Filtering**: Filter content by specific knowledge graph meta areas
- **Autocomplete Selection**: Intelligent autocomplete for selecting available meta areas
- **Multiple Selections**: Support for multiple meta area filters per domain
- **System-Wide Meta Areas**: Access to all meta areas across the entire platform
- **Real-Time Updates**: Dynamic filtering based on current knowledge graph content

#### 🚀 **Deployment & Testing**

- **Live Domain Testing**: Real-time testing of domain DNS and worker route configuration
- **Automated Setup**: One-click domain creation with DNS records and worker routes
- **Worker Code Generation**: Automatic generation of custom worker code for manual deployment
- **Conflict Resolution**: Intelligent handling of existing DNS records and worker routes
- **Error Diagnostics**: Detailed error reporting and suggested solutions

### User Interface Components

#### **Domain List Management**

- **Visual Domain Cards**: Rich cards showing domain status, logo, and filter configuration
- **Quick Actions**: Edit and remove buttons with confirmation dialogs
- **Status Indicators**: Visual badges showing logo status and filter configuration
- **Empty State Handling**: Helpful guidance for users with no configured domains

#### **Domain Configuration Form**

- **Multi-Step Workflow**: Intuitive step-by-step domain configuration process
- **Real-Time Validation**: Live validation of domain names and logo URLs
- **Live Preview**: Browser mockup showing how the domain will appear
- **Deployment Instructions**: Clear guidance for DNS setup and testing

#### **Advanced Features**

- **Front Page Configuration**: Custom front page selection from user's knowledge graphs
- **Meta Area Management**: Visual selection and management of content filters
- **AI Integration**: Direct integration with AI logo generation modal
- **Responsive Design**: Mobile-friendly interface with adaptive layouts

### Technical Architecture

#### **API Integration**

- **Custom Domain API**: Integration with `/create-custom-domain` and `/delete-custom-domain` endpoints
- **KV Store Management**: Automatic saving and retrieval of domain configurations
- **User Profile Integration**: Syncing domain configurations with user profile data
- **Knowledge Graph API**: Fetching available meta areas and user graphs for filtering

#### **State Management**

- **Local State**: Component-level state for form data and UI interactions
- **Portfolio Store Integration**: Access to system-wide meta areas and user graphs
- **User Store Integration**: Integration with user authentication and profile data
- **Reactive Updates**: Real-time updates based on user actions and API responses

#### **Error Handling & UX**

- **Comprehensive Validation**: Multi-level validation for domains, logos, and configurations
- **Loading States**: Professional loading indicators during API operations
- **Error Recovery**: Intelligent error handling with suggested solutions
- **Confirmation Dialogs**: User-friendly confirmations for destructive actions

### Integration Benefits

#### **For Platform Users**

- **White-Label Capability**: Complete branding customization for professional deployments
- **Multi-Domain Support**: Manage multiple branded sites from a single interface
- **Content Curation**: Filter and customize content for specific audiences
- **Professional Appearance**: High-quality logos and consistent branding

#### **For Platform Administration**

- **Scalable Architecture**: Support for unlimited custom domains across multiple root domains
- **Automated Infrastructure**: DNS and worker route management without manual intervention
- **Security Controls**: Protected subdomain validation and access control
- **Monitoring Capabilities**: Comprehensive logging and error tracking

This branding system positions Vegvisr.org as a comprehensive white-label platform, enabling users to create professional, branded experiences while maintaining the powerful knowledge management capabilities of the core platform.

## Outline

- AI-Powered Content Enhancement System
- Document Update System
- Custom Domain Management System
- Google Photos Integration System
- YouTube Integration System
- Enhanced AI Image Generation System
- Transcript Processing System
- Brand Worker Proxy System
- Branding Management Interface
- Project Structure
- Main Components
- State Management
- Routing
- External Integrations
- Data Flow
- Build & Deployment

_Each section will be expanded with more details as the documentation progresses._

## Flow Diagram

### System Architecture Overview

```mermaid
graph TD
  A[User Browser] --> B[Vue.js Frontend (vegvisr-frontend)]
  B --> C[Graph Viewer Component]
  B --> D[Graph Portfolio Component]
  B --> E[Cloudflare Workers]
  E --> E1[main-worker]
  E --> E2[api-worker]
  E --> E3[dev-worker (knowledge-graph-worker)]
  E1 --> F1[Cloudflare KV]
  E1 --> F2[Cloudflare D1]
  E1 --> F3[Cloudflare R2 (profile-pictures)]
  E2 --> F1
  E2 --> F4[Cloudflare R2 (blog-pictures, klm-files)]
  E2 --> E3
  E3 --> F1
  E3 --> F2
  E2 --> G1[OpenAI]
  E2 --> G2[XAI/Grok]
  E2 --> G3[Pexels API]
  E2 --> G4[GitHub]
  E2 --> G5[Twilio]
  E2 --> G6[Google API]
  E2 --> G7[Mystmkra.io]
```

_This diagram provides a high-level overview of the system's main components, data flow, and integrations._

## Major Components and Their Purpose

### Vue.js Frontend (vegvisr-frontend)

The user interface of Vegvisr.org, built as a single-page application. It provides interactive dashboards, profile management, and visualization tools for users to interact with knowledge graphs and other features.

### Graph Viewer Component

A reusable Vue.js component responsible for rendering and displaying knowledge graphs. It supports various node types (images, markdown, background images, iframes, etc.), custom styles, and flexible layouts. The component is designed to be embedded in different parts of the application wherever graph visualization is needed.

**Enhanced with AI Formatting**: The Graph Viewer now includes integrated AI-powered content enhancement through the NodeControlBar component, enabling users to apply professional formatting templates, color themes, and contextual images directly within the graph interface.

### Graph Viewer View

A main user-facing page that leverages the Graph Viewer Component to provide a full-featured graph exploration and export experience. The view adds advanced features such as:

- Exporting graphs as PDF (multiple methods)
- Printing graphs
- Editing node content with a markdown editor
- Integrating with external services (e.g., Mystmkra.io)
- Role-based editing permissions
- Responsive and print-friendly layout

The Graph Viewer View orchestrates data fetching, user interactions, and advanced export/editing tools, making it the central place for users to interact with and share knowledge graphs in Vegvisr.org.

### Graph Portfolio Component

The Graph Portfolio allows users to browse, search, and manage collections of knowledge graphs. It provides multiple viewing modes (detailed, simple, table), supports filtering and sorting, and enables sharing and editing of graph metadata. This component enhances discoverability and organization of knowledge assets within the platform.

### API Worker (api-worker)

The API Worker is a Cloudflare Worker that powers the application's backend API endpoints. It handles AI-powered features (OpenAI, XAI, Grok), search, file uploads, blog and snippet management, integration with external services (GitHub, Twilio, Google, Mystmkra.io), and knowledge graph operations. It acts as a central hub for business logic, data processing, and secure communication between the frontend, storage, and third-party APIs.

### Cloudflare Workers

A serverless API layer that handles requests from the frontend, processes business logic, and routes data between the frontend, databases, storage, and external services.

- **main-worker**: Handles core application logic, user data, and profile image uploads. Connects to Cloudflare KV, D1 database, and R2 storage for persistent data and files.
- **api-worker**: Manages API endpoints, integrates with external services (OpenAI, GitHub, Twilio, Google, Mystmkra.io), and coordinates with other workers and storage layers.
- **dev-worker (knowledge-graph-worker)**: Specialized for knowledge graph operations, using Cloudflare D1 and KV for graph data storage and retrieval.

### Cloudflare KV

A distributed key-value store used for fast, scalable storage of session data, configuration, and other non-relational data.

### Cloudflare D1

A serverless SQL database used for structured data, such as user accounts, knowledge graph metadata, and other relational information.

### Cloudflare R2

Object storage for files and images, such as user profile pictures and blog assets.

### External Integrations

- **OpenAI**: Provides AI-powered features including text generation, summarization, and multi-model image generation (DALL-E 2, DALL-E 3, GPT-Image-1).
- **XAI (Grok)**: Powers the Enhanced PagesStyleTemplates System with intelligent content formatting, transcript processing, and knowledge graph analysis.
- **Google Gemini**: Advanced AI integration for content generation and analysis with Gemini-2.0-flash model.
- **Pexels API**: Provides contextual, professional-quality images for AI-enhanced content formatting with real-time search capabilities.
- **YouTube Data API v3**: Comprehensive video search, metadata extraction, and content analysis for educational and research workflows.
- **Google Photos API**: OAuth 2.0 integration for photo library access, search, and embedding capabilities.
- **Cloudflare API**: Direct DNS management and worker route configuration for custom domain management.
- **GitHub**: Used for authentication, issue tracking, or integration with developer workflows.
- **Twilio**: Enables SMS and phone-based notifications or verifications.
- **Google API**: Used for various integrations, such as maps, authentication, and photo library access.
- **Mystmkra.io**: External service for markdown content proxying and user ID integration.

### Dev Worker (knowledge-graph-worker)

The Dev Worker is a specialized Cloudflare Worker focused on advanced knowledge graph operations. It manages the creation, updating, versioning, and retrieval of knowledge graphs, as well as the storage and management of graph templates and work notes. The Dev Worker ensures data integrity, supports collaborative editing, and provides endpoints for interacting with graph history and metadata. It is essential for enabling rich, versioned knowledge graph experiences within Vegvisr.org.

### Main Worker (main-worker)

The Main Worker is a Cloudflare Worker responsible for handling core application logic, user data, and profile image uploads. It connects to Cloudflare KV, D1 database, and R2 storage for persistent data and files, ensuring that user profiles, settings, and related assets are managed efficiently and securely. The Main Worker plays a crucial role in maintaining the integrity and performance of the Vegvisr.org application.

### GitHub Issues View

The GitHub Issues View is a Vue.js component that provides a user-friendly interface for viewing, sorting, and interacting with GitHub issues related to the Vegvisr.org project. It allows users to track the project roadmap, view issue details, and create new issues directly from the application. This component enhances collaboration and transparency by integrating GitHub issue tracking seamlessly into the Vegvisr.org platform.

### GitHub Issues Component

The GitHub Issues component is a reusable Vue.js component that fetches, displays, and sorts GitHub issues. It supports various sorting options (priority, date, issue number, title) and renders issue details using Markdown. This component is essential for maintaining an organized and accessible project roadmap within Vegvisr.org.

### Branding Modal Component

The Branding Modal is a comprehensive Vue.js component that provides a complete interface for managing custom domain branding and white-label deployments. It features:

- **Multi-Domain Management**: Centralized dashboard for viewing and managing all configured custom domains with visual domain cards and quick actions
- **Advanced Logo Management**: Support for URL-based logos, direct file upload to R2 storage, AI logo generation integration, and real-time logo validation with responsive preview
- **Content Filtering System**: Meta area filtering with autocomplete selection, multiple filter support, and dynamic content updates based on knowledge graph meta areas
- **Deployment & Testing**: Live domain testing, automated DNS and worker route setup, custom worker code generation, and comprehensive error diagnostics
- **Professional UI Components**: Multi-step configuration workflow, real-time validation, browser mockup previews, and mobile-friendly responsive design
- **Technical Integration**: Direct API integration with custom domain endpoints, KV store management, user profile synchronization, and comprehensive state management with loading states and error recovery

### Blog View

The Blog View is a main user-facing page that allows users to browse, search, and manage blog posts within Vegvisr.org. It features:

- A searchable list of blog posts with pagination
- Role-based controls for editing, publishing/drafting, and deleting posts
- Support for viewing both visible and hidden (draft) posts
- Integration with the backend for fetching, updating, and deleting blog content
- Responsive design for optimal experience on all devices

This view enhances content management and sharing within the platform, providing both end-users and administrators with intuitive tools for blog publishing and moderation.

### Editor View

The Editor View is a dedicated page for creating and editing markdown-based blog posts and content within Vegvisr.org. It features:

- A dual-mode interface for editing and previewing markdown content
- File/image upload support with automatic markdown image insertion
- Context menu for inserting reusable content snippets
- Role-based controls for saving, resetting, and managing post visibility
- Shareable links for published or draft content
- Embedded mode for integration in other parts of the application
- Integration with backend APIs for saving, updating, and managing blog content

This view provides a powerful and user-friendly environment for content creators and administrators to manage rich markdown content in the platform.

### User Registration View

The User Registration View provides a simple and secure interface for new users to register with Vegvisr.org. It features:

- Email-based registration with validation
- Success and error messaging for user feedback
- Detection of existing users and option to reset registration
- Embedded mode for integration in other contexts
- Integration with backend endpoints for registration, verification, and reset

This view ensures a smooth onboarding process and helps users complete registration securely and efficiently.

### Login View

The Login View allows users to authenticate and access their Vegvisr.org account. It features:

- Email-based login with verification
- Role retrieval and user state management
- Integration with backend endpoints for email verification and role fetching
- Redirects to registration if the user does not exist
- Responsive and accessible design

This view provides a secure and user-friendly entry point to the application, ensuring only verified users can access protected features.

### GraphAdmin View

The GraphAdmin view is the advanced graph editing interface in Vegvisr.org. It provides a comprehensive environment for creating, editing, validating, and managing knowledge graphs. Key features include:

- **Visual Graph Editor:** Interactive, drag-and-drop editor powered by Cytoscape.js for building and arranging nodes and edges.
- **Sidebar and Top Bar:** Tools for managing graph metadata, history, templates, and work notes.
- **JSON Editor:** Direct editing and validation of the graph's JSON structure, with search and highlighting.
- **Template System:** Apply, create, and manage reusable node and graph templates.
- **Version History:** View and restore previous versions of a graph, with keyboard navigation.
- **Role-based Access:** View-only and playground modes for restricted users, with full editing for authorized users.
- **Export and Integration:** Export graphs, integrate with external APIs, and manage advanced node types (e.g., AI, charts, maps).

The GraphAdmin view is essential for power users, admins, and advanced contributors who need full control over graph structure, content, and metadata.

### Router

Vegvisr.org uses Vue Router to manage navigation and page transitions throughout the single-page application. The router configuration includes:

- **Named Routes:** Each major view (Home, Blog, GraphAdmin, GraphViewer, Portfolio, Registration, Login, etc.) is mapped to a named route for easy navigation and programmatic access.
- **Dynamic and Fallback Routes:** Supports dynamic paths (e.g., `/graph-viewer?graphId=...`) and a catch-all route for 404 handling.
- **Authentication Guards:** Routes can require authentication via `meta.requiresAuth`. The router checks user state (via Pinia store) and redirects unauthenticated users to the login page.
- **Layout Selection:** Some routes (e.g., registration, editor, sound studio) dynamically select between embedded and default layouts based on query parameters.
- **Props Passing:** Query parameters (such as `graphId` or `theme`) are passed as props to views for flexible, context-aware rendering.

This routing system ensures a secure, flexible, and user-friendly navigation experience, supporting both public and authenticated workflows, as well as embedded and standalone modes.

_This chapter gives a high-level description of each major component and its role in the Vegvisr.org system._

## D1 Database Tables

The following tables are present in the Cloudflare D1 database (vegvisr_org):

- \_cf_KV
- book
- sqlite_sequence
- landingpages
- config
- nodes
- edges
- knowledge_graphs
- knowledge_graph_history
- graphTemplates
- graphWorkNotes

_These tables store various types of data for the Vegvisr.org application, including user configuration, knowledge graph data, templates, and work notes._

### Graph Node Templates

The following node templates are available in the Vegvisr.org system. Each template defines a reusable node structure for knowledge graphs, supporting a variety of content types and visualizations:

- **GrokTest**: An action test node that can trigger external API calls (e.g., Grok or AI services) and display the result. Useful for integrating dynamic Q&A or knowledge retrieval into a graph.

- **WorkNote**: A work note node for capturing research notes, observations, or ongoing thoughts. Typically styled with a distinct background and used for in-progress or collaborative annotations.

- **BubbleChart**: A bubble chart visualization node. Displays multi-dimensional data (e.g., IQ vs. income by country) using bubbles sized and colored by data attributes. Useful for comparative and statistical insights.

- **FullText**: A full-text content node supporting rich markdown, sections, and work notes. Ideal for detailed articles, biographies, or long-form explanations within a graph.

- **Image**: A node for displaying a single image, with customizable size and layout. Used for visual assets, headers, or illustrative content.

- **NotesNode**: A concise note or insight node, designed for short observations, key ideas, or contextual highlights. Supports bibliographic references for source attribution.

- **TitleNode**: A simple title node for labeling sections or providing graph titles. Used to organize and structure graph content.

- **InfoNode**: A text node for explanatory or contextual information, often with section formatting and references. Useful for background, definitions, or supporting details.

- **MultiLineChart**: A multi-series line chart node for visualizing trends over time or comparing multiple data series. Supports labeled axes and color coding.

- **LineChart**: A single-series line chart node for visualizing changes or trends in a single variable over time.

- **MapNode**: A map node for displaying geographic data, KML overlays, or highlighting locations relevant to the graph's topic. Useful for spatial context and exploration.

- **YouTube**: A node for embedding YouTube videos with a title and supporting information. Enables multimedia integration and video-based learning.

- **PortfolioImage**: A node for displaying portfolio images, typically used in graph portfolios or galleries to showcase visual work.

- **QuadrantChart**: A quadrant chart node for visualizing data across four quadrants (e.g., reach vs. engagement). Useful for strategic analysis and campaign planning.

- **FlowChart**: A node for embedding Mermaid-based flow diagrams, supporting visual representation of processes, system flows, or relationships.

### State Management Stores

Vegvisr.org uses Pinia for state management. The following main stores coordinate application state and data flow:

#### userStore

- **Purpose:** Manages user authentication, profile, and session state.
- **Main State:**
  - `email`, `role`, `user_id`, `emailVerificationToken`, `loggedIn`, `mystmkraUserId`
- **Features:**
  - Handles login/logout, registration, and persistent user data
  - Stores authentication tokens and user roles
  - Supports Mystmkra.io integration

#### blogStore

- **Purpose:** Manages blog post content, visibility, and sharing.
- **Main State:**
  - `currentBlogId`, `markdown`, `isVisible`, `shareableLink`, `blogPosts`
- **Features:**
  - Handles saving, fetching, and clearing blog posts
  - Manages post visibility and shareable links
  - Integrates with backend for CRUD operations

#### knowledgeGraphStore

- **Purpose:** Manages the state of knowledge graphs, including nodes, edges, metadata, and versioning.
- **Main State:**
  - `graphMetadata`, `nodes`, `edges`, `graphJson`, `currentGraphId`, `currentVersion`, `undoStack`, `redoStack`, `nodeCount`, `edgeCount`
- **Features:**
  - Handles graph updates, undo/redo, and JSON validation
  - Tracks current graph and version for editing and viewing
  - Supports node/edge visibility and metadata

#### portfolioStore

- **Purpose:** Manages the state and filtering of graph portfolios and meta areas.
- **Main State:**
  - `viewMode`, `searchQuery`, `sortBy`, `selectedMetaArea`, `allMetaAreas`, `metaAreaFrequencies`, `sortedMetaAreas`
- **Features:**
  - Supports portfolio browsing, searching, and sorting
  - Tracks and analyzes meta areas for filtering and statistics

These stores provide a modular and reactive foundation for managing user, content, and graph state across the Vegvisr.org application.

## API Overview

Vegvisr.org uses multiple Cloudflare Workers to provide a modular API for frontend and external integrations. Below is a high-level summary of the main API endpoints and their responsibilities, organized by worker:

### Main Worker (main-worker)

- **/sve2 [GET]**: Register a new user by email. Checks for existing users and calls an external registration API.
- **/resend-verification [POST]**: Resend the email verification link to a user.
- **/verify-email [GET]**: Verify a user's email using a token.
- **/check-email [GET]**: Check if a user exists and is verified.
- **/reset-registration [POST]**: Reset a user's registration, allowing them to re-register.
- **/set-jwt [GET]**: Generate a JWT token for a user based on their email verification token.
- **/userdata [GET/PUT]**: Retrieve or update user profile data, including bio, settings, and profile image.
- **/github/issues [GET]**: Fetch GitHub issues for project tracking.
- **/github/create-issue [POST]**: Create a new GitHub issue from the app.

### API Worker (api-worker)

#### **Blog & Content Management**

- **/save [POST]**: Save a blog post (markdown content, visibility, email).
- **/view/:id [GET]**: View a blog post by ID (HTML or raw markdown).
- **/blog-posts [GET]**: List all visible blog posts.
- **/hidden-blog-posts [GET]**: List all hidden (draft) blog posts.
- **/blogpostdelete/:id [DELETE]**: Delete a blog post by ID.
- **/search [GET]**: Search blog posts by query.
- **/hid_vis [POST]**: Toggle blog post visibility (publish/draft).

#### **Snippet Management**

- **/snippetadd [POST]**: Add a reusable content snippet.
- **/snippets/:id [GET]**: Retrieve a snippet by ID.
- **/snippetdelete/:id [DELETE]**: Delete a snippet by ID.
- **/snippetlist [GET]**: List all snippet keys.

#### **File & Image Management**

- **/upload [POST]**: Upload an image or file to Cloudflare R2.
- **/getimage [GET]**: Retrieve an image from R2 by name.
- **/getcorsimage [GET]**: Retrieve a CORS-enabled image from R2.
- **/getcorsimage [HEAD]**: Get CORS image headers from R2.
- **/list-r2-images [GET]**: List all images stored in R2 bucket.

#### **Custom Domain Management**

- **/create-custom-domain [POST]**: Create new custom subdomain with DNS and worker routing across multiple root domains.
- **/delete-custom-domain [POST]**: Remove custom domain with complete DNS and worker route cleanup.

#### **AI-Powered Content Enhancement**

- **/summarize [POST]**: Summarize text using OpenAI.
- **/groktest [POST]**: Run a Grok AI test and return a fulltext node.
- **/gemini-test [POST]**: Test Google Gemini AI integration for content generation.
- **/aiaction [POST]**: Flexible AI action endpoint for various providers (OpenAI, XAI, Google).
- **/style-templates [GET]**: Retrieve available AI formatting templates filtered by node type.
- **/apply-style-template [POST]**: Apply AI-powered content formatting with color themes and contextual image integration.
- **/pexels-search [POST]**: Search for contextual images using Pexels API based on content analysis.

#### **Knowledge Graph AI Features**

- **/createknowledgegraph [GET]**: Generate a knowledge graph using AI based on a subject.
- **/ai-generate-node [POST]**: Generate knowledge graph nodes using AI with context awareness.
- **/process-transcript [POST]**: Process audio/video transcripts into structured Norwegian knowledge graphs.
- **/suggest-title [POST]**: AI-powered graph title suggestions based on content analysis.
- **/suggest-description [POST]**: AI-powered graph description generation.
- **/suggest-categories [POST]**: AI-powered graph category suggestions.
- **/generate-meta-areas [POST]**: Generate meta areas for knowledge graph classification.

#### **AI Image Generation**

- **/generate-header-image [POST]**: Generate header images using DALL-E based on content context.
- **/generate-image-prompt [POST]**: Generate AI image prompts from content analysis.
- **/gpt4-vision-image [POST]**: Multi-model image generation with DALL-E 2, DALL-E 3, and GPT-Image-1 support.
- **/save-approved-image [POST]**: Deploy approved AI-generated images to R2 storage with professional CDN integration.

#### **Advanced AI Tools**

- **/grok-ask [POST]**: AI-powered Q&A functionality using Grok for content-based queries.
- **/grok-issue-description [POST]**: AI-powered GitHub issue description enhancement and generation.

#### **YouTube Integration**

- **/youtube-search [GET]**: Search YouTube videos with comprehensive metadata and content analysis.

#### **Google Photos Integration**

- **/auth/google/callback.html [GET]**: OAuth 2.0 callback handler for Google Photos authentication.
- **/google-photos-auth [POST]**: Exchange authorization code for Google Photos access token.
- **/google-photos-search [POST]**: Search user's Google Photos library with content filtering.
- **/google-photos-recent [POST]**: Retrieve user's most recent Google Photos.

#### **External Integrations**

- **/mystmkrasave [POST]**: Proxy to Mystmkra.io for saving markdown content.
- **/getGoogleApiKey [GET]**: Secure retrieval of Google API key for authenticated integrations.
- **/updatekml [POST]**: Update KML files for geographic data and mapping features.

### Dev Worker (knowledge-graph-worker)

- **/saveknowgraph [POST]**: Save a knowledge graph (nodes, edges, metadata).
- **/updateknowgraph [POST]**: Update an existing knowledge graph.
- **/getknowgraphs [GET]**: List all knowledge graphs (IDs and titles).
- **/getknowgraph [GET]**: Retrieve a specific knowledge graph by ID.
- **/saveGraphWithHistory [POST]**: Save a graph and its version history.
- **/getknowgraphhistory [GET]**: List version history for a graph.
- **/getknowgraphversion [GET]**: Retrieve a specific version of a graph.
- **/addTemplate [POST]**: Add a new node template to the database.
- **/getTemplates [GET]**: List all node templates.
- **/saveToGraphWorkNotes [POST]**: Save a work note for a graph.
- **/getGraphWorkNotes [GET]**: Retrieve work notes for a graph.
- **/insertWorkNoteIntoGraph [POST]**: Insert a work note as a node in a graph.
- **/generateText [POST]**: Generate text using Workers AI.

### Brand Worker (brand-worker)

The Brand Worker serves as an intelligent proxy system that powers custom domain deployments and white-label functionality:

#### **Proxy Routing**

- **Knowledge Graph Endpoints**: Routes graph-related requests (`/getknowgraphs`, `/getknowgraph`, `/saveknowgraph`, `/updateknowgraph`, `/deleteknowgraph`, `/saveGraphWithHistory`) to knowledge-graph-worker
- **API Endpoints**: Routes API requests (`/mystmkrasave`, `/generate-header-image`, `/grok-ask`, `/grok-elaborate`, `/apply-style-template`) to api.vegvisr.org
- **Frontend Requests**: Routes all other requests to www.vegvisr.org main frontend

#### **Proxy Features**

- **Domain Context Preservation**: Adds `x-original-hostname` header to maintain custom domain context
- **Method & Header Forwarding**: Preserves original HTTP methods, headers, and request bodies
- **CORS Management**: Automatic CORS header injection for cross-origin compatibility
- **JSON Response Handling**: Intelligent parsing and re-serialization of API responses
- **Error Handling**: Structured JSON error responses with comprehensive error reporting

_This overview provides a quick reference for developers and integrators to understand the main API surface of Vegvisr.org. For detailed request/response formats, see the relevant worker source files or API documentation._

## Chat Worker System

Vegvisr.org features a comprehensive **Real-Time Chat System** powered by dedicated chat workers that enable seamless communication and collaboration within knowledge graph contexts.

### Core Chat Features

#### 💬 **Multi-Room Chat Architecture**

- **Room-Based Organization**: Independent chat rooms with unique room IDs and configurable settings
- **Invitation System**: Email-based invitations with token validation and acceptance workflows
- **User Management**: Role-based access control with room administrators and participants
- **Cross-Domain Support**: Chat functionality integrated across all custom domain deployments

#### 🔐 **Secure Invitation Flow**

- **Token-Based Invitations**: Cryptographically secure invitation tokens with expiration
- **Email Integration**: Professional email templates with branding support via email-worker
- **User Validation**: Existing user detection and new user registration workflows
- **Access Control**: Room-specific permissions and invitation validation

#### ⚡ **Real-Time Communication**

- **WebSocket Integration**: Real-time message delivery and presence indicators
- **Message Threading**: Structured conversations with reply and threading support
- **File Sharing**: Document and media sharing within chat contexts
- **Notification System**: Push notifications and email alerts for important messages

### Technical Implementation

#### **Chat Worker Endpoints**

- **POST /create-room**: Create new chat rooms with configuration settings
- **POST /invite-user**: Send email invitations to join specific rooms
- **GET /validate-invitation**: Validate invitation tokens and room access
- **POST /accept-invitation**: Complete invitation acceptance workflow
- **GET /room-members**: List participants and their roles in specific rooms

#### **Integration Features**

- **Email Worker Integration**: Professional invitation emails with custom branding
- **User System Integration**: Seamless integration with existing user authentication
- **Knowledge Graph Context**: Chat rooms can be associated with specific knowledge graphs
- **Multi-Language Support**: Internationalized chat interface and notifications

## Affiliate System (aff-worker)

Vegvisr.org includes a sophisticated **Affiliate Marketing System** currently under active development, designed to enable comprehensive referral tracking and commission management across the platform.

### Core Affiliate Features

#### 🎯 **Multi-Level Affiliate Management**

- **Deal-Specific Affiliates**: Each affiliate registration tied to specific knowledge graphs (dealName/graphId)
- **Referral Code Generation**: Automatic generation of unique referral codes for tracking
- **Commission Tracking**: Support for both percentage-based and fixed-amount commissions
- **Multi-Domain Support**: Affiliate programs across all custom domain deployments

#### 📊 **Advanced Analytics & Tracking**

- **Real-Time Statistics**: Conversion rates, earnings tracking, and referral performance metrics
- **Dashboard Interface**: Comprehensive affiliate dashboard with earnings overview
- **Invitation Management**: Email-based affiliate recruitment with professional templates
- **Payout Management**: Automated commission calculations and payout tracking

#### 🔄 **Dual Registration Flow**

- **Direct Registration**: Self-service affiliate signup for existing users
- **Invitation-Based**: Email invitation system for recruiting new affiliates
- **Existing User Handling**: Special workflow for users who already have platform accounts
- **Token Validation**: Secure invitation token system with expiration and validation

### Technical Architecture

#### **Affiliate Worker Endpoints**

- **POST /register-affiliate**: Direct affiliate registration for existing users
- **POST /send-affiliate-invitation**: Send branded email invitations to potential affiliates
- **GET /affiliate-dashboard**: Retrieve dashboard data with statistics and earnings
- **GET /list-invitations**: Administrative interface for managing all invitations
- **POST /accept-invitation**: Complete invitation acceptance and affiliate activation

#### **Integration Components**

- **Email Template Integration**: Professional affiliate invitation emails via email-worker
- **User System Integration**: Seamless integration with config table and user authentication
- **Commission Calculation**: Automated tracking of referrals and commission calculations
- **Graph Association**: Each affiliate deal associated with specific knowledge graph content

#### **Development Status**

- **Core Functionality**: ✅ Registration, invitations, and tracking implemented
- **Email Integration**: ✅ Professional templates and delivery system
- **Dashboard Interface**: 🚧 Under active development
- **Payment Processing**: 🚧 Commission payout system in development
- **Analytics Enhancement**: 🚧 Advanced reporting and analytics features

## Vectorize Knowledge Graph Search

Vegvisr.org incorporates advanced **AI-Powered Vector Search** capabilities that enable semantic search across knowledge graphs using Cloudflare's Vectorize service and AI embeddings.

### Core Vector Search Features

#### 🧠 **Intelligent Content Analysis**

- **Semantic Embeddings**: Convert knowledge graph content into vector representations using BGE-base-en-v1.5 model
- **Hybrid Search**: Combines vector similarity search with traditional keyword matching for optimal results
- **Content Extraction**: Intelligent parsing of node content, titles, and metadata for comprehensive indexing
- **Graph-Level Indexing**: Automatic vectorization of entire knowledge graphs with incremental updates

#### 🔍 **Advanced Search Capabilities**

- **Natural Language Queries**: Users can search using natural language questions and concepts
- **Relevance Scoring**: AI-powered relevance scoring with confidence metrics
- **Multi-Modal Search**: Support for searching across text, metadata, and structured content
- **Search Analytics**: Comprehensive logging and analytics for search performance optimization

#### ⚡ **Performance & Scalability**

- **Cloudflare Vectorize**: Leverages Cloudflare's distributed vector database for fast queries
- **Incremental Indexing**: Efficient updates when knowledge graphs are modified
- **Caching Strategy**: Smart caching of embeddings and search results
- **Fallback Systems**: Graceful degradation to keyword search when vector search unavailable

### Technical Implementation

#### **Vector Search Worker Endpoints**

- **POST /index-graph**: Vectorize individual knowledge graphs for search indexing
- **POST /search**: Perform hybrid vector and keyword search across indexed content
- **POST /reindex-all**: Bulk reindexing of all knowledge graphs in the system
- **GET /analyze-content**: Content analysis and embedding quality assessment
- **POST /vectorization-status**: Check vectorization status for multiple graphs

#### **AI Integration**

- **Cloudflare Workers AI**: Direct integration with Cloudflare's AI models for embedding generation
- **BGE-base-en-v1.5 Model**: High-quality English language embeddings optimized for semantic search
- **Content Processing**: Intelligent content chunking and metadata extraction for optimal search results
- **Quality Validation**: Embedding validation and quality checks for search accuracy

#### **Search Modes**

- **Vector Search**: Pure semantic similarity search using AI embeddings
- **Keyword Search**: Traditional text-based search with filtering and ranking
- **Hybrid Search**: Combined approach leveraging both vector and keyword methods for best results

### Frontend Integration

#### **Search Interface Components**

- **Smart Search Toggle**: Switch between keyword and semantic search modes
- **Real-Time Suggestions**: AI-powered search suggestions and query enhancement
- **Results Visualization**: Enhanced results display with relevance scoring and match explanations
- **Search Analytics**: User search behavior tracking and optimization insights

## Email Templates System

Vegvisr.org features a comprehensive **Email Template Management System** that provides professional, branded email communications across all platform features including affiliate invitations, chat invitations, and system notifications.

### Core Email Template Features

#### 📧 **Professional Template Engine**

- **Multi-Language Support**: Templates available in Norwegian (nb), English (en), Turkish (tr), German (de), and Spanish (es)
- **Variable Substitution**: Dynamic content insertion using both Handlebars {{variable}} and simple {variable} syntax
- **HTML & Text Versions**: Professional HTML templates with plain text fallbacks
- **Template Versioning**: Active/inactive template management with version control

#### 🎨 **Advanced Template Types**

- **Affiliate Registration Invitations**: Professional affiliate recruitment emails with commission details
- **Chat Room Invitations**: Branded chat invitation emails with room access links
- **System Notifications**: Platform updates, security alerts, and administrative communications
- **Custom Domain Branding**: Template customization based on domain-specific branding

#### 🔧 **AI-Powered Template Generation**

- **GPT-4 Integration**: AI-powered email template generation with customizable prompts
- **Tone Selection**: Professional, friendly, formal, casual, and urgent tone options
- **Type-Specific Generation**: Specialized templates for invitations, notifications, welcome emails
- **Variable Optimization**: AI suggests appropriate variables for template customization

### Technical Architecture

#### **Email Worker Endpoints**

- **POST /render-template**: Render templates with variable substitution and validation
- **GET /templates**: List available templates with filtering by language and type
- **POST /render-and-send-template**: Complete email rendering and delivery pipeline
- **GET /templates/{id}**: Retrieve specific template details and metadata

#### **Template Processing Engine**

- **Handlebars Integration**: Full Handlebars template processing for complex conditional logic
- **Variable Validation**: Type checking and validation for template variables
- **Content Sanitization**: Security measures to prevent XSS and injection attacks
- **Error Handling**: Comprehensive error reporting for template rendering issues

#### **Database Integration**

- **email_templates Table**: Centralized template storage with metadata and versioning
- **Language Code Support**: Multi-language template management and selection
- **Active Status Management**: Enable/disable templates without deletion
- **Template Categories**: Organized template types for easy management and selection

### Email Delivery Integration

#### **Multi-Service Support**

- **Slowyou.io Integration**: Primary email delivery service with VEGVISR protocol support
- **Variable Processing**: Server-side variable replacement for security and reliability
- **Delivery Tracking**: Message ID generation and delivery status monitoring
- **Error Handling**: Comprehensive error reporting and fallback mechanisms

#### **Branding Integration**

- **Domain-Specific Templates**: Custom templates based on sender domain branding
- **Logo Integration**: Automatic logo insertion based on domain configuration
- **Color Scheme Adaptation**: Template styling based on domain branding settings
- **Custom Signatures**: Domain-specific email signatures and contact information

### Template Management Interface

#### **Administrative Features**

- **Template Builder**: Visual template creation and editing interface
- **Variable Management**: Dynamic variable addition and validation
- **Preview System**: Real-time template preview with test data
- **Deployment Pipeline**: Template testing and production deployment workflow

#### **Developer Tools**

- **API Testing**: Built-in tools for testing template rendering and delivery
- **Variable Documentation**: Automatic documentation generation for template variables
- **Error Debugging**: Detailed error messages and debugging information
- **Performance Monitoring**: Template rendering performance metrics and optimization

_This overview provides a quick reference for developers and integrators to understand the main API surface of Vegvisr.org. For detailed request/response formats, see the relevant worker source files or API documentation._
