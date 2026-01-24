<template>
  <div class="graph-canvas" ref="graphCanvasRoot">
    <!-- Top Toolbar -->
    <div class="canvas-toolbar">
      <div class="toolbar-section">
        <h3 class="canvas-title">
          Graph Canvas
          <span v-if="currentGraphTitle" class="text-muted ms-2">- {{ currentGraphTitle }}</span>
        </h3>
      </div>

      <div class="toolbar-section">
        <!-- Search -->
        <input
          v-model="searchQuery"
          @input="searchNodes"
          type="text"
          class="form-control search-input"
          placeholder="Search nodes..."
        />
      </div>

      <div class="toolbar-section">
        <!-- Alignment Controls -->
        <div class="btn-group" role="group">
          <button
            @click="alignSelectedNodes('horizontal')"
            class="btn btn-outline-primary"
            title="Align Horizontal"
          >
            ⬌ Horizontal
          </button>
          <button
            @click="alignSelectedNodes('vertical')"
            class="btn btn-outline-primary"
            title="Align Vertical"
          >
            ⬍ Vertical
          </button>
          <button
            @click="alignSelectedNodes('center')"
            class="btn btn-outline-primary"
            title="Align Center"
          >
            ⊕ Center
          </button>
        </div>
      </div>

      <div class="toolbar-section">
        <!-- Spacing Controls -->
        <div class="btn-group" role="group">
          <button
            @click="spreadSelectedNodes('horizontal')"
            class="btn btn-outline-secondary"
            title="Spread Horizontal"
          >
            ↔ Spread H
          </button>
          <button
            @click="spreadSelectedNodes('vertical')"
            class="btn btn-outline-secondary"
            title="Spread Vertical"
          >
            ↕ Spread V
          </button>
          <button
            @click="openGridLayoutDialog"
            class="btn btn-outline-secondary"
            title="Arrange selected nodes in a grid/matrix"
          >
            ▦ Grid
          </button>
        </div>
      </div>

      <div class="toolbar-section">
        <!-- View Controls -->
        <div class="btn-group" role="group">
          <button @click="centerAndZoom" class="btn btn-outline-info" title="Center & Fit">
            🎯 Center
          </button>
          <button
            @click="toggleFullscreen"
            class="btn btn-outline-info"
            :title="isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'"
          >
            {{ isFullscreen ? '⤢ Exit Fullscreen' : '⤢ Fullscreen' }}
          </button>
        </div>
      </div>

      <div class="toolbar-section">
        <!-- Grid Controls -->
        <div class="btn-group" role="group">
          <button
            @click="showCanvasGrid = !showCanvasGrid"
            class="btn"
            :class="showCanvasGrid ? 'btn-info' : 'btn-outline-info'"
            title="Toggle grid lines"
          >
            ⊞ Grid
          </button>
          <button
            @click="snapToGrid = !snapToGrid"
            class="btn"
            :class="snapToGrid ? 'btn-warning' : 'btn-outline-warning'"
            title="Toggle snap to grid"
          >
            ⊡ Snap
          </button>
          <select
            v-model.number="canvasGridSize"
            class="form-select form-select-sm grid-size-select"
            title="Grid size"
          >
            <option :value="25">25px</option>
            <option :value="50">50px</option>
            <option :value="100">100px</option>
            <option :value="150">150px</option>
          </select>
        </div>
      </div>

      <div class="toolbar-section">
        <!-- Undo/Redo -->
        <div class="btn-group" role="group">
          <button @click="undoAction" class="btn btn-outline-secondary" title="Undo">↶ Undo</button>
          <button @click="redoAction" class="btn btn-outline-secondary" title="Redo">↷ Redo</button>
        </div>
      </div>

      <div class="toolbar-section">
        <!-- Save -->
        <button @click="saveGraph" class="btn btn-success" title="Save Changes">
          💾 Save Graph
        </button>
      </div>

      <div class="toolbar-section">
        <!-- AI Chat Toggle -->
        <button
          v-if="userStore.loggedIn"
          @click="showAIChat = !showAIChat"
          class="btn btn-sm ai-chat-toggle"
          :class="showAIChat ? 'btn-primary' : 'btn-outline-primary'"
          title="Toggle AI Assistant"
        >
          🤖 AI Chat
        </button>
      </div>
    </div>

    <!-- Status Bar -->
    <div v-if="statusMessage" class="status-bar" :class="statusClass">
      {{ statusMessage }}
    </div>

    <!-- Main Content with optional Chat Panel -->
    <div class="canvas-with-chat" :class="{ 'chat-open': showAIChat }">
      <!-- Main Canvas -->
      <div class="canvas-container" :class="{ 'with-chat': showAIChat }">
        <!-- Grid Background Overlay -->
        <div
          v-if="showCanvasGrid"
          class="canvas-grid-overlay"
          :style="gridOverlayStyle"
        ></div>
        <div id="graph-canvas" class="cytoscape-canvas"></div>
        <div
          class="node-html-overlays"
          v-if="nodeHtmlOverlays.length"
        >
        <div
          v-for="overlay in nodeHtmlOverlays"
          :key="overlay.id"
          class="node-html-overlay"
          :class="{ 'is-selected': overlay.isSelected }"
          :data-node-id="overlay.id"
          :style="overlay.style"
        >
            <component
              :is="overlay.component"
              :node="overlay.node"
              :isPreview="true"
              :showControls="false"
            />
          </div>
        </div>
        <div class="youtube-play-buttons" v-if="youtubePlayButtons.length">
          <button
            v-for="btn in youtubePlayButtons"
            :key="btn.id"
            class="youtube-play-button"
            :style="btn.style"
            @click.stop="openYoutubeModal(btn.node)"
            aria-label="Play YouTube video"
            title="Play video"
          >
            ▶
          </button>
        </div>
        <!-- Node Resize Handles -->
        <div
          v-if="resizeHandles.visible"
          class="node-resize-handles"
          :style="resizeHandles.containerStyle"
        >
          <div
            class="resize-handle resize-handle-n"
            @mousedown.prevent.stop="startNodeResize('n', $event)"
          ></div>
          <div
            class="resize-handle resize-handle-s"
            @mousedown.prevent.stop="startNodeResize('s', $event)"
          ></div>
          <div
            class="resize-handle resize-handle-e"
            @mousedown.prevent.stop="startNodeResize('e', $event)"
          ></div>
          <div
            class="resize-handle resize-handle-w"
            @mousedown.prevent.stop="startNodeResize('w', $event)"
          ></div>
          <div
            class="resize-handle resize-handle-ne"
            @mousedown.prevent.stop="startNodeResize('ne', $event)"
          ></div>
          <div
            class="resize-handle resize-handle-nw"
            @mousedown.prevent.stop="startNodeResize('nw', $event)"
          ></div>
          <div
            class="resize-handle resize-handle-se"
            @mousedown.prevent.stop="startNodeResize('se', $event)"
          ></div>
          <div
            class="resize-handle resize-handle-sw"
            @mousedown.prevent.stop="startNodeResize('sw', $event)"
          ></div>
          <!-- Rotation Handle -->
          <div
            class="rotation-handle"
            @mousedown.prevent.stop="startNodeRotation($event)"
            title="Drag to rotate"
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
            </svg>
          </div>
        </div>
        <!-- Group Selection Box (multi-node drag handle) -->
        <div
          v-if="groupSelectionBox.visible"
          class="group-selection-box"
          :style="groupSelectionBox.style"
          @mousedown.prevent.stop="startGroupDrag($event)"
          title="Drag to move all selected nodes"
        >
          <div class="group-selection-label">
            {{ groupSelectionBox.nodeCount }} nodes selected - drag to move
          </div>
        </div>
      </div>
      <!-- Chat Resize Handle -->
      <div
        v-if="showAIChat"
        class="chat-resize-handle"
        @mousedown.prevent="startChatResize"
      ></div>

      <!-- AI Chat Panel -->
      <div
        v-if="showAIChat"
        class="chat-panel-container"
        :style="{ width: chatWidth + 'px' }"
      >
        <GrokChatPanel
          :graphData="graphDataForChat"
          :selection-context="aiChatSelectionContext"
          parent-context="canvas"
          @insert-fulltext="insertAIResponseAsFullText"
          @insert-html="insertAIResponseAsHtml"
          @insert-node="insertAIResponseAsNode"
          @insert-network="insertAIResponseAsNetwork"
          @insert-person-network="insertAIResponseAsPersonNetwork"
          @import-graph-as-cluster="handleImportGraphAsCluster"
        />
      </div>
    </div>

    <div class="floating-node-menu" v-if="canAddNodes">
      <div class="menu-header">
        <span>Nodes & Edges</span>
        <span class="menu-status" v-if="placementMode || edgeMode">
          {{ placementMode ? getPlacementModeLabel(placementMode) : edgeStartNode ? 'Select target node' : 'Select start node' }}
        </span>
      </div>
      <button
        class="btn btn-primary btn-sm"
        type="button"
        :class="{ active: placementMode === 'info' }"
        @click="startNodePlacement('info')"
      >
        ➕ Add Info Node
      </button>
      <button
        class="btn btn-primary btn-sm"
        type="button"
        :class="{ active: placementMode === 'fulltext' }"
        @click="startNodePlacement('fulltext')"
      >
        📝 Add Full Text Node
      </button>

      <!-- Case Study Node Types -->
      <div class="menu-subheader mt-2">📊 Case Study</div>
      <button
        class="btn btn-outline-success btn-sm"
        type="button"
        :class="{ active: placementMode === 'person-profile' }"
        @click="startNodePlacement('person-profile')"
        title="Add person profile from Proff data"
      >
        👤 Person Profile
      </button>
      <button
        class="btn btn-outline-success btn-sm"
        type="button"
        :class="{ active: placementMode === 'company-card' }"
        @click="startNodePlacement('company-card')"
        title="Add company card from Proff data"
      >
        🏢 Company Card
      </button>
      <button
        class="btn btn-outline-success btn-sm"
        type="button"
        :class="{ active: placementMode === 'network' }"
        @click="startNodePlacement('network')"
        title="Add network visualization node"
      >
        🕸️ Network Map
      </button>
      <button
        class="btn btn-outline-success btn-sm"
        type="button"
        :class="{ active: placementMode === 'news-feed' }"
        @click="startNodePlacement('news-feed')"
        title="Add news feed from sources"
      >
        📰 News Feed
      </button>

      <div class="menu-subheader mt-2">Audio</div>
      <button
        class="btn btn-outline-warning btn-sm"
        type="button"
        :class="{ active: placementMode === 'audio-visualizer' }"
        @click="startNodePlacement('audio-visualizer')"
        title="Add audio visualizer with waveform display"
      >
        🎵 Audio Visualizer
      </button>

      <div class="menu-subheader mt-2">Tools</div>
      <button
        class="btn btn-outline-primary btn-sm"
        type="button"
        :class="{ active: edgeMode }"
        @click="toggleEdgeMode"
      >
        {{ edgeMode ? 'Cancel Edge Mode' : '🔗 Create Edge' }}
      </button>
      <button
        class="btn btn-outline-success btn-sm"
        type="button"
        @click="createClusterFromSelected"
        :disabled="selectedCount < 2"
      >
        📦 Create Cluster
      </button>
      <button
        class="btn btn-outline-info btn-sm"
        type="button"
        @click="showImportGraphDialog"
      >
        🌐 Import Graph
      </button>
      <button
        class="btn btn-outline-secondary btn-sm"
        type="button"
        @click="toggleFontColor"
        :disabled="selectedCount === 0"
        title="Toggle font color between black and white"
      >
        🎨 Toggle Font Color
      </button>

      <!-- Shape Options -->
      <div v-if="selectedCount === 1" class="shape-options">
        <div class="menu-subheader">Shape</div>
        <div class="shape-buttons">
          <button
            class="btn btn-outline-secondary btn-sm shape-btn"
            type="button"
            @click="changeSelectedNodeShape('ellipse')"
            title="Circle"
          >⚫</button>
          <button
            class="btn btn-outline-secondary btn-sm shape-btn"
            type="button"
            @click="changeSelectedNodeShape('rectangle')"
            title="Square"
          >⬜</button>
          <button
            class="btn btn-outline-secondary btn-sm shape-btn"
            type="button"
            @click="changeSelectedNodeShape('round-rectangle')"
            title="Rounded Rectangle"
          >▭</button>
          <button
            class="btn btn-outline-secondary btn-sm shape-btn"
            type="button"
            @click="changeSelectedNodeShape('triangle')"
            title="Triangle"
          >▲</button>
          <button
            class="btn btn-outline-secondary btn-sm shape-btn"
            type="button"
            @click="changeSelectedNodeShape('diamond')"
            title="Diamond"
          >◆</button>
        </div>
      </div>

      <!-- Color Options -->
      <div v-if="selectedCount === 1" class="color-options">
        <div class="menu-subheader">Color</div>
        <div class="color-buttons">
          <button
            class="btn btn-sm color-btn"
            type="button"
            @click="changeSelectedNodeColor('#ADD8E6')"
            title="Light Blue"
            style="background-color: #ADD8E6;"
          ></button>
          <button
            class="btn btn-sm color-btn"
            type="button"
            @click="changeSelectedNodeColor('#90EE90')"
            title="Light Green"
            style="background-color: #90EE90;"
          ></button>
          <button
            class="btn btn-sm color-btn"
            type="button"
            @click="changeSelectedNodeColor('#FFB6C1')"
            title="Light Pink"
            style="background-color: #FFB6C1;"
          ></button>
          <button
            class="btn btn-sm color-btn"
            type="button"
            @click="changeSelectedNodeColor('#FFD700')"
            title="Gold"
            style="background-color: #FFD700;"
          ></button>
          <button
            class="btn btn-sm color-btn"
            type="button"
            @click="changeSelectedNodeColor('#FFA500')"
            title="Orange"
            style="background-color: #FFA500;"
          ></button>
          <button
            class="btn btn-sm color-btn"
            type="button"
            @click="changeSelectedNodeColor('#DDA0DD')"
            title="Plum"
            style="background-color: #DDA0DD;"
          ></button>
          <button
            class="btn btn-sm color-btn"
            type="button"
            @click="changeSelectedNodeColor('#F5F5DC')"
            title="Beige"
            style="background-color: #F5F5DC;"
          ></button>
          <button
            class="btn btn-sm color-btn"
            type="button"
            @click="changeSelectedNodeColor('#E0E0E0')"
            title="Light Gray"
            style="background-color: #E0E0E0;"
          ></button>
          <button
            class="btn btn-sm color-btn"
            type="button"
            @click="changeSelectedNodeColor('#FFFFFF')"
            title="White"
            style="background-color: #FFFFFF; border: 1px solid #ccc;"
          ></button>
          <button
            class="btn btn-sm color-btn"
            type="button"
            @click="changeSelectedNodeColor('#333333')"
            title="Dark Gray"
            style="background-color: #333333;"
          ></button>
        </div>
        <div class="color-picker-row">
          <input
            type="color"
            class="color-picker-input"
            @input="changeSelectedNodeColor($event.target.value)"
            title="Custom color"
          />
          <span class="color-picker-label">Custom</span>
        </div>
      </div>

      <button
        class="btn btn-link btn-sm"
        type="button"
        v-if="placementMode || edgeMode"
        @click="cancelInteractionModes"
      >
        Cancel Operation
      </button>
      <p class="menu-hint" v-if="placementMode">
        Click anywhere on the canvas to place the selected node type.
      </p>
      <p class="menu-hint" v-else-if="edgeMode && !edgeStartNode">
        Edge mode: select the start node.
      </p>
      <p class="menu-hint" v-else-if="edgeMode && edgeStartNode">
        Edge mode: select the target node.
      </p>
      <p class="menu-hint" v-else-if="selectedCount >= 2">
        Select 2+ nodes to group them in a cluster.
      </p>
      <p class="menu-hint" v-else>
        Tip: use these tools to add nodes or connect ideas.
      </p>

      <!-- Edge Info Editor -->
      <div v-if="selectedEdge" class="edge-info-editor">
        <div class="menu-subheader">🔗 Edge Info</div>
        <textarea
          v-model="edgeInfoText"
          class="edge-info-textarea"
          placeholder="Add description for this connection..."
          @input="updateEdgeInfo"
          rows="3"
        ></textarea>
        <button
          class="btn btn-outline-danger btn-sm mt-2"
          type="button"
          @click="deleteSelectedEdge"
        >
          🗑️ Delete Edge
        </button>
      </div>
    </div>

    <!-- Selection Info -->
    <div v-if="selectedCount > 0" class="selection-info">
      {{ selectedCount }} node{{ selectedCount > 1 ? 's' : '' }} selected
    </div>

    <!-- Context Menu -->
    <div
      v-if="contextMenu.show"
      class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @click.stop
    >
      <!-- Background Image -->
      <div class="context-menu-section">
        <div class="context-menu-header">Background</div>
        <div class="context-menu-item" @click="openImageSelectorForNode">
          <span class="context-menu-icon">🖼️</span>
          Set Background Image
        </div>
        <div v-if="hasBackgroundImage()" class="context-menu-item" @click="removeBackgroundImage">
          <span class="context-menu-icon">🚫</span>
          Remove Background
        </div>
      </div>

      <!-- Edit Node (not for clusters) -->
      <div v-if="!contextMenu.isCluster" class="context-menu-section">
        <div class="context-menu-header">Content</div>
        <div class="context-menu-item" @click="openInfoModal">
          <span class="context-menu-icon">📝</span>
          Edit Info
        </div>
        <div class="context-menu-item" @click="renameNode">
          <span class="context-menu-icon">✏️</span>
          Rename Node
        </div>
      </div>

      <!-- Font Size (only for info nodes) -->
      <div v-if="contextMenu.isInfoNode" class="context-menu-section">
        <div class="context-menu-header">Font Size</div>
        <div class="context-menu-font-sizes">
          <button
            v-for="size in fontSizeOptions"
            :key="size.value"
            class="font-size-btn"
            :class="{ active: contextMenu.currentFontSize === size.value }"
            @click="setInfoNodeFontSize(size.value)"
          >
            {{ size.label }}
          </button>
        </div>
      </div>

      <!-- Divider -->
      <div class="context-menu-divider"></div>

      <!-- Delete Options -->
      <div class="context-menu-item danger" @click="deleteContextNode">
        <span class="context-menu-icon">🗑️</span>
        {{ contextMenu.isImportedCluster ? 'Remove Imported Graph' : contextMenu.isCluster ? 'Delete Cluster' : 'Delete Node' }}
      </div>
      <div v-if="contextMenu.isCluster && !contextMenu.isImportedCluster" class="context-menu-item" @click="deleteClusterOnly">
        <span class="context-menu-icon">📦</span>
        Ungroup (Keep Children)
      </div>
    </div>

    <!-- Image Selector for Background Images -->
    <ImageSelector
      :is-open="isImageSelectorOpen"
      :current-image-url="currentImageData.url"
      :current-image-alt="currentImageData.alt"
      :image-type="currentImageData.type"
      :image-context="currentImageData.context"
      :node-content="currentImageData.nodeContent"
      @close="closeImageSelector"
      @image-replaced="handleBackgroundImageSelected"
    />

    <!-- Node Edit Modal (reusable component) -->
    <NodeEditModal
      :show="showInfoModal"
      :node="editingNodeData"
      :saving="savingNodeInfo"
      @close="closeInfoModal"
      @save="handleNodeSave"
    />

    <!-- YouTube Player Modal -->
    <div v-if="showYoutubeModal" class="youtube-modal-overlay">
      <div
        class="youtube-modal"
        :style="youtubeModalStyle"
        @click.stop
        @mousedown="bringYoutubeModalToFront"
      >
        <div class="modal-header youtube-modal-header" @mousedown.prevent="startYoutubeModalDrag">
          <h5>Play Video</h5>
          <button @click="closeYoutubeModal" class="btn-close">&times;</button>
        </div>
        <div class="modal-body">
          <GNewVideoNode
            v-if="youtubeModalNode"
            :node="youtubeModalNode"
            :isPreview="true"
            :showControls="false"
          />
        </div>
        <div
          class="youtube-modal-resize-handle"
          @mousedown.prevent.stop="startYoutubeModalResize"
          aria-label="Resize video modal"
          title="Resize"
        ></div>
      </div>
    </div>

    <!-- Grid Layout Dialog -->
    <div v-if="showGridDialog" class="graph-import-modal-overlay" @click="showGridDialog = false">
      <div class="graph-import-modal" @click.stop style="max-width: 400px;">
        <div class="modal-header">
          <h5>Grid Layout Settings</h5>
          <button class="btn-close" @click="showGridDialog = false"></button>
        </div>
        <div class="modal-body">
          <p class="text-muted mb-3">
            Arrange {{ cyInstance?.$('node:selected').length || 0 }} selected nodes in a grid
          </p>
          <div class="mb-3">
            <label class="form-label">Columns</label>
            <input
              v-model.number="gridSettings.cols"
              type="number"
              class="form-control"
              min="1"
              max="20"
              placeholder="Auto"
            />
            <small class="text-muted">Number of columns (leave 0 for auto)</small>
          </div>
          <div class="mb-3">
            <label class="form-label">Rows</label>
            <input
              v-model.number="gridSettings.rows"
              type="number"
              class="form-control"
              min="1"
              max="20"
              placeholder="Auto"
            />
            <small class="text-muted">Number of rows (leave 0 for auto)</small>
          </div>
          <div class="mb-3">
            <label class="form-label">Spacing: {{ gridSettings.spacing }}px</label>
            <input
              v-model.number="gridSettings.spacing"
              type="range"
              class="form-range"
              min="50"
              max="400"
              step="10"
            />
            <small class="text-muted">Distance between nodes</small>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showGridDialog = false">Cancel</button>
          <button class="btn btn-primary" @click="applyGridLayout">Apply Grid</button>
        </div>
      </div>
    </div>

    <!-- Graph Import Modal -->
    <div v-if="showImportModal" class="graph-import-modal-overlay" @click="closeImportModal">
      <div class="graph-import-modal" @click.stop>
        <div class="modal-header">
          <h5>Import Knowledge Graph</h5>
          <button class="btn-close" @click="closeImportModal"></button>
        </div>
        <div class="modal-body">
          <input
            v-model="importSearchQuery"
            type="text"
            class="form-control mb-3"
            placeholder="🔍 Search graphs..."
          />
          <div class="graph-grid">
            <div
              v-for="graph in filteredImportGraphs"
              :key="graph.id"
              class="graph-card"
              @click="importGraphAsCluster(graph.id, graph.title || graph.name || `Graph ${graph.id}`)"
            >
              <div class="graph-card-title">{{ graph.title || graph.name || `Graph ${graph.id}` }}</div>
              <div class="graph-card-meta">
                <span v-if="graph.metadata?.metaArea" class="badge bg-secondary">{{ graph.metadata.metaArea }}</span>
                <span class="text-muted small">{{ graph.metadata?.description || 'No description' }}</span>
              </div>
            </div>
          </div>
          <div v-if="filteredImportGraphs.length === 0" class="text-center text-muted p-4">
            No graphs available to import
          </div>
        </div>
      </div>
    </div>

    <!-- Teacher Assistant (Learning/Tutorial System) - Hidden until Gemini TTS billing propagates (24h) -->
    <!--
    <TeacherAssistant
      ref="teacherAssistant"
      current-view="GraphCanvas"
    />
    -->
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import { fetchChatSessionCount } from '@/composables/useChatSessions'
import cytoscape from 'cytoscape'
import undoRedo from 'cytoscape-undo-redo'
import ImageSelector from '@/components/ImageSelector.vue'
import GrokChatPanel from '@/components/GrokChatPanel.vue'
import GNewDefaultNode from '@/components/GNewNodes/GNewDefaultNode.vue'
import GNewVideoNode from '@/components/GNewNodes/GNewVideoNode.vue'
import GNewAudioVisualizerNode from '@/components/GNewNodes/GNewAudioVisualizerNode.vue'
import GNewGuideNode from '@/components/GNewNodes/GNewGuideNode.vue'
import GNewHtmlNode from '@/components/GNewNodes/GNewHtmlNode.vue'
import NodeEditModal from '@/components/NodeEditModal.vue'
// import TeacherAssistant from '@/components/TeacherAssistant.vue'  // Hidden until TTS billing propagates

