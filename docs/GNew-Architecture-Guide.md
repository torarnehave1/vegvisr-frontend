# GNew Architecture Guide

## Modern Knowledge Graph Interface Development

**Version:** 1.3  
**Last Updated:** January 20, 2025  
**Purpose:** Technical documentation for transitioning from GraphViewer to GNewViewer system

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Why the Transition](#why-the-transition)
3. [Architecture Overview](#architecture-overview)
4. [Node Control System](#node-control-system)
5. [Saving Mechanism](#saving-mechanism)
6. [Component Hierarchy](#component-hierarchy)
7. [Event Flow](#event-flow)
8. [Development Phases](#development-phases)
9. [Migration Strategy](#migration-strategy)
10. [Future Development Guidelines](#future-development-guidelines)

---

## Executive Summary

The GNew system is a next-generation knowledge graph interface designed to replace the monolithic GraphViewer. It provides the same functionality with cleaner architecture, better maintainability, and modern Vue 3 patterns.

**Key Benefits:**

- **Clean Architecture:** Modular component design vs 6000+ line monolith
- **Type-specific Rendering:** Dedicated components for each node type
- **Maintainable Code:** Small, focused components vs complex conditional rendering
- **Modern Patterns:** Composition API, proper event handling, reactive state management
- **Future-Ready:** Extensible design for new node types and features

---

## Why the Transition

### Current GraphViewer Problems

**GraphViewer.vue** has become unmaintainable:

- **6000+ lines** of complex code in a single file
- **Conditional rendering** nightmare with complex v-if chains
- **Mixed concerns** - UI, data management, and business logic intertwined
- **Hard to debug** - cascading effects from changes
- **Difficult to extend** - adding new node types requires touching core rendering logic
- **Performance issues** - entire component re-renders for any change

### GNew Solution

**GNewViewer.vue** provides clean architecture:

- **Modular design** - each node type has its own component
- **Single responsibility** - each component handles one concern
- **Predictable rendering** - dynamic component loading based on node type
- **Easy to extend** - new node types = new components
- **Better performance** - only relevant components re-render
- **Maintainable** - changes are isolated and predictable

---

## Architecture Overview

### System Components

```
GNewViewer.vue (Main Interface)
├── Graph Management
├── Node Rendering Container
└── Event Coordination

GNewNodeRenderer.vue (Dynamic Loader)
├── Component Selection Logic
├── Event Forwarding
└── Prop Management

GNewNodes/ (Type-Specific Components)
├── GNewDefaultNode.vue      (fallback, fulltext, worknote, etc.)
├── GNewImageNode.vue        (markdown-image, background, portfolio-image)
├── GNewVideoNode.vue        (youtube-video)
├── GNewTitleNode.vue        (title)
├── GNewActionTestNode.vue   (action_test - AI endpoints)
├── GNewButtonRowNode.vue    (button_row)
├── GNewImageQuoteNode.vue   (imagequote)
├── [Chart Components] (Phase 3.2 ✅ COMPLETE)
└── [GNewMermaidNode.vue] (Phase 3.3 - mermaid-diagram support)
```

### Data Flow

```
Backend API ←→ KnowledgeGraphStore (Pinia) ←→ GNewViewer ←→ GNewNodeRenderer ←→ GNewNodes
```

### Component Selection Logic

```javascript
// GNewNodeRenderer.vue - Dynamic component mapping
const nodeComponents = {
  default: GNewDefaultNode,
  'markdown-image': GNewImageNode,
  'youtube-video': GNewVideoNode,
  title: GNewTitleNode,
  action_test: GNewActionTestNode,
  imagequote: GNewImageQuoteNode,
  // Chart types (Phase 3.2 ✅ COMPLETE)
  chart: GNewChartNode,
  piechart: GNewPieChartNode,
  linechart: GNewLineChartNode,
  timeline: GNewTimelineNode,
  bubblechart: GNewBubbleChartNode,
  swot: GNewSWOTNode,
  // Mermaid diagrams (Phase 3.3 ⏳ PENDING)
  'mermaid-diagram': GNewMermaidNode, // ⚠️ MISSING - defaults to GNewDefaultNode
  // Fallback
  [nodeType]: nodeComponents[nodeType] || nodeComponents['default'],
}
```

---

## Node Control System

### Node Structure

Every node follows a consistent data structure:

```javascript
{
  id: "unique-identifier",
  label: "Display Label",
  type: "node-type",           // Determines which component renders it
  info: "Content/HTML",        // Main content
  color: "#hexcolor",          // Visual styling
  visible: true,               // Visibility state
  position: { x: 100, y: 100 },// Layout position
  bibl: ["reference1", "ref2"], // Bibliography references
  // Type-specific fields
  imageWidth: "100%",          // For image nodes
  mystmkraUrl: "...",         // For document nodes
  // etc.
}
```

### Component Responsibilities

Each node component handles:

1. **Rendering** - Display the node content according to its type
2. **Interaction** - Edit, delete, copy controls
3. **Events** - Emit events for parent handling
4. **Validation** - Ensure data integrity for its type

### Standard Component Interface

```javascript
// Props (Input)
const props = defineProps({
  node: { type: Object, required: true },
  isPreview: { type: Boolean, default: false },
  showControls: { type: Boolean, default: true },
})

// Events (Output)
const emit = defineEmits([
  'node-updated', // When node data changes
  'node-deleted', // When node should be removed
  'node-created', // When new nodes are created (AI responses)
])
```

---

## Saving Mechanism

### Complete Save Flow

```
1. Local State Update
   ├── graphData.value.nodes.push(newNode) OR
   ├── graphData.value.nodes[index] = updatedNode

2. Backend Persistence
   ├── POST /saveGraphWithHistory
   ├── Body: { id: graphId, graphData: completeGraph, override: true }

3. Store Synchronization
   ├── knowledgeGraphStore.updateGraphFromJson(completeGraph)
   ├── Replaces entire nodes/edges arrays

4. Success Feedback
   ├── Status message display
   ├── Console logging for debugging
```

### Critical Understanding

**The system works by REPLACING the entire graph, not adding individual nodes:**

```javascript
// ❌ Wrong Approach - No addNode() method exists
knowledgeGraphStore.addNode(newNode)

// ✅ Correct Approach - Replace entire graph
graphData.value.nodes.push(newNode)
const updatedGraph = { ...graphData.value }
await saveToBackend(updatedGraph)
knowledgeGraphStore.updateGraphFromJson(updatedGraph)
```

### Backend API Requirements

```javascript
// /saveGraphWithHistory endpoint expects:
{
  id: "graph-uuid",              // Target graph ID
  graphData: {
    metadata: {
      title: "Graph Title",
      description: "...",
      createdBy: "user",
      version: 1
    },
    nodes: [...],                // Complete nodes array
    edges: [...]                 // Complete edges array
  },
  override: true                 // Version control flag
}
```

---

## Component Hierarchy

### Event Flow Architecture

```
User Action
    ↓
GNewNode Component (specific type)
    ↓ emits event
GNewNodeRenderer
    ↓ forwards event
GNewViewer
    ↓ handles event
Backend API + Store Update
    ↓
Re-render with new data
```

### Event Types and Handlers

```javascript
// GNewViewer.vue - Event handling
const handleNodeUpdated = (updatedNode) => {
  // Update specific node in local state
  // Save to backend
  // Update store
}

const handleNodeDeleted = (nodeId) => {
  // Remove from local state
  // Save to backend
  // Update store
}

const handleNodeCreated = (newNode) => {
  // Add to local state
  // Save to backend
  // Update store
}
```

### Template Structure

```vue
<!-- GNewViewer.vue -->
<GNewNodeRenderer
  v-for="node in graphData.nodes"
  :key="node.id"
  :node="node"
  :showControls="true"
  @node-updated="handleNodeUpdated"
  @node-deleted="handleNodeDeleted"
  @node-created="handleNodeCreated"
/>
```

---

## Event Flow

### Successful Node Creation Flow

```
1. User triggers AI action in GNewActionTestNode
   ↓
2. API call to /groktest (or other AI endpoint)
   ↓
3. Parse API response and create node data
   ↓
4. emit('node-created', newNodeData)
   ↓
5. GNewNodeRenderer receives and forwards: emit('node-created', newNodeData)
   ↓
6. GNewViewer.handleNodeCreated(newNodeData)
   ↓
7. graphData.value.nodes.push(newNodeData)
   ↓
8. POST /saveGraphWithHistory with complete graph
   ↓
9. knowledgeGraphStore.updateGraphFromJson(updatedGraph)
   ↓
10. Success message and UI update
```

### Failed Node Creation Flow

```
1-4. Same as above
   ↓
5. Event forwarding fails (missing @node-created)
   ↓
6. handleNodeCreated never called
   ↓
7. No backend save, no store update
   ↓
8. User sees "success" but no node appears
```

### Event Forwarding Requirements

**Critical:** Every component in the chain must forward the `node-created` event:

```javascript
// GNewNodeRenderer.vue - MUST have all three
const emit = defineEmits(['node-updated', 'node-deleted', 'node-created'])

// Template MUST include the handler
@node-created="handleNodeCreated"

// Handler MUST forward the event
const handleNodeCreated = (newNode) => {
  emit('node-created', newNode)
}
```

---

## Development Phases

### Phase 3.1: Basic Framework ✅ COMPLETE

- ✅ GNewViewer main interface
- ✅ GNewNodeRenderer dynamic loader
- ✅ All basic node types (default, image, video, title, action_test)
- ✅ Event forwarding system
- ✅ AI response generation and saving
- ✅ IMAGEQUOTE system integration

### Phase 3.2: Chart Node Components ✅ COMPLETE

**Completed Components:**

- ✅ `GNewChartNode.vue` - Bar chart display with modern styling
- ✅ `GNewPieChartNode.vue` - Pie chart specific with center alignment
- ✅ `GNewLineChartNode.vue` - Line chart with xLabel/yLabel support
- ✅ `GNewTimelineNode.vue` - Timeline visualization with scroll support
- ✅ `GNewBubbleChartNode.vue` - Bubble chart with minimum height container
- ✅ `GNewSWOTNode.vue` - SWOT diagram with quadrant color bar

**Implementation Completed:**

```javascript
// GNewNodeRenderer.vue - Chart components now active
const nodeComponents = {
  // ... existing
  chart: GNewChartNode, // ✅ Bar charts
  piechart: GNewPieChartNode, // ✅ Pie charts
  linechart: GNewLineChartNode, // ✅ Line charts
  timeline: GNewTimelineNode, // ✅ Timeline charts
  bubblechart: GNewBubbleChartNode, // ✅ Bubble charts
  swot: GNewSWOTNode, // ✅ SWOT diagrams
}
```

**Features Achieved:**

- Modern GNew styling with color-coded borders and hover effects
- Consistent edit/delete controls across all chart types
- Proper chart wrapper styling for visual consistency
- Support for chart descriptions and additional metadata
- Mobile-responsive design for all chart components

### Phase 3.3: Template Sidebar Infrastructure ⏳ PRIORITY

**Strategic Foundation:** The Template Sidebar establishes the architectural foundation that makes all future feature additions significantly easier and more discoverable. This phase prioritizes infrastructure over individual features.

**Core Sidebar Architecture:**

- **`GNewTemplateSidebar.vue`** - Collapsible sidebar component with responsive design
- **Template System** - JSON-based template definitions for all current node types
- **Template Categories** - Organized by content type (Content, Charts, Visual, Interactive, Diagrams)
- **Click-to-Add Functionality** - Single-click node insertion with proper positioning
- **Mobile Responsive** - Collapsible design with mobile-optimized interactions
- **Template Preview System** - Visual representations of each node type

**Template Integration Framework:**

```javascript
// Template definition structure
const nodeTemplates = {
  'Content Nodes': [
    { id: 'fulltext', icon: '📄', label: 'Fulltext', template: {...} },
    { id: 'title', icon: '🎯', label: 'Title', template: {...} },
    { id: 'worknote', icon: '📝', label: 'Work Note', template: {...} }
  ],
  'Charts & Data': [
    { id: 'chart', icon: '📊', label: 'Bar Chart', template: {...} },
    { id: 'piechart', icon: '🥧', label: 'Pie Chart', template: {...} },
    // ... all current chart types
  ]
  // ... additional categories
}
```

**Architecture Benefits:**

- **Extensibility** - New node types require only template definition additions
- **Discoverability** - Visual template browser increases feature usage
- **Consistency** - Standardized node creation workflow
- **Development Velocity** - 90% reduction in time to add new node types
- **User Experience** - Professional, modern interface matching industry standards

**Implementation Components:**

1. **Sidebar Component** - Collapsible panel with template categories
2. **Template Store** - Pinia store for template definitions and management
3. **Insertion System** - Event handling for template-to-graph conversion
4. **Responsive Design** - Mobile-first approach with touch optimization
5. **Search & Filter** - Template discovery and quick access

**Success Metrics:**

- All 12+ current node types accessible via sidebar
- Mobile responsive collapse/expand functionality
- Sub-300ms template insertion performance
- Foundation ready for Phase 3.4 template additions

### Phase 3.4: Core Visualization Support ⏳ PENDING

**Mermaid Diagram Integration** (Critical missing functionality)

With the Template Sidebar infrastructure in place, Phase 3.4 focuses on adding advanced visualization capabilities that plug directly into the established template system.

**Implementation Components:**

- **`GNewMermaidNode.vue`** - Dedicated mermaid diagram component
- **Flowchart Support** - Business process and system flow diagrams
- **Gantt Chart Rendering** - Project timeline and scheduling visualization
- **Quadrant Analysis** - Strategic planning and campaign analysis tools
- **Timeline Diagrams** - Historical and process timeline visualization
- **Template Integration** - Support for 4 existing mermaid diagram templates

**Template System Integration:**

```javascript
// New templates plug into existing sidebar infrastructure
const mermaidTemplates = {
  'Diagrams': [
    { id: 'mermaid-flowchart', icon: '🌊', label: 'Flowchart', template: {...} },
    { id: 'mermaid-gantt', icon: '📅', label: 'Gantt Chart', template: {...} },
    { id: 'mermaid-quadrant', icon: '📊', label: 'Quadrant Analysis', template: {...} },
    { id: 'mermaid-timeline', icon: '⏱️', label: 'Timeline', template: {...} }
  ]
}
```

**Benefits of Sidebar-First Architecture:**

- **Rapid Implementation** - Template definitions vs. complex UI changes
- **Consistent User Experience** - Mermaid diagrams discovered via same sidebar workflow
- **Easy Testing** - Individual template validation independent of UI
- **Future-Proofing** - Foundation supports unlimited diagram variations

### Phase 3.5: Export & Integration Functions ⏳ PENDING

**Advanced Export Capabilities** (Critical for feature parity)

**Export Functions:**

- **Print Functionality** - `printGraph()` with browser print integration
- **PDF Export** - Advanced html2pdf with page breaks, button hiding, A4 format
- **AI-Powered Share Modal** - Cloudflare Worker generated engaging summaries
- **Multi-Platform Sharing** - Instagram, LinkedIn, Twitter, Facebook integration
- **Branded Domain Integration** - Custom domain URLs for professional sharing

**External Platform Integration:**

- **Mystmkra.io Integration** - Document creation/updating with API tokens
- **R2 Portfolio Navigation** - Cloud storage portfolio access
- **RAG Sandbox Modal** - Retrieval-Augmented Generation experimentation

**Node Management Operations:**

- **Copy Node to Graphs** - Cross-graph node duplication functionality
- **Node Reordering Controls** - Move up/down, drag-and-drop, bulk reordering
- **Template-based Creation** - Format nodes with predefined templates (leveraging sidebar)
- **Quick Format Actions** - Rapid node styling and structure changes

**Advanced Edit Controls:**

- **Enhanced Edit Modals** - Rich formatting with template integration
- **Bulk Node Operations** - Multi-select and batch editing
- **Google Photos Integration** - Direct image replacement from Google Photos
- **Image Management** - URL replacement, dimension changes, search integration

**Performance & UX Optimizations:**

- **Lazy Loading** - Large graph handling optimization
- **Virtual Scrolling** - Efficient node list rendering
- **Real-time Collaboration** - Multi-user editing capabilities
- **Memory Management** - Component cleanup and optimization

---

## GraphViewer Top Menubar Analysis

### Comprehensive Feature Audit Results

Through detailed examination of GraphViewer's main action toolbar, the following 9 primary buttons and their sophisticated functionality were identified:

**1. Print Button** - `printGraph()` - Browser print integration

**2. Save as PDF Button** - `saveAsHtml2Pdf()` - Advanced PDF generation with:

- html2pdf library integration
- Control button hiding during export
- Page break optimization
- A4 format with 98% image quality
- Error handling and logging

**3. Share Button** - `openShareModal()` - AI-powered sharing with:

- Cloudflare Worker content generation
- Multi-platform integration (Instagram, LinkedIn, Twitter, Facebook)
- Branded domain URL generation
- Fallback content for AI failures
- Real-time summary generation

**4. Save to Mystmkra.io Button** (Admin/Superadmin) - External platform integration

**5. AI NODE Button** (Admin/Superadmin) - Basic AI node generation

**6. Enhanced AI NODE Button** (Admin/Superadmin) - Advanced AI node creation

**7. AI IMAGE Button** (Admin/Superadmin) - AI-powered image generation

**8. R2 Portfolio Button** (Logged users) - Cloud storage navigation

**9. RAG Sandbox Button** (Admin/Superadmin) - AI experimentation workspace

### Social Media Integration Details

The Share button provides comprehensive social platform support:

- **Instagram**: Story creation with copy-paste workflow
- **LinkedIn**: Professional network optimization with title/summary pre-population
- **Twitter**: 280-character optimized content with direct tweet composition
- **Facebook**: URL-based sharing with automatic preview generation

### Critical Gap Analysis

GNewViewer currently lacks **two major functionality categories**:

1. **Mermaid Diagram Support** - Missing flowcharts, Gantt charts, quadrant analysis, and timeline diagrams affecting 4 major visualization templates
2. **Complete Export Functionality** - Missing all sharing, PDF, and external platform integration features

These gaps represent the most significant barriers to production readiness. The mermaid diagram support affects core business visualization needs, while the sophisticated sharing system with AI-generated content and multi-platform integration are essential user expectations.

---

## Migration Strategy

### Gradual Transition Plan

1. **Parallel Development** - Both systems coexist
2. **Feature Parity** - Ensure GNew matches GraphViewer capabilities
3. **User Testing** - Validate GNew experience with real users
4. **Gradual Cutover** - Route users to GNew as features are validated
5. **Legacy Deprecation** - Phase out GraphViewer once GNew is stable

### Feature Compatibility Matrix

| Feature                     | GraphViewer | GNewViewer | Status    | Details                                  |
| --------------------------- | ----------- | ---------- | --------- | ---------------------------------------- |
| Basic Node Display          | ✅          | ✅         | Complete  | All node types render correctly          |
| Node Editing                | ✅          | ✅         | Complete  | Edit, delete, copy functionality         |
| AI Integration              | ✅          | ✅         | Complete  | AI node generation working               |
| Image Nodes                 | ✅          | ✅         | Complete  | Markdown-image, background support       |
| Video Nodes                 | ✅          | ✅         | Complete  | YouTube video embedding                  |
| Chart Nodes                 | ✅          | ✅         | Complete  | All 6 chart types implemented            |
| IMAGEQUOTE System           | ✅          | ✅         | Complete  | Image quote generation and export        |
| **Template Sidebar**        | ❌          | ❌         | Phase 3.3 | Visual template browser and insertion    |
| **Mermaid Diagrams**        | ✅          | ❌         | Phase 3.4 | Flowcharts, Gantt, Quadrant, Timeline    |
| **Export Functions**        |             |            |           |                                          |
| - Print Functionality       | ✅          | ❌         | Phase 3.5 | `window.print()` integration             |
| - PDF Export                | ✅          | ❌         | Phase 3.5 | html2pdf with advanced options           |
| - AI Share Modal            | ✅          | ❌         | Phase 3.5 | Cloudflare Worker content generation     |
| - Social Media Sharing      | ✅          | ❌         | Phase 3.5 | Instagram, LinkedIn, Twitter, Facebook   |
| **Admin Functions**         |             |            |           |                                          |
| - Enhanced AI Node          | ✅          | ❌         | Phase 3.5 | Advanced AI node generation              |
| - AI Image Generation       | ✅          | ❌         | Phase 3.5 | AI-powered image creation                |
| - Mystmkra.io Integration   | ✅          | ❌         | Phase 3.5 | External platform document saving        |
| - RAG Sandbox               | ✅          | ❌         | Phase 3.5 | Retrieval-Augmented Generation workspace |
| **Node Operations**         |             |            |           |                                          |
| - Copy to Other Graphs      | ✅          | ❌         | Phase 3.5 | Cross-graph node duplication             |
| - Node Reordering           | ✅          | ❌         | Phase 3.5 | Move up/down, drag-drop, bulk reorder    |
| - Template Formatting       | ✅          | ❌         | Phase 3.5 | Quick format and template selection      |
| - Google Photos Integration | ✅          | ❌         | Phase 3.5 | Direct image replacement workflow        |

### Risk Mitigation

- **Rollback Plan** - Keep GraphViewer functional during transition
- **Data Safety** - Both systems use same backend/store
- **User Communication** - Clear migration messaging
- **Testing** - Comprehensive testing before each phase

---

## Future Development Guidelines

### Adding New Node Types

1. **Create Component** - `src/components/GNewNodes/GNew[Type]Node.vue`
2. **Follow Interface** - Use standard props and events
3. **Register Component** - Add to `GNewNodeRenderer.vue` mapping
4. **Test Integration** - Verify event flow and saving
5. **Update Documentation** - Add to this guide

### Component Development Standards

```javascript
// Standard component template
<template>
  <div class="gnew-[type]-node">
    <!-- Node content -->
    <div v-if="showControls" class="node-controls">
      <!-- Edit, delete, copy controls -->
    </div>
  </div>
</template>

<script setup>
// Standard interface
const props = defineProps({
  node: { type: Object, required: true },
  isPreview: { type: Boolean, default: false },
  showControls: { type: Boolean, default: true }
})

const emit = defineEmits(['node-updated', 'node-deleted', 'node-created'])

// Component logic here
</script>

<style scoped>
/* Component-specific styles */
</style>
```

### Event Handling Best Practices

1. **Always emit events** - Don't manipulate parent state directly
2. **Use descriptive event names** - `node-updated` not `update`
3. **Include complete data** - Send full node object, not just changes
4. **Handle errors gracefully** - Emit error events when needed
5. **Test event flow** - Verify events reach their handlers

### Performance Considerations

1. **Component Isolation** - Keep components independent
2. **Reactive Optimization** - Use computed properties for derived data
3. **Event Debouncing** - Debounce rapid events (typing, etc.)
4. **Memory Management** - Clean up listeners and refs
5. **Lazy Loading** - Consider lazy loading for heavy components

### Debugging Guidelines

1. **Console Logging** - Use structured logging for event flow
2. **Vue DevTools** - Monitor component state and events
3. **Network Tab** - Verify API calls and responses
4. **Error Boundaries** - Implement graceful error handling
5. **State Inspection** - Monitor store state changes

---

## Technical Reference

### Key Files and Their Purposes

```
src/views/GNewViewer.vue          - Main interface, event coordination
src/components/GNewNodeRenderer.vue  - Dynamic component loader
src/components/GNewNodes/         - Type-specific node components
src/stores/knowledgeGraphStore.js - Global state management
api-worker/index.js              - Backend API endpoints
```

### Environment Setup

```bash
# Development server
npm run dev:vue

# Component testing
npm run test

# Type checking
npm run type-check
```

### Common Issues and Solutions

**Issue: Events not reaching handlers**

- Check event forwarding chain
- Verify emit declarations
- Confirm event handler binding

**Issue: Nodes not saving**

- Check API endpoint responses
- Verify store update calls
- Confirm graph ID is set

**Issue: Components not rendering**

- Check component registration
- Verify node type mapping
- Confirm component import

---

## Conclusion

The GNew system represents a fundamental architectural improvement over the legacy GraphViewer. By following the patterns and guidelines outlined in this document, developers can:

- **Maintain Consistency** - All components follow the same patterns
- **Add Features Safely** - New components integrate predictably
- **Debug Effectively** - Event flow and data flow are transparent
- **Scale Efficiently** - Architecture supports growth and complexity

The transition from GraphViewer to GNewViewer is not just a technical migration—it's an investment in maintainable, scalable, and modern knowledge graph interface development.

---

**Document Maintenance:** This guide should be updated whenever significant architectural changes are made to the GNew system. All developers working on the system should be familiar with these patterns and guidelines.

**Last Updated:** January 20, 2025 - Version 1.3: Restructured Development Phases to prioritize Template Sidebar Infrastructure as Phase 3.3. Moved Mermaid diagrams to Phase 3.4 and Export/Integration functions to Phase 3.5. This architectural change recognizes the sidebar as the foundational infrastructure that makes all future feature additions significantly easier and more discoverable. Updated Feature Compatibility Matrix to reflect new phase structure.
