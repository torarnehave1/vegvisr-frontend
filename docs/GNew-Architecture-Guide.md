# GNew Architecture Guide

## Modern Knowledge Graph Interface Development

**Version:** 1.0  
**Last Updated:** January 2025  
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
└── [Future Chart Components] (Phase 3.2)
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
  // Chart types (Phase 3.2)
  chart: GNewDefaultNode,
  piechart: GNewDefaultNode,
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

### Phase 3.3: Advanced Features

- Advanced edit modals
- Drag and drop reordering
- Real-time collaboration
- Export/import functionality
- Performance optimizations

---

## Migration Strategy

### Gradual Transition Plan

1. **Parallel Development** - Both systems coexist
2. **Feature Parity** - Ensure GNew matches GraphViewer capabilities
3. **User Testing** - Validate GNew experience with real users
4. **Gradual Cutover** - Route users to GNew as features are validated
5. **Legacy Deprecation** - Phase out GraphViewer once GNew is stable

### Feature Compatibility Matrix

| Feature            | GraphViewer | GNewViewer | Status    |
| ------------------ | ----------- | ---------- | --------- |
| Basic Node Display | ✅          | ✅         | Complete  |
| Node Editing       | ✅          | ✅         | Complete  |
| AI Integration     | ✅          | ✅         | Complete  |
| Image Nodes        | ✅          | ✅         | Complete  |
| Video Nodes        | ✅          | ✅         | Complete  |
| Chart Nodes        | ✅          | ✅         | Complete  |
| IMAGEQUOTE         | ✅          | ✅         | Complete  |
| Export Functions   | ✅          | ⏳         | Phase 3.3 |

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