// Initialize undo-redo plugin
if (!cytoscape.prototype.undoRedo) {
  undoRedo(cytoscape)
}

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const graphStore = useKnowledgeGraphStore()

const searchQuery = ref('')
const statusMessage = ref('')
const statusClass = ref('')
const selectedCount = ref(0)
const knowledgeGraphs = ref([])
const showImportModal = ref(false)
const importSearchQuery = ref('')
const currentGraphTitle = ref('')
const graphCanvasRoot = ref(null)
const isFullscreen = ref(false)
const showRichFulltext = ref(true)
const showRichYoutube = ref(true)
const showYoutubeModal = ref(false)
const youtubeModalNode = ref(null)
const youtubeModalState = ref({
  top: 80,
  left: 80,
  width: 960,
  height: 640,
  zIndex: 1200,
})
const isYoutubeModalDragging = ref(false)
const isYoutubeModalResizing = ref(false)
const youtubeModalDragStart = ref({ x: 0, y: 0, top: 0, left: 0 })
const youtubeModalResizeStart = ref({ x: 0, y: 0, width: 0, height: 0 })

// Grid layout dialog state
const showGridDialog = ref(false)
const gridSettings = ref({
  cols: 0, // 0 = auto
  rows: 0, // 0 = auto
  spacing: 150
})

// Canvas grid and snap settings
const showCanvasGrid = ref(false)
const snapToGrid = ref(false)
const canvasGridSize = ref(50) // Grid cell size in pixels

// AI Chat Panel state
const showAIChat = ref(false)
const chatWidth = ref(420)
const isResizingChat = ref(false)
let chatResizeStartX = 0
let chatResizeStartWidth = 0
const chatSelection = ref(null)

const placementMode = ref(null)
const edgeMode = ref(false)
const edgeStartNode = ref(null)

// Selected edge state
const selectedEdge = ref(null)
const edgeInfoText = ref('')

// Node resize state
const isResizingNode = ref(false)
const resizeDirection = ref(null)
const resizeStartPos = ref({ x: 0, y: 0 })
const resizeStartSize = ref({ width: 0, height: 0 })
const resizeStartNodePos = ref({ x: 0, y: 0 })
const resizeTargetNode = ref(null)
const resizeUpdateToken = ref(0)

// Node rotation state
const isRotatingNode = ref(false)
const rotationStartAngle = ref(0)
const rotationStartMouseAngle = ref(0)
const rotationTargetNode = ref(null)
const groupDragState = {
  active: false,
  anchorNodeId: null,
  startAnchorPos: null,
  startPositions: new Map(),
}

const bumpResizeUpdate = () => {
  resizeUpdateToken.value = (resizeUpdateToken.value + 1) % Number.MAX_SAFE_INTEGER
}

const handleWindowResize = () => {
  clampChatWidthToViewport()
  bumpResizeUpdate()
}

const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  node: null,
  isCluster: false,
  isImportedCluster: false,
  isInfoNode: false,
  currentFontSize: 14,
})

// Font size options for info nodes
const fontSizeOptions = [
  { label: 'S', value: 16 },
  { label: 'M', value: 24 },
  { label: 'L', value: 64 },
  { label: 'XL', value: 140 },
  { label: 'XXL', value: 240 },
]

// Clipboard for copy/paste nodes
const copiedNodeData = ref(null)

const isImageSelectorOpen = ref(false)
const targetNodeForImage = ref(null)
const currentImageData = ref({
  url: '',
  alt: '',
  type: 'node-background',
  context: 'Graph Canvas Node Background',
  nodeContent: '',
})
const showInfoModal = ref(false)
const editingNodeData = ref({})
const editingNode = ref(null)
const savingNodeInfo = ref(false)
const canAddNodes = computed(() => Boolean(graphStore.currentGraphId))
const filteredImportGraphs = computed(() => {
  if (!importSearchQuery.value.trim()) {
    return knowledgeGraphs.value.filter((g) => g.id !== graphStore.currentGraphId)
  }
  const query = importSearchQuery.value.toLowerCase()
  return knowledgeGraphs.value
    .filter((g) => g.id !== graphStore.currentGraphId)
    .filter(
      (g) =>
        (g.title && g.title.toLowerCase().includes(query)) ||
        (g.name && g.name.toLowerCase().includes(query)) ||
        (g.metadata?.metaArea && g.metadata.metaArea.toLowerCase().includes(query)) ||
        (g.metadata?.description && g.metadata.description.toLowerCase().includes(query))
    )
})

// AI Chat Panel - computed properties
const aiChatSelectionContext = computed(() => {
  if (!chatSelection.value?.text && !chatSelection.value?.selectedNodes?.length) return null
  return {
    text: chatSelection.value.text,
    nodeId: chatSelection.value.nodeId || null,
    nodeLabel: chatSelection.value.nodeLabel || null,
    nodeType: chatSelection.value.nodeType || null,
    nodeData: chatSelection.value.nodeData || null,
    selectedNodes: chatSelection.value.selectedNodes || [],
    source: 'graph-canvas',
    updatedAt: chatSelection.value.updatedAt,
  }
})

const graphDataForChat = computed(() => {
  if (!cyInstance.value) return { nodes: [], edges: [], metadata: { title: currentGraphTitle.value } }

  const nodes = cyInstance.value.nodes().map(n => ({
    id: n.id(),
    label: n.data('label'),
    info: n.data('info'),
    fullText: n.data('fullText'),
    type: n.data('type'),
    ...n.data()
  }))

  const edges = cyInstance.value.edges().map(e => ({
    id: e.id(),
    source: e.source().id(),
    target: e.target().id(),
    ...e.data()
  }))

  return { nodes, edges, metadata: { title: currentGraphTitle.value } }
})

// Resize handles computed - calculates position based on selected node
const computeHandleStyle = (node) => {
  if (!cyInstance.value?.container()) return null

  // renderedPosition() is already relative to the cytoscape container
  // Since our overlay is inside .canvas-container (same as #graph-canvas),
  // we use the position directly without viewport offset adjustments
  const renderedPos = node.renderedPosition()
  const width = node.renderedOuterWidth()
  const height = node.renderedOuterHeight()

  return {
    position: 'absolute',
    left: `${renderedPos.x - width / 2}px`,
    top: `${renderedPos.y - height / 2}px`,
    width: `${width}px`,
    height: `${height}px`,
    pointerEvents: 'auto',
  }
}

const resizeHandles = computed(() => {
  // Depend on selection count and explicit updates for reactivity
  selectedCount.value
  resizeUpdateToken.value
  if (!cyInstance.value || isResizingNode.value) {
    // Keep showing during resize
    if (isResizingNode.value && resizeTargetNode.value) {
      const node = resizeTargetNode.value
      const style = computeHandleStyle(node)
      if (!style) {
        return { visible: false, containerStyle: {} }
      }
      return {
        visible: true,
        containerStyle: { ...style, pointerEvents: 'none' },
      }
    }
    return { visible: false, containerStyle: {} }
  }

  const selectedNodes = cyInstance.value.nodes(':selected')
  if (selectedNodes.length !== 1) {
    return { visible: false, containerStyle: {} }
  }

  const node = selectedNodes.first()
  // Don't show resize handles for parent/cluster nodes
  if (node.isParent()) {
    return { visible: false, containerStyle: {} }
  }

  const style = computeHandleStyle(node)
  if (!style) {
    return { visible: false, containerStyle: {} }
  }

  return {
    visible: true,
    containerStyle: style,
  }
})

// Group selection bounding box for multi-node drag handle
const groupSelectionBox = computed(() => {
  selectedCount.value
  resizeUpdateToken.value
  if (!cyInstance.value || selectedCount.value < 2) {
    return { visible: false, style: {} }
  }

  const selectedNodes = cyInstance.value.nodes(':selected')
  if (selectedNodes.length < 2) {
    return { visible: false, style: {} }
  }

  // Get rendered bounding box of all selected nodes
  const bb = selectedNodes.renderedBoundingBox()
  if (!bb || bb.w === 0 || bb.h === 0) {
    return { visible: false, style: {} }
  }

  const padding = 10
  return {
    visible: true,
    style: {
      position: 'absolute',
      left: `${bb.x1 - padding}px`,
      top: `${bb.y1 - padding}px`,
      width: `${bb.w + padding * 2}px`,
      height: `${bb.h + padding * 2}px`,
    },
    nodeCount: selectedNodes.length
  }
})

// Canvas grid overlay style - creates a dynamic grid pattern based on zoom and pan
const gridOverlayStyle = computed(() => {
  // Depend on resizeUpdateToken to update when viewport changes
  resizeUpdateToken.value

  if (!cyInstance.value) {
    return {
      backgroundSize: `${canvasGridSize.value}px ${canvasGridSize.value}px`
    }
  }

  const zoom = cyInstance.value.zoom()
  const pan = cyInstance.value.pan()
  const size = canvasGridSize.value * zoom

  return {
    backgroundSize: `${size}px ${size}px`,
    backgroundPosition: `${pan.x}px ${pan.y}px`
  }
})

// Group drag state
const isGroupDragging = ref(false)
const groupDragStart = ref({ x: 0, y: 0 })
const groupNodeStartPositions = ref(new Map())

const startGroupDrag = (event) => {
  if (!cyInstance.value) return

  const selectedNodes = cyInstance.value.nodes(':selected')
  if (selectedNodes.length < 2) return

  isGroupDragging.value = true
  groupDragStart.value = { x: event.clientX, y: event.clientY }

  // Store starting positions of all selected nodes
  groupNodeStartPositions.value = new Map()
  selectedNodes.forEach(node => {
    groupNodeStartPositions.value.set(node.id(), { ...node.position() })
  })

  document.addEventListener('mousemove', onGroupDrag)
  document.addEventListener('mouseup', stopGroupDrag)
}

const onGroupDrag = (event) => {
  if (!isGroupDragging.value || !cyInstance.value) return

  const zoom = cyInstance.value.zoom()

  // Calculate delta in model coordinates
  const dx = (event.clientX - groupDragStart.value.x) / zoom
  const dy = (event.clientY - groupDragStart.value.y) / zoom

  // Move all selected nodes
  groupNodeStartPositions.value.forEach((startPos, nodeId) => {
    const node = cyInstance.value.$id(nodeId)
    if (!node.empty()) {
      node.position({
        x: startPos.x + dx,
        y: startPos.y + dy
      })
    }
  })

  bumpResizeUpdate()
}

const stopGroupDrag = () => {
  isGroupDragging.value = false
  groupNodeStartPositions.value = new Map()
  document.removeEventListener('mousemove', onGroupDrag)
  document.removeEventListener('mouseup', stopGroupDrag)
}

const getYoutubeNodeLabel = (ele) => {
  const label = ele.data('label') || ''
  const match = label.match(/!\[YOUTUBE src=.+?\](.+?)\[END YOUTUBE\]/)
  return match ? match[1] : label
}

const toggleRichFulltext = () => {
  showRichFulltext.value = !showRichFulltext.value
  updateFulltextNodeLabelStyle()
  bumpResizeUpdate()
}

const toggleRichYoutube = () => {
  showRichYoutube.value = !showRichYoutube.value
  updateYoutubeNodeLabelStyle()
  bumpResizeUpdate()
}

const updateFulltextNodeLabelStyle = () => {
  if (!cyInstance.value) return
  const labelValue = showRichFulltext.value
    ? ''
    : (ele) => `${ele.data('label') || ''}\n\n${ele.data('info') || ''}`
  cyInstance.value.style()
    .selector('node[type="fulltext"]')
    .style('label', labelValue)
    .update()
}

const updateYoutubeNodeLabelStyle = () => {
  if (!cyInstance.value) return
  const labelValue = showRichYoutube.value ? '' : getYoutubeNodeLabel
  cyInstance.value.style()
    .selector('node[type="youtube-video"]')
    .style('label', labelValue)
    .update()
}

const getOverlayStyle = (node) => {
  if (!cyInstance.value?.container()) return null
  const renderedPos = node.renderedPosition()
  const width = node.renderedOuterWidth()
  const height = node.renderedOuterHeight()
  return {
    position: 'absolute',
    left: `${renderedPos.x - width / 2}px`,
    top: `${renderedPos.y - height / 2}px`,
    width: `${width}px`,
    height: `${height}px`,
  }
}

