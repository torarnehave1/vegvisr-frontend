# Vegvisr Frontend Architecture Overview

_This document will be updated with detailed architectural information as we proceed._

## Introduction

Vegvisr.org is a web application designed to empower users with advanced tools for knowledge management, visualization, and integration with external services. The platform provides a personalized dashboard experience, allowing users to manage their profiles, customize settings, and interact with various data sources. Vegvisr.org aims to facilitate the creation, editing, and exploration of knowledge graphs, enabling users to organize information, collaborate, and gain insights through intuitive visual interfaces. Key features include the interactive Graph Viewer for exploring and exporting graphs, the Graph Portfolio for browsing and managing collections of knowledge graphs, a robust API Worker that powers AI, search, file upload, and integration features, a dedicated Dev Worker for advanced knowledge graph operations and versioning, a Main Worker that handles core application logic, user data, and profile image uploads, and a GitHub Issues View for tracking and managing project roadmap and feature requests. The application emphasizes user experience, flexibility, and extensibility, making it suitable for a wide range of use cases from personal knowledge management to collaborative research and education.

## Purpose of This Document

This document is intended to give developers a high-level overview of the main components and structure of the Vegvisr.org frontend system. It serves as a starting point for understanding how the application is organized, how data flows, and where to find key features and integrations.

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

## Outline

- AI-Powered Content Enhancement System
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

- **OpenAI**: Provides AI-powered features such as text generation and summarization.
- **XAI (Grok)**: Powers the Enhanced PagesStyleTemplates System with intelligent content formatting and analysis.
- **Pexels API**: Provides contextual, professional-quality images for AI-enhanced content formatting.
- **GitHub**: Used for authentication, issue tracking, or integration with developer workflows.
- **Twilio**: Enables SMS and phone-based notifications or verifications.
- **Google API**: Used for various integrations, such as maps or authentication.
- **Mystmkra.io**: External service for user ID integration and other features.

### Dev Worker (knowledge-graph-worker)

The Dev Worker is a specialized Cloudflare Worker focused on advanced knowledge graph operations. It manages the creation, updating, versioning, and retrieval of knowledge graphs, as well as the storage and management of graph templates and work notes. The Dev Worker ensures data integrity, supports collaborative editing, and provides endpoints for interacting with graph history and metadata. It is essential for enabling rich, versioned knowledge graph experiences within Vegvisr.org.

### Main Worker (main-worker)

The Main Worker is a Cloudflare Worker responsible for handling core application logic, user data, and profile image uploads. It connects to Cloudflare KV, D1 database, and R2 storage for persistent data and files, ensuring that user profiles, settings, and related assets are managed efficiently and securely. The Main Worker plays a crucial role in maintaining the integrity and performance of the Vegvisr.org application.

### GitHub Issues View

The GitHub Issues View is a Vue.js component that provides a user-friendly interface for viewing, sorting, and interacting with GitHub issues related to the Vegvisr.org project. It allows users to track the project roadmap, view issue details, and create new issues directly from the application. This component enhances collaboration and transparency by integrating GitHub issue tracking seamlessly into the Vegvisr.org platform.

### GitHub Issues Component

The GitHub Issues component is a reusable Vue.js component that fetches, displays, and sorts GitHub issues. It supports various sorting options (priority, date, issue number, title) and renders issue details using Markdown. This component is essential for maintaining an organized and accessible project roadmap within Vegvisr.org.

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

#### **AI-Powered Content Enhancement**

- **/summarize [POST]**: Summarize text using OpenAI.
- **/groktest [POST]**: Run a Grok AI test and return a fulltext node.
- **/aiaction [POST]**: Flexible AI action endpoint for various providers (OpenAI, XAI, Google).
- **/style-templates [GET]**: Retrieve available AI formatting templates filtered by node type.
- **/apply-style-template [POST]**: Apply AI-powered content formatting with color themes and contextual image integration.
- **/pexels-search [POST]**: Search for contextual images using Pexels API based on content analysis.

#### **Knowledge Graph AI Features**

- **/createknowledgegraph [GET]**: Generate a knowledge graph using AI based on a subject.
- **/ai-generate-node [POST]**: Generate knowledge graph nodes using AI with context awareness.
- **/process-transcript [POST]**: Process audio/video transcripts into structured knowledge graphs.
- **/suggest-title [POST]**: AI-powered graph title suggestions based on content analysis.
- **/suggest-description [POST]**: AI-powered graph description generation.
- **/suggest-categories [POST]**: AI-powered graph category suggestions.
- **/generate-meta-areas [POST]**: Generate meta areas for knowledge graph classification.

#### **AI Image Generation**

- **/generate-header-image [POST]**: Generate header images using DALL-E based on content context.
- **/generate-image-prompt [POST]**: Generate AI image prompts from content analysis.
- **/gpt4-vision-image [POST]**: Generate images using GPT-4 Vision and various AI models.

#### **Advanced AI Tools**

- **/grok-ask [POST]**: AI-powered Q&A functionality using Grok for content-based queries.
- **/grok-issue-description [POST]**: AI-powered GitHub issue description enhancement and generation.

#### **External Integrations**

- **/mystmkra-save [POST]**: Proxy to Mystmkra.io for saving markdown content.
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

_This overview provides a quick reference for developers and integrators to understand the main API surface of Vegvisr.org. For detailed request/response formats, see the relevant worker source files or API documentation._