const nodeHtmlOverlays = computed(() => {
  resizeUpdateToken.value
  if (!cyInstance.value) return []

  return cyInstance.value.nodes().reduce((overlays, node) => {
    const data = node.data()
    if (data.visible === false || node.isParent() || !node.visible()) return overlays
    const overlayStyle = getOverlayStyle(node)
    if (!overlayStyle) return overlays

    if (data.type === 'fulltext' && showRichFulltext.value) {
      const info =
        typeof data.info === 'string' && data.info.trim().length
          ? data.info
          : typeof data.fullText === 'string'
            ? data.fullText
            : ''
      overlays.push({
        id: node.id(),
        isSelected: node.selected(),
        style: overlayStyle,
        component: GNewDefaultNode,
        node: {
          ...data,
          id: node.id(),
          label: data.label || '',
          type: data.type || 'fulltext',
          info,
          imageAttributions: data.imageAttributions || {},
        },
      })
    }

    if (data.type === 'youtube-video' && showRichYoutube.value) {
      overlays.push({
        id: node.id(),
        isSelected: node.selected(),
        style: overlayStyle,
        component: GNewVideoNode,
        node: {
          ...data,
          id: node.id(),
          label: data.label || '',
          type: data.type || 'youtube-video',
        },
      })
    }

    if (data.type === 'audio-visualizer') {
      overlays.push({
        id: node.id(),
        isSelected: node.selected(),
        style: overlayStyle,
        component: GNewAudioVisualizerNode,
        node: {
          ...data,
          id: node.id(),
          label: data.label || '',
          type: data.type || 'audio-visualizer',
          audioUrl: data.audioUrl || data.path || '',
        },
      })
    }

    if (data.type === 'guide-node') {
      overlays.push({
        id: node.id(),
        isSelected: node.selected(),
        style: overlayStyle,
        component: GNewGuideNode,
        node: {
          ...data,
          id: node.id(),
          label: data.label || '',
          type: data.type || 'guide-node',
        },
      })
    }

    if (data.type === 'html-node') {
      overlays.push({
        id: node.id(),
        isSelected: node.selected(),
        style: overlayStyle,
        component: GNewHtmlNode,
        node: {
          ...data,
          id: node.id(),
          label: data.label || '',
          type: data.type || 'html-node',
          info: data.info || '',
        },
      })
    }

    return overlays
  }, [])
})

const youtubePlayButtons = computed(() => {
  resizeUpdateToken.value
  if (!cyInstance.value) return []

  const buttonSize = 28
  const inset = 8

  return cyInstance.value.nodes().reduce((buttons, node) => {
    const data = node.data()
    if (data.type !== 'youtube-video') return buttons
    if (data.visible === false || node.isParent() || !node.visible()) return buttons

    const renderedPos = node.renderedPosition()
    const width = node.renderedOuterWidth()
    const height = node.renderedOuterHeight()

    buttons.push({
      id: node.id(),
      style: {
        position: 'absolute',
        left: `${renderedPos.x + width / 2 - buttonSize - inset}px`,
        top: `${renderedPos.y - height / 2 + inset}px`,
        width: `${buttonSize}px`,
        height: `${buttonSize}px`,
      },
      node: {
        ...data,
        id: node.id(),
        label: data.label || '',
        type: data.type || 'youtube-video',
      },
    })

    return buttons
  }, [])
})

const youtubeModalStyle = computed(() => ({
  top: `${youtubeModalState.value.top}px`,
  left: `${youtubeModalState.value.left}px`,
  width: `${youtubeModalState.value.width}px`,
  height: `${youtubeModalState.value.height}px`,
  zIndex: youtubeModalState.value.zIndex,
}))

// Cytoscape instance
const cyInstance = ref(null)
const undoRedoInstance = ref(null)

const generateUUID = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })

// Helper function to parse markdown image syntax (from GraphAdmin)
const parseMarkdownImage = (markdown) => {
  const regex = /!\[.*?\|(.+?)\]\((.+?)\)/ // Match markdown image syntax
  const match = markdown.match(regex)

  if (match) {
    const styles = match[1].split(';').reduce((acc, style) => {
      const [key, value] = style.split(':').map((s) => s.trim())
      if (key && value) acc[key] = value
      return acc
    }, {})

    return { url: match[2], styles }
  }
  return null
}

// Computed
const hasSelection = computed(() => selectedCount.value > 0)

// Load available graphs
const loadGraphs = async () => {
  try {
    const response = await fetch('https://knowledge-graph-worker.torarnehave.workers.dev/getknowgraphs')
    if (response.ok) {
      const data = await response.json()
      console.log('Raw API response:', data)
      console.log('Data type:', typeof data)
      console.log('Is array:', Array.isArray(data))

      // Handle different response formats
      let graphs = []
      if (data.results && Array.isArray(data.results)) {
        graphs = data.results
      } else if (Array.isArray(data)) {
        graphs = data
      } else if (data && Array.isArray(data.graphs)) {
        graphs = data.graphs
      } else if (data && typeof data === 'object') {
        // If it's an object with graph data, try to extract graphs
        graphs = Object.values(data).filter((item) => item && typeof item === 'object' && item.id)
      } else {
        console.warn('Unexpected data format:', data)
        showStatus('Unexpected response format from server', 'warning')
        return
      }

      // Store all graphs without filtering by user
      knowledgeGraphs.value = graphs

      console.log('Total graphs loaded:', knowledgeGraphs.value.length)
      console.log('User email:', userStore.email)
      console.log('User role:', userStore.role)
      console.log('Current graph ID:', graphStore.currentGraphId)
      const availableForImport = knowledgeGraphs.value.filter((g) => g.id !== graphStore.currentGraphId)
      console.log('Available for import (excluding current):', availableForImport.length)
      showStatus(`Loaded ${knowledgeGraphs.value.length} graphs`, 'success')
    } else {
      console.error('Failed to fetch graphs. Status:', response.status)
      showStatus('Failed to load graphs from server', 'error')
    }
  } catch (error) {
    console.error('Error loading graphs:', error)
    showStatus('Error loading graphs: ' + error.message, 'error')
  }
}

// Load selected graph
const loadGraph = async () => {
  const currentGraphId = graphStore.currentGraphId
  if (!currentGraphId) return

  try {
    showStatus('Loading graph...', 'info')

    // Update URL to reflect current graph
    if (route.query.graphId !== currentGraphId) {
      router.replace({
        name: 'GraphCanvas',
        query: { graphId: currentGraphId },
      })
    }

    const response = await fetch(
      `https://knowledge.vegvisr.org/getknowgraph?id=${currentGraphId}`,
    )

    if (response.ok) {
      let graphData = await response.json()
      console.log('Raw graph data:', graphData)

      // Handle case where graph data is stored as JSON string
      if (typeof graphData === 'string') {
        try {
          graphData = JSON.parse(graphData)
        } catch (parseError) {
          console.error('Failed to parse graph JSON:', parseError)
          showStatus('Invalid JSON format in graph data', 'error')
          return
        }
      }

      console.log('Parsed graph data:', graphData)
      console.log('Has nodes:', !!graphData.nodes)
      console.log('Has edges:', !!graphData.edges)

      // Ensure we have nodes and edges arrays
      if (!graphData.nodes || !graphData.edges) {
        console.warn('Missing nodes or edges in graph data')
        // Initialize empty arrays if missing
        graphData.nodes = graphData.nodes || []
        graphData.edges = graphData.edges || []
        showStatus('Graph loaded with missing data - initialized empty arrays', 'warning')
      }

      initializeCytoscape(graphData)
      currentGraphTitle.value = graphData.metadata?.title || graphData.title || 'Untitled Graph'
      showStatus('Graph loaded successfully', 'success')
    } else {
      showStatus('Error loading graph', 'error')
    }
  } catch (error) {
    console.error('Error loading graph:', error)
    showStatus('Error loading graph', 'error')
  }
}

// Initialize Cytoscape
const initializeCytoscape = (graphData) => {
  const container = document.getElementById('graph-canvas')
  if (!container) {
    console.error('Canvas container not found')
    return
  }

  // Destroy existing instance
  if (cyInstance.value) {
    cyInstance.value.destroy()
  }

  resetInteractionModes()

  // Prepare elements
  const elements = [
    ...graphData.nodes.map((node) => ({
      data: { id: node.id, label: node.label, ...node },
      position: node.position || { x: Math.random() * 800, y: Math.random() * 600 },
    })),
    ...graphData.edges.map((edge) => ({
      data: { id: edge.id, source: edge.source, target: edge.target, ...edge },
    })),
  ]

  // Create Cytoscape instance
  cyInstance.value = cytoscape({
    container: container,
    elements: elements,
    style: [
      {
        selector: 'node',
        style: {
          display: 'element',
          label: (ele) =>
            ele.data('type') === 'info' ? ele.data('label') + ' ℹ️' : ele.data('label') || '',
          'background-color': (ele) => ele.data('color') || '#ccc',
          color: (ele) => ele.data('fontColor') || '#000',
          'text-valign': 'center',
          'text-halign': 'center',
        },
      },
      {
        selector: 'node[type="info"]',
        style: {
          shape: 'ellipse',
          width: (ele) => {
            const label = ele.data('label') || ''
            const info = ele.data('info') || ''
            const fontSize = ele.data('fontSize') || 14
            const totalLength = label.length + info.length
            // Scale size based on font size
            const baseSize = Math.max(150, Math.min(400, 150 + totalLength * 2))
            return baseSize * (fontSize / 14)
          },
          height: (ele) => {
            const label = ele.data('label') || ''
            const info = ele.data('info') || ''
            const fontSize = ele.data('fontSize') || 14
            const totalLength = label.length + info.length
            // Scale size based on font size
            const baseSize = Math.max(150, Math.min(400, 150 + totalLength * 2))
            return baseSize * (fontSize / 14)
          },
          'text-wrap': 'wrap',
          'text-max-width': (ele) => {
            const fontSize = ele.data('fontSize') || 14
            return (350 * (fontSize / 14)) + 'px'
          },
          'font-size': (ele) => (ele.data('fontSize') || 14) + 'px',
        },
      },
      {
        selector: 'node[type="person-profile"]',
        style: {
          shape: 'ellipse',
          'background-color': (ele) => ele.data('color') || '#9ca3af',
          width: (ele) => ele.data('width') || 60,
          height: (ele) => ele.data('height') || 60,
          'border-width': 2,
          'border-color': '#fff',
          label: 'data(label)',
          'text-wrap': 'wrap',
          'text-max-width': '100px',
          'text-valign': 'bottom',
          'text-halign': 'center',
          'font-size': '11px',
          'text-margin-y': 5,
        },
      },
      {
        selector: 'node[type="worknote"]',
        style: {
          shape: 'rectangle',
          'background-color': '#FFD580',
          'border-width': 2,
          'border-color': '#333',
          label: (ele) => `${ele.data('label')}\n\n${ele.data('info') || ''}`,
          'text-wrap': 'wrap',
          'text-max-width': '734px',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '14px',
          'font-weight': 'bold',
          width: '300px',
          height: (ele) => {
            const lineHeight = 30
            const padding = 20
            const labelLines = ele.data('label') ? ele.data('label').split('\n').length : 1
            const infoLines = ele.data('info') ? ele.data('info').split('\n').length : 0
            const totalLines = labelLines + infoLines + 2
            return Math.max(100, totalLines * lineHeight + padding)
          },
        },
      },
      {
        selector: 'node[type="markdown-image"]',
        style: {
          shape: 'rectangle',
          'background-image': (ele) => {
            const parsed = parseMarkdownImage(ele.data('label'))
            return parsed ? parsed.url : ''
          },
          'background-fit': 'cover',
          'background-opacity': 1,
          'border-width': 0,
          width: (ele) => ele.data('imageWidth') || '100%',
          height: (ele) => ele.data('imageHeight') || '100%',
          'z-index': -1,
          label: '',
        },
      },
      {
        selector: 'node[type="fulltext"]',
        style: {
          shape: 'round-rectangle',
          'background-color': (ele) => ele.data('color') || '#ede8e8',
          'border-width': 4,
          'border-color': '#555',
          label: showRichFulltext.value
            ? ''
            : (ele) => `${ele.data('label') || ''}\n\n${ele.data('info') || ''}`,
          'text-wrap': 'wrap',
          'text-max-width': '734px',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '16px',
          padding: '10px',
          width: '794px',
          height: '1122pt',
        },
      },
      {
        selector: 'node[type="title"]',
        style: {
          shape: 'rectangle',
          'background-opacity': 0,
          'border-width': 1,
          'border-color': '#ccc',
          'padding-left': '15px',
          'padding-right': '10px',
          'padding-top': '5px',
          'padding-bottom': '5px',
          label: (ele) => ele.data('label') || '',
          'font-size': '24px',
          'font-weight': 'bold',
          color: 'black',
          'text-valign': 'center',
          'text-halign': 'center',
          width: 200,
          height: 50,
        },
      },
      {
        selector: 'node[type="youtube-video"]',
        style: {
          shape: 'rectangle',
          'background-color': '#FF0000',
          'border-width': 1,
          'border-color': '#000',
          label: showRichYoutube.value ? '' : getYoutubeNodeLabel,
          'text-wrap': 'wrap',
          'text-max-width': '180px',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '14px',
          width: '200px',
          height: '112px',
        },
      },
      {
        selector: 'node[type="audio-visualizer"]',
        style: {
          shape: 'round-rectangle',
          'background-color': '#2c3e50',
          'border-width': 2,
          'border-color': '#3498db',
          label: '',
          'text-wrap': 'wrap',
          'text-valign': 'center',
          'text-halign': 'center',
          padding: '10px',
          width: '1122px',
          height: '794px',
        },
      },
      {
        selector: 'node[type="background"]',
        style: {
          shape: 'rectangle',
          'background-image': (ele) => ele.data('label'),
          'background-fit': 'cover',
          'background-opacity': 1,
          'border-width': 0,
          width: (ele) => ele.data('imageWidth') || '100%',
          height: (ele) => ele.data('imageHeight') || '100%',
          label: 'data(label)',
          'text-valign': 'bottom',
          'text-halign': 'center',
          'font-size': '0px',
          color: '#000',
          'background-image-crossorigin': 'anonymous',
        },
      },
      {
        selector: 'node[type="map"]',
        style: {
          shape: 'rectangle',
          'background-color': '#FFD580',
          'border-width': 2,
          'border-color': '#333',
          label: (ele) => `${ele.data('label')}\n\n${ele.data('info') || ''}`,
          'text-wrap': 'wrap',
          'text-max-width': '734px',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '14px',
          'font-weight': 'bold',
          width: '300px',
          height: (ele) => {
            const lineHeight = 30
            const padding = 20
            const labelLines = ele.data('label') ? ele.data('label').split('\n').length : 1
            const infoLines = ele.data('info') ? ele.data('info').split('\n').length : 0
            const totalLines = labelLines + infoLines + 2
            return Math.max(100, totalLines * lineHeight + padding)
          },
        },
      },
      {
        selector: 'node[type="app-viewer"]',
        style: {
          shape: 'rectangle',
          'background-color': (ele) => ele.data('path') ? 'transparent' : '#11998e',
          'background-image': (ele) => ele.data('path') || null,
          'background-fit': 'cover',
          'background-opacity': 1,
          'border-width': 3,
          'border-color': '#11998e',
          label: 'data(label)',
          'text-valign': 'bottom',
          'text-halign': 'center',
          'text-background-color': 'rgba(17, 153, 142, 0.9)',
          'text-background-opacity': 1,
          'text-background-padding': '4px',
          'font-size': '14px',
          'font-weight': 'bold',
          color: '#fff',
          'text-wrap': 'wrap',
          'text-max-width': '180px',
          width: '200px',
          height: '150px',
          'background-image-crossorigin': 'anonymous',
        },
      },
      {
        selector: 'node[type="guide-node"]',
        style: {
          shape: 'round-rectangle',
          'background-color': '#0f766e',
          'border-width': 3,
          'border-color': '#0f766e',
          label: 'data(label)',
          'text-valign': 'bottom',
          'text-halign': 'center',
          'text-background-color': 'rgba(15, 118, 110, 0.9)',
          'text-background-opacity': 1,
          'text-background-padding': '4px',
          'font-size': '13px',
          'font-weight': 'bold',
          color: '#fff',
          'text-wrap': 'wrap',
          'text-max-width': '220px',
          width: '720px',
          height: '420px',
        },
      },
      {
        selector: 'edge',
        style: {
          label: (ele) => (ele.data('type') === 'info' ? 'ℹ️' : ''),
          width: 2,
          'line-color': '#999',
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#999',
          'curve-style': 'unbundled-bezier',
          'control-point-distances': [50, -50],
          'control-point-weights': [0.3, 0.7],
          'edge-distances': 'intersection',
        },
      },
      {
        selector: '.highlighted',
        style: {
          'border-width': 4,
          'border-color': 'yellow',
        },
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 4,
          'border-color': '#FF9800',
        },
      },
      {
        selector: 'edge:selected',
        style: {
          'line-color': '#FF9800',
          'target-arrow-color': '#FF9800',
          width: 4,
        },
      },
      {
        selector: ':parent',
        style: {
          'background-opacity': 0.2,
          'background-color': (ele) => ele.data('sourceGraphId') ? '#E8F5E9' : '#E3F2FD',
          'background-image': 'none',
          'border-width': 3,
          'border-color': (ele) => ele.data('sourceGraphId') ? '#2DA44E' : '#0969DA',
          'border-style': 'dashed',
          'text-valign': 'top',
          'text-halign': 'center',
          'font-weight': 'bold',
          'font-size': '16px',
          'padding': '20px',
          label: (ele) => {
            const collapsed = ele.data('collapsed')
            const childCount = ele.children().length
            const label = ele.data('label') || 'Cluster'
            const isImported = ele.data('sourceGraphId') ? ' 🌐' : ''
            return collapsed ? `${label} [${childCount}]${isImported}` : `${label}${isImported}`
          },
        },
      },
      {
        selector: ':parent[collapsed]',
        style: {
          'background-color': (ele) => ele.data('path') ? 'transparent' : (ele.data('sourceGraphId') ? '#2DA44E' : '#0969DA'),
          'background-opacity': (ele) => ele.data('path') ? 1 : 0.4,
          'border-style': 'solid',
          width: '400px',
          height: '400px',
        },
      },
      {
        selector: ':parent[collapsed][path]',
        style: {
          'background-image': 'data(path)',
          'background-fit': 'cover',
        },
      },
    ],
    layout: {
      name: 'preset',
    },
    // Interaction options
    userZoomingEnabled: true,
    userPanningEnabled: true,
    boxSelectionEnabled: true,
    selectionType: 'additive',
    // Fine-tuned zoom settings
    wheelSensitivity: 0.1, // Reduce wheel sensitivity for finer control (default is 1)
    minZoom: 0.02, // Minimum zoom level (2%) - allows zooming out much further
    maxZoom: 10, // Maximum zoom level (1000%)
    zoomingEnabled: true,
    // Pan settings
    panningEnabled: true,
  })

  // Initialize undo-redo
  undoRedoInstance.value = cyInstance.value.undoRedo({
    isDebug: false,
    actions: {},
    undoableDrag: true,
    stackSizeLimit: 50,
  })

  // Event listeners
  setupEventListeners()
  updateCanvasInteractionState()

  // Apply collapsed state to clusters
  cyInstance.value.nodes().forEach((node) => {
    if (node.isParent() && node.data('collapsed')) {
      node.children().style('display', 'none')
    }
  })

  // Apply custom shapes and background images from node data
  cyInstance.value.nodes().forEach((node) => {
    // Apply custom shape if stored
    if (node.data('customShape')) {
      node.style('shape', node.data('customShape'))
    }

    // Apply background image if stored (using 'path' property)
    // Only apply to collapsed clusters or non-cluster nodes
    if (node.data('path')) {
      const isCluster = node.isParent()
      const isCollapsed = node.data('collapsed')

      // Only apply inline styles for non-clusters or collapsed clusters
      if (!isCluster || isCollapsed) {
        node.style({
          'background-image': node.data('path'),
          'background-fit': 'cover',
          'background-opacity': 1,
        })
      }
      // For expanded clusters with path, CSS selectors will handle hiding the image
    }

    // Apply custom font color if stored
    if (node.data('fontColor')) {
      node.style('color', node.data('fontColor'))
    }

    // Apply custom size if stored (from resize operations)
    if (node.data('customWidth') || node.data('customHeight')) {
      const styleUpdate = {}
      if (node.data('customWidth')) {
        styleUpdate.width = node.data('customWidth')
      }
      if (node.data('customHeight')) {
        styleUpdate.height = node.data('customHeight')
      }
      node.style(styleUpdate)
    }

    // Apply rotation if stored
    if (node.data('rotation')) {
      const rotation = node.data('rotation')
      const bgImage = node.style('background-image')
      if (bgImage && bgImage !== 'none') {
        node.style('background-image-rotation', rotation)
      }
      node.style('text-rotation', rotation)
    }
  })

  // Fit to view
  cyInstance.value.fit()

  updateFulltextNodeLabelStyle()
  updateYoutubeNodeLabelStyle()
}

const handleCanvasTap = async (event) => {
  if (!cyInstance.value) return

  // Check if clicked on background (not a node or edge)
  const isBackgroundClick = !event.target.isNode || !event.target.isNode()

  if (placementMode.value && isBackgroundClick) {
    console.log('Background clicked in placement mode, adding node at:', event.position)
    await addNodeAtPosition(placementMode.value, event.position)
    // Don't reset interaction modes - keep placement mode active
    return
  }

  if (edgeMode.value && event.target?.isNode?.()) {
    console.log('Node clicked in edge mode:', event.target.id())
    await handleEdgeNodeSelection(event.target)
  }
}

// Setup event listeners
const setupEventListeners = () => {
  if (!cyInstance.value) return

  // Selection tracking
  cyInstance.value.on('select unselect', () => {
    selectedCount.value = cyInstance.value.$(':selected').length
    bumpResizeUpdate()
  })

  // AI Chat - Update selection context when node is selected/unselected
  cyInstance.value.on('select', 'node', () => {
    updateChatSelectionFromNode()
    bumpResizeUpdate()
  })

  cyInstance.value.on('unselect', 'node', () => {
    updateChatSelectionFromNode()
    bumpResizeUpdate()
  })

  // Edge selection - show edge info editor
  cyInstance.value.on('select', 'edge', (event) => {
    const edge = event.target
    selectedEdge.value = edge
    edgeInfoText.value = edge.data('info') || ''
    bumpResizeUpdate()
  })

  cyInstance.value.on('unselect', 'edge', () => {
    if (cyInstance.value.edges(':selected').length === 0) {
      selectedEdge.value = null
      edgeInfoText.value = ''
    }
    bumpResizeUpdate()
  })

  // Update resize handles on viewport changes (pan, zoom, drag)
  cyInstance.value.on('viewport pan zoom drag position', () => {
    bumpResizeUpdate()
  })

  // Drag all selected nodes together.
  cyInstance.value.on('grab', 'node', (event) => {
    if (isResizingNode.value || isRotatingNode.value) return
    const selectedNodes = cyInstance.value.$('node:selected')
    if (selectedNodes.length < 2) return
    const anchor = event.target
    if (!anchor.selected()) return

    groupDragState.active = true
    groupDragState.anchorNodeId = anchor.id()
    groupDragState.startAnchorPos = { ...anchor.position() }
    groupDragState.startPositions = new Map()

    selectedNodes.forEach((node) => {
      groupDragState.startPositions.set(node.id(), { ...node.position() })
    })
  })

  cyInstance.value.on('drag', 'node', (event) => {
    if (!groupDragState.active) return
    const anchor = event.target
    if (anchor.id() !== groupDragState.anchorNodeId) return

    const dx = anchor.position('x') - groupDragState.startAnchorPos.x
    const dy = anchor.position('y') - groupDragState.startAnchorPos.y

    groupDragState.startPositions.forEach((pos, nodeId) => {
      if (nodeId === anchor.id()) return
      const node = cyInstance.value.$id(nodeId)
      if (node.empty()) return
      node.position({ x: pos.x + dx, y: pos.y + dy })
    })
  })

  cyInstance.value.on('dragfree', 'node', (event) => {
    // Handle group drag cleanup
    if (groupDragState.active) {
      groupDragState.active = false
      groupDragState.anchorNodeId = null
      groupDragState.startAnchorPos = null
      groupDragState.startPositions = new Map()
    }

    // Snap to grid if enabled
    if (snapToGrid.value) {
      const node = event.target
      const pos = node.position()
      const gridSize = canvasGridSize.value

      // Snap position to nearest grid point
      const snappedX = Math.round(pos.x / gridSize) * gridSize
      const snappedY = Math.round(pos.y / gridSize) * gridSize

      node.position({ x: snappedX, y: snappedY })

      // Also snap any other selected nodes
      const selectedNodes = cyInstance.value.$('node:selected')
      if (selectedNodes.length > 1) {
        selectedNodes.forEach((n) => {
          if (n.id() !== node.id()) {
            const p = n.position()
            n.position({
              x: Math.round(p.x / gridSize) * gridSize,
              y: Math.round(p.y / gridSize) * gridSize
            })
          }
        })
      }

      bumpResizeUpdate()
    }
  })

  cyInstance.value.on('style', 'node', () => {
    bumpResizeUpdate()
  })

  cyInstance.value.on('data', 'node', () => {
    bumpResizeUpdate()
  })

  cyInstance.value.on('add remove', () => {
    bumpResizeUpdate()
  })

  // Close context menu on canvas click (but not immediately after opening)
  let contextMenuJustOpened = false

  cyInstance.value.on('tap', (event) => {
    // If menu was just opened, don't close it
    if (contextMenuJustOpened) {
      return
    }

    // Handle regular tap behavior
    handleCanvasTap(event)

    // Close context menu if open
    if (contextMenu.value.show) {
      contextMenu.value.show = false
    }
  })

  // Right-click context menu (works with right-click, Ctrl+click on Mac, or long-press)
  cyInstance.value.on('cxttap', 'node', (event) => {
    event.originalEvent.preventDefault()
    event.originalEvent.stopPropagation()
    console.log('Context menu triggered on node:', event.target.data('label'))
    const node = event.target

    // Select the node on right-click (standard UX behavior)
    cyInstance.value.nodes().unselect()
    node.select()

    // Get viewport coordinates from the original event for position: fixed menu
    const clientX = event.originalEvent.clientX ?? event.originalEvent.touches?.[0]?.clientX ?? 0
    const clientY = event.originalEvent.clientY ?? event.originalEvent.touches?.[0]?.clientY ?? 0

    // Set flag to prevent tap handler from closing menu
    contextMenuJustOpened = true

    // Show context menu immediately at cursor position
    const nodeType = node.data('type')
    const isInfoNode = nodeType === 'info'
    console.log('Node type:', nodeType, 'isInfoNode:', isInfoNode, 'fontSize:', node.data('fontSize'))
    contextMenu.value = {
      show: true,
      x: clientX,
      y: clientY,
      node: node,
      isCluster: node.isParent(),
      isImportedCluster: node.isParent() && Boolean(node.data('sourceGraphId')),
      isInfoNode: isInfoNode,
      currentFontSize: isInfoNode ? (node.data('fontSize') || 14) : 14,
    }
    console.log('Context menu opened at:', clientX, clientY, 'isInfoNode:', isInfoNode)

    // Clear flag after a delay to ensure menu stays open
    setTimeout(() => {
      contextMenuJustOpened = false
    }, 200)
  })

  // Also handle context menu via standard browser event as fallback
  const canvas = document.getElementById('graph-canvas')
  if (canvas) {
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      e.stopPropagation()

      // Find the node at the click position using Cytoscape's API
      const containerRect = cyInstance.value.container().getBoundingClientRect()
      const renderedX = e.clientX - containerRect.left
      const renderedY = e.clientY - containerRect.top

      // Get node at rendered position
      const nodesAtPoint = cyInstance.value.nodes().filter(node => {
        const bbox = node.renderedBoundingBox()
        return renderedX >= bbox.x1 && renderedX <= bbox.x2 &&
               renderedY >= bbox.y1 && renderedY <= bbox.y2
      })

      if (nodesAtPoint.length > 0) {
        const node = nodesAtPoint.first()

        // Select the node
        cyInstance.value.nodes().unselect()
        node.select()

        contextMenuJustOpened = true

        const nodeType = node.data('type')
        const isInfoNode = nodeType === 'info'
        contextMenu.value = {
          show: true,
          x: e.clientX,
          y: e.clientY,
          node: node,
          isCluster: node.isParent(),
          isImportedCluster: node.isParent() && Boolean(node.data('sourceGraphId')),
          isInfoNode: isInfoNode,
          currentFontSize: isInfoNode ? (node.data('fontSize') || 14) : 14,
        }
        console.log('Context menu opened via browser contextmenu event at:', e.clientX, e.clientY)

        setTimeout(() => {
          contextMenuJustOpened = false
        }, 200)
      }
    })
  }

  // Double-click on parent nodes to toggle collapse/expand
  cyInstance.value.on('dblclick', 'node', (event) => {
    event.originalEvent.preventDefault()
    event.originalEvent.stopPropagation()

    const node = event.target

    // Check if it's a parent/cluster node
    if (node.isParent()) {
      toggleClusterCollapse(node)
    }
    // For regular nodes, the dbltap handler will open the info modal
  })

  // Delete key to remove selected elements
  document.addEventListener('keydown', handleKeyDown)
}

// Handle keyboard shortcuts
const handleKeyDown = (event) => {
  if (!cyInstance.value) return

  // Ignore keyboard shortcuts if user is typing in an input field
  const activeElement = document.activeElement
  if (activeElement && (
    activeElement.tagName === 'INPUT' ||
    activeElement.tagName === 'TEXTAREA' ||
    activeElement.isContentEditable
  )) {
    return
  }

  switch (event.key) {
    case 'z':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        undoAction()
      }
      break
    case 'y':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        redoAction()
      }
      break
    case 'c':
      if (event.ctrlKey || event.metaKey) {
        copySelectedNode()
      }
      break
    case 'v':
      if (event.ctrlKey || event.metaKey) {
        pasteNode()
      }
      break
    case 'Escape':
      if (placementMode.value || edgeMode.value) {
        cancelInteractionModes()
      }
      break
  }
}

// Copy selected node to clipboard
const copySelectedNode = () => {
  if (!cyInstance.value) return

  const selectedNodes = cyInstance.value.$('node:selected')
  if (selectedNodes.length === 0) {
    showStatus('No node selected to copy', 'warning')
    return
  }

  // Copy the first selected node
  const node = selectedNodes[0]
  const nodeData = node.data()
  const position = node.position()

  // Capture computed styles (width, height, shape, etc.)
  const computedStyles = {
    width: node.style('width'),
    height: node.style('height'),
    shape: node.style('shape'),
  }

  copiedNodeData.value = {
    ...nodeData,
    position: { ...position },
    _computedStyles: computedStyles
  }

  showStatus(`Copied node: ${nodeData.label || nodeData.id}`, 'success')
}

// Paste copied node at offset position
const pasteNode = async () => {
  if (!cyInstance.value || !copiedNodeData.value) {
    showStatus('Nothing to paste', 'warning')
    return
  }

  const newId = generateUUID()
  const offset = 50 // Offset from original position

  // Extract computed styles before creating new data
  const computedStyles = copiedNodeData.value._computedStyles

  const newNodeData = {
    ...copiedNodeData.value,
    id: newId,
  }
  delete newNodeData.position // Remove position from data
  delete newNodeData._computedStyles // Remove computed styles from data

  const newPosition = {
    x: copiedNodeData.value.position.x + offset,
    y: copiedNodeData.value.position.y + offset,
  }

  try {
    const newNode = cyInstance.value.add({
      group: 'nodes',
      data: newNodeData,
      position: newPosition,
    })

    // Apply the computed styles to preserve size and shape
    if (computedStyles) {
      newNode.style({
        'width': computedStyles.width,
        'height': computedStyles.height,
        'shape': computedStyles.shape,
      })
    }

    // Select the new node
    cyInstance.value.$('node:selected').unselect()
    cyInstance.value.$(`#${newId}`).select()

    // Update copied position for next paste
    copiedNodeData.value.position = newPosition

    showStatus('Saving pasted node...', 'info')
    await saveGraph()
    showStatus('Node pasted successfully', 'success')
  } catch (error) {
    console.error('Failed to paste node:', error)
    showStatus('Unable to paste node. Please try again.', 'error')
    const created = cyInstance.value.$(`#${newId}`)
    if (created) {
      created.remove()
    }
  }
}

// Alignment functions
const alignSelectedNodes = (alignmentType) => {
  if (!cyInstance.value) return

  const selectedNodes = cyInstance.value.$('node:selected')
  if (selectedNodes.length === 0) {
    showStatus('No nodes selected for alignment', 'warning')
    return
  }

  const positions = selectedNodes.map((node) => node.position())

  if (alignmentType === 'horizontal') {
    const avgY = positions.reduce((sum, pos) => sum + pos.y, 0) / positions.length
    selectedNodes.forEach((node) => {
      node.position({ x: node.position('x'), y: avgY })
    })
  } else if (alignmentType === 'vertical') {
    const avgX = positions.reduce((sum, pos) => sum + pos.x, 0) / positions.length
    selectedNodes.forEach((node) => {
      node.position({ x: avgX, y: node.position('y') })
    })
  } else if (alignmentType === 'center') {
    const avgX = positions.reduce((sum, pos) => sum + pos.x, 0) / positions.length
    const avgY = positions.reduce((sum, pos) => sum + pos.y, 0) / positions.length
    selectedNodes.forEach((node) => {
      node.position({ x: avgX, y: avgY })
    })
  }

  showStatus(`Aligned ${selectedNodes.length} nodes ${alignmentType}`, 'success')
}

// Spacing functions
const spreadSelectedNodes = (axis) => {
  if (!cyInstance.value) return

  const selectedNodes = cyInstance.value.$('node:selected')
  if (selectedNodes.length < 2) {
    showStatus('Select at least 2 nodes for spreading', 'warning')
    return
  }

  const sortedNodes = selectedNodes.sort((a, b) =>
    axis === 'horizontal' ? a.position('x') - b.position('x') : a.position('y') - b.position('y'),
  )

  const minPos = sortedNodes[0].position(axis === 'horizontal' ? 'x' : 'y')
  const maxPos = sortedNodes[sortedNodes.length - 1].position(axis === 'horizontal' ? 'x' : 'y')
  const spacing = (maxPos - minPos) / (sortedNodes.length - 1)

  sortedNodes.forEach((node, index) => {
    const newPos = minPos + index * spacing
    if (axis === 'horizontal') {
      node.position({ x: newPos, y: node.position('y') })
    } else {
      node.position({ x: node.position('x'), y: newPos })
    }
  })

  showStatus(`Spread ${selectedNodes.length} nodes ${axis}`, 'success')
}

// Grid layout for selected nodes - opens dialog to configure
const openGridLayoutDialog = () => {
  if (!cyInstance.value) return

  const selectedNodes = cyInstance.value.$('node:selected')
  if (selectedNodes.length < 2) {
    showStatus('Select at least 2 nodes for grid layout', 'warning')
    return
  }

  // Calculate suggested cols based on node count
  const nodeCount = selectedNodes.length
  const suggestedCols = Math.ceil(Math.sqrt(nodeCount))
  gridSettings.value.cols = suggestedCols
  gridSettings.value.rows = Math.ceil(nodeCount / suggestedCols)

  showGridDialog.value = true
}

// Apply grid layout with current settings - preserves spatial order and considers node sizes
const applyGridLayout = () => {
  if (!cyInstance.value) return

  const selectedNodes = cyInstance.value.$('node:selected')
  if (selectedNodes.length < 2) return

  const gapSpacing = gridSettings.value.spacing || 150 // Gap between nodes
  const cols = gridSettings.value.cols || Math.ceil(Math.sqrt(selectedNodes.length))
  const rows = gridSettings.value.rows || Math.ceil(selectedNodes.length / cols)

  // Get the bounding box of selected nodes to position grid in same area
  const boundingBox = selectedNodes.boundingBox()
  const startX = boundingBox.x1
  const startY = boundingBox.y1

  // Convert to array and sort by position (top-to-bottom, left-to-right)
  const nodesArray = selectedNodes.toArray()

  // Sort nodes: first by approximate row (Y position), then by X position within row
  const rowHeight = (boundingBox.y2 - boundingBox.y1) / Math.max(1, rows)

  nodesArray.sort((a, b) => {
    const posA = a.position()
    const posB = b.position()

    const rowA = Math.floor((posA.y - boundingBox.y1) / rowHeight)
    const rowB = Math.floor((posB.y - boundingBox.y1) / rowHeight)

    if (rowA !== rowB) {
      return rowA - rowB
    }
    return posA.x - posB.x
  })

  // Calculate max width for each column and max height for each row
  const colWidths = new Array(cols).fill(0)
  const rowHeights = new Array(rows).fill(0)

  nodesArray.forEach((node, index) => {
    const row = Math.floor(index / cols)
    const col = index % cols
    const bb = node.boundingBox()
    const nodeWidth = bb.w
    const nodeHeight = bb.h

    colWidths[col] = Math.max(colWidths[col], nodeWidth)
    rowHeights[row] = Math.max(rowHeights[row], nodeHeight)
  })

  // Calculate cumulative positions for columns and rows
  const colPositions = [0]
  for (let i = 0; i < cols - 1; i++) {
    colPositions.push(colPositions[i] + colWidths[i] + gapSpacing)
  }

  const rowPositions = [0]
  for (let i = 0; i < rows - 1; i++) {
    rowPositions.push(rowPositions[i] + rowHeights[i] + gapSpacing)
  }

  // Position each node in the grid, centered within its cell
  nodesArray.forEach((node, index) => {
    const row = Math.floor(index / cols)
    const col = index % cols

    // Center node within its cell
    const newX = startX + colPositions[col] + colWidths[col] / 2
    const newY = startY + rowPositions[row] + rowHeights[row] / 2

    node.animate({
      position: { x: newX, y: newY },
      duration: 300,
      easing: 'ease-in-out'
    })
  })

  showGridDialog.value = false
  showStatus(`Arranged ${selectedNodes.length} nodes in ${rows}x${cols} grid`, 'success')
}

// View controls
const centerAndZoom = () => {
  if (!cyInstance.value) return
  cyInstance.value.fit()
  showStatus('Centered and fitted to view', 'success')
}

// Delete selected elements
const deleteSelected = () => {
  if (!cyInstance.value) return

  const selected = cyInstance.value.$(':selected')
  if (selected.length === 0) {
    showStatus('No elements selected for deletion', 'warning')
    return
  }

  if (confirm(`Delete ${selected.length} selected element(s)?`)) {
    selected.remove()
    selectedCount.value = 0
    showStatus(`Deleted ${selected.length} element(s)`, 'success')
  }
}

const deleteContextNode = async () => {
  const node = contextMenu.value.node
  if (!node) return

  const isImportedCluster = contextMenu.value.isImportedCluster
  const isCluster = contextMenu.value.isCluster
  const nodeName = node.data('label') || 'this item'

  contextMenu.value.show = false

  if (isImportedCluster) {
    // Just remove from canvas - original graph remains intact
    if (confirm(`Remove imported graph "${nodeName}" from canvas?\n\nThe original graph will remain intact.`)) {
      node.remove()
      await saveGraph()
      showStatus(`Removed imported graph "${nodeName}"`, 'success')
    }
  } else if (isCluster) {
    // Delete cluster and all children
    const childCount = node.children().length
    if (confirm(`Delete cluster "${nodeName}" and ${childCount} children?`)) {
      node.remove()
      await saveGraph()
      showStatus(`Deleted cluster "${nodeName}" with ${childCount} nodes`, 'success')
    }
  } else {
    // Regular node deletion
    if (confirm(`Delete node "${nodeName}"?`)) {
      node.remove()
      await saveGraph()
      showStatus(`Deleted node "${nodeName}"`, 'success')
    }
  }
}

const deleteClusterOnly = async () => {
  const node = contextMenu.value.node
  if (!node || !node.isParent()) return

  const nodeName = node.data('label') || 'cluster'
  contextMenu.value.show = false

  if (confirm(`Ungroup "${nodeName}"?\n\nChildren will be moved to root level.`)) {
    const children = node.children()

    // Move children to root (remove parent reference)
    children.forEach((child) => {
      child.move({ parent: null })
    })

    // Delete the cluster node itself
    node.remove()

    await saveGraph()
    showStatus(`Ungrouped "${nodeName}" - ${children.length} nodes moved to root`, 'success')
  }
}

// Node styling functions
const changeNodeShape = async (shape) => {
  const node = contextMenu.value.node
  if (!node) return

  contextMenu.value.show = false

  // Update node style
  node.style('shape', shape)

  // Store shape in node data for persistence
  node.data('customShape', shape)

  await saveGraph()
  showStatus(`Changed node shape to ${shape}`, 'success')
}

// Change shape for currently selected node (from floating menu)
const changeSelectedNodeShape = async (shape) => {
  if (!cyInstance.value) return

  const selectedNodes = cyInstance.value.nodes(':selected')
  if (selectedNodes.length !== 1) return

  const node = selectedNodes.first()
  if (node.isParent()) return // Don't change shape of clusters

  // Update node style
  node.style('shape', shape)

  // Store shape in node data for persistence
  node.data('customShape', shape)

  await saveGraph()
  showStatus(`Changed node shape to ${shape}`, 'success')
}

// Change color for currently selected node (from floating menu)
const changeSelectedNodeColor = async (color) => {
  if (!cyInstance.value) return

  const selectedNodes = cyInstance.value.nodes(':selected')
  if (selectedNodes.length !== 1) return

  const node = selectedNodes.first()
  if (node.isParent()) return // Don't change color of clusters

  // Update node style
  node.style('background-color', color)

  // Store color in node data for persistence
  node.data('color', color)

  await saveGraph()
  showStatus(`Changed node color`, 'success')
}

const openImageSelectorForNode = () => {
  console.log('🖼️ openImageSelectorForNode called', {
    hasContextMenu: !!contextMenu.value,
    hasNode: !!contextMenu.value?.node,
    isCluster: contextMenu.value?.isCluster,
    nodeLabel: contextMenu.value?.node?.data('label')
  })

  targetNodeForImage.value = contextMenu.value.node
  contextMenu.value.show = false

  const node = targetNodeForImage.value
  currentImageData.value = {
    url: node.data('path') || '',
    alt: node.data('label') || 'Node background',
    type: 'node-background',
    context: `Background image for node: ${node.data('label') || 'Untitled'}`,
    nodeContent: node.data('info') || node.data('label') || '',
  }

  console.log('🖼️ Opening ImageSelector', {
    currentImageData: currentImageData.value,
    isImageSelectorOpen: isImageSelectorOpen.value
  })

  isImageSelectorOpen.value = true

  console.log('🖼️ After setting isImageSelectorOpen', {
    isImageSelectorOpen: isImageSelectorOpen.value
  })
}

const closeImageSelector = () => {
  isImageSelectorOpen.value = false
  targetNodeForImage.value = null
  currentImageData.value = {
    url: '',
    alt: '',
    type: 'node-background',
    context: 'Graph Canvas Node Background',
    nodeContent: '',
  }
}

const handleBackgroundImageSelected = async (replacementData) => {
  if (!targetNodeForImage.value) return

  const node = targetNodeForImage.value
  const imageUrl = replacementData.newUrl

  // Store image URL in node data for persistence (using 'path' property)
  node.data('path', imageUrl)

  // Apply inline styles for immediate visual update
  // For clusters, check if collapsed
  const isCluster = node.isParent()
  const isCollapsed = node.data('collapsed')

  // Apply styles to non-clusters or collapsed clusters
  if (!isCluster || isCollapsed) {
    node.style({
      'background-image': imageUrl,
      'background-fit': 'cover',
      'background-opacity': 1,
    })
  }

  await saveGraph()
  showStatus('Background image applied', 'success')

  closeImageSelector()
}

const removeBackgroundImage = async () => {
  const node = contextMenu.value.node
  if (!node) return

  contextMenu.value.show = false

  // Remove background image style
  node.style({
    'background-image': 'none',
    'background-color': '#6495ED', // Reset to default blue
  })

  // Remove from node data (using 'path' property)
  node.removeData('path')

  await saveGraph()
  showStatus('Background image removed', 'success')
}

const hasBackgroundImage = () => {
  const node = contextMenu.value.node
  if (!node) return false
  return Boolean(node.data('path'))
}

// Node info modal functions
const renameNode = () => {
  const node = contextMenu.value.node
  if (!node) return

  const currentLabel = node.data('label') || ''
  const newLabel = prompt('Enter new name for node:', currentLabel)

  if (newLabel !== null && newLabel.trim() !== '') {
    node.data('label', newLabel.trim())
    saveCytoscape()
  }

  contextMenu.value.show = false
}

const openInfoModal = () => {
  const node = contextMenu.value.node
  if (!node) return

  editingNode.value = node
  // Prepare node data for the modal component
  editingNodeData.value = {
    id: node.id(),
    label: node.data('label') || '',
    info: node.data('info') || '',
    type: node.data('type') || 'default',
    color: node.data('color') || '#f8f9fa',
    path: node.data('path') || '',
    superadminOnly: !!node.data('superadminOnly')
  }
  contextMenu.value.show = false
  showInfoModal.value = true
}

// Set font size for info nodes
const setInfoNodeFontSize = (size) => {
  console.log('setInfoNodeFontSize called with size:', size)
  const node = contextMenu.value.node
  if (!node) {
    console.log('No node in context menu')
    return
  }
  if (node.data('type') !== 'info') {
    console.log('Node is not info type, it is:', node.data('type'))
    return
  }

  // Update node data with new font size
  node.data('fontSize', size)
  contextMenu.value.currentFontSize = size

  // Force Cytoscape to re-evaluate dynamic styles by updating the stylesheet
  if (cyInstance.value) {
    // Trigger style recalculation for this node
    node.updateStyle()
  }

  // Close context menu after selection
  contextMenu.value.show = false

  console.log(`Set font size to ${size}px for info node:`, node.id())
}

const closeInfoModal = () => {
  showInfoModal.value = false
  editingNode.value = null
  editingNodeData.value = {}
  savingNodeInfo.value = false
}

// Handle save from NodeEditModal component
const handleNodeSave = async (nodeData) => {
  if (!editingNode.value) return

  savingNodeInfo.value = true
  const node = editingNode.value

  try {
    // Update node data
    if (nodeData.label && nodeData.label.trim()) {
      node.data('label', nodeData.label.trim())
    }
    node.data('info', nodeData.info || '')
    node.data('color', nodeData.color || '#f8f9fa')
    if (nodeData.path) {
      node.data('path', nodeData.path)
    }
    node.data('superadminOnly', !!nodeData.superadminOnly)

    await saveGraph()
    showStatus('Node info updated', 'success')
    closeInfoModal()
  } catch (error) {
    console.error('Error saving node:', error)
    showStatus('Failed to save node', 'danger')
  } finally {
    savingNodeInfo.value = false
  }
}

const openYoutubeModal = (nodeData) => {
  youtubeModalNode.value = nodeData
  showYoutubeModal.value = true
  bringYoutubeModalToFront()
}

const closeYoutubeModal = () => {
  showYoutubeModal.value = false
  youtubeModalNode.value = null
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onYoutubeModalDrag)
  window.removeEventListener('mouseup', stopYoutubeModalDrag)
  window.removeEventListener('mousemove', onYoutubeModalResize)
  window.removeEventListener('mouseup', stopYoutubeModalResize)
})

const bringYoutubeModalToFront = () => {
  youtubeModalState.value = {
    ...youtubeModalState.value,
    zIndex: youtubeModalState.value.zIndex + 1,
  }
}

const startYoutubeModalDrag = (event) => {
  bringYoutubeModalToFront()
  isYoutubeModalDragging.value = true
  youtubeModalDragStart.value = {
    x: event.clientX,
    y: event.clientY,
    top: youtubeModalState.value.top,
    left: youtubeModalState.value.left,
  }
  window.addEventListener('mousemove', onYoutubeModalDrag)
  window.addEventListener('mouseup', stopYoutubeModalDrag)
}

const onYoutubeModalDrag = (event) => {
  if (!isYoutubeModalDragging.value) return
  const deltaX = event.clientX - youtubeModalDragStart.value.x
  const deltaY = event.clientY - youtubeModalDragStart.value.y
  youtubeModalState.value = {
    ...youtubeModalState.value,
    top: Math.max(10, youtubeModalDragStart.value.top + deltaY),
    left: Math.max(10, youtubeModalDragStart.value.left + deltaX),
  }
}

const stopYoutubeModalDrag = () => {
  if (!isYoutubeModalDragging.value) return
  isYoutubeModalDragging.value = false
  window.removeEventListener('mousemove', onYoutubeModalDrag)
  window.removeEventListener('mouseup', stopYoutubeModalDrag)
}

const startYoutubeModalResize = (event) => {
  bringYoutubeModalToFront()
  isYoutubeModalResizing.value = true
  youtubeModalResizeStart.value = {
    x: event.clientX,
    y: event.clientY,
    width: youtubeModalState.value.width,
    height: youtubeModalState.value.height,
  }
  window.addEventListener('mousemove', onYoutubeModalResize)
  window.addEventListener('mouseup', stopYoutubeModalResize)
}

const onYoutubeModalResize = (event) => {
  if (!isYoutubeModalResizing.value) return
  const deltaX = event.clientX - youtubeModalResizeStart.value.x
  const deltaY = event.clientY - youtubeModalResizeStart.value.y
  youtubeModalState.value = {
    ...youtubeModalState.value,
    width: Math.max(360, youtubeModalResizeStart.value.width + deltaX),
    height: Math.max(240, youtubeModalResizeStart.value.height + deltaY),
  }
}

const stopYoutubeModalResize = () => {
  if (!isYoutubeModalResizing.value) return
  isYoutubeModalResizing.value = false
  window.removeEventListener('mousemove', onYoutubeModalResize)
  window.removeEventListener('mouseup', stopYoutubeModalResize)
}

// Toggle font color on selected nodes
const toggleFontColor = async () => {
  if (!cyInstance.value) return

  // Get selected nodes but exclude parent/cluster nodes
  const selectedNodes = cyInstance.value.$('node:selected').filter(node => !node.isParent())
  console.log('Selected nodes count:', selectedNodes.length)
  console.log('Selected node IDs:', selectedNodes.map(n => n.id()).join(', '))

  if (selectedNodes.length === 0) {
    showStatus('No nodes selected (or only clusters selected)', 'warning')
    return
  }

  selectedNodes.forEach((node) => {
    // Check if node has stored fontColor in data, otherwise get current computed color
    const storedColor = node.data('fontColor')
    const currentColor = storedColor || node.style('color')

    console.log(`Node ${node.id()} - Current color:`, currentColor, 'Stored color:', storedColor)

    // Determine new color - if it's white or contains white, switch to black, otherwise to white
    let newColor
    if (currentColor === '#fff' || currentColor === '#ffffff' ||
        currentColor === 'rgb(255, 255, 255)' || currentColor === 'white' ||
        storedColor === '#fff' || storedColor === 'white') {
      newColor = '#000'
    } else {
      newColor = '#fff'
    }

    console.log(`Node ${node.id()} - Setting new color:`, newColor)

    // Apply the new color
    node.style('color', newColor)
    // Store color in node data for persistence
    node.data('fontColor', newColor)
  })

  await saveGraph()
  showStatus(`Font color toggled for ${selectedNodes.length} node(s)`, 'success')
}

// Search nodes
const searchNodes = () => {
  if (!cyInstance.value) return

  cyInstance.value.nodes().removeClass('highlighted')

  if (searchQuery.value.trim()) {
    const matchingNodes = cyInstance.value
      .nodes()
      .filter((node) => node.data('label').toLowerCase().includes(searchQuery.value.toLowerCase()))

    if (matchingNodes.length > 0) {
      matchingNodes.addClass('highlighted')
      cyInstance.value.fit(matchingNodes, 50)
      showStatus(`Found ${matchingNodes.length} matching nodes`, 'success')
    } else {
      showStatus('No matching nodes found', 'warning')
    }
  }
}

// Undo/Redo
const undoAction = () => {
  if (undoRedoInstance.value) {
    undoRedoInstance.value.undo()
    showStatus('Undone', 'info')
  }
}

const redoAction = () => {
  if (undoRedoInstance.value) {
    undoRedoInstance.value.redo()
    showStatus('Redone', 'info')
  }
}

// Save graph with history - uses saveGraphWithHistory endpoint like GNewViewer
// This ensures version history is properly maintained
const saveGraph = async () => {
  if (!cyInstance.value || !graphStore.currentGraphId) {
    showStatus('No graph selected to save', 'warning')
    return
  }

  try {
    showStatus('Saving graph...', 'info')

    // Fetch the current graph data to preserve metadata
    console.log('🔍 [GraphCanvas] Fetching current graph to preserve metadata...')
    const currentGraphResponse = await fetch(
      `https://knowledge.vegvisr.org/getknowgraph?id=${graphStore.currentGraphId}`,
    )

    if (!currentGraphResponse.ok) {
      throw new Error(`Failed to fetch current graph: ${currentGraphResponse.status}`)
    }

    const currentGraph = await currentGraphResponse.json()

    // Ensure metadata exists with fallback defaults
    const existingMetadata = currentGraph.metadata || {}

    console.log(
      '🔍 [GraphCanvas] Current graph metadata:',
      JSON.stringify(existingMetadata, null, 2),
    )

    // Get current positions from Cytoscape
    const updatedNodes = cyInstance.value.nodes().map((node) => ({
      ...node.data(), // Keep all existing node data
      position: node.position(), // Update position
    }))

    const updatedEdges = cyInstance.value.edges().map((edge) => ({
      ...edge.data(), // Keep all existing edge data
    }))

    console.log('=== Saving Graph with History ===')
    console.log('Updated nodes:', updatedNodes.length)
    console.log('Updated edges:', updatedEdges.length)

    // Fetch current chat session count before saving
    const chatSessionCount = await fetchChatSessionCount(graphStore.currentGraphId, userStore)

    // Preserve metadata - version will be incremented by backend
    const preservedMetadata = {
      ...existingMetadata,
      title: existingMetadata.title || 'Untitled Graph',
      description: existingMetadata.description || '',
      createdBy: existingMetadata.createdBy || 'Unknown',
      category: existingMetadata.category || '',
      metaArea: existingMetadata.metaArea || '',
      createdAt: existingMetadata.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      chatSessionCount: chatSessionCount,
    }

    // Use saveGraphWithHistory endpoint (like GNewViewer) to properly save with version history
    const response = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: graphStore.currentGraphId,
        graphData: {
          metadata: preservedMetadata,
          nodes: updatedNodes,
          edges: updatedEdges,
        },
        override: true,
      }),
    })

    if (response.ok) {
      const result = await response.json()
      console.log('✅ [GraphCanvas] Graph saved with history:', result)
      showStatus('Graph saved successfully!', 'success')
    } else {
      const errorText = await response.text()
      console.error('❌ [GraphCanvas] Save failed:', response.status, errorText)
      showStatus(`Error saving graph: ${response.status}`, 'error')
    }
  } catch (error) {
    console.error('❌ [GraphCanvas] Error saving graph:', error)
    showStatus('Error saving graph: ' + error.message, 'error')
  }
}

const createNodeTemplate = (type) => {
  const baseNode = {
    id: generateUUID(),
    visible: true,
    imageWidth: '100%',
    imageHeight: '100%',
  }

  switch (type) {
    case 'fulltext':
      return {
        ...baseNode,
        label: 'New Full Text Node',
        type: 'fulltext',
        color: '#f8f9fa',
        info: 'Add your full text content here.',
        bibl: [],
      }

    case 'person-profile':
      return {
        ...baseNode,
        label: 'Person Profile',
        type: 'person-profile',
        color: '#e8f5e9',
        data: {
          personId: '',
          name: 'Søk etter person...',
          age: null,
          gender: null,
          location: { municipality: '', county: '' },
          roles: [],
          connections: [],
          industryConnections: [],
          showRoles: true,
          showConnections: true
        },
        info: 'Bruk AI Chat til å søke etter en person: "Finn person Christine Myrseth"',
      }

    case 'company-card':
      return {
        ...baseNode,
        label: 'Company Card',
        type: 'company-card',
        color: '#fff3e0',
        data: {
          organisationNumber: '',
          name: 'Søk etter bedrift...',
          naceDescription: '',
          employees: null,
          foundedYear: null,
          address: {},
          boardMembers: [],
          financials: {},
          showFinancials: true,
          showBoard: true,
          showAddress: true
        },
        info: 'Bruk AI Chat til å søke etter en bedrift: "Finn bedrift SABIMA"',
      }

    case 'network':
      return {
        ...baseNode,
        label: 'Network Map',
        type: 'network',
        color: '#e3f2fd',
        data: {
          title: 'Nettverkskart',
          centerPerson: null,
          paths: [],
          connections: [],
          degreesOfSeparation: 0
        },
        info: 'Bruk AI Chat: "Finn forbindelser mellom Person A og Person B"',
      }

    case 'news-feed':
      return {
        ...baseNode,
        label: 'News Feed',
        type: 'news-feed',
        color: '#fce4ec',
        data: {
          title: 'Nyhetsstrøm',
          subtitle: '',
          query: '',
          results: [],
          lastUpdated: new Date().toISOString()
        },
        info: 'Bruk AI Chat: "Finn nyheter om naturvern"',
      }

    case 'audio-visualizer':
      return {
        ...baseNode,
        label: 'Audio Visualizer',
        type: 'audio-visualizer',
        color: '#2c3e50',
        audioUrl: '',
        info: 'Audio visualizer with waveform display',
      }

    default:
      return {
        ...baseNode,
        label: 'New Info Node',
        type: 'info',
        color: '#d1ecf1',
        info: 'Add supporting details here.',
        bibl: [],
      }
  }
}

const addNodeAtPosition = async (type, position) => {
  if (!cyInstance.value) return

  const nodeData = createNodeTemplate(type)

  try {
    cyInstance.value.add({
      group: 'nodes',
      data: nodeData,
      position,
    })

    const newNode = cyInstance.value.$(`#${nodeData.id}`)

    // Force style for audio-visualizer nodes directly on the element
    if (type === 'audio-visualizer') {
      newNode.style({
        'shape': 'round-rectangle',
        'background-color': '#2c3e50',
        'border-width': 2,
        'border-color': '#3498db',
        'label': '',
        'text-wrap': 'wrap',
        'text-valign': 'center',
        'text-halign': 'center',
        'padding': '10px',
        'width': '1122px',
        'height': '794px',
      })
      // Force Cytoscape to recalculate layout
      cyInstance.value.style().update()
    }

    // Small delay to allow Cytoscape to process styles, then trigger overlay recalculation
    await new Promise(resolve => setTimeout(resolve, 50))
    resizeUpdateToken.value = (resizeUpdateToken.value + 1) % Number.MAX_SAFE_INTEGER

    newNode.select()
    showStatus('Saving new node...', 'info')
    await saveGraph()
    showStatus('Node added successfully.', 'success')
  } catch (error) {
    console.error('Failed to add node:', error)
    showStatus('Unable to add node. Please try again.', 'error')
    const created = cyInstance.value.$(`#${nodeData.id}`)
    if (created) {
      created.remove()
    }
  }
}

const addEdgeBetweenNodes = async (sourceNode, targetNode) => {
  if (!cyInstance.value || !sourceNode || !targetNode) return

  const edgeId = generateUUID()

  try {
    cyInstance.value.add({
      group: 'edges',
      data: {
        id: edgeId,
        source: sourceNode.id(),
        target: targetNode.id(),
        type: 'info',
        label: '',
      },
    })

    showStatus('Saving new edge...', 'info')
    await saveGraph()
    showStatus('Edge added successfully.', 'success')
  } catch (error) {
    console.error('Failed to add edge:', error)
    showStatus('Unable to add edge. Please try again.', 'error')
    const created = cyInstance.value.$(`#${edgeId}`)
    if (created) {
      created.remove()
    }
  }
}

const updateCanvasInteractionState = () => {
  const interactionLocked = Boolean(placementMode.value || edgeMode.value)
  const cy = cyInstance.value

  if (cy) {
    cy.userPanningEnabled(!interactionLocked)
    cy.boxSelectionEnabled(!interactionLocked)
    cy.autoungrabify(interactionLocked)
  }

  const root = graphCanvasRoot.value
  if (root) {
    root.classList.toggle('interaction-locked', interactionLocked)
    root.classList.toggle('placement-active', Boolean(placementMode.value))
    root.classList.toggle('edge-active', Boolean(edgeMode.value))
  }
}

const resetInteractionModes = () => {
  placementMode.value = null
  edgeMode.value = false
  edgeStartNode.value = null
  updateCanvasInteractionState()
}

const cancelInteractionModes = () => {
  if (placementMode.value || edgeMode.value) {
    resetInteractionModes()
    showStatus('Placement cancelled.', 'info')
  }
}

const getPlacementModeLabel = (mode) => {
  const labels = {
    'info': 'Info mode',
    'fulltext': 'Full Text mode',
    'person-profile': 'Person Profile mode',
    'company-card': 'Company Card mode',
    'network': 'Network Map mode',
    'news-feed': 'News Feed mode',
    'audio-visualizer': 'Audio Visualizer mode'
  }
  return labels[mode] || `${mode} mode`
}

const startNodePlacement = (type) => {
  if (!canAddNodes.value) {
    showStatus('Load a graph to add nodes.', 'warning')
    return
  }

  // Toggle behavior: if already in this mode, turn it off
  if (placementMode.value === type) {
    resetInteractionModes()
    showStatus('Node placement mode disabled.', 'info')
    return
  }

  resetInteractionModes()
  placementMode.value = type
  updateCanvasInteractionState()
  const label = getPlacementModeLabel(type)
  showStatus(`${label} enabled. Click to add nodes. Click button again to disable.`, 'info')
}

const toggleEdgeMode = () => {
  if (!canAddNodes.value) {
    showStatus('Load a graph to add edges.', 'warning')
    return
  }

  if (edgeMode.value) {
    resetInteractionModes()
    showStatus('Edge mode cancelled.', 'info')
  } else {
    resetInteractionModes()
    edgeMode.value = true
    updateCanvasInteractionState()
    showStatus('Edge mode: select the start node.', 'info')
  }
}

const handleEdgeNodeSelection = async (node) => {
  if (!edgeMode.value || !node) {
    return
  }

  if (!edgeStartNode.value) {
    edgeStartNode.value = node
    showStatus('Start node selected. Choose the target node.', 'info')
    return
  }

  if (edgeStartNode.value.id() === node.id()) {
    showStatus('Choose a different node as the target.', 'warning')
    return
  }

  await addEdgeBetweenNodes(edgeStartNode.value, node)
  resetInteractionModes()
}

// Edge info editing functions
const updateEdgeInfo = () => {
  if (selectedEdge.value) {
    selectedEdge.value.data('info', edgeInfoText.value)
    showStatus('Edge info updated', 'success')
  }
}

const deleteSelectedEdge = async () => {
  if (!selectedEdge.value || !cyInstance.value) return

  const confirmed = confirm('Delete this edge?')
  if (!confirmed) return

  cyInstance.value.remove(selectedEdge.value)
  selectedEdge.value = null
  edgeInfoText.value = ''
  showStatus('Edge deleted', 'info')
  await saveGraph()
}

const toggleClusterCollapse = async (clusterNode) => {
  if (!cyInstance.value || !clusterNode || !clusterNode.isParent()) return

  const isCollapsed = clusterNode.data('collapsed')
  const children = clusterNode.children()

  if (isCollapsed) {
    // Expand: show children and remove background image inline styles
    children.style('display', 'element')
    clusterNode.removeData('collapsed')
    // Force remove any inline background-image styles so CSS selectors take over
    clusterNode.removeStyle('background-image')
    clusterNode.removeStyle('background-fit')
    showStatus(`Expanded cluster "${clusterNode.data('label')}"`, 'info')
  } else {
    // Collapse: hide children
    children.style('display', 'none')
    clusterNode.data('collapsed', true)
    showStatus(`Collapsed cluster "${clusterNode.data('label')}" (${children.length} nodes)`, 'info')
  }

  // Save the collapsed state
  await saveGraph()
}

const createClusterFromSelected = async () => {
  if (!cyInstance.value) return

  const selectedNodes = cyInstance.value.$('node:selected')
  if (selectedNodes.length < 2) {
    showStatus('Select at least 2 nodes to create a cluster', 'warning')
    return
  }

  const clusterName = prompt('Enter cluster name:', 'New Cluster')
  if (!clusterName || !clusterName.trim()) {
    showStatus('Cluster creation cancelled', 'info')
    return
  }

  try {
    // Calculate bounding box for selected nodes
    const boundingBox = selectedNodes.boundingBox()
    const centerX = (boundingBox.x1 + boundingBox.x2) / 2
    const centerY = (boundingBox.y1 + boundingBox.y2) / 2

    // Create parent/cluster node
    const clusterId = generateUUID()
    cyInstance.value.add({
      group: 'nodes',
      data: {
        id: clusterId,
        label: clusterName.trim(),
        type: 'cluster',
        color: '#A5D6FF',
        visible: true,
      },
      position: { x: centerX, y: centerY },
    })

    // Move selected nodes into the cluster
    selectedNodes.forEach((node) => {
      node.move({ parent: clusterId })
    })

    showStatus('Saving cluster...', 'info')
    await saveGraph()
    showStatus(`Cluster "${clusterName.trim()}" created with ${selectedNodes.length} nodes`, 'success')

    // Select the new cluster
    cyInstance.value.$(':selected').unselect()
    cyInstance.value.$(`#${clusterId}`).select()
  } catch (error) {
    console.error('Failed to create cluster:', error)
    showStatus('Unable to create cluster. Please try again.', 'error')
  }
}

const showImportGraphDialog = async () => {
  if (!cyInstance.value) return

  // Ensure graphs are loaded
  if (knowledgeGraphs.value.length === 0) {
    showStatus('Loading graphs...', 'info')
    await loadGraphs()
  }

  const availableGraphs = knowledgeGraphs.value.filter((g) => g.id !== graphStore.currentGraphId)

  if (availableGraphs.length === 0) {
    showStatus('No other graphs available to import', 'warning')
    return
  }

  showImportModal.value = true
  importSearchQuery.value = ''
}

const closeImportModal = () => {
  showImportModal.value = false
  importSearchQuery.value = ''
}

const importGraphAsCluster = async (graphId, graphTitle) => {
  if (!cyInstance.value) return

  closeImportModal()

  try {
    showStatus(`Loading graph "${graphTitle}"...`, 'info')

    const response = await fetch(
      `https://knowledge.vegvisr.org/getknowgraph?id=${graphId}`
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch graph: ${response.status}`)
    }

    let importedGraphData = await response.json()

    // Handle JSON string
    if (typeof importedGraphData === 'string') {
      importedGraphData = JSON.parse(importedGraphData)
    }

    if (!importedGraphData.nodes || !importedGraphData.edges) {
      throw new Error('Invalid graph data structure')
    }

    // Calculate center position for the imported cluster
    const extent = cyInstance.value.extent()
    const centerX = (extent.x1 + extent.x2) / 2
    const centerY = (extent.y1 + extent.y2) / 2

    // Create parent cluster node
    const clusterId = generateUUID()
    cyInstance.value.add({
      group: 'nodes',
      data: {
        id: clusterId,
        label: graphTitle,
        type: 'cluster',
        color: '#B8E6B8',
        visible: true,
        sourceGraphId: graphId, // Track original graph
      },
      position: { x: centerX, y: centerY },
    })

    // Map old node IDs to new ones to avoid conflicts
    const idMap = {}
    importedGraphData.nodes.forEach((node) => {
      const newId = generateUUID()
      idMap[node.id] = newId

      // Calculate relative position offset
      const relativeX = node.position?.x || 0
      const relativeY = node.position?.y || 0

      cyInstance.value.add({
        group: 'nodes',
        data: {
          ...node,
          id: newId,
          originalId: node.id, // Keep reference to original
          parent: clusterId,
        },
        position: {
          x: relativeX,
          y: relativeY,
        },
      })
    })

    // Add edges with mapped IDs
    importedGraphData.edges.forEach((edge) => {
      const newSource = idMap[edge.source]
      const newTarget = idMap[edge.target]

      if (newSource && newTarget) {
        cyInstance.value.add({
          group: 'edges',
          data: {
            ...edge,
            id: generateUUID(),
            source: newSource,
            target: newTarget,
          },
        })
      }
    })

    showStatus('Saving imported cluster...', 'info')
    await saveGraph()
    showStatus(
      `Graph "${graphTitle}" imported with ${importedGraphData.nodes.length} nodes`,
      'success'
    )

    // Select the imported cluster
    cyInstance.value.$(':selected').unselect()
    cyInstance.value.$(`#${clusterId}`).select()
    cyInstance.value.fit(cyInstance.value.$(`#${clusterId}`), 50)
  } catch (error) {
    console.error('Failed to import graph:', error)
    showStatus(`Unable to import graph: ${error.message}`, 'error')
  }
}

const handleFullscreenChange = () => {
  isFullscreen.value = Boolean(document.fullscreenElement)
}

const toggleFullscreen = async () => {
  const target = graphCanvasRoot.value
  if (!target) {
    showStatus('Canvas not ready for fullscreen', 'warning')
    return
  }

  try {
    if (!document.fullscreenElement) {
      await target.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  } catch (error) {
    console.error('Fullscreen toggle failed:', error)
    showStatus('Fullscreen mode is unavailable in this browser.', 'error')
  }
}

// Status message helper
const showStatus = (message, type = 'info') => {
  statusMessage.value = message
  statusClass.value = `alert-${type === 'error' ? 'danger' : type}`

  setTimeout(() => {
    statusMessage.value = ''
    statusClass.value = ''
  }, 3000)
}

// Initialize empty canvas
const initializeEmptyCanvas = () => {
  const container = document.getElementById('graph-canvas')
  if (!container) return

  if (cyInstance.value) {
    cyInstance.value.destroy()
  }

  resetInteractionModes()

  cyInstance.value = cytoscape({
    container: container,
    elements: [],
    style: [
      {
        selector: 'node',
        style: {
          display: 'element',
          label: (ele) =>
            ele.data('type') === 'info' ? ele.data('label') + ' ℹ️' : ele.data('label') || '',
          'background-color': (ele) => ele.data('color') || '#ccc',
          color: (ele) => ele.data('fontColor') || '#000',
          'text-valign': 'center',
          'text-halign': 'center',
        },
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 4,
          'border-color': '#FF9800',
        },
      },
      {
        selector: 'edge',
        style: {
          width: 2,
          'line-color': '#999',
          'target-arrow-color': '#999',
          'target-arrow-shape': 'triangle',
          'curve-style': 'unbundled-bezier',
        },
      },
      {
        selector: ':parent',
        style: {
          'background-opacity': 0.2,
          'background-color': (ele) => ele.data('sourceGraphId') ? '#B8E6B8' : '#A5D6FF',
          'border-width': 3,
          'border-color': (ele) => ele.data('sourceGraphId') ? '#2DA44E' : '#0969DA',
          'border-style': 'dashed',
          'text-valign': 'top',
          'text-halign': 'center',
          'font-weight': 'bold',
          'font-size': '16px',
          'padding': '20px',
          label: (ele) => {
            const collapsed = ele.data('collapsed')
            const childCount = ele.children().length
            const label = ele.data('label') || 'Cluster'
            const isImported = ele.data('sourceGraphId') ? ' 🌐' : ''
            return collapsed ? `${label} [${childCount}]${isImported}` : `${label}${isImported}`
          },
        },
      },
      {
        selector: ':parent[collapsed]',
        style: {
          'background-color': (ele) => ele.data('sourceGraphId') ? '#2DA44E' : '#0969DA',
          'background-opacity': 0.4,
          'border-style': 'solid',
          width: '400px',
          height: '400px',
        },
      },
    ],
    layout: { name: 'grid' },
    userZoomingEnabled: true,
    userPanningEnabled: true,
    boxSelectionEnabled: true,
    selectionType: 'additive',
    // Fine-tuned zoom settings
    wheelSensitivity: 0.1, // Reduce wheel sensitivity for finer control
    minZoom: 0.001, // Minimum zoom level (0.1%)
    maxZoom: 500, // Maximum zoom level (50000%)
    zoomingEnabled: true,
    panningEnabled: true,
  })

  setupEventListeners()
  updateCanvasInteractionState()
  showStatus('Canvas initialized - select a graph to load data', 'info')
  bumpResizeUpdate()
}

// Handle URL parameters and store changes
const handleGraphIdChange = async (newGraphId) => {
  if (newGraphId && knowledgeGraphs.value.length > 0) {
    console.log('Loading graph from ID change:', newGraphId)
    await loadGraph()
  }
}

watch([placementMode, edgeMode], () => {
  updateCanvasInteractionState()
}, { immediate: true })

// Watch for changes in currentGraphId (from store or URL)
watch(() => graphStore.currentGraphId, handleGraphIdChange)

// Node Resize Handlers
const startNodeResize = (direction, event) => {
  if (!cyInstance.value) return

  const selectedNodes = cyInstance.value.nodes(':selected')
  if (selectedNodes.length !== 1) return

  const node = selectedNodes.first()
  if (node.isParent()) return

  isResizingNode.value = true
  resizeDirection.value = direction
  resizeTargetNode.value = node
  resizeStartPos.value = { x: event.clientX, y: event.clientY }

  // Get current node dimensions
  const width = node.width()
  const height = node.height()
  const pos = node.position()

  resizeStartSize.value = { width, height }
  resizeStartNodePos.value = { x: pos.x, y: pos.y }

  document.addEventListener('mousemove', handleNodeResize)
  document.addEventListener('mouseup', stopNodeResize)

  // Prevent node dragging during resize
  node.ungrabify()
  bumpResizeUpdate()
}

const handleNodeResize = (event) => {
  if (!isResizingNode.value || !resizeTargetNode.value) return

  const node = resizeTargetNode.value
  const deltaX = event.clientX - resizeStartPos.value.x
  const deltaY = event.clientY - resizeStartPos.value.y

  // Get zoom level for accurate delta calculation
  const zoom = cyInstance.value.zoom()
  const minSizePx = 50
  const minSize = minSizePx / zoom

  let newWidth = resizeStartSize.value.width
  let newHeight = resizeStartSize.value.height
  let newX = resizeStartNodePos.value.x
  let newY = resizeStartNodePos.value.y

  const dir = resizeDirection.value
  const shiftKey = event.shiftKey
  const startAspectRatio = resizeStartSize.value.width / resizeStartSize.value.height

  // Calculate new dimensions based on resize direction
  if (dir.includes('e')) {
    newWidth = Math.max(minSize, resizeStartSize.value.width + deltaX / zoom)
  }
  if (dir.includes('w')) {
    newWidth = Math.max(minSize, resizeStartSize.value.width - deltaX / zoom)
    const widthDelta = newWidth - resizeStartSize.value.width
    if (newWidth >= minSize) {
      newX = resizeStartNodePos.value.x - widthDelta / 2
    }
  }
  if (dir.includes('s')) {
    newHeight = Math.max(minSize, resizeStartSize.value.height + deltaY / zoom)
  }
  if (dir.includes('n')) {
    newHeight = Math.max(minSize, resizeStartSize.value.height - deltaY / zoom)
    const heightDelta = newHeight - resizeStartSize.value.height
    if (newHeight >= minSize) {
      newY = resizeStartNodePos.value.y - heightDelta / 2
    }
  }

  // Maintain aspect ratio when Shift is held
  if (shiftKey) {
    const currentAspectRatio = newWidth / newHeight

    // Determine which dimension to adjust based on resize direction
    if (dir === 'e' || dir === 'w') {
      // Horizontal only - adjust height to match
      newHeight = newWidth / startAspectRatio
    } else if (dir === 'n' || dir === 's') {
      // Vertical only - adjust width to match
      newWidth = newHeight * startAspectRatio
    } else {
      // Corner resize - use the larger change
      const widthChange = Math.abs(newWidth - resizeStartSize.value.width)
      const heightChange = Math.abs(newHeight - resizeStartSize.value.height)

      if (widthChange > heightChange) {
        newHeight = newWidth / startAspectRatio
      } else {
        newWidth = newHeight * startAspectRatio
      }
    }

    // Recalculate position for north/west directions with aspect ratio
    if (dir.includes('w')) {
      const widthDelta = newWidth - resizeStartSize.value.width
      newX = resizeStartNodePos.value.x - widthDelta / 2
    }
    if (dir.includes('n')) {
      const heightDelta = newHeight - resizeStartSize.value.height
      newY = resizeStartNodePos.value.y - heightDelta / 2
    }
  }

  // Apply the new size using style
  node.style({
    width: newWidth,
    height: newHeight,
  })

  // Update position if resizing from top or left
  if (dir.includes('n') || dir.includes('w')) {
    node.position({ x: newX, y: newY })
  }

  // Store dimensions in node data for persistence
  node.data('customWidth', newWidth)
  node.data('customHeight', newHeight)
  bumpResizeUpdate()
}

const stopNodeResize = () => {
  if (resizeTargetNode.value) {
    // Re-enable grabbing
    resizeTargetNode.value.grabify()
  }

  isResizingNode.value = false
  resizeDirection.value = null
  resizeTargetNode.value = null

  document.removeEventListener('mousemove', handleNodeResize)
  document.removeEventListener('mouseup', stopNodeResize)

  // Mark graph as modified
  showStatus('Node resized', 'success')
  bumpResizeUpdate()
}

// Node Rotation Handlers
const startNodeRotation = (event) => {
  if (!cyInstance.value) return

  const selectedNodes = cyInstance.value.nodes(':selected')
  if (selectedNodes.length !== 1) return

  const node = selectedNodes.first()
  if (node.isParent()) return

  isRotatingNode.value = true
  rotationTargetNode.value = node

  // Get current rotation angle from node data (default 0)
  rotationStartAngle.value = node.data('rotation') || 0

  // Calculate initial mouse angle relative to node center
  const renderedPos = node.renderedPosition()
  const container = cyInstance.value.container()
  const rect = container.getBoundingClientRect()
  const nodeCenterX = rect.left + renderedPos.x
  const nodeCenterY = rect.top + renderedPos.y

  rotationStartMouseAngle.value = Math.atan2(
    event.clientY - nodeCenterY,
    event.clientX - nodeCenterX
  ) * (180 / Math.PI)

  document.addEventListener('mousemove', handleNodeRotation)
  document.addEventListener('mouseup', stopNodeRotation)

  // Prevent node dragging during rotation
  node.ungrabify()
}

const handleNodeRotation = (event) => {
  if (!isRotatingNode.value || !rotationTargetNode.value) return

  const node = rotationTargetNode.value
  const renderedPos = node.renderedPosition()
  const container = cyInstance.value.container()
  const rect = container.getBoundingClientRect()
  const nodeCenterX = rect.left + renderedPos.x
  const nodeCenterY = rect.top + renderedPos.y

  // Calculate current mouse angle
  const currentMouseAngle = Math.atan2(
    event.clientY - nodeCenterY,
    event.clientX - nodeCenterX
  ) * (180 / Math.PI)

  // Calculate rotation delta
  let angleDelta = currentMouseAngle - rotationStartMouseAngle.value

  // Calculate new rotation
  let newRotation = rotationStartAngle.value + angleDelta

  // Snap to 90-degree increments if Shift is held
  if (event.shiftKey) {
    newRotation = Math.round(newRotation / 90) * 90
  }

  // Normalize to 0-360 range
  newRotation = ((newRotation % 360) + 360) % 360

  // Store rotation in node data
  node.data('rotation', newRotation)

  // Apply rotation via CSS (Cytoscape doesn't natively support rotation)
  // We'll use a custom style that reads the rotation data
  updateNodeRotationStyle(node, newRotation)
}

const stopNodeRotation = () => {
  if (rotationTargetNode.value) {
    rotationTargetNode.value.grabify()
  }

  isRotatingNode.value = false
  rotationTargetNode.value = null

  document.removeEventListener('mousemove', handleNodeRotation)
  document.removeEventListener('mouseup', stopNodeRotation)

  showStatus('Node rotated', 'success')
  bumpResizeUpdate()
}

// Apply rotation to node using CSS transform on the node's DOM element
const updateNodeRotationStyle = (node, rotation) => {
  // Store rotation in node data for persistence
  node.data('rotation', rotation)

  // Cytoscape supports rotation for background images
  // Apply rotation to the node's background image if it has one
  const bgImage = node.style('background-image')
  if (bgImage && bgImage !== 'none') {
    node.style('background-image-rotation', rotation)
  }

  // Also apply text rotation for the label
  node.style('text-rotation', rotation)

  // Trigger style update
  node.updateStyle()
}

// AI Chat Panel - Resize handlers
const getMaxChatWidth = () => Math.min(800, window.innerWidth * 0.5)

const clampChatWidthToViewport = () => {
  const maxWidth = getMaxChatWidth()
  if (chatWidth.value > maxWidth) {
    chatWidth.value = maxWidth
  }
}

const startChatResize = (e) => {
  isResizingChat.value = true
  chatResizeStartX = e.clientX
  chatResizeStartWidth = chatWidth.value
  document.addEventListener('mousemove', handleChatResize)
  document.addEventListener('mouseup', stopChatResize)
}

const handleChatResize = (e) => {
  if (!isResizingChat.value) return
  const delta = chatResizeStartX - e.clientX
  const newWidth = Math.max(300, Math.min(getMaxChatWidth(), chatResizeStartWidth + delta))
  chatWidth.value = newWidth
}

const stopChatResize = () => {
  isResizingChat.value = false
  document.removeEventListener('mousemove', handleChatResize)
  document.removeEventListener('mouseup', stopChatResize)
}

// AI Chat Panel - Insert AI response as fulltext node
const insertAIResponseAsFullText = async (content) => {
  if (!cyInstance.value) return

  // Create new fulltext node with AI response
  const newNodeId = generateUUID()

  // Calculate position - center of visible viewport
  const extent = cyInstance.value.extent()
  const position = {
    x: (extent.x1 + extent.x2) / 2,
    y: (extent.y1 + extent.y2) / 2
  }

  cyInstance.value.add({
    data: {
      id: newNodeId,
      label: 'AI Response',
      type: 'fulltext',
      info: content,  // Full content goes in info (same as GNewViewer)
      color: '#e8f4f8',
      fontColor: '#000',
      visible: true,
      bibl: [],
      createdAt: new Date().toISOString()
    },
    position: position
  })

  showStatus('AI response inserted as new fulltext node', 'success')

  // Auto-save the graph
  await saveGraph()
}

const insertAIResponseAsHtml = async (content) => {
  if (!cyInstance.value) return

  const newNodeId = generateUUID()
  const extent = cyInstance.value.extent()
  const position = {
    x: (extent.x1 + extent.x2) / 2,
    y: (extent.y1 + extent.y2) / 2
  }

  cyInstance.value.add({
    data: {
      id: newNodeId,
      label: 'AI HTML',
      type: 'html-node',
      info: content,
      color: '#fff3cd',
      fontColor: '#000',
      visible: true,
      bibl: [],
      createdAt: new Date().toISOString()
    },
    position: position
  })

  showStatus('AI response inserted as new HTML node', 'success')
  await saveGraph()
}

// AI Chat Panel - Insert structured node from Proff/Sources data
const insertAIResponseAsNode = async (payload) => {
  if (!cyInstance.value) return

  const { type, content, rawData } = payload
  const newNodeId = generateUUID()

  console.log('insertAIResponseAsNode - type:', type, 'rawData:', rawData)

  // Calculate position - center of visible viewport
  const extent = cyInstance.value.extent()
  const position = {
    x: (extent.x1 + extent.x2) / 2,
    y: (extent.y1 + extent.y2) / 2
  }

  // Build node data based on type
  let nodeData = {
    id: newNodeId,
    type: type,
    visible: true,
    createdAt: new Date().toISOString()
  }

  if (type === 'person-profile' && rawData) {
    // Extract person data from various possible structures
    // rawData may have: person, persons, proff_search_persons, proff_get_person_details
    let person = rawData.person || rawData.persons?.[0]

    // Check for tool-name keyed results
    if (!person && rawData.proff_search_persons?.persons) {
      person = rawData.proff_search_persons.persons[0]
    }
    if (!person && rawData.proff_get_person_details?.person) {
      person = rawData.proff_get_person_details.person
    }
    if (!person && rawData.proff_get_person_details) {
      // Sometimes the person data is directly in the result
      person = rawData.proff_get_person_details
    }

    console.log('Extracted person:', person)

    if (person) {
      // Store BOTH AI response AND raw Proff data in info field
      const nodeInfo = {
        aiResponse: content || '',  // Claude's text response
        proffData: {
          personId: person.personId || '',
          name: person.name || '',
          age: person.age,
          birthYear: person.birthYear,
          gender: person.gender,
          location: person.location || {},
          address: person.address || {},
          roles: person.roles || [],
          connections: person.connections,
          industryConnections: person.industryConnections || [],
        },
        showRoles: true,
        showConnections: true
      }

      nodeData = {
        ...nodeData,
        label: person.name || 'Person Profile',
        color: '#e8f5e9',
        info: JSON.stringify(nodeInfo, null, 2)
      }
    } else {
      // Fallback with content
      nodeData = {
        ...nodeData,
        label: 'Person Profile',
        color: '#e8f5e9',
        info: content || 'No person data found'
      }
    }
  } else if (type === 'company-card' && rawData) {
    // Extract company data from various possible structures
    let company = rawData.company || rawData.companies?.[0]

    // Check for tool-name keyed results
    if (!company && rawData.proff_search_companies?.companies) {
      company = rawData.proff_search_companies.companies[0]
    }
    if (!company && rawData.proff_get_company_details?.company) {
      company = rawData.proff_get_company_details.company
    }
    if (!company && rawData.proff_get_company_details) {
      company = rawData.proff_get_company_details
    }

    console.log('Extracted company:', company)

    if (company) {
      // Store BOTH AI response AND raw Proff data
      const nodeInfo = {
        aiResponse: content || '',
        proffData: {
          organisationNumber: company.organisationNumber || company.orgNr || '',
          name: company.name || '',
          naceDescription: company.naceDescription || '',
          employees: company.employees,
          foundedYear: company.foundedYear,
          address: company.address || {},
          boardMembers: company.boardMembers || [],
          financials: company.financials || {},
        },
        showFinancials: true,
        showBoard: true,
        showAddress: true
      }

      nodeData = {
        ...nodeData,
        label: company.name || 'Company Card',
        color: '#fff3e0',
        info: JSON.stringify(nodeInfo, null, 2)
      }
    } else {
      nodeData = {
        ...nodeData,
        label: 'Company Card',
        color: '#fff3e0',
        info: content || 'No company data found'
      }
    }
  } else if (type === 'news-feed' && rawData) {
    // Extract results from sources data
    const results = rawData.results || rawData.sources_search?.results || []

    // Store BOTH AI response AND raw sources data
    const nodeInfo = {
      aiResponse: content || '',
      sourcesData: {
        title: 'Relaterte nyheter',
        results: results,
        lastUpdated: new Date().toISOString()
      }
    }

    nodeData = {
      ...nodeData,
      label: 'News Feed',
      color: '#fce4ec',
      info: JSON.stringify(nodeInfo, null, 2)
    }
  } else {
    // Fallback - create fulltext node with content
    nodeData = {
      ...nodeData,
      label: `${type} Node`,
      type: 'fulltext',
      color: '#f5f5f5',
      info: content || 'No data available',
      fullText: content
    }
  }

  cyInstance.value.add({
    data: nodeData,
    position: position
  })

  showStatus(`${type} node inserted`, 'success')
  await saveGraph()
}

// AI Chat Panel - Insert network diagram from Proff network data
const insertAIResponseAsNetwork = async (payload) => {
  if (!cyInstance.value) return

  const { content, networkData } = payload

  if (!networkData?.paths && !networkData?.degreesOfSeparation) {
    showStatus('No network data found', 'warning')
    return
  }

  const extent = cyInstance.value.extent()
  const centerX = (extent.x1 + extent.x2) / 2
  const centerY = (extent.y1 + extent.y2) / 2

  // Create network visualization node
  const networkNodeId = generateUUID()
  cyInstance.value.add({
    data: {
      id: networkNodeId,
      label: 'Network Map',
      type: 'network',
      color: '#e3f2fd',
      visible: true,
      data: {
        title: 'Forbindelseskart',
        paths: networkData.paths || [],
        degreesOfSeparation: networkData.degreesOfSeparation,
        centerPerson: networkData.proff_find_business_network?.fromPerson || null
      },
      createdAt: new Date().toISOString()
    },
    position: { x: centerX, y: centerY }
  })

  // If we have path data, also create individual person nodes
  if (networkData.paths && networkData.paths.length > 0) {
    const path = networkData.paths[0]
    const nodeSpacing = 200
    let xOffset = -((path.persons?.length || 0) * nodeSpacing) / 2

    path.persons?.forEach((person, idx) => {
      const personNodeId = generateUUID()
      cyInstance.value.add({
        data: {
          id: personNodeId,
          label: person.name || `Person ${idx + 1}`,
          type: 'person-profile',
          color: '#e8f5e9',
          visible: true,
          data: {
            personId: person.personId || '',
            name: person.name || '',
            roles: person.roles || []
          }
        },
        position: { x: centerX + xOffset, y: centerY + 150 }
      })
      xOffset += nodeSpacing

      // Create edge from previous person
      if (idx > 0) {
        const prevPerson = path.persons[idx - 1]
        // Find the previous node we just created
        const prevNodes = cyInstance.value.nodes().filter(n => n.data('data')?.personId === prevPerson.personId)
        if (prevNodes.length > 0) {
          cyInstance.value.add({
            data: {
              id: generateUUID(),
              source: prevNodes[0].id(),
              target: personNodeId,
              label: path.companies?.[idx - 1]?.name || 'via',
              type: 'connection'
            }
          })
        }
      }
    })
  }

  showStatus('Network diagram inserted with nodes', 'success')
  await saveGraph()
}

// AI Chat Panel - Insert person network canvas from Proff person data with connections
const insertAIResponseAsPersonNetwork = async (payload) => {
  if (!cyInstance.value) return

  const { personData } = payload

  if (!personData?.connections || !Array.isArray(personData.connections)) {
    showStatus('No person connections found', 'warning')
    return
  }

  const extent = cyInstance.value.extent()
  const centerX = (extent.x1 + extent.x2) / 2
  const centerY = (extent.y1 + extent.y2) / 2

  // Create the person network canvas node
  const networkCanvasId = generateUUID()
  const nodeInfo = JSON.stringify({
    personId: personData.personId,
    name: personData.name,
    gender: personData.gender,
    age: personData.age,
    roles: personData.roles || [],
    connections: personData.connections,
    industryConnections: personData.industryConnections || []
  })

  cyInstance.value.add({
    data: {
      id: networkCanvasId,
      label: `${personData.name} sitt nettverk`,
      type: 'person-network-canvas',
      color: '#f3e8ff',
      visible: true,
      info: nodeInfo,
      data: {
        personId: personData.personId,
        name: personData.name,
        gender: personData.gender,
        connections: personData.connections
      },
      createdAt: new Date().toISOString()
    },
    position: { x: centerX, y: centerY }
  })

  showStatus(`Nettverkskart for ${personData.name} opprettet med ${personData.connections.length} forbindelser`, 'success')
  await saveGraph()
}

const handleImportGraphAsCluster = (payload) => {
  if (!payload?.graphId) return
  importGraphAsCluster(payload.graphId, payload.title || `Graph ${payload.graphId}`)
}

// AI Chat Panel - Update selection context when node is selected
const updateChatSelectionFromNode = () => {
  if (!cyInstance.value) {
    chatSelection.value = null
    return
  }

  const selectedNodes = cyInstance.value.nodes(':selected').filter(n => !n.isParent())

  if (selectedNodes.length === 0) {
    chatSelection.value = null
    return
  }

  if (selectedNodes.length === 1) {
    // Single node selection
    const singleNode = selectedNodes.first()
    const textContent = singleNode.data('fullText') || singleNode.data('info') || singleNode.data('label') || ''

    chatSelection.value = {
      text: textContent,
      nodeId: singleNode.id(),
      nodeLabel: singleNode.data('label'),
      nodeType: singleNode.data('type'),
      nodeData: singleNode.data(),
      source: 'node-selection',
      selectedNodes: [{
        id: singleNode.id(),
        label: singleNode.data('label'),
        type: singleNode.data('type'),
        data: singleNode.data()
      }],
      updatedAt: Date.now()
    }
  } else {
    // Multi-node selection
    const nodesInfo = selectedNodes.map(n => ({
      id: n.id(),
      label: n.data('label'),
      type: n.data('type'),
      data: n.data()
    }))

    // Create combined label: "Person A og Person B" or "Person A, Person B og Person C"
    const labels = nodesInfo.map(n => n.label).filter(Boolean)
    let combinedLabel = ''
    if (labels.length === 2) {
      combinedLabel = `${labels[0]} og ${labels[1]}`
    } else if (labels.length > 2) {
      combinedLabel = labels.slice(0, -1).join(', ') + ' og ' + labels[labels.length - 1]
    } else {
      combinedLabel = labels.join(', ')
    }

    // Combine text content from all nodes
    const combinedText = nodesInfo
      .map(n => n.data?.fullText || n.data?.info || n.label || '')
      .filter(Boolean)
      .join('\n\n---\n\n')

    chatSelection.value = {
      text: combinedText,
      nodeId: nodesInfo[0]?.id || null,
      nodeLabel: combinedLabel,
      nodeType: 'multi-selection',
      source: 'node-selection',
      selectedNodes: nodesInfo,
      updatedAt: Date.now()
    }
  }
}

const normalizeSelectionNode = (node) => {
  if (!node) return null
  return node.nodeType === Node.TEXT_NODE ? node.parentElement : node
}

const getSelectionContainer = (element) => {
  if (!element?.closest) return null
  return element.closest('.node-html-overlay, .youtube-modal')
}

const handleOverlayTextSelection = () => {
  const selection = window.getSelection?.()
  if (!selection || selection.isCollapsed) {
    if (chatSelection.value?.source === 'text-selection') {
      chatSelection.value = null
    }
    return
  }

  const selectedTextValue = selection.toString().trim()
  if (!selectedTextValue) return

  const anchorElement = normalizeSelectionNode(selection.anchorNode)
  const focusElement = normalizeSelectionNode(selection.focusNode)
  const anchorContainer = getSelectionContainer(anchorElement)
  const focusContainer = getSelectionContainer(focusElement)
  const selectionContainer = anchorContainer || focusContainer

  if (!selectionContainer) return

  let nodeData = null
  let nodeId = null
  let nodeLabel = 'Highlighted text'
  let nodeType = null

  if (selectionContainer.classList.contains('node-html-overlay')) {
    nodeId = selectionContainer.dataset.nodeId || null
    if (nodeId && cyInstance.value) {
      const node = cyInstance.value.getElementById(nodeId)
      if (node && node.length) {
        const data = node.data()
        nodeData = { ...data, id: nodeId }
        nodeLabel = data.label || nodeLabel
        nodeType = data.type || null
      }
    }
  } else if (selectionContainer.classList.contains('youtube-modal') && youtubeModalNode.value) {
    nodeData = youtubeModalNode.value
    nodeId = youtubeModalNode.value.id || null
    nodeLabel = youtubeModalNode.value.label || nodeLabel
    nodeType = youtubeModalNode.value.type || null
  }

  chatSelection.value = {
    text: selectedTextValue,
    nodeId,
    nodeLabel,
    nodeType,
    nodeData,
    source: 'text-selection',
    selectedNodes: nodeData
      ? [{
          id: nodeId,
          label: nodeLabel,
          type: nodeType,
          data: nodeData,
        }]
      : [],
    updatedAt: Date.now(),
  }
}

// Lifecycle
onMounted(async () => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('selectionchange', handleOverlayTextSelection)

  // Clamp chat width on window resize
  window.addEventListener('resize', handleWindowResize)

  // Close context menu when clicking outside
  document.addEventListener('click', (e) => {
    const contextMenuEl = document.querySelector('.context-menu')
    if (contextMenu.value.show && contextMenuEl && !contextMenuEl.contains(e.target)) {
      contextMenu.value.show = false
    }
  })

  if (!userStore.loggedIn) {
    router.push('/login')
    return
  }

  // Check URL parameters first
  const urlGraphId = route.query.graphId
  if (urlGraphId) {
    console.log('Found graphId in URL:', urlGraphId)
    graphStore.setCurrentGraphId(urlGraphId)
  }

  // Initialize empty canvas first
  setTimeout(() => {
    initializeEmptyCanvas()
  }, 100)

  await loadGraphs()

  // Auto-load current graph if one is stored
  if (graphStore.currentGraphId) {
    console.log('Auto-loading stored graph:', graphStore.currentGraphId)
    await loadGraph()
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('selectionchange', handleOverlayTextSelection)
  // Clean up chat resize listeners
  document.removeEventListener('mousemove', handleChatResize)
  document.removeEventListener('mouseup', stopChatResize)
  // Clean up node resize listeners
  document.removeEventListener('mousemove', handleNodeResize)
  document.removeEventListener('mouseup', stopNodeResize)
  // Clean up node rotation listeners
  document.removeEventListener('mousemove', handleNodeRotation)
  document.removeEventListener('mouseup', stopNodeRotation)
  window.removeEventListener('resize', handleWindowResize)
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {})
  }
  if (cyInstance.value) {
    cyInstance.value.destroy()
  }
})
</script>

<style scoped>
.graph-canvas {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
  position: relative;
}

:global(.graph-canvas:fullscreen),
:global(.graph-canvas:-webkit-full-screen) {
  height: 100vh;
  width: 100vw;
  background: #f8f9fa;
}

.canvas-toolbar {
  background: white;
  border-bottom: 1px solid #dee2e6;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.canvas-title {
  margin: 0;
  color: #495057;
  font-size: 1.25rem;
  font-weight: 600;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.search-input {
  width: 200px;
}

.status-bar {
  padding: 0.5rem 1rem;
  text-align: center;
  font-weight: 500;
}

.alert-success {
  background-color: #d4edda;
  color: #155724;
}
.alert-info {
  background-color: #d1ecf1;
  color: #0c5460;
}
.alert-warning {
  background-color: #fff3cd;
  color: #856404;
}
.alert-danger {
  background-color: #f8d7da;
  color: #721c24;
}

.canvas-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  transition: flex 0.2s ease;
}

/* Canvas Grid Overlay */
.canvas-grid-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background-image:
    linear-gradient(to right, rgba(100, 100, 100, 0.15) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(100, 100, 100, 0.15) 1px, transparent 1px);
  background-repeat: repeat;
}

/* Grid size selector in toolbar */
.grid-size-select {
  width: 75px;
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
  border-radius: 0 0.25rem 0.25rem 0;
}

.node-html-overlays {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: contents;
}

.node-html-overlay {
  position: absolute;
  pointer-events: none;
  user-select: none;
}

.node-html-overlay.is-selected {
  pointer-events: auto;
  user-select: text;
  cursor: text;
}

.node-html-overlay :deep(.gnew-default-node) {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}

.node-html-overlay :deep(.gnew-video-node) {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}

.node-html-overlay :deep(.gnew-audio-visualizer-node) {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}

.node-html-overlay :deep(.gnew-guide-node) {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}

.node-html-overlay :deep(.node-content) {
  max-height: 100%;
  overflow: hidden;
}

.node-html-overlay.is-selected :deep(.node-content) {
  user-select: text;
}

.node-html-overlay.is-selected :deep(.gnew-default-node) {
  box-shadow: 0 0 0 3px #0d6efd, 0 2px 8px rgba(0, 0, 0, 0.12);
}

.youtube-play-buttons {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 4;
}

.youtube-play-button {
  position: absolute;
  border: none;
  border-radius: 999px;
  background: rgba(220, 38, 38, 0.92);
  color: #fff;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.18);
  transition: transform 0.15s ease, background 0.15s ease;
}

.youtube-play-button:hover {
  transform: scale(1.08);
  background: rgba(185, 28, 28, 0.95);
}

.youtube-play-button:active {
  transform: scale(0.98);
}

.youtube-modal {
  position: fixed;
  width: min(960px, 92vw);
  max-width: 95vw;
  max-height: 90vh;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.youtube-modal-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 11000;
}

.youtube-modal {
  pointer-events: auto;
}

.youtube-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.youtube-modal-header {
  cursor: move;
  user-select: none;
}

.youtube-modal .modal-body {
  padding: 16px 20px 24px;
  height: calc(100% - 64px);
  overflow: auto;
}

.youtube-modal-resize-handle {
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  border-right: 2px solid #9ca3af;
  border-bottom: 2px solid #9ca3af;
  border-radius: 2px;
  opacity: 0.7;
}

/* AI Chat Panel Layout */
.canvas-with-chat {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.canvas-with-chat.chat-open .canvas-container {
  flex: 1;
}

.chat-resize-handle {
  width: 6px;
  cursor: ew-resize;
  background: linear-gradient(90deg, transparent, #e0e0e0, transparent);
  transition: background 0.2s;
  flex-shrink: 0;
}

.chat-resize-handle:hover {
  background: linear-gradient(90deg, transparent, #007bff, transparent);
}

.chat-resize-handle:active {
  background: linear-gradient(90deg, transparent, #0056b3, transparent);
}

.chat-panel-container {
  height: 100%;
  min-width: 300px;
  max-width: 800px;
  border-left: 1px solid #e0e0e0;
  background: #fff;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.ai-chat-toggle {
  font-weight: 500;
  transition: all 0.2s ease;
}

.ai-chat-toggle:hover {
  transform: scale(1.02);
}

.ai-chat-toggle.btn-primary {
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
}

.floating-node-menu {
  position: absolute;
  left: 1rem;
  top: calc(1rem + 100px);
  width: 240px;
  background: rgba(255, 255, 255, 0.97);
  border: 1px solid #dee2e6;
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 5;
}

.floating-node-menu .menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.floating-node-menu .menu-status {
  font-size: 0.75rem;
  color: #0d6efd;
}

.floating-node-menu .btn {
  width: 100%;
}

.floating-node-menu .btn.active {
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.5);
}

.floating-node-menu .menu-hint {
  font-size: 0.8rem;
  color: #495057;
  margin: 0;
}

.floating-node-menu .shape-options {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #dee2e6;
}

.floating-node-menu .menu-subheader {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6c757d;
  margin-bottom: 0.25rem;
  text-transform: uppercase;
}

.floating-node-menu .shape-buttons {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.floating-node-menu .shape-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.floating-node-menu .color-options {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #dee2e6;
}

.floating-node-menu .color-buttons {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.floating-node-menu .color-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 4px;
  border: 2px solid #dee2e6;
  cursor: pointer;
  transition: transform 0.1s, border-color 0.1s;
}

.floating-node-menu .color-btn:hover {
  transform: scale(1.1);
  border-color: #0969DA;
}

.floating-node-menu .color-picker-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.floating-node-menu .color-picker-input {
  width: 36px;
  height: 28px;
  padding: 0;
  border: 2px solid #dee2e6;
  border-radius: 4px;
  cursor: pointer;
}

.floating-node-menu .color-picker-input:hover {
  border-color: #0969DA;
}

.floating-node-menu .color-picker-label {
  font-size: 0.75rem;
  color: #6c757d;
}

/* Edge Info Editor */
.floating-node-menu .edge-info-editor {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 2px solid #ffc107;
  background: rgba(255, 193, 7, 0.1);
  padding: 0.75rem;
  border-radius: 6px;
  margin-left: -0.5rem;
  margin-right: -0.5rem;
}

.floating-node-menu .edge-info-textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-size: 0.85rem;
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
}

.floating-node-menu .edge-info-textarea:focus {
  outline: none;
  border-color: #ffc107;
  box-shadow: 0 0 0 2px rgba(255, 193, 7, 0.25);
}

.floating-node-menu .edge-info-textarea::placeholder {
  color: #adb5bd;
}

.cytoscape-canvas {
  width: 100%;
  height: 100%;
  background: white;
}

.selection-info {
  position: absolute;
  bottom: 1rem;
  left: 1rem;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.875rem;
}

.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 200px;
  padding: 0.25rem 0;
}

.context-menu-section {
  padding: 0.25rem 0;
}

.context-menu-header {
  padding: 0.25rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6c757d;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.context-menu-divider {
  height: 1px;
  background-color: #dee2e6;
  margin: 0.25rem 0;
}

.context-menu-item {
  padding: 0.5rem 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: background-color 0.2s;
}

.context-menu-item:hover {
  background-color: #f8f9fa;
}

.context-menu-item.danger:hover {
  background-color: #fee;
  color: #dc3545;
}

.context-menu-icon {
  font-size: 1.1rem;
}

.context-menu-font-sizes {
  display: flex;
  gap: 4px;
  padding: 4px 8px;
}

.font-size-btn {
  width: 32px;
  height: 28px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.15s ease;
}

.font-size-btn:hover {
  background: #f0f0f0;
  border-color: #ccc;
}

.font-size-btn.active {
  background: #007bff;
  color: #fff;
  border-color: #007bff;
}

.graph-canvas.placement-active .cytoscape-canvas {
  cursor: crosshair;
}

.graph-canvas.edge-active .cytoscape-canvas {
  cursor: pointer;
}

.graph-canvas.interaction-locked .cytoscape-canvas {
  user-select: none;
}

.graph-import-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.graph-import-modal {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.graph-import-modal .modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.graph-import-modal .modal-header h5 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.graph-import-modal .modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.info-modal {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 700px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.info-modal .modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-modal .modal-header h5 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.info-modal .modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.info-modal .modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #dee2e6;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.info-textarea {
  font-family: 'Courier New', Courier, monospace;
  font-size: 16px;
  line-height: 1.5;
  resize: vertical;
  color: #000;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.btn-close:hover {
  opacity: 1;
}

.graph-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.graph-card {
  padding: 1rem;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.graph-card:hover {
  border-color: #0969DA;
  background: #f8f9fa;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.graph-card-title {
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #212529;
}

.graph-card-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.graph-card-meta .badge {
  align-self: flex-start;
  font-size: 0.75rem;
}

/* Highlighted nodes */
:global(.highlighted) {
  background-color: #ff5722 !important;
  border-color: #d84315 !important;
}

/* Node Resize Handles */
.node-resize-handles {
  position: absolute;
  pointer-events: none;
  z-index: 100;
  border: 2px solid #0969DA;
  border-radius: 2px;
  box-sizing: border-box;
}

.resize-handle {
  position: absolute;
  background: #0969DA;
  border: 2px solid white;
  border-radius: 2px;
  pointer-events: auto;
  z-index: 101;
}

/* Edge handles (top, bottom, left, right) */
.resize-handle-n,
.resize-handle-s {
  width: 12px;
  height: 8px;
  left: 50%;
  transform: translateX(-50%);
  cursor: ns-resize;
}

.resize-handle-n {
  top: -5px;
}

.resize-handle-s {
  bottom: -5px;
}

.resize-handle-e,
.resize-handle-w {
  width: 8px;
  height: 12px;
  top: 50%;
  transform: translateY(-50%);
  cursor: ew-resize;
}

.resize-handle-e {
  right: -5px;
}

.resize-handle-w {
  left: -5px;
}

/* Corner handles */
.resize-handle-ne,
.resize-handle-nw,
.resize-handle-se,
.resize-handle-sw {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.resize-handle-ne {
  top: -6px;
  right: -6px;
  cursor: nesw-resize;
}

.resize-handle-nw {
  top: -6px;
  left: -6px;
  cursor: nwse-resize;
}

.resize-handle-se {
  bottom: -6px;
  right: -6px;
  cursor: nwse-resize;
}

.resize-handle-sw {
  bottom: -6px;
  left: -6px;
  cursor: nesw-resize;
}

.resize-handle:hover {
  background: #0550ae;
  transform-origin: center;
}

/* Rotation handle - positioned above the node */
.rotation-handle {
  position: absolute;
  top: -35px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 24px;
  background: #10B981;
  border: 2px solid white;
  border-radius: 50%;
  cursor: grab;
  pointer-events: auto;
  z-index: 102;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.15s ease;
}

.rotation-handle:hover {
  background: #059669;
  transform: translateX(-50%) scale(1.15);
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
}

.rotation-handle:active {
  cursor: grabbing;
  background: #047857;
}

/* Connector line from rotation handle to node */
.node-resize-handles::before {
  content: '';
  position: absolute;
  top: -25px;
  left: 50%;
  width: 2px;
  height: 20px;
  background: #10B981;
  transform: translateX(-50%);
  pointer-events: none;
}

.resize-handle-n:hover,
.resize-handle-s:hover {
  transform: translateX(-50%) scale(1.1);
}

.resize-handle-e:hover,
.resize-handle-w:hover {
  transform: translateY(-50%) scale(1.1);
}

.resize-handle-ne:hover,
.resize-handle-nw:hover,
.resize-handle-se:hover,
.resize-handle-sw:hover {
  transform: scale(1.2);
}

/* Group Selection Box */
.group-selection-box {
  position: absolute;
  border: 2px dashed #6366f1;
  border-radius: 4px;
  background: rgba(99, 102, 241, 0.08);
  cursor: move;
  z-index: 99;
  box-sizing: border-box;
}

.group-selection-box:hover {
  background: rgba(99, 102, 241, 0.15);
  border-color: #4f46e5;
}

.group-selection-box:active {
  background: rgba(99, 102, 241, 0.2);
  border-color: #4338ca;
}

.group-selection-label {
  position: absolute;
  top: -28px;
  left: 50%;
  transform: translateX(-50%);
  background: #6366f1;
  color: white;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

/* Responsive design */
@media (max-width: 768px) {
  .canvas-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-section {
    justify-content: center;
  }

  .search-input {
    width: 100%;
  }
}
</style>
