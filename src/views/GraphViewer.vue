<template>
  <div class="graph-viewer container">
    <!-- ============================= -->
    <!-- MAIN ACTION TOOLBAR          -->
    <!-- Document-level actions:      -->
    <!-- Print, Save as PDF, Export,  -->
    <!-- AI Node Generation           -->
    <!-- ============================= -->
    <button @click="printGraph" class="btn btn-primary mb-3">Print</button>
    <button @click="saveAsHtml2Pdf" class="btn btn-warning mb-3 ms-2">Save as PDF</button>
    <button @click="openShareModal" class="btn btn-success mb-3 ms-2">
      <i class="bi bi-share"></i> Share
    </button>
    <button
      v-if="userStore.loggedIn && ['Admin', 'Superadmin'].includes(userStore.role)"
      @click="saveToMystmkraFromMenu"
      class="btn btn-info mb-3 ms-2"
    >
      Save to Mystmkra.io
    </button>
    <button
      v-if="userStore.loggedIn && ['Admin', 'Superadmin'].includes(userStore.role)"
      @click="handleAINodeClick"
      class="btn btn-info mb-3 ms-2"
    >
      AI NODE
    </button>
    <button
      v-if="userStore.loggedIn && ['Admin', 'Superadmin'].includes(userStore.role)"
      @click="handleEnhancedAINodeClick"
      class="btn btn-info mb-3 ms-2"
    >
      Enhanced AI NODE
    </button>
    <button
      v-if="userStore.loggedIn && ['Admin', 'Superadmin'].includes(userStore.role)"
      @click="handleAIImageClick"
      class="btn btn-success mb-3 ms-2"
    >
      AI IMAGE
    </button>
    <button
      v-if="userStore.loggedIn"
      @click="navigateToR2Portfolio"
      class="btn btn-secondary mb-3 ms-2"
    >
      📁 R2 Portfolio
    </button>
    <button
      v-if="userStore.loggedIn && ['Admin', 'Superadmin'].includes(userStore.role)"
      @click="openRAGSandboxModal()"
      class="btn btn-success mb-3 ms-2"
    >
      🧪 Create RAG Sandbox
    </button>
    <!-- Success Message at the top -->
    <div v-if="saveMessage" class="alert alert-success text-center" role="alert">
      {{ saveMessage }}
    </div>
    <div v-if="loading" class="loading">Loading...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else class="graph-container">
      <!-- Render only nodes with visible=true -->
      <div v-for="node in graphData.nodes.filter((n) => n.visible !== false)" :key="node.id">
        <div class="node-content-inner">
          <template v-if="node.type === 'markdown-image'">
            <!-- Node Control Bar: Edit Label, Edit Info, Copy to Graph, Delete, and Reorder Controls -->
            <NodeControlBar
              v-if="
                userStore.loggedIn && ['Admin', 'Editor', 'Superadmin'].includes(userStore.role)
              "
              :node-type="node.type"
              :position="getNodePosition(node)"
              :total="totalVisibleNodes"
              :is-first="getNodePosition(node) === 1"
              :is-last="getNodePosition(node) === totalVisibleNodes"
              :node-content="node.info || ''"
              @edit-label="openLabelEditor(node)"
              @edit-info="openMarkdownEditor(node)"
              @format-node="openTemplateSelector(node)"
              @quick-format="handleQuickFormat(node, $event)"
              @copy-node="openCopyNodeModal(node)"
              @delete-node="deleteNode(node)"
              @move-up="moveNodeUp(node)"
              @move-down="moveNodeDown(node)"
              @open-reorder="openReorderModal"
            />
            <div v-html="convertToHtml(node.label, node.id)"></div>
          </template>
          <template v-else-if="node.type === 'background'">
            <div class="image-wrapper">
              <img :src="node.label" alt="Background Image" />
            </div>
          </template>
          <template v-else-if="node.type === 'REG'">
            <iframe
              src="https://www.vegvisr.org/register?embed=true"
              style="width: 100%; height: 500px; border: none"
            ></iframe>
          </template>
          <template v-else-if="node.type === 'youtube-video'">
            <!-- Render YouTube video nodes -->
            <div class="youtube-section">
              <h3 class="youtube-title">{{ parseYoutubeVideoTitle(node.label) }}</h3>
              <iframe
                :src="parseYoutubeVideo(node.label)"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerpolicy="strict-origin-when-cross-origin"
                allowfullscreen
                class="youtube-iframe"
              ></iframe>
              <div class="node-info">
                <button @click="editYoutubeVideo(node)">Edit Video</button>
                <button @click="editYoutubeTitle(node)">Edit Title</button>
                <button @click="openMarkdownEditor(node)">Edit Info</button>
                <button
                  v-if="
                    userStore.loggedIn && ['Admin', 'Editor', 'Superadmin'].includes(userStore.role)
                  "
                  @click="openCopyNodeModal(node)"
                  class="copy-button"
                  title="Copy to another graph"
                >
                  Copy to Graph...
                </button>
                <button
                  v-if="
                    userStore.loggedIn && ['Admin', 'Editor', 'Superadmin'].includes(userStore.role)
                  "
                  @click="deleteNode(node)"
                  class="delete-button"
                  title="Delete Node"
                >
                  🗑️
                </button>
                <div
                  v-html="
                    convertToHtml(node.info || 'No additional information available.', node.id)
                  "
                ></div>
              </div>
            </div>
          </template>
          <template v-else-if="node.type === 'worknote'">
            <!-- Render worknote nodes -->
            <div class="work-note" :style="{ backgroundColor: node.color || '#FFD580' }">
              <h3 class="node-label">{{ node.label }}</h3>
              <NodeControlBar
                v-if="
                  userStore.loggedIn && ['Admin', 'Editor', 'Superadmin'].includes(userStore.role)
                "
                :node-type="node.type"
                :position="getNodePosition(node)"
                :total="totalVisibleNodes"
                :is-first="getNodePosition(node) === 1"
                :is-last="getNodePosition(node) === totalVisibleNodes"
                :node-content="node.info || ''"
                @edit-label="openLabelEditor(node)"
                @edit-info="openMarkdownEditor(node)"
                @format-node="openTemplateSelector(node)"
                @quick-format="handleQuickFormat(node, $event)"
                @copy-node="openCopyNodeModal(node)"
                @delete-node="deleteNode(node)"
                @move-up="moveNodeUp(node)"
                @move-down="moveNodeDown(node)"
                @open-reorder="openReorderModal"
              />
              <div
                v-html="convertToHtml(node.info || 'No additional information available.', node.id)"
              ></div>
            </div>
          </template>
          <template v-else-if="node.type === 'map'">
            <!-- Render map nodes -->
            <h3 class="node-label">{{ node.label }}</h3>
            <MapViewer
              v-if="node.path"
              :path="node.path"
              :map-id="node.mapId || 'efe3a8a8c093a07cf97c4b3c'"
              @place-changed="onPlaceChanged"
            />
            <div v-else class="text-danger">No map path provided for this node.</div>
            <div
              v-html="convertToHtml(node.info || 'No additional information available.', node.id)"
            ></div>
          </template>
          <template v-else-if="node.type === 'timeline'">
            <!-- Render timeline nodes -->
            <h3 class="node-label">{{ node.label }}</h3>
            <TimelineChart :data="node.info" />
          </template>
          <template v-else-if="node.type === 'chart'">
            <!-- Render chart nodes -->
            <h3 class="node-label">{{ node.label }}</h3>
            <BarChart :data="node.info" />
          </template>
          <template v-else-if="node.type === 'piechart'">
            <!-- Render pie chart nodes -->
            <h3 class="node-label">{{ node.label }}</h3>
            <PieChart :data="node.info" />
          </template>
          <template v-else-if="node.type === 'linechart'">
            <!-- Render line chart nodes -->
            <h3 class="node-label">{{ node.label }}</h3>
            <div class="node-info">
              <NodeControlBar
                v-if="
                  userStore.loggedIn && ['Admin', 'Editor', 'Superadmin'].includes(userStore.role)
                "
                :node-type="node.type"
                :position="getNodePosition(node)"
                :total="totalVisibleNodes"
                :is-first="getNodePosition(node) === 1"
                :is-last="getNodePosition(node) === totalVisibleNodes"
                :node-content="node.info || ''"
                @edit-label="openLabelEditor(node)"
                @edit-info="openMarkdownEditor(node)"
                @format-node="openTemplateSelector(node)"
                @quick-format="handleQuickFormat(node, $event)"
                @copy-node="openCopyNodeModal(node)"
                @delete-node="deleteNode(node)"
                @move-up="moveNodeUp(node)"
                @move-down="moveNodeDown(node)"
                @open-reorder="openReorderModal"
              />
              <LineChart :data="node.info" :xLabel="node.xLabel" :yLabel="node.yLabel" />
              <div v-if="node.description" v-html="convertToHtml(node.description, node.id)"></div>
            </div>
          </template>
          <template v-else-if="node.type === 'swot'">
            <!-- Render SWOT diagram nodes -->
            <h3 class="node-label">{{ node.label }}</h3>
            <SWOTDiagram :data="node.info" />
          </template>
          <template v-else-if="node.type === 'bubblechart'">
            <!-- Render bubble chart nodes -->
            <h3 class="node-label">{{ node.label }}</h3>
            <BubbleChart :data="node.info" />
          </template>
          <template v-else-if="node.type === 'mermaid-diagram'">
            <h3 class="node-label">{{ node.label }}</h3>
            <Mermaid :code="node.info" />
          </template>
          <template v-else-if="node.type === 'fulltext'">
            <!-- Render fulltext nodes -->
            <h3 class="node-label">{{ node.label }}</h3>
            <div class="node-info">
              <NodeControlBar
                v-if="
                  userStore.loggedIn && ['Admin', 'Editor', 'Superadmin'].includes(userStore.role)
                "
                :node-type="node.type"
                :position="getNodePosition(node)"
                :total="totalVisibleNodes"
                :is-first="getNodePosition(node) === 1"
                :is-last="getNodePosition(node) === totalVisibleNodes"
                :node-content="node.info || ''"
                @edit-label="openLabelEditor(node)"
                @edit-info="openMarkdownEditor(node)"
                @format-node="openTemplateSelector(node)"
                @quick-format="handleQuickFormat(node, $event)"
                @copy-node="openCopyNodeModal(node)"
                @delete-node="deleteNode(node)"
                @move-up="moveNodeUp(node)"
                @move-down="moveNodeDown(node)"
                @open-reorder="openReorderModal"
              />
              <div
                v-html="convertToHtml(node.info || 'No additional information available.', node.id)"
              ></div>
            </div>
          </template>
          <template v-else-if="node.type === 'worker-code'">
            <h3 class="node-label">{{ node.label }}</h3>
            <div class="node-info">
              <NodeControlBar
                v-if="
                  userStore.loggedIn && ['Admin', 'Editor', 'Superadmin'].includes(userStore.role)
                "
                :node-type="node.type"
                :position="getNodePosition(node)"
                :total="totalVisibleNodes"
                :is-first="getNodePosition(node) === 1"
                :is-last="getNodePosition(node) === totalVisibleNodes"
                :node-content="node.info || ''"
                @edit-label="openLabelEditor(node)"
                @edit-info="openMarkdownEditor(node)"
                @format-node="openTemplateSelector(node)"
                @quick-format="handleQuickFormat(node, $event)"
                @copy-node="openCopyNodeModal(node)"
                @delete-node="deleteNode(node)"
                @move-up="moveNodeUp(node)"
                @move-down="moveNodeDown(node)"
                @open-reorder="openReorderModal"
              />
              <pre class="worker-code-block">{{ node.info }}</pre>
            </div>
          </template>
          <template v-else>
            <!-- Render other node types -->
            <template v-if="node.type === 'title'">
              <!-- For title nodes, only render the info content without the label -->
              <div class="title-content">
                <NodeControlBar
                  v-if="
                    userStore.loggedIn && ['Admin', 'Editor', 'Superadmin'].includes(userStore.role)
                  "
                  :node-type="node.type"
                  :position="getNodePosition(node)"
                  :total="totalVisibleNodes"
                  :is-first="getNodePosition(node) === 1"
                  :is-last="getNodePosition(node) === totalVisibleNodes"
                  :node-content="node.info || ''"
                  @edit-label="openLabelEditor(node)"
                  @edit-info="openMarkdownEditor(node)"
                  @format-node="openTemplateSelector(node)"
                  @quick-format="handleQuickFormat(node, $event)"
                  @copy-node="openCopyNodeModal(node)"
                  @delete-node="deleteNode(node)"
                  @move-up="moveNodeUp(node)"
                  @move-down="moveNodeDown(node)"
                  @open-reorder="openReorderModal"
                />
                <div
                  v-html="
                    convertToHtml(
                      node.info || 'No content yet. Click Edit Title to add content.',
                      node.id,
                    )
                  "
                ></div>
              </div>
            </template>
            <template v-else-if="node.type === 'action_test'">
              <!-- For action_test nodes, render endpoint URL and question -->
              <div class="action-test-content">
                <h3 class="node-label">{{ node.label }}</h3>
                <NodeControlBar
                  v-if="
                    userStore.loggedIn && ['Admin', 'Editor', 'Superadmin'].includes(userStore.role)
                  "
                  :node-type="node.type"
                  :position="getNodePosition(node)"
                  :total="totalVisibleNodes"
                  :is-first="getNodePosition(node) === 1"
                  :is-last="getNodePosition(node) === totalVisibleNodes"
                  :node-content="node.info || ''"
                  @edit-label="openLabelEditor(node)"
                  @edit-info="openMarkdownEditor(node)"
                  @format-node="openTemplateSelector(node)"
                  @quick-format="handleQuickFormat(node, $event)"
                  @copy-node="openCopyNodeModal(node)"
                  @delete-node="deleteNode(node)"
                  @move-up="moveNodeUp(node)"
                  @move-down="moveNodeDown(node)"
                  @open-reorder="openReorderModal"
                  @get-ai-response="handleGetAIResponse(node)"
                />
                <div class="action-test-info">
                  <div class="endpoint-info"><strong>🔗 Endpoint:</strong> {{ node.label }}</div>
                  <div class="question-info">
                    <strong>❓ Question:</strong>
                    <div class="question-content">{{ node.info || 'No question provided' }}</div>
                  </div>
                </div>
              </div>
            </template>
            <template v-else>
              <!-- For all other node types, render label + info -->
              <h3 class="node-label">{{ node.label }}</h3>
              <div class="node-info">
                <NodeControlBar
                  v-if="
                    userStore.loggedIn && ['Admin', 'Editor', 'Superadmin'].includes(userStore.role)
                  "
                  :node-type="node.type"
                  :position="getNodePosition(node)"
                  :total="totalVisibleNodes"
                  :is-first="getNodePosition(node) === 1"
                  :is-last="getNodePosition(node) === totalVisibleNodes"
                  :node-content="node.info || ''"
                  @edit-label="openLabelEditor(node)"
                  @edit-info="openMarkdownEditor(node)"
                  @format-node="openTemplateSelector(node)"
                  @quick-format="handleQuickFormat(node, $event)"
                  @copy-node="openCopyNodeModal(node)"
                  @delete-node="deleteNode(node)"
                  @move-up="moveNodeUp(node)"
                  @move-down="moveNodeDown(node)"
                  @open-reorder="openReorderModal"
                />
                <div
                  v-html="
                    convertToHtml(node.info || 'No additional information available.', node.id)
                  "
                ></div>
              </div>
            </template>
          </template>
        </div>
      </div>

      <!-- Markdown Editor Modal -->
      <div v-if="isMarkdownEditorOpen" class="markdown-editor-modal">
        <div class="modal-content">
          <h3>
            {{
              currentNode?.type === 'title'
                ? 'Edit Title (Markdown)'
                : currentNode?.type === 'linechart'
                  ? 'Edit Line Chart'
                  : ['chart', 'piechart', 'timeline', 'swot', 'bubblechart'].includes(
                        currentNode?.type,
                      )
                    ? 'Edit Chart Data (JSON)'
                    : 'Edit Info (Markdown)'
            }}
          </h3>

          <!-- Line Chart Sheet Editor -->
          <div
            v-if="currentNode?.type === 'linechart' && !isJsonMode"
            class="linechart-sheet-editor"
          >
            <div class="chart-settings">
              <div class="setting-row">
                <label>Chart Title:</label>
                <input
                  v-model="chartSheetData.title"
                  class="chart-input"
                  placeholder="Enter chart title"
                />
              </div>
              <div class="setting-row">
                <label>X-Axis Label:</label>
                <input
                  v-model="chartSheetData.xLabel"
                  class="chart-input"
                  placeholder="X-axis label"
                />
              </div>
              <div class="setting-row">
                <label>Y-Axis Label:</label>
                <input
                  v-model="chartSheetData.yLabel"
                  class="chart-input"
                  placeholder="Y-axis label"
                />
              </div>
            </div>

            <div class="chart-data-table">
              <table class="sheet-table">
                <thead>
                  <tr>
                    <th>Labels</th>
                    <th v-for="(series, i) in chartSheetData.series" :key="i" class="series-header">
                      <input
                        v-model="series.label"
                        class="series-name-input"
                        placeholder="Series Name"
                      />
                      <button
                        @click="removeSeries(i)"
                        v-if="chartSheetData.series.length > 1"
                        class="remove-series-btn"
                      >
                        ❌
                      </button>
                    </th>
                    <th v-if="chartSheetData.series.length < 5">
                      <button @click="addSeries" class="add-series-btn">+ Series</button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, i) in chartSheetData.rows" :key="i">
                    <td>
                      <input v-model="row.label" class="label-input" placeholder="Label" />
                    </td>
                    <td v-for="(series, j) in chartSheetData.series" :key="j">
                      <input
                        type="number"
                        v-model.number="row.values[j]"
                        class="value-input"
                        placeholder="0"
                      />
                    </td>
                    <td v-if="chartSheetData.rows.length > 1">
                      <button @click="removeRow(i)" class="remove-row-btn">🗑️</button>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div class="table-actions">
                <button @click="addRow" v-if="chartSheetData.rows.length < 5" class="add-row-btn">
                  + Add Row
                </button>
                <button @click="switchToJsonMode" class="switch-mode-btn">
                  Switch to JSON for Saving...
                </button>
              </div>
            </div>
          </div>

          <!-- JSON/Markdown Editor (existing) -->
          <div v-else>
            <!-- Ensure the editor is visible and bound to currentMarkdown -->
            <div class="d-flex align-items-center gap-2">
              <button
                @click="insertSectionMarkdown"
                title="Insert Section"
                class="btn btn-link p-0"
              >
                <span class="material-icons">format_color_fill</span>
              </button>
              <button @click="insertQuoteMarkdown" title="Insert Quote" class="btn btn-link p-0">
                <span class="material-icons">format_quote</span>
              </button>
              <button
                @click="insertWNoteMarkdown"
                title="Insert Work Note"
                class="btn btn-link p-0"
              >
                <span class="material-icons">note</span>
              </button>
              <button
                @click="insertHeaderImageMarkdown"
                title="Insert Header Image"
                class="btn btn-link p-0"
              >
                <span class="material-icons">image</span>
              </button>
              <button
                @click="insertRightsideImageMarkdown"
                title="Insert Rightside Image"
                class="btn btn-link p-0"
              >
                <span class="material-icons">image</span>
              </button>
              <button
                @click="insertLeftsideImageMarkdown"
                title="Insert Leftside Image"
                class="btn btn-link p-0"
              >
                <span class="material-icons">image</span>
              </button>
              <button @click="insertFancyMarkdown" title="Insert Fancy" class="btn btn-link p-0">
                <span class="material-icons">format_paint</span>
              </button>
              <button
                @click="insertYoutubeVideoMarkdown"
                title="Insert Youtube Video"
                class="btn btn-link p-0"
              >
                <span class="material-icons">video_library</span>
              </button>
              <!-- Add AI Assist button to the modal toolbar -->
              <button
                v-if="
                  userStore.loggedIn && ['Admin', 'Editor', 'Superadmin'].includes(userStore.role)
                "
                @click="openAIAssistInEditor"
                title="AI Assist"
                class="btn btn-link p-0"
                style="
                  background: #6f42c1;
                  color: #fff;
                  border-radius: 4px;
                  border: none;
                  padding: 5px 10px;
                "
              >
                <span class="material-icons">smart_toy</span>
              </button>
            </div>
            <textarea
              v-model="currentMarkdown"
              class="form-control"
              style="width: 100%; height: 200px; font-family: monospace"
              ref="markdownEditorTextarea"
            ></textarea>
          </div>

          <div class="modal-actions">
            <button @click="handleSave">Save</button>
            <button @click="closeMarkdownEditor">Cancel</button>
            <button
              v-if="userStore.loggedIn && ['Admin', 'Superadmin'].includes(userStore.role)"
              @click="saveToMystmkra"
              class="btn btn-info"
            >
              Save to Mystmkra.io
            </button>
          </div>
        </div>
      </div>

      <!-- AI Assist Modal -->
      <div v-if="isAIAssistOpen" class="ai-assist-modal">
        <div class="ai-assist-content">
          <button class="ai-assist-close" @click="closeAIAssist" title="Close">&times;</button>
          <h4 v-if="!aiAssistMode">Vegvisr AI Assist</h4>
          <div v-if="!aiAssistMode">
            <div class="mb-2">
              <textarea
                v-model="aiAssistQuestion"
                class="form-control mb-1 ai-assist-questionarea"
                placeholder="Ask a question..."
                rows="3"
              />
              <button
                class="btn btn-outline-success"
                @click="runAIAssist('ask')"
                :disabled="!aiAssistQuestion"
              >
                Ask
              </button>
            </div>
            <div class="ai-assist-btn-row">
              <button class="btn btn-outline-primary ai-assist-btn" @click="runAIAssist('expand')">
                Elaborate on the text
              </button>
              <button class="btn btn-outline-warning ai-assist-btn" @click="runAIAssist('image')">
                Generate Header Image
              </button>
            </div>
          </div>
          <div v-else>
            <div v-if="aiAssistLoading" class="text-center my-3">
              <span class="spinner-border spinner-border-sm"></span> Loading AI response...
            </div>
            <div v-else-if="aiAssistResult" class="ai-assist-result-container">
              <div class="ai-assist-buttons">
                <button class="btn btn-primary" @click="insertAIAssistResultToEditor">
                  Insert at Cursor
                </button>
                <button class="btn btn-secondary" @click="closeAIAssist">Back</button>
              </div>
              <div class="alert alert-info">{{ aiAssistResult }}</div>
            </div>
            <div v-else-if="aiAssistImageUrl" class="ai-assist-image-container">
              <div class="ai-assist-buttons">
                <button class="btn btn-primary" @click="insertAIAssistResultToEditor">
                  Insert as Header Image
                </button>
                <button class="btn btn-secondary" @click="closeAIAssist">Back</button>
              </div>
              <img
                :src="aiAssistImageUrl"
                alt="AI Header"
                style="max-width: 100%; border-radius: 6px; margin-bottom: 10px"
              />
            </div>
            <div v-if="aiAssistError" class="alert alert-danger">{{ aiAssistError }}</div>
          </div>
        </div>
      </div>

      <!-- Add the AI Node Modal -->
      <AINodeModal
        :is-open="isAINodeModalOpen"
        :graph-context="graphData"
        @close="closeAINodeModal"
        @node-inserted="handleNodeInserted"
      />

      <!-- Add the Enhanced AI Node Modal -->
      <EnhancedAINodeModal
        :is-open="isEnhancedAINodeModalOpen"
        :graph-context="graphData"
        @close="closeEnhancedAINodeModal"
        @node-inserted="handleNodeInserted"
      />

      <!-- Add the AI Image Modal -->
      <AIImageModal
        :is-open="isAIImageModalOpen"
        :graph-context="graphData"
        @close="closeAIImageModal"
        @image-inserted="handleImageInserted"
      />

      <!-- Copy Node Modal -->
      <CopyNodeModal
        ref="copyNodeModal"
        :node-data="selectedNodeToCopy"
        :current-graph-id="knowledgeGraphStore.currentGraphId"
        @node-copied="handleNodeCopied"
      />

      <!-- Template Selector Modal -->
      <TemplateSelector
        :is-open="isTemplateSelectorOpen"
        :node-type="currentTemplateNode?.type || 'fulltext'"
        :node-content="currentTemplateNode?.info || ''"
        @close="closeTemplateSelector"
        @template-applied="handleTemplateApplied"
      />

      <!-- Image Selector Modal -->
      <ImageSelector
        :is-open="isImageSelectorOpen"
        :current-image-url="currentImageData.url"
        :current-image-alt="currentImageData.alt"
        :image-type="currentImageData.type"
        :image-context="currentImageData.context"
        :node-content="currentImageData.nodeContent"
        @close="closeImageSelector"
        @image-replaced="handleImageReplaced"
      />

      <!-- Google Photos Selector Modal -->
      <GooglePhotosSelector
        :is-open="isGooglePhotosSelectorOpen"
        :current-image-url="currentGooglePhotosData.url"
        :current-image-alt="currentGooglePhotosData.alt"
        :image-type="currentGooglePhotosData.type"
        :image-context="currentGooglePhotosData.context"
        @close="closeGooglePhotosSelector"
        @photo-selected="handleGooglePhotoSelected"
      />

      <!-- RAG Sandbox Modal -->
      <SandboxModal
        :is-visible="isRAGSandboxModalOpen"
        :graph-data="graphData"
        :graph-id="knowledgeGraphStore.currentGraphId"
        :user-id="userStore.user_id || 'anonymous'"
        :user-token="userStore.emailVerificationToken"
        @close="closeRAGSandboxModal"
      />

      <!-- Quick Format Loading Overlay -->
      <div v-if="isQuickFormatLoading" class="quick-format-loading-overlay">
        <div class="loading-content">
          <div class="spinner-large"></div>
          <h3>🤖 AI Processing</h3>
          <p>Applying formatting template...</p>
          <div class="loading-progress">
            <div class="progress-bar">
              <div class="progress-fill"></div>
            </div>
          </div>
          <small>This may take a few seconds. Please don't navigate away.</small>
        </div>
      </div>

      <!-- Label Editor Modal -->
      <div v-if="isLabelEditorOpen" class="label-editor-modal">
        <div class="modal-content">
          <h3>Edit Node Label</h3>
          <input
            v-model="currentLabelText"
            class="form-control"
            type="text"
            placeholder="Enter node label"
            ref="labelEditorInput"
            @keyup.enter="saveLabelChanges"
          />
          <div class="modal-actions">
            <button @click="saveLabelChanges">Save</button>
            <button @click="closeLabelEditor">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Reorder Modal -->
      <div v-if="isReorderModalOpen" class="reorder-modal">
        <div class="reorder-modal-content">
          <div class="reorder-header">
            <h3>Reorder Nodes</h3>
            <button class="reorder-close" @click="closeReorderModal" title="Close">&times;</button>
          </div>
          <div class="reorder-instructions">
            Drag nodes to reorder, or use the position numbers. Changes are saved automatically.
          </div>
          <div class="reorder-list">
            <div
              v-for="(node, index) in reorderableNodes"
              :key="node.id"
              class="reorder-item"
              :class="{ 'reorder-item-dragging': draggedNodeId === node.id }"
              draggable="true"
              @dragstart="onDragStart(node, index)"
              @dragover.prevent
              @drop="onDrop(node, index)"
              @dragend="onDragEnd"
            >
              <div class="reorder-item-content">
                <div class="drag-handle" title="Drag to reorder">≡≡</div>
                <div class="node-preview">
                  <div class="node-type-icon">{{ getNodeTypeIcon(node.type) }}</div>
                  <div class="node-details">
                    <div class="node-title">{{ getNodeDisplayName(node) }}</div>
                    <div class="node-type">{{ node.type }}</div>
                  </div>
                </div>
                <div class="position-input">
                  <label>Position:</label>
                  <input
                    type="number"
                    :value="node.order"
                    @input="updateNodePosition(node, $event.target.value)"
                    min="1"
                    :max="reorderableNodes.length"
                    class="position-number"
                  />
                </div>
              </div>
            </div>
          </div>
          <div class="reorder-actions">
            <button @click="resetOrder" class="btn btn-secondary">Reset to Default</button>
            <button @click="closeReorderModal" class="btn btn-primary">Done</button>
          </div>
        </div>
      </div>

      <!-- Action Test Loading Overlay -->
      <div v-if="isActionTestLoading" class="action-test-loading-overlay">
        <div class="loading-content">
          <div class="spinner-large"></div>
          <h3>{{ actionTestLoadingMessage }}</h3>
          <p>Processing AI request...</p>
          <div class="loading-progress">
            <div class="progress-bar">
              <div class="progress-fill"></div>
            </div>
          </div>
          <small>This may take a few seconds. Please don't navigate away.</small>
        </div>
      </div>

      <!-- Share Modal -->
      <div
        class="modal fade"
        id="shareModal"
        tabindex="-1"
        aria-labelledby="shareModalLabel"
        aria-hidden="true"
      >
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="shareModalLabel">Share Knowledge Graph</h5>
              <button
                type="button"
                class="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label for="shareContent" class="form-label">
                  Share Content
                  <span v-if="shareContent.includes('Generating')" class="text-muted">
                    <i class="bi bi-hourglass-split"></i> AI is creating an engaging summary...
                  </span>
                </label>
                <textarea
                  class="form-control"
                  id="shareContent"
                  rows="6"
                  v-model="shareContent"
                  readonly
                  :class="{ 'text-muted': shareContent.includes('Generating') }"
                ></textarea>
              </div>
              <div class="share-buttons d-flex gap-2 justify-content-center flex-wrap">
                <button
                  class="btn btn-outline-primary share-btn instagram-btn"
                  @click="shareToInstagram"
                  :disabled="shareContent.includes('Generating')"
                  title="Share to Instagram"
                >
                  <i class="bi bi-instagram"></i> Instagram
                </button>
                <button
                  class="btn btn-outline-primary share-btn linkedin-btn"
                  @click="shareToLinkedIn"
                  :disabled="shareContent.includes('Generating')"
                  title="Share to LinkedIn"
                >
                  <i class="bi bi-linkedin"></i> LinkedIn
                </button>
                <button
                  class="btn btn-outline-primary share-btn twitter-btn"
                  @click="shareToTwitter"
                  :disabled="shareContent.includes('Generating')"
                  title="Share to Twitter"
                >
                  <i class="bi bi-twitter-x"></i> Twitter
                </button>
                <button
                  class="btn btn-outline-primary share-btn facebook-btn"
                  @click="shareToFacebook"
                  :disabled="shareContent.includes('Generating')"
                  title="Share to Facebook"
                >
                  <i class="bi bi-facebook"></i> Facebook
                </button>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import { marked } from 'marked'
import { useUserStore } from '@/stores/userStore'
import MapViewer from '@/components/MapViewer.vue'
import TimelineChart from '@/components/TimelineChart.vue'
import BarChart from '@/components/BarChart.vue'
import PieChart from '@/components/PieChart.vue'
import LineChart from '@/components/LineChart.vue'
import SWOTDiagram from '@/components/SWOTDiagram.vue'
import BubbleChart from '@/components/BubbleChart.vue'
import html2pdf from 'html2pdf.js'
import Mermaid from '@/components/Mermaid.vue'
import mermaid from 'mermaid'
import AINodeModal from '@/components/AINodeModal.vue'
import EnhancedAINodeModal from '@/components/EnhancedAINodeModal.vue'
import AIImageModal from '@/components/AIImageModal.vue'
import CopyNodeModal from '@/components/CopyNodeModal.vue'
import NodeControlBar from '@/components/NodeControlBar.vue'
import TemplateSelector from '@/components/TemplateSelector.vue'
import ImageSelector from '@/components/ImageSelector.vue'
import GooglePhotosSelector from '@/components/GooglePhotosSelector.vue'
import SandboxModal from '@/components/SandboxModal.vue'
import { Modal } from 'bootstrap'
import { useBranding } from '@/composables/useBranding'

// Initialize Mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  logLevel: 'error',
})

const graphData = ref({ nodes: [], edges: [] })
const loading = ref(true)
const error = ref(null)
const saveMessage = ref('')
const knowledgeGraphStore = useKnowledgeGraphStore()
const userStore = useUserStore()
const router = useRouter()

// Add branding composable for domain detection (only importing for potential future use)
const { currentDomain, isCustomDomain } = useBranding()

// Dynamic API endpoint configuration
const getApiEndpoint = (endpoint) => {
  const currentHostname = window.location.hostname

  // If on custom domain, use relative paths for knowledge graph operations
  if (currentHostname !== 'www.vegvisr.org' && currentHostname !== 'localhost') {
    // Knowledge graph operations should go through proxy
    if (
      endpoint.includes('/getknowgraph') ||
      endpoint.includes('/saveGraphWithHistory') ||
      endpoint.includes('/saveknowgraph') ||
      endpoint.includes('/updateknowgraph') ||
      endpoint.includes('/deleteknowgraph')
    ) {
      return endpoint.replace(/https:\/\/knowledge\.vegvisr\.org/, '')
    }

    // API operations (AI, etc.) should still go to main API worker through proxy
    if (endpoint.includes('api.vegvisr.org')) {
      return endpoint.replace(/https:\/\/api\.vegvisr\.org/, '')
    }
  }

  // Default: return original endpoint for www.vegvisr.org
  return endpoint
}

// Copy node functionality
const copyNodeModal = ref(null)
const selectedNodeToCopy = ref(null)

// Template selector functionality
const isTemplateSelectorOpen = ref(false)
const currentTemplateNode = ref(null)

// Image selector functionality
const isImageSelectorOpen = ref(false)
const currentImageData = ref({
  url: '',
  alt: '',
  type: '',
  context: '',
  nodeId: '',
  nodeContent: '',
})

// Google Photos selector functionality
const isGooglePhotosSelectorOpen = ref(false)
const currentGooglePhotosData = ref({
  type: '',
  context: '',
  nodeId: '',
  nodeContent: '',
})

// RAG Sandbox modal functionality
const isRAGSandboxModalOpen = ref(false)

// Sharing functionality
const shareContent = ref('')
const shareModal = ref(null)

// Quick format loading state
const isQuickFormatLoading = ref(false)
const quickFormatCurrentNode = ref(null)

// Reordering functionality
const isReorderModalOpen = ref(false)
const reorderableNodes = ref([])
const draggedNodeId = ref(null)
const draggedFromIndex = ref(null)

const fetchGraphData = async () => {
  try {
    const graphId = knowledgeGraphStore.currentGraphId
    if (!graphId) {
      throw new Error('No graph ID is set in the store.')
    }

    const apiUrl = getApiEndpoint(`https://knowledge.vegvisr.org/getknowgraph?id=${graphId}`)
    const response = await fetch(apiUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch graph: ${response.statusText}`)
    }
    const data = await response.json()

    const uniqueNodes = []
    const seenIds = new Set()
    for (const node of data.nodes) {
      if (!seenIds.has(node.id)) {
        uniqueNodes.push({
          ...node,
          position: node.position || { x: 0, y: 0 }, // Ensure position is preserved
          visible: node.visible !== false,
          order: node.order || 0, // Ensure order field exists
        })
        seenIds.add(node.id)
      }
    }

    // Filter visible nodes and assign default order if not set
    const visibleNodes = uniqueNodes.filter((node) => node.visible !== false)
    visibleNodes.forEach((node, index) => {
      if (!node.order) {
        node.order = index + 1
      }
    })

    // Sort nodes by order field
    visibleNodes.sort((a, b) => (a.order || 0) - (b.order || 0))

    graphData.value = {
      ...data,
      nodes: visibleNodes,
    }

    // Update the store with the graph data
    knowledgeGraphStore.updateGraph(
      graphData.value.nodes.map((node) => ({
        ...node,
        position: node.position || { x: 0, y: 0 },
      })),
      graphData.value.edges,
    )
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const insertSectionMarkdown = () => {
  const textarea = document.querySelector('.markdown-editor-modal textarea')
  if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
    const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd)
    const sectionMarkdown = `[SECTION | background-color: 'lightyellow'; color: 'black']\n${selectedText}\n[END SECTION]`
    currentMarkdown.value =
      textarea.value.substring(0, textarea.selectionStart) +
      sectionMarkdown +
      textarea.value.substring(textarea.selectionEnd)
  } else {
    const sectionMarkdown =
      "[SECTION | background-color: 'lightblue'; color: 'black']\n\nYour content here\n\n[END SECTION]"
    currentMarkdown.value += `\n${sectionMarkdown}\n`
  }
}

const insertQuoteMarkdown = () => {
  const textarea = document.querySelector('.markdown-editor-modal textarea')
  if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
    const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd)
    const quoteMarkdown = `[QUOTE | Cited='Author']\n${selectedText}\n[END QUOTE]`
    currentMarkdown.value =
      textarea.value.substring(0, textarea.selectionStart) +
      quoteMarkdown +
      textarea.value.substring(textarea.selectionEnd)
  } else {
    const quoteMarkdown = "[QUOTE | Cited='Author']\n\nYour quote here\n\n[END QUOTE]"
    currentMarkdown.value += `\n${quoteMarkdown}\n`
  }
}

const insertWNoteMarkdown = () => {
  const textarea = document.querySelector('.markdown-editor-modal textarea')
  if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
    const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd)
    const wNoteMarkdown = `[WNOTE | Cited='Author']\n${selectedText}\n[END WNOTE]`
    currentMarkdown.value =
      textarea.value.substring(0, textarea.selectionStart) +
      wNoteMarkdown +
      textarea.value.substring(textarea.selectionEnd)
  } else {
    const wNoteMarkdown = "[WNOTE | Cited='Author']\n\nYour work note here\n\n[END WNOTE]"
    currentMarkdown.value += `\n${wNoteMarkdown}\n`
  }
}

const insertHeaderImageMarkdown = () => {
  const textarea = document.querySelector('.markdown-editor-modal textarea')
  const headerImageMarkdown = `![Header|height: 200px; object-fit: 'cover'; object-position: 'center'](https://vegvisr.imgix.net/HEADERIMG.png)`

  if (textarea && currentMarkdown.value !== undefined) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const textBefore = currentMarkdown.value.substring(0, start)
    const textAfter = currentMarkdown.value.substring(end)

    currentMarkdown.value = `${textBefore}${headerImageMarkdown}${textAfter}`

    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + headerImageMarkdown.length
      textarea.focus()
    }, 0)
  }
}

const insertRightsideImageMarkdown = () => {
  const textarea = document.querySelector('.markdown-editor-modal textarea')
  const rightsideImageMarkdown = `![Rightside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'](https://vegvisr.imgix.net/SIDEIMG.png)`

  if (textarea && currentMarkdown.value !== undefined) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const textBefore = currentMarkdown.value.substring(0, start)
    const textAfter = currentMarkdown.value.substring(end)

    currentMarkdown.value = `${textBefore}${rightsideImageMarkdown}${textAfter}`

    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + rightsideImageMarkdown.length
      textarea.focus()
    }, 0)
  }
}

const insertLeftsideImageMarkdown = () => {
  const textarea = document.querySelector('.markdown-editor-modal textarea')
  const leftsideImageMarkdown = `![Leftside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'](https://vegvisr.imgix.net/SIDEIMG.png)`
  if (textarea && currentMarkdown.value !== undefined) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const textBefore = currentMarkdown.value.substring(0, start)
    const textAfter = currentMarkdown.value.substring(end)

    currentMarkdown.value = `${textBefore}${leftsideImageMarkdown}${textAfter}`

    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + leftsideImageMarkdown.length
      textarea.focus()
    }, 0)
  }
}

const insertFancyMarkdown = () => {
  const textarea = document.querySelector('.markdown-editor-modal textarea')
  const fancyMarkdown = `[FANCY | font-size: 4.5em; color: lightblue; background-image: url('https://vegvisr.imgix.net/FANCYIMG.png'); text-align: center]\nYour fancy content here\n[END FANCY]`

  if (textarea && currentMarkdown.value !== undefined) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const textBefore = currentMarkdown.value.substring(0, start)
    const textAfter = currentMarkdown.value.substring(end)

    currentMarkdown.value = `${textBefore}${fancyMarkdown}${textAfter}`

    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + fancyMarkdown.length
      textarea.focus()
    }, 0)
  }
}

const insertYoutubeVideoMarkdown = () => {
  const textarea = document.querySelector('.markdown-editor-modal textarea')
  const videoUrl = prompt('Please enter the YouTube video URL:')

  if (videoUrl) {
    const videoIdMatch =
      videoUrl.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/) ||
      videoUrl.match(/(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)/) ||
      videoUrl.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/)
    const videoId = videoIdMatch ? videoIdMatch[1] : null

    if (videoId) {
      const youtubeMarkdown = `![YOUTUBE src=https://www.youtube.com/embed/${videoId}]Title goes here[END YOUTUBE]`

      if (textarea && currentMarkdown.value !== undefined) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const textBefore = currentMarkdown.value.substring(0, start)
        const textAfter = currentMarkdown.value.substring(end)

        currentMarkdown.value = `${textBefore}${youtubeMarkdown}${textAfter}`

        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + youtubeMarkdown.length
          textarea.focus()
        }, 0)
      }
    } else {
      alert('Invalid YouTube URL. Please try again.')
    }
  }
}

function preprocessPageBreaks(markdown) {
  return markdown.replace(/\[pb\]/gi, '<div class="page-break"></div>')
}

// Helper function to process leftside/rightside images
const processLeftRightImages = (text) => {
  // Split into blocks (paragraphs, images, etc.)
  const lines = text.split(/\n+/)
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    // Updated regex: match image at start of line, even if text follows
    const imageMatch = line.match(
      /^!\[(Rightside|Leftside)(?:-(\d+))?\s*\|\s*([^\]]+?)\s*\]\((.+?)\)(.*)$/,
    )
    if (imageMatch) {
      const type = imageMatch[1]
      const paragraphCount = parseInt(imageMatch[2], 10) || 1
      const styles = imageMatch[3].trim()
      const url = imageMatch[4].trim()
      const afterText = imageMatch[5].trim()
      // Collect the next N non-empty lines as paragraphs
      const consumedParagraphs = []
      // If there is text after the image on the same line, treat it as the first paragraph
      if (afterText) {
        consumedParagraphs.push(afterText)
      }
      let j = i + 1
      while (consumedParagraphs.length < paragraphCount && j < lines.length) {
        if (lines[j].trim() !== '') {
          consumedParagraphs.push(lines[j])
        }
        j++
      }
      // Helper to extract style values
      const getStyleValue = (styleString, key, fallback) => {
        const regex = new RegExp(key + ': *[\'"]?([^;\'"]+)[\'"]?', 'i')
        const found = styleString.match(regex)
        return found ? found[1].trim() : fallback
      }
      const width = (() => {
        let w = getStyleValue(styles, 'width', '20%')
        if (/^\d+$/.test(w)) w = w + 'px'
        return w
      })()
      let height = getStyleValue(styles, 'height', '200px')
      if (/^\d+$/.test(height)) height = height + 'px'
      const objectFit = getStyleValue(styles, 'object-fit', 'cover')
      const objectPosition = getStyleValue(styles, 'object-position', 'center')
      const sideParagraphs = marked.parse(consumedParagraphs.join('\n\n'))
      const containerClass = type === 'Rightside' ? 'rightside-container' : 'leftside-container'
      const contentClass = type === 'Rightside' ? 'rightside-content' : 'leftside-content'
      const imageClass = type === 'Rightside' ? 'rightside-image' : 'leftside-image'
      const imageSideClass = type === 'Rightside' ? 'rightside' : 'leftside'
      // Use a human-readable alt text
      const altText = type + ' Image'
      // Calculate dynamic width for containers if image is large

      if (width.endsWith('px')) {
        const widthValue = parseInt(width)
        if (widthValue > 200) {
          const containerWidth = 1000 // Typical container width
          const imagePercentage = Math.min((widthValue / containerWidth) * 100, 60) // Max 60%
          const contentPercentage = 100 - imagePercentage - 2 // 2% for gap

          const containerStyle = ` style="display: flex; gap: 20px; align-items: flex-start;"`
          const imageStyle = ` style="flex: 0 0 ${imagePercentage}%; width: ${imagePercentage}%; min-width: ${imagePercentage}%;"`
          const contentStyleAttr = ` style="flex: 1 1 auto; max-width: ${contentPercentage}%; min-width: 0; overflow-wrap: break-word;"`

          const containerHtml = `
            <div class="${containerClass} dynamic-width-container"${containerStyle}>
              <div class="${imageClass}"${imageStyle}>
                <img src="${url}" alt="${altText}" class="${imageSideClass}" style="width: ${width}; min-width: ${width}; height: ${height}; object-fit: ${objectFit}; object-position: ${objectPosition}; border-radius: 8px;" />
              </div>
              <div class="${contentClass}"${contentStyleAttr}>${sideParagraphs}</div>
            </div>
          `.trim()

          blocks.push(containerHtml)
          i = j
          continue
        }
      }

      const containerHtml = `
        <div class="${containerClass}">
          <div class="${imageClass}">
            <img src="${url}" alt="${altText}" class="${imageSideClass}" style="width: ${width}; min-width: ${width}; height: ${height}; object-fit: ${objectFit}; object-position: ${objectPosition}; border-radius: 8px;" />
          </div>
          <div class="${contentClass}">${sideParagraphs}</div>
        </div>
      `.trim()
      blocks.push(containerHtml)
      i = j // Skip the image line and the consumed paragraphs
      continue
    }
    // Otherwise, just add the line as a block
    if (line.trim() !== '') {
      blocks.push(line)
    }
    i++
  }
  return blocks.join('\n\n')
}

const preprocessMarkdown = (text) => {
  console.log('=== preprocessMarkdown called ===')
  console.log('Input text contains FANCY:', text.includes('[FANCY'))
  console.log('Text length:', text.length)

  // First, process [pb] page breaks
  let processedText = preprocessPageBreaks(text)

  // Process COMMENT blocks before any markdown parsing
  processedText = processedText.replace(
    /\[COMMENT\s*\|([^\]]*)\]([\s\S]*?)\[END COMMENT\]/g,
    (match, style, content) => {
      // Parse style string for author and CSS
      let author = ''
      let css = ''
      style.split(';').forEach((s) => {
        const [k, v] = s.split(':').map((x) => x && x.trim().replace(/^['"]|['"]$/g, ''))
        if (k && v) {
          if (k.toLowerCase() === 'author') {
            author = v
          } else {
            css += `${k}:${v};`
          }
        }
      })
      return `<div class="comment-block" style="${css}">
${author ? `<div class="comment-author">${author}</div>` : ''}
<div>${marked.parse(content.trim())}</div>
</div>\n\n`
    },
  )

  // Process fancy titles
  processedText = processedText.replace(
    /\[FANCY\s*\|([^\]]+)\]([\s\S]*?)\[END FANCY\]/g,
    (match, style, content) => {
      console.log('=== FANCY Processing ===')
      console.log('Original style:', style)

      // Convert style string to inline CSS
      const css = style
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          // Split only on the first colon to handle URLs with colons
          const colonIndex = s.indexOf(':')
          if (colonIndex === -1) return ''

          const k = s.substring(0, colonIndex).trim()
          const v = s.substring(colonIndex + 1).trim()

          if (!k || !v) return ''

          // Special handling for background-image to preserve url() quotes
          if (k === 'background-image' && v.includes('url(')) {
            console.log(`✅ Preserving background-image: ${k}:${v}`)
            return `${k}:${v}`
          }

          // Special handling for width and height - ensure units are added if missing
          if (k === 'width' || k === 'height') {
            // If the value is just a number, add px
            if (/^\d+(\.\d+)?$/.test(v)) {
              console.log(`✅ Adding px to ${k}: ${v} -> ${v}px`)
              return `${k}:${v}px`
            }
            // If it already has units or is a percentage, keep as is
            console.log(`✅ Keeping ${k} as is: ${v}`)
            return `${k}:${v}`
          }

          // For other properties, remove outer quotes but preserve inner content
          const cleanValue = v.replace(/^['"]|['"]$/g, '')
          return `${k}:${cleanValue}`
        })
        .join(';')

      console.log('Final CSS:', css)
      console.log('=== End FANCY Processing ===')

      return `<div class="fancy-title" style="${css}">${content.trim()}</div>`
    },
  )

  // Process leftside/rightside images FIRST (before sections and quotes)
  processedText = processLeftRightImages(processedText)

  // Process quotes
  processedText = processedText.replace(
    /\[QUOTE\s*\|([^\]]+)\]([\s\S]*?)\[END QUOTE\]/g,
    (match, style, content) => {
      const cite = style.split('=')[1]?.replace(/['"]/g, '') || 'Unknown'
      const processedContent = marked.parse(content.trim())
      return `<div class="fancy-quote">${processedContent}<cite>— ${cite}</cite></div>`
    },
  )

  // Then process sections (after leftside/rightside images have been processed)
  processedText = processedText.replace(
    /\[SECTION\s*\|([^\]]+)\]([\s\S]*?)\[END SECTION\]/g,
    (match, style, content) => {
      // Convert style string to inline CSS
      const css = style
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          // Split only on the first colon to handle URLs with colons
          const colonIndex = s.indexOf(':')
          if (colonIndex === -1) return ''

          const k = s.substring(0, colonIndex).trim()
          const v = s.substring(colonIndex + 1).trim()

          if (!k || !v) return ''

          // Special handling for background-image to preserve url() quotes
          if (k === 'background-image' && v.includes('url(')) {
            return `${k}:${v}`
          }

          // For other properties, remove outer quotes but preserve inner content
          const cleanValue = v.replace(/^['"]|['"]$/g, '')
          return `${k}:${cleanValue}`
        })
        .join(';')
      // Process the content through marked first to handle any markdown inside the section
      const processedContent = marked.parse(content.trim())
      return `<div class="section" style="${css}; padding: 15px; border-radius: 8px; margin: 15px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">${processedContent}</div>`
    },
  )

  // Leftside/rightside images are now processed earlier in the pipeline

  // Handle header images normally (they don't consume text)
  processedText = processedText.replace(
    /!\[Header(?:-(\d+))?\|(.+?)\]\((.+?)\)/g,
    (match, paragraphCount, styles, url) => {
      const getStyleValue = (styleString, key, fallback) => {
        const regex = new RegExp(key + ': *[\'"]?([^;\'"]+)[\'"]?', 'i')
        const found = styleString.match(regex)
        return found ? found[1].trim() : fallback
      }
      const height = getStyleValue(styles, 'height', 'auto')
      const objectFit = getStyleValue(styles, 'object-fit', 'cover')
      const objectPosition = getStyleValue(styles, 'object-position', 'center')
      // Return the HTML string with no leading spaces
      return `<div class="header-image-container">
<img src="${url}" alt="Header Image" class="header-image" style="object-fit: ${objectFit}; object-position: ${objectPosition}; height: ${height !== 'auto' ? height + 'px' : height}; border-radius: 8px;" />
</div>\n\n`
    },
  )

  // Clean up extra whitespace
  processedText = processedText.replace(/\n\s*\n\s*\n/g, '\n\n')

  console.log('=== Final processed text before marked.parse ===')
  console.log(processedText)

  // Process the final text with marked
  const finalHtml = marked.parse(processedText)

  console.log('=== Final HTML after marked.parse ===')
  console.log(finalHtml)

  return finalHtml
}

const convertToHtml = (text, nodeId = null) => {
  console.log('=== convertToHtml called ===')
  console.log('User logged in:', userStore.loggedIn)
  console.log('User role:', userStore.role)
  console.log('Node ID provided:', nodeId)
  console.log('Text length:', text?.length || 0)

  const htmlContent = preprocessMarkdown(text)

  // Add change image buttons for admin/superadmin users
  if (userStore.loggedIn && ['Admin', 'Superadmin'].includes(userStore.role) && nodeId) {
    console.log('✅ Conditions met - calling addChangeImageButtons')
    return addChangeImageButtons(htmlContent, nodeId, text)
  } else {
    console.log('❌ Conditions not met:')
    console.log('  - Logged in:', userStore.loggedIn)
    console.log('  - Role check:', ['Admin', 'Superadmin'].includes(userStore.role))
    console.log('  - Node ID:', !!nodeId)
  }

  return htmlContent
}

const addChangeImageButtons = (html, nodeId, originalContent) => {
  console.log('=== Adding Change Image Buttons & Resize Handles ===')
  console.log('User role:', userStore.role)
  console.log('User logged in:', userStore.loggedIn)
  console.log('Node ID:', nodeId)

  // Create a temporary DOM element to parse the HTML
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html

  // Find all images and add change buttons + resize handles
  const images = tempDiv.querySelectorAll('img')
  console.log('Found images:', images.length)

  images.forEach((img) => {
    const imageUrl = img.src
    const imageAlt = img.alt || ''

    // Determine image type from alt text or class
    let imageType = 'Unknown'
    let imageContext = 'Image in content'

    if (imageAlt.toLowerCase().includes('header')) {
      imageType = 'Header'
      imageContext = 'Header image for visual impact'
    } else if (imageAlt.toLowerCase().includes('leftside')) {
      imageType = 'Leftside'
      imageContext = 'Left-aligned contextual image'
      // Fix leftside layout for larger images
      fixSideImageLayout(img, 'leftside')
    } else if (imageAlt.toLowerCase().includes('rightside')) {
      imageType = 'Rightside'
      imageContext = 'Right-aligned contextual image'
      // Fix rightside layout for larger images
      fixSideImageLayout(img, 'rightside')
    } else if (img.classList.contains('header-image')) {
      imageType = 'Header'
      imageContext = 'Header image for visual impact'
    } else if (img.classList.contains('leftside')) {
      imageType = 'Leftside'
      imageContext = 'Left-aligned contextual image'
      fixSideImageLayout(img, 'leftside')
    } else if (img.classList.contains('rightside')) {
      imageType = 'Rightside'
      imageContext = 'Right-aligned contextual image'
      fixSideImageLayout(img, 'rightside')
    }

    // Wrap the image for change button positioning
    const imageWrapper = document.createElement('div')
    imageWrapper.className = 'image-change-wrapper'
    imageWrapper.setAttribute('data-node-id', nodeId)
    imageWrapper.setAttribute('data-node-content', originalContent)
    imageWrapper.setAttribute('data-image-type', imageType)

    // Wrap the image
    img.parentNode.insertBefore(imageWrapper, img)
    imageWrapper.appendChild(img)

    // Create button container
    const buttonContainer = document.createElement('div')
    buttonContainer.className = 'image-button-container'

    // Create change image button
    const changeButton = document.createElement('button')
    changeButton.className = 'change-image-btn'
    changeButton.innerHTML = '🔄 Change Image'
    changeButton.title = 'Change this image'

    // Add click handler data
    changeButton.setAttribute('data-image-url', imageUrl)
    changeButton.setAttribute('data-image-alt', imageAlt)
    changeButton.setAttribute('data-image-type', imageType)
    changeButton.setAttribute('data-image-context', imageContext)
    changeButton.setAttribute('data-node-id', nodeId)
    changeButton.setAttribute('data-node-content', originalContent)

    // Create Google Photos button
    const googleButton = document.createElement('button')
    googleButton.className = 'google-photos-btn'
    googleButton.innerHTML = '📷 Google'
    googleButton.title = 'Select from Google Photos'

    // Add click handler data for Google button
    googleButton.setAttribute('data-image-url', imageUrl) // Add missing image URL
    googleButton.setAttribute('data-image-alt', imageAlt) // Add missing image alt
    googleButton.setAttribute('data-image-type', imageType)
    googleButton.setAttribute('data-image-context', imageContext)
    googleButton.setAttribute('data-node-id', nodeId)
    googleButton.setAttribute('data-node-content', originalContent)

    // Add buttons to container
    buttonContainer.appendChild(changeButton)
    buttonContainer.appendChild(googleButton)

    // Insert button container after the image wrapper
    if (imageWrapper.parentNode) {
      // If wrapper is in a container, add button container to container
      if (
        imageWrapper.parentNode.classList.contains('header-image-container') ||
        imageWrapper.parentNode.classList.contains('rightside-image') ||
        imageWrapper.parentNode.classList.contains('leftside-image')
      ) {
        imageWrapper.parentNode.appendChild(buttonContainer)
      } else {
        // Insert after the wrapper
        imageWrapper.parentNode.insertBefore(buttonContainer, imageWrapper.nextSibling)
      }
    }
  })

  return tempDiv.innerHTML
}

// Fix side image layout for larger images
const fixSideImageLayout = (img, side) => {
  const imageContainer = img.parentNode
  if (!imageContainer || !imageContainer.classList.contains(`${side}-image`)) return

  const containerParent = imageContainer.parentNode
  if (!containerParent || !containerParent.classList.contains(`${side}-container`)) return

  // Parse the width from the image style
  const imgStyle = img.style
  let imageWidth = imgStyle.width || '200px'

  // Extract numeric value and unit
  const widthMatch = imageWidth.match(/^(\d+)(px|%|em|rem)?$/)
  if (!widthMatch) return

  const widthValue = parseInt(widthMatch[1])
  const widthUnit = widthMatch[2] || 'px'

  // Only fix if width is specified in pixels and is larger than default
  if (widthUnit === 'px' && widthValue > 200) {
    // Calculate the percentage this image should take
    // Assume container width is around 1000px (typical)
    const containerWidth = 1000
    const imagePercentage = Math.min((widthValue / containerWidth) * 100, 60) // Max 60%
    const contentPercentage = 100 - imagePercentage - 2 // 2% for gap

    // Apply dynamic width to image container
    imageContainer.style.flex = `0 0 ${imagePercentage}%`
    imageContainer.style.width = `${imagePercentage}%`
    imageContainer.style.minWidth = `${imagePercentage}%`

    // Find and adjust content container
    const contentContainer = containerParent.querySelector(`.${side}-content`)
    if (contentContainer) {
      contentContainer.style.flex = `1 1 auto`
      contentContainer.style.maxWidth = `${contentPercentage}%`
    }

    // Add responsive class for this specific container
    containerParent.classList.add('dynamic-width-container')
  }
}

const parseYoutubeVideo = (markdown) => {
  const regex = /!\[YOUTUBE src=(.+?)\](.+?)\[END YOUTUBE\]/
  const match = markdown.match(regex)

  if (match) {
    let videoUrl = match[1].trim()
    if (videoUrl.includes('youtube.com/embed/')) {
      return videoUrl.split('?')[0]
    } else if (videoUrl.includes('youtu.be/')) {
      const videoId = videoUrl.split('youtu.be/')[1].split('?')[0]
      return `https://www.youtube.com/embed/${videoId}`
    } else if (videoUrl.includes('youtube.com/watch?v=')) {
      const videoId = videoUrl.split('watch?v=')[1].split('&')[0]
      return `https://www.youtube.com/embed/${videoId}`
    }
    console.warn('Invalid YouTube URL:', videoUrl)
    return null
  }
  console.warn('No match for YouTube markdown:', markdown)
  return null
}

const parseYoutubeVideoTitle = (markdown) => {
  const regex = /!\[YOUTUBE src=(.+?)\](.+?)\[END YOUTUBE\]/
  const match = markdown.match(regex)
  return match ? match[2].trim() : 'Untitled Video'
}

const editYoutubeVideo = async (node) => {
  const currentLabel = node.label
  const match = currentLabel.match(/!\[YOUTUBE src=(.+?)\](.+?)\[END YOUTUBE\]/)
  if (!match) {
    alert('Invalid YouTube markdown format.')
    return
  }

  const currentUrl = match[1].trim()
  const currentTitle = match[2].trim()
  const newUrl = prompt('Enter new YouTube share link or embed URL:', currentUrl)

  if (newUrl && newUrl !== currentUrl) {
    const videoIdMatch =
      newUrl.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/) ||
      newUrl.match(/(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)/) ||
      newUrl.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/)
    const videoId = videoIdMatch ? videoIdMatch[1] : null

    if (!videoId) {
      alert('Invalid YouTube URL. Please use a valid share link or embed URL.')
      return
    }

    node.label = `![YOUTUBE src=https://www.youtube.com/embed/${videoId}]${currentTitle}[END YOUTUBE]`
    node.bibl = [`[Source: YouTube video URL, e.g., https://youtu.be/${videoId}]`]

    const updatedGraphData = {
      ...graphData.value,
      nodes: graphData.value.nodes.map((n) =>
        n.id === node.id ? { ...n, label: node.label, bibl: node.bibl } : n,
      ),
    }

    try {
      const response = await fetch(
        getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: knowledgeGraphStore.currentGraphId,
            graphData: updatedGraphData,
            override: true,
          }),
        },
      )

      if (!response.ok) {
        throw new Error('Failed to save the graph with history.')
      }

      await response.json()

      knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

      saveMessage.value = 'YouTube video updated successfully!'
      setTimeout(() => {
        saveMessage.value = ''
      }, 3000)
    } catch (error) {
      console.error('Error saving video:', error)
      alert('Failed to save the video. Please try again.')
    }
  }
}

const editYoutubeTitle = async (node) => {
  const currentLabel = node.label
  const match = currentLabel.match(/!\[YOUTUBE src=(.+?)\](.+?)\[END YOUTUBE\]/)
  if (!match) {
    alert('Invalid YouTube markdown format.')
    return
  }

  const currentTitle = match[2].trim()
  const newTitle = prompt('Enter new video title:', currentTitle)

  if (newTitle && newTitle !== currentTitle) {
    node.label = `![YOUTUBE src=${match[1]}]${newTitle}[END YOUTUBE]`

    const updatedGraphData = {
      ...graphData.value,
      nodes: graphData.value.nodes.map((n) => (n.id === node.id ? { ...n, label: node.label } : n)),
    }

    try {
      const response = await fetch(
        getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: knowledgeGraphStore.currentGraphId,
            graphData: updatedGraphData,
            override: true,
          }),
        },
      )

      if (!response.ok) {
        throw new Error('Failed to save the graph with history.')
      }

      await response.json()

      knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

      saveMessage.value = 'Video title updated successfully!'
      setTimeout(() => {
        saveMessage.value = ''
      }, 3000)
    } catch (error) {
      console.error('Error saving title:', error)
      alert('Failed to save the title. Please try again.')
    }
  }
}

const isMarkdownEditorOpen = ref(false)
const currentMarkdown = ref('')
const currentNode = ref(null)
const markdownEditorTextarea = ref(null)

// Label editor state
const isLabelEditorOpen = ref(false)
const currentLabelText = ref('')
const currentEditingNode = ref(null)
const labelEditorInput = ref(null)

// Chart sheet editor state
const chartSheetData = ref({
  title: '',
  xLabel: '',
  yLabel: '',
  series: [{ label: 'Series 1' }],
  rows: [{ label: '', values: [0] }],
})
const isJsonMode = ref(false)
const originalDataFormat = ref('standard') // 'standard', 'points', 'array', 'object'

const openMarkdownEditor = (node) => {
  currentNode.value = node
  isJsonMode.value = false

  // Handle linechart with sheet interface
  if (node.type === 'linechart') {
    initializeChartSheetData(node)
    isMarkdownEditorOpen.value = true
    return
  }

  // Handle other node types
  let content = ''
  if (node.type === 'markdown-image') {
    content = node.label
  } else if (['chart', 'piechart', 'timeline', 'swot', 'bubblechart'].includes(node.type)) {
    // For other chart nodes, use JSON editor
    content = node.info ? JSON.stringify(node.info, null, 2) : ''
  } else {
    // For other nodes, use info field as markdown
    content = node.info || ''
  }

  // For title nodes, allow editing even if info is null by initializing as empty string
  if (node.type === 'title' || content || content.trim() !== '') {
    currentMarkdown.value = content
    isMarkdownEditorOpen.value = true
  } else {
    alert('This node does not contain any content to edit.')
    return
  }
}

const closeMarkdownEditor = () => {
  isMarkdownEditorOpen.value = false
  currentNode.value = null
  currentMarkdown.value = ''
  isJsonMode.value = false
  originalDataFormat.value = 'standard'

  // Reset chart sheet data
  chartSheetData.value = {
    title: '',
    xLabel: '',
    yLabel: '',
    series: [{ label: 'Series 1' }],
    rows: [{ label: '', values: [0] }],
  }
}

// Label editor functions
const openLabelEditor = (node) => {
  currentEditingNode.value = node
  currentLabelText.value = node.label || ''
  isLabelEditorOpen.value = true

  nextTick(() => {
    if (labelEditorInput.value) {
      labelEditorInput.value.focus()
      labelEditorInput.value.select()
    }
  })
}

const closeLabelEditor = () => {
  isLabelEditorOpen.value = false
  currentEditingNode.value = null
  currentLabelText.value = ''
}

const saveLabelChanges = async () => {
  if (currentEditingNode.value && currentLabelText.value.trim()) {
    console.log('=== Saving Label Changes ===')
    console.log('Node:', currentEditingNode.value)
    console.log('New label:', currentLabelText.value.trim())

    // Update the node's label
    currentEditingNode.value.label = currentLabelText.value.trim()

    const updatedGraphData = {
      ...graphData.value,
      nodes: graphData.value.nodes.map((node) =>
        node.id === currentEditingNode.value.id
          ? { ...node, label: currentEditingNode.value.label }
          : node,
      ),
    }

    try {
      const response = await fetch(
        getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: knowledgeGraphStore.currentGraphId,
            graphData: updatedGraphData,
            override: true,
          }),
        },
      )

      if (!response.ok) {
        throw new Error('Failed to save the graph with history.')
      }

      await response.json()

      knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

      saveMessage.value = 'Node label updated successfully!'
      setTimeout(() => {
        saveMessage.value = ''
      }, 3000)

      console.log('Label saved successfully')
    } catch (error) {
      console.error('Error saving label:', error)
      alert('Failed to save the label. Please try again.')
    }
  }

  closeLabelEditor()
}

const saveMarkdown = async () => {
  if (currentNode.value) {
    // Handle different node types appropriately
    if (currentNode.value.type === 'markdown-image') {
      currentNode.value.label = currentMarkdown.value
    } else if (
      ['chart', 'piechart', 'linechart', 'timeline', 'swot', 'bubblechart'].includes(
        currentNode.value.type,
      )
    ) {
      // For chart nodes, parse JSON back to object
      try {
        currentNode.value.info = JSON.parse(currentMarkdown.value)
      } catch {
        alert('Invalid JSON format. Please check your chart data syntax.')
        return
      }
    } else {
      // For other nodes, save as markdown
      currentNode.value.info = currentMarkdown.value
    }

    const updatedGraphData = {
      ...graphData.value,
      nodes: graphData.value.nodes.map((node) =>
        node.id === currentNode.value.id ? { ...node, ...currentNode.value } : node,
      ),
    }

    try {
      const response = await fetch(
        getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: knowledgeGraphStore.currentGraphId,
            graphData: updatedGraphData,
            override: true,
          }),
        },
      )

      if (!response.ok) {
        throw new Error('Failed to save the graph with history.')
      }

      await response.json()

      knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

      saveMessage.value = 'Markdown saved and graph updated successfully!'
      setTimeout(() => {
        saveMessage.value = ''
      }, 3000)
    } catch (error) {
      console.error('Error saving markdown:', error)
      alert('Failed to save the markdown. Please try again.')
    }
  }

  closeMarkdownEditor()
}

const onPlaceChanged = (place) => {
  if (place && place.location) {
    // You can add additional handling here if needed
  }
}

const printGraph = () => {
  window.print()
}

const saveAsHtml2Pdf = () => {
  const element = document.querySelector('.graph-container')
  if (!element) {
    alert('Graph content not found!')
    return
  }

  const opt = {
    margin: 0.5,
    filename: 'graph-export.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: true,
      onclone: (clonedDoc) => {
        // Hide all .node-info button elements in the cloned DOM
        const buttons = clonedDoc.querySelectorAll('.node-info button')
        buttons.forEach((btn) => (btn.style.display = 'none'))

        // Add strong page break styles and keep .section together
        const style = clonedDoc.createElement('style')
        style.textContent = `
          .page-break {
            display: block !important;
            width: 100% !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            background: none !important;
            page-break-before: always !important;
            page-break-after: always !important;
            break-before: page !important;
            break-after: page !important;
          }
          .section {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          table, tr, td, th {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        `
        clonedDoc.head.appendChild(style)
      },
    },
    jsPDF: {
      unit: 'in',
      format: 'a4',
      orientation: 'portrait',
      compress: true,
    },
    pagebreak: {
      mode: ['avoid-all', 'css', 'legacy'],
      before: '.page-break',
    },
  }

  html2pdf()
    .set(opt)
    .from(element)
    .save()
    .then(() => {
      console.log('PDF generation completed')
    })
    .catch((err) => {
      console.error('Error generating PDF:', err)
    })
}

const saveToMystmkra = async () => {
  if (!userStore.emailVerificationToken) {
    saveMessage.value = 'No API token found for this user.'
    setTimeout(() => {
      saveMessage.value = ''
    }, 2000)
    return
  }
  const mystmkraUserId = userStore.mystmkraUserId
  if (!mystmkraUserId || !/^[a-f\d]{24}$/i.test(mystmkraUserId)) {
    saveMessage.value =
      'Mystmkra User ID is missing or invalid. Please set it in your profile before saving.'
    setTimeout(() => {
      saveMessage.value = ''
    }, 2000)
    return
  }
  const content = currentNode.value?.info || ''
  const title = currentNode.value?.label || 'Untitled'
  closeMarkdownEditor()
  saveMessage.value = 'Saving to Mystmkra.io...'
  try {
    const response = await fetch(getApiEndpoint('https://api.vegvisr.org/mystmkrasave'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken,
      },
      body: JSON.stringify({
        content,
        title,
        tags: [],
        documentId: graphData.value.metadata?.mystmkraDocumentId || null,
        userId: mystmkraUserId,
      }),
    })
    if (response.ok) {
      const data = await response.json()
      console.log('Mystmkra Save Response:', JSON.stringify(data, null, 2))
      if (currentNode.value) {
        currentNode.value.mystmkraUrl = data.data.fileUrl
        currentNode.value.mystmkraDocumentId = data.data.documentId

        const updatedGraphData = {
          ...graphData.value,
          nodes: graphData.value.nodes.map((node) =>
            node.id === currentNode.value.id ? { ...node, ...currentNode.value } : node,
          ),
          metadata: {
            ...graphData.value.metadata,
            mystmkraDocumentId: data.data.documentId,
            mystmkraUrl: data.data.fileUrl,
            mystmkraNodeId: currentNode.value.id,
          },
        }

        const saveResponse = await fetch(
          getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: knowledgeGraphStore.currentGraphId,
              graphData: updatedGraphData,
              override: true,
            }),
          },
        )

        if (!saveResponse.ok) {
          throw new Error('Failed to save the graph with history.')
        }

        knowledgeGraphStore.updateGraphFromJson(updatedGraphData)
      }

      saveMessage.value = graphData.value.metadata?.mystmkraDocumentId
        ? 'Updated existing document on Mystmkra.io!'
        : 'Created new document on Mystmkra.io!'
      setTimeout(() => {
        saveMessage.value = ''
      }, 2000)
    } else {
      const text = await response.text()
      saveMessage.value = 'Failed to save to Mystmkra.io. ' + text
      setTimeout(() => {
        saveMessage.value = ''
      }, 2000)
    }
  } catch (err) {
    saveMessage.value = 'Error saving to Mystmkra.io: ' + err.message
    setTimeout(() => {
      saveMessage.value = ''
    }, 2000)
  }
}

function saveToMystmkraFromMenu() {
  let content = ''
  let title = ''
  let targetNode = null
  if (isMarkdownEditorOpen.value && currentNode.value) {
    content = currentMarkdown.value
    title = currentNode.value.label || 'Untitled'
    targetNode = currentNode.value
  } else {
    const node = (graphData.value.nodes || []).find((n) => n.visible !== false)
    if (node && node.info) {
      content = node.info
      title = node.label || 'Untitled'
      targetNode = node
    }
  }

  if (content) {
    if (!userStore.emailVerificationToken) {
      saveMessage.value = 'No API token found for this user.'
      setTimeout(() => {
        saveMessage.value = ''
      }, 2000)
      return
    }
    const mystmkraUserId = userStore.mystmkraUserId
    if (!mystmkraUserId || !/^[a-f\d]{24}$/i.test(mystmkraUserId)) {
      saveMessage.value =
        'Mystmkra User ID is missing or invalid. Please set it in your profile before saving.'
      setTimeout(() => {
        saveMessage.value = ''
      }, 2000)
      return
    }
    saveMessage.value = 'Saving to Mystmkra.io...'
    fetch(getApiEndpoint('https://api.vegvisr.org/mystmkrasave'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken,
      },
      body: JSON.stringify({
        content,
        title,
        tags: [],
        documentId: graphData.value.metadata?.mystmkraDocumentId || null,
        userId: mystmkraUserId,
      }),
    })
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json()
          console.log('Mystmkra Save Response:', JSON.stringify(data, null, 2))
          if (targetNode) {
            targetNode.mystmkraUrl = data.data.fileUrl
            targetNode.mystmkraDocumentId = data.data.documentId

            const updatedGraphData = {
              ...graphData.value,
              nodes: graphData.value.nodes.map((node) =>
                node.id === targetNode.id ? { ...node, ...targetNode } : node,
              ),
              metadata: {
                ...graphData.value.metadata,
                mystmkraDocumentId: data.data.documentId,
                mystmkraUrl: data.data.fileUrl,
                mystmkraNodeId: targetNode.id,
              },
            }

            const saveResponse = await fetch(
              getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: knowledgeGraphStore.currentGraphId,
                  graphData: updatedGraphData,
                  override: true,
                }),
              },
            )

            if (!saveResponse.ok) {
              throw new Error('Failed to save the graph with history.')
            }

            knowledgeGraphStore.updateGraphFromJson(updatedGraphData)
          }

          saveMessage.value = graphData.value.metadata?.mystmkraDocumentId
            ? 'Updated existing document on Mystmkra.io!'
            : 'Created new document on Mystmkra.io!'
          setTimeout(() => {
            saveMessage.value = ''
          }, 2000)
        } else {
          response.text().then((text) => {
            saveMessage.value = 'Failed to save to Mystmkra.io. ' + text
            setTimeout(() => {
              saveMessage.value = ''
            }, 2000)
          })
        }
      })
      .catch((err) => {
        saveMessage.value = 'Error saving to Mystmkra.io: ' + err.message
        setTimeout(() => {
          saveMessage.value = ''
        }, 2000)
      })
  } else {
    saveMessage.value = 'No visible node with markdown content to save.'
    setTimeout(() => {
      saveMessage.value = ''
    }, 2000)
  }
}

// --- AI Assist UI State ---
const isAIAssistOpen = ref(false)
const aiAssistMode = ref('') // 'expand', 'ask', 'image'
const aiAssistQuestion = ref('')
const aiAssistLoading = ref(false)
const aiAssistResult = ref('')
const aiAssistImageUrl = ref('')
const aiAssistError = ref('')
let aiAssistNode = null

function closeAIAssist() {
  isAIAssistOpen.value = false
  aiAssistMode.value = ''
  aiAssistQuestion.value = ''
  aiAssistResult.value = ''
  aiAssistImageUrl.value = ''
  aiAssistError.value = ''
  aiAssistNode = null
}

async function runAIAssist(mode) {
  aiAssistMode.value = mode
  aiAssistLoading.value = true
  aiAssistResult.value = ''
  aiAssistImageUrl.value = ''
  aiAssistError.value = ''

  if (mode === 'image') {
    // Real API call for image generation
    try {
      const prompt =
        String(aiAssistNode?.info ?? '').slice(0, 300) ||
        'A beautiful, wide, horizontal header image'
      const response = await fetch(
        getApiEndpoint('https://api.vegvisr.org/generate-header-image'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        },
      )
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'API error')
      }
      const data = await response.json()
      aiAssistResult.value = data.markdown || '[No image generated]'
      aiAssistImageUrl.value = data.url || ''
    } catch (err) {
      aiAssistError.value = 'Error: ' + (err.message || err)
    } finally {
      aiAssistLoading.value = false
    }
    return
  }

  // Real API call for 'expand' and 'ask'
  try {
    const payload = {
      context: String(aiAssistNode?.info ?? ''),
      ...(mode === 'ask' && aiAssistQuestion
        ? { question: String(aiAssistQuestion?.value ?? aiAssistQuestion) }
        : {}),
    }
    const endpoint =
      mode === 'ask'
        ? getApiEndpoint('https://api.vegvisr.org/grok-ask')
        : getApiEndpoint('https://api.vegvisr.org/grok-elaborate')
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'API error')
    }
    const data = await response.json()
    aiAssistResult.value = data.result || '[No response from AI]'
  } catch (err) {
    aiAssistError.value = 'Error: ' + (err.message || err)
  } finally {
    aiAssistLoading.value = false
  }
}

function openAIAssistInEditor() {
  isAIAssistOpen.value = true
  aiAssistMode.value = ''
  aiAssistQuestion.value = ''
  aiAssistResult.value = ''
  aiAssistImageUrl.value = ''
  aiAssistError.value = ''
  aiAssistNode = currentNode.value // Use the node being edited
}

function insertAIAssistResultToEditor() {
  const textarea = markdownEditorTextarea.value
  if (!textarea) return
  let insertText = ''
  if (aiAssistMode.value === 'expand' || aiAssistMode.value === 'ask') {
    insertText = aiAssistResult.value
  } else if (aiAssistMode.value === 'image') {
    insertText = aiAssistResult.value
  }
  // Insert at cursor position
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const before = currentMarkdown.value.substring(0, start)
  const after = currentMarkdown.value.substring(end)
  currentMarkdown.value = before + insertText + after
  // Move cursor after inserted text
  nextTick(() => {
    textarea.selectionStart = textarea.selectionEnd = start + insertText.length
    textarea.focus()
  })
  closeAIAssist()
}

// Template Selector Functions
const openTemplateSelector = (node) => {
  console.log('=== Opening Template Selector ===')
  console.log('Node:', node)
  console.log('Node type:', node.type)
  console.log('Node content:', node.info)

  currentTemplateNode.value = node
  isTemplateSelectorOpen.value = true
}

const closeTemplateSelector = () => {
  isTemplateSelectorOpen.value = false
  currentTemplateNode.value = null
}

// Image Selector Functions
const openImageSelector = (imageData) => {
  console.log('=== Opening Image Selector ===')
  console.log('Image data:', imageData)

  currentImageData.value = {
    url: imageData.url,
    alt: imageData.alt || '',
    type: imageData.type || 'Unknown',
    context: imageData.context || 'No context provided',
    nodeId: imageData.nodeId,
    nodeContent: imageData.nodeContent || '',
  }
  isImageSelectorOpen.value = true
}

const closeImageSelector = () => {
  isImageSelectorOpen.value = false
  currentImageData.value = {
    url: '',
    alt: '',
    type: '',
    context: '',
    nodeId: '',
    nodeContent: '',
  }
}

// Google Photos Selector Functions
const openGooglePhotosSelector = (googlePhotosData) => {
  console.log('=== Opening Google Photos Selector ===')
  console.log('Google Photos data:', googlePhotosData)

  currentGooglePhotosData.value = {
    url: googlePhotosData.url || '',
    alt: googlePhotosData.alt || '',
    type: googlePhotosData.type || 'Unknown',
    context: googlePhotosData.context || 'No context provided',
    nodeId: googlePhotosData.nodeId,
    nodeContent: googlePhotosData.nodeContent || '',
  }
  isGooglePhotosSelectorOpen.value = true
}

const closeGooglePhotosSelector = () => {
  isGooglePhotosSelectorOpen.value = false
  currentGooglePhotosData.value = {
    url: '',
    alt: '',
    type: '',
    context: '',
    nodeId: '',
    nodeContent: '',
  }
}

// RAG Sandbox Modal Functions
const openRAGSandboxModal = (node = null) => {
  console.log('=== Opening RAG Sandbox Modal ===')
  console.log('Node:', node)
  console.log('Graph data:', graphData.value)
  console.log('Graph ID:', knowledgeGraphStore.currentGraphId)
  console.log('User ID:', userStore.user_id)

  isRAGSandboxModalOpen.value = true
}

const closeRAGSandboxModal = () => {
  isRAGSandboxModalOpen.value = false
}

const handleGooglePhotoSelected = async (selectionData) => {
  console.log('=== Google Photo Selected ===')
  console.log('Selection data:', selectionData)
  console.log('Current Google Photos data:', currentGooglePhotosData.value)
  try {
    // Find the node to update
    const nodeToUpdate = graphData.value.nodes.find(
      (node) => node.id === currentGooglePhotosData.value.nodeId,
    )
    if (!nodeToUpdate) {
      throw new Error('Node not found for Google photo replacement')
    }
    console.log('=== Node to Update ===')
    console.log('Node ID:', nodeToUpdate.id)
    console.log('Node type:', nodeToUpdate.type)
    console.log('Current node content:', nodeToUpdate.info)
    console.log('Image type from selection:', selectionData.imageType)
    const photo = selectionData.photo
    console.log('=== Photo Data ===')
    console.log('Photo URL:', photo.url)
    console.log('Photo alt:', photo.alt)
    console.log('Photo permanent URL:', photo.permanentUrl)
    // Create markdown for the selected Google photo based on image type
    let photoMarkdown = ''
    const imageUrl = photo.permanentUrl || photo.url // Use permanentUrl first, fallback to url
    switch (selectionData.imageType) {
      case 'Header':
        photoMarkdown = `![Header|height: 200px; object-fit: 'cover'; object-position: 'center'](${imageUrl})`
        break
      case 'Leftside':
        photoMarkdown = `![Leftside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'](${imageUrl})`
        break
      case 'Rightside':
        photoMarkdown = `![Rightside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'](${imageUrl})`
        break
      default:
        photoMarkdown = `![Image|width: 300px; height: 200px; object-fit: 'cover'; object-position: 'center'](${imageUrl})`
    }
    console.log('=== Generated Photo Markdown ===')
    console.log('Photo markdown:', photoMarkdown)
    // Get current content
    let updatedContent = nodeToUpdate.info || ''
    console.log('=== Content Update Strategy ===')
    console.log('Current content length:', updatedContent.length)
    console.log('Current content preview:', updatedContent.substring(0, 200) + '...')
    // Replace the specific image URL that had the Google Photos button clicked
    const oldUrl = currentGooglePhotosData.value.url

    if (oldUrl && updatedContent.includes(oldUrl)) {
      console.log('=== Replacing Specific Image URL with New Google Photo URL ===')
      console.log('Old URL:', oldUrl)
      console.log('New URL:', imageUrl)
      updatedContent = updatedContent.replace(new RegExp(escapeRegExp(oldUrl), 'g'), imageUrl)
    } else {
      console.log('=== Could not find specific image URL, appending new photo ===')
      console.log('Looking for URL:', oldUrl)
      console.log('Content includes URL:', updatedContent.includes(oldUrl))
      // If there's existing content, append the photo
      if (updatedContent.trim()) {
        updatedContent += '\n\n' + photoMarkdown
      } else {
        updatedContent = photoMarkdown
      }
    }
    console.log('=== Final Updated Content ===')
    console.log('Updated content length:', updatedContent.length)
    console.log('Updated content preview:', updatedContent.substring(0, 300) + '...')
    // Update the node
    nodeToUpdate.info = updatedContent
    const updatedGraphData = {
      ...graphData.value,
      nodes: graphData.value.nodes.map((node) =>
        node.id === nodeToUpdate.id ? { ...node, info: updatedContent } : node,
      ),
    }
    console.log('=== Saving to Backend ===')
    console.log('Graph ID:', knowledgeGraphStore.currentGraphId)
    console.log(
      'Updated node in graph data:',
      updatedGraphData.nodes.find((n) => n.id === nodeToUpdate.id),
    )
    // Save to backend
    const response = await fetch(
      getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: knowledgeGraphStore.currentGraphId,
          graphData: updatedGraphData,
          override: true,
        }),
      },
    )
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Backend save failed:', errorText)
      throw new Error('Failed to save the graph with Google photo.')
    }
    const saveResult = await response.json()
    console.log('=== Backend Save Result ===')
    console.log('Save response:', saveResult)
    knowledgeGraphStore.updateGraphFromJson(updatedGraphData)
    // Force immediate local update to avoid needing page refresh
    graphData.value = { ...updatedGraphData }
    // Reattach image change listeners after content update
    nextTick(() => {
      attachImageChangeListeners()
    })
    saveMessage.value = `Google Photo added successfully from your Google Photos!`
    setTimeout(() => {
      saveMessage.value = ''
    }, 4000)
    console.log('=== Google Photo Addition Complete ===')
    console.log('Photo added and saved successfully')
    // Close the Google Photos selector modal
    closeGooglePhotosSelector()
  } catch (error) {
    console.error('=== Error Adding Google Photo ===')
    console.error('Error details:', error)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    alert('Failed to add the Google photo. Please try again.')
  }
}

const handleImageReplaced = async (replacementData) => {
  console.log('=== Image Replaced ===')
  console.log('Replacement data:', replacementData)

  try {
    // Find the node to update
    const nodeToUpdate = graphData.value.nodes.find(
      (node) => node.id === currentImageData.value.nodeId,
    )
    if (!nodeToUpdate) {
      throw new Error('Node not found for image replacement')
    }

    let updatedContent = nodeToUpdate.info || ''
    const oldUrl = replacementData.oldUrl

    // Handle dimension changes vs URL replacements differently
    if (replacementData.isDimensionChange) {
      console.log('=== Applying Dimension Change ===')
      console.log('New dimensions:', replacementData.newWidth, 'x', replacementData.newHeight)

      // Update dimensions in the markdown content
      updatedContent = updateImageDimensions(
        updatedContent,
        oldUrl,
        replacementData.newWidth,
        replacementData.newHeight,
      )
    } else if (replacementData.isUrlChange) {
      console.log('=== Applying URL Change ===')
      console.log('Old URL:', oldUrl)
      console.log('New URL:', replacementData.newUrl)

      // Replace the image URL in the node's info content
      const newUrl = replacementData.newUrl
      updatedContent = updatedContent.replace(new RegExp(escapeRegExp(oldUrl), 'g'), newUrl)
    } else {
      console.log('=== Applying Image Replacement ===')
      // Replace the image URL in the node's info content (from search)
      const newUrl = replacementData.newUrl

      // Replace in various markdown image formats
      updatedContent = updatedContent.replace(new RegExp(escapeRegExp(oldUrl), 'g'), newUrl)
    }

    // Update the node
    nodeToUpdate.info = updatedContent

    const updatedGraphData = {
      ...graphData.value,
      nodes: graphData.value.nodes.map((node) =>
        node.id === nodeToUpdate.id ? { ...node, info: updatedContent } : node,
      ),
    }

    // Save to backend
    const response = await fetch(
      getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: knowledgeGraphStore.currentGraphId,
          graphData: updatedGraphData,
          override: true,
        }),
      },
    )

    if (!response.ok) {
      throw new Error('Failed to save the graph with updated image.')
    }

    await response.json()
    knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

    // Show appropriate success message
    if (replacementData.isDimensionChange) {
      saveMessage.value = `Image resized to ${replacementData.newWidth} × ${replacementData.newHeight} successfully!`
    } else if (replacementData.isUrlChange) {
      saveMessage.value = `Image URL updated successfully!`
    } else {
      saveMessage.value = `Image replaced successfully! New image by ${replacementData.photographer}`
    }

    setTimeout(() => {
      saveMessage.value = ''
    }, 4000)

    console.log('Image update saved successfully')
  } catch (error) {
    console.error('Error updating image:', error)
    alert('Failed to update the image. Please try again.')
  }
}

// Helper function to escape special regex characters
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const handleTemplateApplied = async (result) => {
  console.log('=== Template Applied ===')
  console.log('Result:', result)
  console.log('Formatted content length:', result.formattedContent.length)
  console.log('Template used:', result.templateUsed)

  if (currentTemplateNode.value) {
    // Update the node's content with the formatted result
    currentTemplateNode.value.info = result.formattedContent

    const updatedGraphData = {
      ...graphData.value,
      nodes: graphData.value.nodes.map((node) =>
        node.id === currentTemplateNode.value.id
          ? { ...node, info: result.formattedContent }
          : node,
      ),
    }

    try {
      // Save the updated graph to the backend
      const response = await fetch(
        getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: knowledgeGraphStore.currentGraphId,
            graphData: updatedGraphData,
            override: true,
          }),
        },
      )

      if (!response.ok) {
        throw new Error('Failed to save the graph with formatted content.')
      }

      await response.json()

      // Update the knowledge graph store
      knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

      // Show success message
      saveMessage.value = `Template "${result.template.name}" applied successfully!`
      setTimeout(() => {
        saveMessage.value = ''
      }, 3000)

      console.log('Template formatting applied and saved successfully')

      // Reattach image change listeners after template is applied
      attachImageChangeListeners()
    } catch (error) {
      console.error('Error saving formatted content:', error)
      alert('Failed to save the formatted content. Please try again.')
    }
  }

  closeTemplateSelector()
}

const handleQuickFormat = async (node, formatType) => {
  console.log('=== Quick Format ===')
  console.log('Node:', node)
  console.log('Format type:', formatType)

  // Get user-friendly descriptions
  const formatDescriptions = {
    add_side_images: {
      title: 'Add Side Images & Visual Formatting',
      description:
        'This will add leftside/rightside images, header images, WNOTE blocks, and SECTION organization to enhance the visual layout of your content.',
    },
    add_work_notes: {
      title: 'Add Work Notes & Technical Formatting',
      description:
        'This will add WNOTE annotations, rightside images for technical diagrams, and structured sections optimized for development notes and documentation.',
    },
  }

  const formatInfo = formatDescriptions[formatType] || {
    title: 'Apply Basic Formatting',
    description: 'This will add basic structure and formatting to your content.',
  }

  // Ask for user confirmation
  const userConfirmed = confirm(
    `${formatInfo.title}\n\n${formatInfo.description}\n\nThis action will modify your node content using AI. Do you want to proceed?`,
  )

  if (!userConfirmed) {
    console.log('User cancelled quick format')
    return
  }

  let templateId = ''

  // Map quick format types to templates
  switch (formatType) {
    case 'add_side_images':
      templateId = 'visual_content_formatter'
      break
    case 'add_work_notes':
      templateId = 'work_note_enhancer'
      break
    default:
      templateId = 'header_sections_basic'
  }

  try {
    // Set loading state
    isQuickFormatLoading.value = true
    quickFormatCurrentNode.value = node

    // Show loading message with spinner effect
    saveMessage.value = `🤖 AI is ${formatType === 'add_side_images' ? 'adding visual formatting with side images' : 'adding work notes and technical formatting'}... Please wait.`

    console.log('Sending request to apply template:', templateId)

    const response = await fetch(getApiEndpoint('https://api.vegvisr.org/apply-style-template'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nodeContent: node.info || '',
        templateId: templateId,
        nodeType: node.type,
        options: {
          includeImages: true,
          preserveStructure: false,
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to apply quick format')
    }

    const result = await response.json()
    console.log('AI formatting completed successfully')

    // Show saving message
    saveMessage.value = '💾 Saving formatted content...'

    // Update the node's content
    node.info = result.formattedContent

    const updatedGraphData = {
      ...graphData.value,
      nodes: graphData.value.nodes.map((n) =>
        n.id === node.id ? { ...n, info: result.formattedContent } : n,
      ),
    }

    // Save to backend
    const saveResponse = await fetch(
      getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: knowledgeGraphStore.currentGraphId,
          graphData: updatedGraphData,
          override: true,
        }),
      },
    )

    if (!saveResponse.ok) {
      throw new Error('Failed to save the formatted content.')
    }

    await saveResponse.json()
    knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

    // Show success message
    const successMessages = {
      add_side_images: '🖼️ Visual formatting with side images applied successfully!',
      add_work_notes: '📝 Work notes and technical formatting applied successfully!',
    }

    saveMessage.value = successMessages[formatType] || '✅ Quick format applied successfully!'
    setTimeout(() => {
      saveMessage.value = ''
    }, 4000)

    console.log('Quick format applied and saved successfully')

    // Reattach image change listeners after quick format is applied
    attachImageChangeListeners()
  } catch (error) {
    console.error('Error applying quick format:', error)
    saveMessage.value = `❌ Failed to apply ${formatType.replace('_', ' ')}: ${error.message}`
    setTimeout(() => {
      saveMessage.value = ''
    }, 5000)
  } finally {
    // Clear loading state
    isQuickFormatLoading.value = false
    quickFormatCurrentNode.value = null
  }
}

const isAINodeModalOpen = ref(false)
const isEnhancedAINodeModalOpen = ref(false)
const isAIImageModalOpen = ref(false)

// Add loading state for action_test AI responses
const isActionTestLoading = ref(false)
const actionTestLoadingMessage = ref('')

const handleAINodeClick = () => {
  isAINodeModalOpen.value = true
}

const handleEnhancedAINodeClick = () => {
  isEnhancedAINodeModalOpen.value = true
}

const closeAINodeModal = () => {
  isAINodeModalOpen.value = false
}

const closeEnhancedAINodeModal = () => {
  isEnhancedAINodeModalOpen.value = false
}

const handleNodeInserted = async (nodeData) => {
  console.log('Inserting new AI-generated node:', nodeData)

  // Add the new node to the local graph data
  graphData.value.nodes.push(nodeData)

  // Create updated graph data with the new node
  const updatedGraphData = {
    ...graphData.value,
    nodes: graphData.value.nodes.map((node) => ({
      ...node,
      position: node.position || { x: 100, y: 100 }, // Ensure position exists
    })),
  }

  try {
    // Save the updated graph to the backend
    const response = await fetch(
      getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: knowledgeGraphStore.currentGraphId,
          graphData: updatedGraphData,
          override: true,
        }),
      },
    )

    if (!response.ok) {
      throw new Error('Failed to save the graph with the new node.')
    }

    await response.json()

    // Update the knowledge graph store with the new data
    knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

    // Show success message
    saveMessage.value = 'AI-generated node added and saved successfully!'
    setTimeout(() => {
      saveMessage.value = ''
    }, 3000)

    console.log('AI-generated node successfully saved to backend')
  } catch (error) {
    console.error('Error saving inserted node:', error)
    // Remove the node from local state if save failed
    graphData.value.nodes = graphData.value.nodes.filter((node) => node.id !== nodeData.id)
    alert('Failed to save the AI-generated node. Please try again.')
  }
}

// Copy node functionality
const openCopyNodeModal = (node) => {
  console.log('=== Opening Copy Node Modal ===')
  console.log('Node to copy:', node)

  selectedNodeToCopy.value = {
    ...node,
    position: node.position || { x: 0, y: 0 },
  }

  // Show the modal using Bootstrap Modal
  const modalElement = document.getElementById('copyNodeModal')
  if (modalElement) {
    const modal = new Modal(modalElement)
    modal.show()

    // Call the show method on the modal component to fetch graphs
    if (copyNodeModal.value) {
      copyNodeModal.value.show()
    }
  }
}

const handleNodeCopied = (copyInfo) => {
  console.log('=== Node Copied Successfully ===')
  console.log('Copy info:', copyInfo)

  // Show success message
  saveMessage.value = `Node "${copyInfo.sourceNode.label}" copied to "${copyInfo.targetGraph.metadata?.title}" with new ID: ${copyInfo.newNodeId}`
  setTimeout(() => {
    saveMessage.value = ''
  }, 5000)

  // Reset the selected node
  selectedNodeToCopy.value = null
}

// Computed properties for reordering
const totalVisibleNodes = computed(() => {
  return graphData.value.nodes.filter((node) => node.visible !== false).length
})

// Reordering functions
const getNodePosition = (node) => {
  const visibleNodes = graphData.value.nodes.filter((n) => n.visible !== false)
  const sortedNodes = visibleNodes.sort((a, b) => (a.order || 0) - (b.order || 0))
  return sortedNodes.findIndex((n) => n.id === node.id) + 1
}

const getNodeTypeIcon = (type) => {
  const icons = {
    title: '📄',
    worknote: '📝',
    'markdown-image': '🖼️',
    'youtube-video': '📺',
    map: '🗺️',
    chart: '📊',
    piechart: '🥧',
    linechart: '📈',
    timeline: '⏰',
    swot: '📋',
    bubblechart: '💭',
    'mermaid-diagram': '🔀',
    background: '🖼️',
  }
  return icons[type] || '📄'
}

const getNodeDisplayName = (node) => {
  if (node.type === 'title') {
    return node.label || 'Untitled'
  }
  return node.label || `${node.type} node`
}

const moveNodeUp = async (node) => {
  const visibleNodes = graphData.value.nodes.filter((n) => n.visible !== false)
  const sortedNodes = visibleNodes.sort((a, b) => (a.order || 0) - (b.order || 0))
  const currentIndex = sortedNodes.findIndex((n) => n.id === node.id)

  if (currentIndex > 0) {
    // Swap orders with the node above
    const nodeAbove = sortedNodes[currentIndex - 1]
    const tempOrder = node.order
    node.order = nodeAbove.order
    nodeAbove.order = tempOrder

    // Re-sort and update
    await saveNodeOrder()
  }
}

const moveNodeDown = async (node) => {
  const visibleNodes = graphData.value.nodes.filter((n) => n.visible !== false)
  const sortedNodes = visibleNodes.sort((a, b) => (a.order || 0) - (b.order || 0))
  const currentIndex = sortedNodes.findIndex((n) => n.id === node.id)

  if (currentIndex < sortedNodes.length - 1) {
    // Swap orders with the node below
    const nodeBelow = sortedNodes[currentIndex + 1]
    const tempOrder = node.order
    node.order = nodeBelow.order
    nodeBelow.order = tempOrder

    // Re-sort and update
    await saveNodeOrder()
  }
}

const openReorderModal = () => {
  const visibleNodes = graphData.value.nodes.filter((n) => n.visible !== false)
  reorderableNodes.value = [...visibleNodes].sort((a, b) => (a.order || 0) - (b.order || 0))
  isReorderModalOpen.value = true
}

const closeReorderModal = () => {
  isReorderModalOpen.value = false
  reorderableNodes.value = []
}

const updateNodePosition = async (node, newPosition) => {
  const position = parseInt(newPosition)
  if (position >= 1 && position <= reorderableNodes.value.length) {
    node.order = position

    // Reassign all positions to avoid conflicts
    reorderableNodes.value.forEach((n, index) => {
      if (n.id !== node.id) {
        if (index >= position - 1) {
          n.order = index + 2
        } else {
          n.order = index + 1
        }
      }
    })

    // Re-sort the modal list
    reorderableNodes.value.sort((a, b) => (a.order || 0) - (b.order || 0))

    await saveNodeOrder()
  }
}

const onDragStart = (node, index) => {
  draggedNodeId.value = node.id
  draggedFromIndex.value = index
}

const onDrop = async (targetNode, targetIndex) => {
  if (draggedNodeId.value && draggedFromIndex.value !== null) {
    const draggedNode = reorderableNodes.value.find((n) => n.id === draggedNodeId.value)

    if (draggedNode && draggedFromIndex.value !== targetIndex) {
      // Remove dragged node from current position
      reorderableNodes.value.splice(draggedFromIndex.value, 1)

      // Insert at new position
      reorderableNodes.value.splice(targetIndex, 0, draggedNode)

      // Reassign orders based on new positions
      reorderableNodes.value.forEach((node, index) => {
        node.order = index + 1
      })

      await saveNodeOrder()
    }
  }
}

const onDragEnd = () => {
  draggedNodeId.value = null
  draggedFromIndex.value = null
}

const resetOrder = async () => {
  reorderableNodes.value.forEach((node, index) => {
    node.order = index + 1
  })
  await saveNodeOrder()
}

const saveNodeOrder = async () => {
  try {
    // Update the main graphData with new orders
    graphData.value.nodes.forEach((node) => {
      const reorderedNode = reorderableNodes.value.find((rn) => rn.id === node.id)
      if (reorderedNode) {
        node.order = reorderedNode.order
      }
    })

    // Sort main graph data
    graphData.value.nodes.sort((a, b) => (a.order || 0) - (b.order || 0))

    // Save to backend
    const response = await fetch(
      getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: knowledgeGraphStore.currentGraphId,
          graphData: graphData.value,
          override: true,
        }),
      },
    )

    if (!response.ok) {
      throw new Error('Failed to save node order.')
    }

    await response.json()
    knowledgeGraphStore.updateGraphFromJson(graphData.value)

    console.log('Node order saved successfully')
  } catch (error) {
    console.error('Error saving node order:', error)
    alert('Failed to save node order. Please try again.')
  }
}

// Chart sheet functions
const initializeChartSheetData = (node) => {
  console.log('=== Initializing Chart Sheet Data ===')
  console.log('Full node data:', JSON.stringify(node, null, 2))
  console.log('Node info:', node.info)
  console.log('Node label:', node.label)
  console.log('Node xLabel:', node.xLabel)
  console.log('Node yLabel:', node.yLabel)

  // Initialize basic chart properties
  chartSheetData.value.title = node.label || ''
  chartSheetData.value.xLabel = node.xLabel || node.info?.xLabel || ''
  chartSheetData.value.yLabel = node.yLabel || node.info?.yLabel || ''

  // Reset to defaults first
  chartSheetData.value.series = [{ label: 'Series 1' }]
  chartSheetData.value.rows = [
    { label: 'Jan', values: [0] },
    { label: 'Feb', values: [0] },
  ]

  // Try to convert existing chart data to sheet format
  if (node.info) {
    console.log('Node.info exists, checking structure...')

    // Handle different possible data structures
    let labels = []
    let datasets = []

    // Case 1: Standard Chart.js format
    if (node.info.labels && node.info.datasets) {
      console.log('Found standard Chart.js format')
      originalDataFormat.value = 'standard'
      labels = node.info.labels
      datasets = node.info.datasets
    }
    // Case 2: Custom format with data array containing series with points
    else if (
      node.info.data &&
      Array.isArray(node.info.data) &&
      node.info.data.length > 0 &&
      node.info.data[0].points
    ) {
      console.log('Found custom points format')
      originalDataFormat.value = 'points'
      const seriesData = node.info.data

      // Extract x values as labels from first series
      if (seriesData[0].points && seriesData[0].points.length > 0) {
        labels = seriesData[0].points.map((point) => String(point.x))
        console.log('Extracted labels from x values:', labels)
      }

      // Convert each series to datasets format
      datasets = seriesData.map((series) => ({
        label: series.label || 'Series',
        data: series.points ? series.points.map((point) => Number(point.y)) : [],
      }))
      console.log('Converted series to datasets:', datasets)
    }
    // Case 3: Simple array format
    else if (Array.isArray(node.info)) {
      console.log('Found array format, trying to parse...')
      // Try to extract structure from array
      if (node.info.length > 0 && typeof node.info[0] === 'object') {
        // Array of objects like [{name: 'Jan', value: 100}, ...]
        labels = node.info.map((item) => item.name || item.label || item.x || 'Label')
        datasets = [
          {
            label: 'Data',
            data: node.info.map((item) => item.value || item.y || item.data || 0),
          },
        ]
      }
    }
    // Case 3: Object with different structure
    else if (typeof node.info === 'object') {
      console.log('Found object format, checking keys...')
      console.log('Object keys:', Object.keys(node.info))

      // Try to find labels and data in various keys
      const possibleLabelKeys = ['labels', 'categories', 'x', 'keys']
      const possibleDataKeys = ['data', 'values', 'series', 'datasets']

      for (const labelKey of possibleLabelKeys) {
        if (node.info[labelKey] && Array.isArray(node.info[labelKey])) {
          labels = node.info[labelKey]
          break
        }
      }

      for (const dataKey of possibleDataKeys) {
        if (node.info[dataKey]) {
          if (Array.isArray(node.info[dataKey])) {
            // Check if it's datasets format or simple array
            if (node.info[dataKey].length > 0 && node.info[dataKey][0].data) {
              datasets = node.info[dataKey]
            } else {
              datasets = [
                {
                  label: 'Data',
                  data: node.info[dataKey],
                },
              ]
            }
          }
          break
        }
      }
    }

    console.log('Extracted labels:', labels)
    console.log('Extracted datasets:', datasets)

    // If we found valid data, use it
    if (labels.length > 0 && datasets.length > 0) {
      console.log('Converting to sheet format...')

      // Set up series from datasets
      chartSheetData.value.series = datasets.map((dataset, i) => ({
        label: dataset.label || `Series ${i + 1}`,
      }))

      // Set up rows from labels and data
      chartSheetData.value.rows = labels.map((label, i) => ({
        label: String(label),
        values: datasets.map((dataset) => {
          const data = Array.isArray(dataset.data) ? dataset.data : []
          return Number(data[i]) || 0
        }),
      }))

      console.log('Successfully converted existing data!')
    } else {
      console.log('Could not parse existing data, using defaults')
    }
  } else {
    console.log('No node.info found, using defaults')
  }

  console.log('Final sheet data:', JSON.stringify(chartSheetData.value, null, 2))
  console.log('=== End Chart Sheet Initialization ===')
}

const convertSheetToChartData = () => {
  console.log('=== Converting Sheet Data Back to Chart Format ===')
  console.log('Original format:', originalDataFormat.value)
  console.log('Current sheet data:', chartSheetData.value)

  if (originalDataFormat.value === 'points') {
    // Convert back to the custom points format
    const data = chartSheetData.value.series.map((series, seriesIndex) => {
      const points = chartSheetData.value.rows.map((row, rowIndex) => ({
        x: Number(row.label) || rowIndex + 1, // Try to parse label as number, fallback to index
        y: Number(row.values[seriesIndex]) || 0,
      }))

      return {
        label: series.label,
        color: getSeriesColor(seriesIndex), // Add default colors
        points: points,
      }
    })

    return {
      data: data,
      xLabel: chartSheetData.value.xLabel,
      yLabel: chartSheetData.value.yLabel,
    }
  } else {
    // Standard Chart.js format
    const labels = chartSheetData.value.rows.map((row) => row.label)
    const datasets = chartSheetData.value.series.map((series, seriesIndex) => ({
      label: series.label,
      data: chartSheetData.value.rows.map((row) => row.values[seriesIndex] || 0),
    }))

    return { labels, datasets }
  }
}

const getSeriesColor = (index) => {
  const colors = ['#4a90e2', '#e94e77', '#f9d423', '#50c8a3', '#8b5cf6']
  return colors[index % colors.length]
}

const addSeries = () => {
  if (chartSheetData.value.series.length < 5) {
    chartSheetData.value.series.push({ label: `Series ${chartSheetData.value.series.length + 1}` })

    // Add empty values for this series to all existing rows
    chartSheetData.value.rows.forEach((row) => {
      row.values.push(0)
    })
  }
}

const removeSeries = (index) => {
  if (chartSheetData.value.series.length > 1) {
    chartSheetData.value.series.splice(index, 1)

    // Remove values for this series from all rows
    chartSheetData.value.rows.forEach((row) => {
      row.values.splice(index, 1)
    })
  }
}

const addRow = () => {
  if (chartSheetData.value.rows.length < 5) {
    const newRow = {
      label: '',
      values: new Array(chartSheetData.value.series.length).fill(0),
    }
    chartSheetData.value.rows.push(newRow)
  }
}

const removeRow = (index) => {
  if (chartSheetData.value.rows.length > 1) {
    chartSheetData.value.rows.splice(index, 1)
  }
}

const switchToJsonMode = () => {
  // Convert current sheet data to JSON for manual editing
  const chartData = convertSheetToChartData()
  currentMarkdown.value = JSON.stringify(chartData, null, 2)
  isJsonMode.value = true
}

const saveChartSheet = async () => {
  if (currentNode.value) {
    console.log('Saving chart sheet data...')

    // Update chart properties
    currentNode.value.label = chartSheetData.value.title

    // Convert sheet data to chart format
    const chartData = convertSheetToChartData()
    currentNode.value.info = chartData

    // For points format, xLabel and yLabel are inside info
    // For standard format, they're at the node level
    if (originalDataFormat.value === 'points') {
      // xLabel and yLabel are already in chartData
    } else {
      currentNode.value.xLabel = chartSheetData.value.xLabel
      currentNode.value.yLabel = chartSheetData.value.yLabel
    }

    console.log('Updated node data:', currentNode.value)

    // Use the existing save logic
    await saveGraphData()
  }
}

const handleSave = async () => {
  if (currentNode.value?.type === 'linechart') {
    if (isJsonMode.value) {
      // Parse JSON and convert back to sheet data, then save
      try {
        const chartData = JSON.parse(currentMarkdown.value)
        currentNode.value.info = chartData
        await saveGraphData()
      } catch {
        alert('Invalid JSON format. Please check your chart data syntax.')
        return
      }
    } else {
      // Save sheet data
      await saveChartSheet()
    }
  } else {
    // Regular markdown/JSON save
    await saveMarkdown()
  }
}

const saveGraphData = async () => {
  const updatedGraphData = {
    ...graphData.value,
    nodes: graphData.value.nodes.map((node) =>
      node.id === currentNode.value.id ? { ...node, ...currentNode.value } : node,
    ),
  }

  try {
    const response = await fetch(
      getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: knowledgeGraphStore.currentGraphId,
          graphData: updatedGraphData,
          override: true,
        }),
      },
    )

    if (!response.ok) {
      throw new Error('Failed to save the graph with history.')
    }

    await response.json()
    knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

    saveMessage.value = 'Chart updated successfully!'
    setTimeout(() => {
      saveMessage.value = ''
    }, 3000)

    closeMarkdownEditor()
  } catch (error) {
    console.error('Error saving chart:', error)
    alert('Failed to save the chart. Please try again.')
  }
}

// AI Response functionality for action_test nodes
const handleGetAIResponse = async (node) => {
  console.log('=== Handling Get AI Response ===')
  console.log('Action test node:', node)
  console.log('Endpoint URL:', node.label)
  console.log('Question/Prompt:', node.info)

  // Validate node data
  if (!node.label || !node.info) {
    alert('Action test node must have a valid endpoint URL in label and question in info.')
    return
  }

  // Show loading spinner and message
  isActionTestLoading.value = true
  actionTestLoadingMessage.value = `🤖 Calling ${node.label}...`

  try {
    // Call the endpoint using the same logic as GraphAdmin
    const result = await testEndpoint(node.label, node.info)

    if (result && validateAINode(result)) {
      console.log('AI response received:', result)

      // Create a new fulltext node with the AI response
      const newNode = {
        id: result.id || `ai_response_${Date.now()}`,
        label: result.label || 'AI Response',
        color: result.color || '#e8f4fd',
        type: 'fulltext',
        info: result.info || 'No response generated',
        bibl: Array.isArray(result.bibl) ? result.bibl : [],
        imageWidth: '100%',
        imageHeight: '100%',
        visible: true,
        order: graphData.value.nodes.length + 1, // Put at the end
      }

      // Add the new node to the graph
      graphData.value.nodes.push(newNode)

      // Update the graph data for saving
      const updatedGraphData = {
        ...graphData.value,
        nodes: graphData.value.nodes,
      }

      // Save to backend
      const response = await fetch(
        getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: knowledgeGraphStore.currentGraphId,
            graphData: updatedGraphData,
            override: true,
          }),
        },
      )

      if (!response.ok) {
        throw new Error('Failed to save the graph with AI response.')
      }

      await response.json()
      knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

      // Show success message
      saveMessage.value = `✅ AI response added successfully! New node: "${newNode.label}"`
      setTimeout(() => {
        saveMessage.value = ''
      }, 4000)

      console.log('AI response node added successfully')
    } else {
      throw new Error('Invalid AI response format')
    }
  } catch (error) {
    console.error('Error getting AI response:', error)
    saveMessage.value = `❌ Failed to get AI response: ${error.message}`
    setTimeout(() => {
      saveMessage.value = ''
    }, 5000)
  } finally {
    // Hide loading spinner
    isActionTestLoading.value = false
    actionTestLoadingMessage.value = ''
  }
}

// Test endpoint function (adapted from GraphAdmin.vue)
const testEndpoint = async (endpoint, content) => {
  console.log('Testing endpoint:', endpoint, 'with content:', content)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: content }),
    })

    if (!response.ok) {
      console.error('Endpoint test failed:', response.statusText)
      return null
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error('Error testing endpoint:', error)
    return null
  }
}

// Validate AI node response
const validateAINode = (node) => {
  if (!node) {
    console.error('Node is null or undefined')
    return false
  }

  // Check for basic required fields
  if (!node.id && !node.label) {
    console.error('Node missing id or label')
    return false
  }

  if (!node.info || typeof node.info !== 'string') {
    console.error('Node missing or invalid info field')
    return false
  }

  return true
}

// Delete node functionality
const deleteNode = async (node) => {
  const nodeDisplayName = getNodeDisplayName(node)

  // Confirm deletion
  const confirmed = confirm(
    `Are you sure you want to delete "${nodeDisplayName}"?\n\nThis action cannot be undone.`,
  )

  if (!confirmed) {
    return
  }

  try {
    console.log('=== Deleting Node ===')
    console.log('Node to delete:', node)

    // Remove the node from graphData
    const nodeIndex = graphData.value.nodes.findIndex((n) => n.id === node.id)
    if (nodeIndex === -1) {
      throw new Error('Node not found in graph data')
    }

    // Remove from local data
    graphData.value.nodes.splice(nodeIndex, 1)

    // Also remove from reorderable nodes if modal is open
    if (isReorderModalOpen.value) {
      const reorderIndex = reorderableNodes.value.findIndex((n) => n.id === node.id)
      if (reorderIndex !== -1) {
        reorderableNodes.value.splice(reorderIndex, 1)
      }
    }

    // Reassign order values to maintain sequence
    const visibleNodes = graphData.value.nodes.filter((n) => n.visible !== false)
    visibleNodes.forEach((n, index) => {
      n.order = index + 1
    })

    console.log('Updated graph data after deletion:', graphData.value)

    // Save to backend
    const response = await fetch(
      getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: knowledgeGraphStore.currentGraphId,
          graphData: graphData.value,
          override: true,
        }),
      },
    )

    if (!response.ok) {
      throw new Error('Failed to save graph after node deletion.')
    }

    await response.json()

    // Update the store
    knowledgeGraphStore.updateGraphFromJson(graphData.value)

    // Show success message
    saveMessage.value = `Node "${nodeDisplayName}" deleted successfully!`
    setTimeout(() => {
      saveMessage.value = ''
    }, 3000)

    console.log('Node deleted successfully')
  } catch (error) {
    console.error('Error deleting node:', error)
    alert(`Failed to delete node: ${error.message}`)

    // Reload the graph data to ensure consistency
    await fetchGraphData()
  }
}

onMounted(() => {
  fetchGraphData()
  attachImageChangeListeners()
})

// Image dimension update utility (used by modal)

const parseImageDimensions = (markdownContent, imageUrl) => {
  // Look for image syntax with the specific URL and extract dimensions
  const imageRegex = new RegExp(
    `!\\[([^\\]]*?)\\|([^\\]]*?)\\]\\(${escapeRegExp(imageUrl)}\\)`,
    'g',
  )
  const match = imageRegex.exec(markdownContent)

  if (match) {
    const styleString = match[2]
    const widthMatch = styleString.match(/width:\s*['"]?([^;'"]+)['"]?/i)
    const heightMatch = styleString.match(/height:\s*['"]?([^;'"]+)['"]?/i)

    return {
      width: widthMatch ? widthMatch[1].trim() : null,
      height: heightMatch ? heightMatch[1].trim() : null,
      fullMatch: match[0],
      styleString: styleString,
    }
  }

  return null
}

const updateImageDimensions = (markdownContent, imageUrl, newWidth, newHeight) => {
  const dimensions = parseImageDimensions(markdownContent, imageUrl)
  if (!dimensions) return markdownContent

  // Update the style string with new dimensions
  let newStyleString = dimensions.styleString

  // Update width
  if (dimensions.width) {
    newStyleString = newStyleString.replace(/width:\s*['"]?[^;'"]+['"]?/i, `width: ${newWidth}`)
  } else {
    newStyleString = `width: ${newWidth}; ${newStyleString}`
  }

  // Update height
  if (dimensions.height) {
    newStyleString = newStyleString.replace(/height:\s*['"]?[^;'"]+['"]?/i, `height: ${newHeight}`)
  } else {
    newStyleString = `height: ${newHeight}; ${newStyleString}`
  }

  // Create the new image markdown
  const newImageMarkdown = dimensions.fullMatch.replace(
    /!\[([^\]]*?)\|([^\]]*?)\]/,
    `![$1|${newStyleString}]`,
  )

  return markdownContent.replace(dimensions.fullMatch, newImageMarkdown)
}

// This function is used by the ImageSelector modal to update image dimensions

// Add event listeners for change image buttons
const attachImageChangeListeners = () => {
  nextTick(() => {
    console.log('=== Attaching Change Image Button Listeners ===')

    // Change image button listeners
    const changeImageButtons = document.querySelectorAll('.change-image-btn')
    console.log('Found change image buttons:', changeImageButtons.length)
    changeImageButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        const btn = event.target
        const imageData = {
          url: btn.getAttribute('data-image-url'),
          alt: btn.getAttribute('data-image-alt'),
          type: btn.getAttribute('data-image-type'),
          context: btn.getAttribute('data-image-context'),
          nodeId: btn.getAttribute('data-node-id'),
          nodeContent: btn.getAttribute('data-node-content'),
        }
        openImageSelector(imageData)
      })
    })

    // Google Photos button listeners
    const googlePhotosButtons = document.querySelectorAll('.google-photos-btn')
    console.log('Found Google Photos buttons:', googlePhotosButtons.length)
    googlePhotosButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        const btn = event.target
        const googlePhotosData = {
          url: btn.getAttribute('data-image-url'),
          alt: btn.getAttribute('data-image-alt'),
          type: btn.getAttribute('data-image-type'),
          context: btn.getAttribute('data-image-context'),
          nodeId: btn.getAttribute('data-node-id'),
          nodeContent: btn.getAttribute('data-node-content'),
        }
        openGooglePhotosSelector(googlePhotosData)
      })
    })

    console.log('Change image and Google Photos button listeners attached successfully')
  })
}

watch(
  () => knowledgeGraphStore.currentGraphId,
  () => {
    loading.value = true
    error.value = null
    fetchGraphData()
  },
)

// Watch for graph data changes to reattach event listeners
watch(
  () => graphData.value,
  () => {
    attachImageChangeListeners()
  },
  { deep: true },
)

// Helper function to extract old image URL from markdown content (unused, kept for future use)
// const extractOldImageUrl = (content) => {
//   if (!content) return null
//   const imageMatch = content.match(/!\[[^\]]*\]\(([^)]+)\)/)
//   return imageMatch ? imageMatch[1] : null
// }

const handleAIImageClick = () => {
  console.log('AI Image generation clicked')
  isAIImageModalOpen.value = true
}

const closeAIImageModal = () => {
  isAIImageModalOpen.value = false
}

// Navigation method for R2 Portfolio
const navigateToR2Portfolio = () => {
  router.push('/r2-portfolio')
}

// Sharing functionality
const openShareModal = async () => {
  // Show loading content initially
  shareContent.value = 'Generating engaging summary... Please wait.'

  if (!shareModal.value) {
    shareModal.value = new Modal(document.getElementById('shareModal'))
  }
  shareModal.value.show()

  try {
    // Get graph metadata
    const graphMetadata = knowledgeGraphStore.currentGraph?.metadata || {}

    // Call AI endpoint to generate engaging summary
    const response = await fetch(
      'https://knowledge-graph-worker.torarnehave.workers.dev/generate-share-summary',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          graphData: graphData.value,
          graphMetadata: graphMetadata,
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to generate summary: ${response.status}`)
    }

    const data = await response.json()

    if (data.success && data.summary) {
      // Use AI-generated engaging summary with branded domain
      const shareUrl = `https://${currentDomain.value}/gnew-viewer?graphId=${knowledgeGraphStore.currentGraphId}`
      shareContent.value = `${data.summary}\n\n${shareUrl}`

      console.log('AI-generated share summary:', data.summary)
      console.log('Used model:', data.model)
      console.log('Share URL with branded domain:', shareUrl)
    } else {
      throw new Error('AI response was not successful')
    }
  } catch (error) {
    console.error('Error generating AI summary:', error)

    // Fallback to basic summary if AI fails
    const nodeCount = Array.isArray(graphData.value.nodes) ? graphData.value.nodes.length : 0
    const edgeCount = Array.isArray(graphData.value.edges) ? graphData.value.edges.length : 0
    const graphMetadata = knowledgeGraphStore.currentGraph?.metadata || {}
    const graphTitle = graphMetadata.title || 'Untitled Graph'
    const graphDescription = graphMetadata.description || ''
    const categories = graphMetadata.category || ''
    const categoryText = categories ? `Categories: ${categories}` : ''

    shareContent.value =
      `${graphTitle}\n\n` +
      `${graphDescription}\n\n` +
      `Nodes: ${nodeCount}\n` +
      `Edges: ${edgeCount}\n` +
      `${categoryText}\n\n` +
      `View this knowledge graph: https://${currentDomain.value}/gnew-viewer?graphId=${knowledgeGraphStore.currentGraphId}`
  }
}

const shareToInstagram = () => {
  const instagramUrl = `https://www.instagram.com/create/story`
  window.open(instagramUrl, '_blank', 'width=600,height=400')

  // Show a message to the user
  alert('Please copy the text from the text area above and paste it into your Instagram story.')
}

const shareToLinkedIn = () => {
  const title = encodeURIComponent(shareContent.value.split('\n')[0])
  const summary = encodeURIComponent(shareContent.value)
  const graphId = knowledgeGraphStore.currentGraphId || ''
  const url = encodeURIComponent(`https://${currentDomain.value}/gnew-viewer?graphId=${graphId}`)

  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}&title=${title}&summary=${summary}`
  window.open(linkedInUrl, '_blank', 'width=600,height=400')
}

const shareToTwitter = () => {
  const title = shareContent.value.split('\n')[0]
  const graphId = knowledgeGraphStore.currentGraphId || ''
  const url = `https://${currentDomain.value}/gnew-viewer?graphId=${graphId}`

  // Twitter has a 280 character limit, so we'll create a shorter message
  const tweetText = encodeURIComponent(`${title}\n\nView this knowledge graph: ${url}`)
  const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}`
  window.open(twitterUrl, '_blank', 'width=600,height=400')
}

const shareToFacebook = () => {
  const graphId = knowledgeGraphStore.currentGraphId || ''
  const url = encodeURIComponent(`https://${currentDomain.value}/gnew-viewer?graphId=${graphId}`)

  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`
  window.open(facebookUrl, '_blank', 'width=600,height=400')
}

const handleImageInserted = async (nodeData) => {
  console.log('=== Image Inserted ===')
  console.log('Node data received:', nodeData)

  if (nodeData && nodeData.type === 'markdown-image') {
    // Add the new markdown-image node to the graph data
    const newNode = {
      ...nodeData,
      order: graphData.value.nodes.length + 1, // Put at the end
    }

    // Add to local graph data
    graphData.value.nodes.push(newNode)

    // Create updated graph data for saving
    const updatedGraphData = {
      ...graphData.value,
      nodes: graphData.value.nodes,
    }

    try {
      // Save to backend
      const response = await fetch(
        getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: knowledgeGraphStore.currentGraphId,
            graphData: updatedGraphData,
            override: true,
          }),
        },
      )

      if (!response.ok) {
        throw new Error('Failed to save the graph with AI-generated image.')
      }

      await response.json()
      knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

      // Show success message
      saveMessage.value = `✅ AI-generated image added successfully! New node: "${newNode.label?.substring(0, 50)}..."`
      setTimeout(() => {
        saveMessage.value = ''
      }, 4000)

      console.log('AI-generated image node saved successfully')
    } catch (error) {
      console.error('Error saving AI-generated image node:', error)
      // Remove the node from local state if save failed
      graphData.value.nodes = graphData.value.nodes.filter((node) => node.id !== newNode.id)
      saveMessage.value = `❌ Failed to save AI-generated image: ${error.message}`
      setTimeout(() => {
        saveMessage.value = ''
      }, 5000)
    }
  } else {
    console.error('Invalid node data for image insertion:', nodeData)
    saveMessage.value = '❌ Invalid image data received'
    setTimeout(() => {
      saveMessage.value = ''
    }, 3000)
  }
}

const { currentFrontPage } = useBranding()
const graphStore = useKnowledgeGraphStore()
const graphTitle = ref('')

onMounted(() => {
  // First check URL parameters for direct graph access (shared links)
  const urlParams = new URLSearchParams(window.location.search)
  const urlGraphId = urlParams.get('graphId')
  const urlTemplate = urlParams.get('template')

  if (urlGraphId) {
    console.log(
      `Loading graph from URL parameter: ${urlGraphId}, Template: ${urlTemplate || 'Default'}`,
    )
    // Set the graph ID in the store for shared links
    knowledgeGraphStore.setCurrentGraphId(urlGraphId)
    loadGraph(urlGraphId, urlTemplate)
    return
  }

  // If no URL parameters, check for branded front page configuration
  const frontPagePath = currentFrontPage.value
  console.log('Front page path received:', frontPagePath)
  if (frontPagePath && frontPagePath.includes('graphId')) {
    const params = new URLSearchParams(frontPagePath.split('?')[1] || '')
    const graphId = params.get('graphId')
    const template = params.get('template')
    if (graphId) {
      console.log(
        `Loading front page graph with ID: ${graphId}, Template: ${template || 'Default'}`,
      )
      knowledgeGraphStore.setCurrentGraphId(graphId)
      loadGraph(graphId, template)
    } else {
      error.value = 'Invalid front page configuration: No graph ID found'
    }
  } else {
    // Default graph loading logic if not a front page and no URL params
    loadDefaultGraph()
  }
})

const loadGraph = async (graphId, template) => {
  loading.value = true
  error.value = null
  try {
    // Set the graph ID in the store
    knowledgeGraphStore.setCurrentGraphId(graphId)

    // Fetch the graph data using the existing fetchGraphData function
    await fetchGraphData()

    // Apply template-specific styling if needed
    if (template === 'Frontpage') {
      console.log('Applying Frontpage template styling')
      // Add any specific styling or layout adjustments for front page
    }

    console.log(`Successfully loaded graph: ${graphId}`)
  } catch (err) {
    error.value = `Failed to load graph: ${err.message}`
    console.error('Error loading graph:', err)
  } finally {
    loading.value = false
  }
}

const loadDefaultGraph = async () => {
  // Check if there's already a graph ID in the store (from previous navigation)
  const existingGraphId = knowledgeGraphStore.currentGraphId

  if (existingGraphId) {
    console.log('Loading existing graph from store:', existingGraphId)
    try {
      await fetchGraphData()
    } catch (err) {
      console.error('Failed to load existing graph:', err)
      error.value = 'No graph selected. Please navigate to a specific graph or use a shared link.'
    }
  } else {
    // No graph ID available - show a helpful message
    console.log('No graph ID available - showing selection message')
    error.value = 'No graph selected. Please navigate to a specific graph or use a shared link.'
  }
}
</script>

<style scoped>
.graph-viewer {
  padding: 20px;
  background-color: #f9f9f9;
  box-sizing: border-box;
  max-width: 1200px;
  margin: 0 auto;
}

.loading,
.error {
  text-align: center;
  font-size: 1.5rem;
  margin-top: 20px;
}

.graph-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 100%;
  overflow: hidden;
  padding: 0 20px;
  box-sizing: border-box;
}

/* Remove or override previous image rules that set width: 100% for images inside p/header containers */
.graph-container img {
  display: block;
  max-width: 100%;
  width: auto;
  height: auto;
  margin: 0 auto 20px auto;
  border-radius: 8px;
  object-fit: cover;
  box-sizing: border-box;
}

/* For header images, if you use a class or alt text, make them full width inside the card, but not outside the card's padding */
.node img.header-image,
.node p:has(img[alt*='Header']) img {
  width: 100%;
  max-width: 100%;
  display: block;
  border-radius: 8px;
  object-fit: cover;
  margin: 0 0 20px 0;
  box-sizing: border-box;
}

/* Remove any special container rules that set width: 100vw or override the card's padding */
.graph-container p:has(img[alt*='Header']),
.graph-container p:has(img[alt*='Rightside']),
.graph-container p:has(img[alt*='Leftside']) {
  width: 100%;
  max-width: 100%;
  margin: 0 0 20px 0;
  overflow: hidden;
  padding: 0;
  box-sizing: border-box;
}

.node {
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
  overflow: hidden;
}

.node-label {
  margin: 0 0 10px;
  font-size: 1.25rem;
  color: #333;
}

.node-info {
  margin: 0;
  font-size: 1rem;
  color: #666;
}

.node-info button {
  margin-right: 10px;
  padding: 5px 10px;
  background-color: #007bff;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.node-info button:hover {
  background-color: #0056b3;
}

.node-image {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
}

.header-image-container {
  width: 100%;
  max-width: 100%;
  margin: 0 auto 20px;
  overflow: hidden;
  box-sizing: border-box;
}

.header-image-container img.header-image {
  width: 100%;
  max-width: 100%;
  max-height: 250px;
  height: auto;
  display: block;
  border-radius: 8px;
  object-fit: cover;
}

.rightside-container,
.leftside-container {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 20px;
  align-items: flex-start;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.rightside-content,
.leftside-content {
  flex: 1 1 auto;
  min-width: 0;
  max-width: calc(100% - 20% - 20px) !important;
  box-sizing: border-box;
}

.rightside-image {
  flex: 0 0 20%;
  width: 20%;
  min-width: 20% !important;
  box-sizing: border-box;
  order: 2;
}

.leftside-image {
  flex: 0 0 20%;
  width: 20%;
  min-width: 20% !important;
  box-sizing: border-box;
  order: 1;
}

.rightside-content {
  order: 1;
}

.leftside-content {
  order: 2;
}

img.rightside,
img.leftside {
  width: 100%;
  max-width: 100%;
  height: auto;
  display: block;
  border-radius: 8px;
}

.work-note {
  background-color: #ffd580;
  color: #333;
  font-size: 14px;
  font-family: 'Courier New', Courier, monospace;
  font-weight: bold;
  padding: 10px;
  margin: 10px 0;
  border-left: 5px solid #ccc;
  border-radius: 4px;
}

.fancy-quote {
  font-style: italic;
  background-color: #f9f9f9;
  border-left: 5px solid #ccc;
  padding: 1em;
  margin: 1em 0;
  color: #333;
}

.fancy-quote cite {
  display: block;
  text-align: right;
  font-style: normal;
  color: #666;
  margin-top: 0.5em;
}

.work-note cite {
  display: block;
  text-align: right;
  font-style: normal;
  color: #666;
  margin-top: 0.5em;
}

.section {
  padding: 1em;
  margin: 1em 0;
  border-radius: 4px;
  box-sizing: border-box;
}

.fancy-title {
  font-family: Arial, Helvetica, sans-serif;
  padding: 0.5em;
  margin: 1em 0;
  border-radius: 4px;
  box-sizing: border-box;
  font-weight: bold;
  text-align: center;
  background-size: cover;
  background-position: center;
  line-height: 1.2;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
}

.markdown-editor-modal,
.label-editor-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  width: 80%;
  max-width: 600px;
  box-sizing: border-box;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.modal-actions button {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.modal-actions button:first-child {
  background-color: #007bff;
  color: #fff;
}

.modal-actions button:last-child {
  background-color: #ccc;
  color: #333;
}

.youtube-section {
  margin: 20px 0;
  text-align: center;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #fff;
}

.youtube-title {
  margin: 0 0 10px;
  font-size: 1.25rem;
  color: #333;
  font-weight: bold;
}

.youtube-iframe {
  width: 100%;
  max-width: 560px;
  height: 315px;
  border: none;
  border-radius: 8px;
  margin-bottom: 10px;
}

@media (max-width: 768px) {
  .node {
    padding: 10px;
  }

  .node-label {
    font-size: 1rem;
  }

  .node-info {
    font-size: 0.875rem;
  }

  .header-image-container {
    margin: 0 0 15px;
  }

  .header-image-container img.header-image {
    max-height: 150px;
  }

  .rightside-container,
  .leftside-container {
    flex-direction: column;
    flex-wrap: wrap;
  }

  .rightside-content,
  .leftside-content {
    max-width: 100% !important;
  }

  .rightside-image,
  .leftside-image {
    flex: 0 0 auto;
    width: 200px;
    min-width: 0 !important;
  }

  .fancy-title {
    font-size: 2em !important;
    padding: 0.3em !important;
    margin: 0.5em 0 !important;
    line-height: 1.1 !important;
  }

  .graph-viewer {
    padding: 10px 5px !important;
    margin: 0 !important;
    max-width: 100% !important;
  }

  .graph-container {
    padding: 0 8px !important;
  }
}

.node-content-inner {
  /* Remove left/right padding for better image centering */
  box-sizing: border-box;
}
.node-content-inner img {
  width: 100%;
  max-width: 100%;
  height: auto;
  display: block;
  border-radius: 8px;
  object-fit: cover;
  margin-bottom: 20px;
}

.image-wrapper {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 20px;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
}
.image-wrapper img {
  width: 90% !important;
  max-width: 90% !important;
  display: block;
  object-fit: cover;
  border-radius: 8px;
  box-sizing: border-box;
  margin: 0 auto;
}

.ai-assist-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
.ai-assist-content {
  background: #fff;
  padding: 24px 20px;
  border-radius: 10px;
  min-width: 320px;
  max-width: 95vw;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.15);
  text-align: center;
  position: relative;
}
.ai-assist-close {
  position: absolute;
  top: 10px;
  right: 14px;
  background: none;
  border: none;
  font-size: 2rem;
  color: #888;
  cursor: pointer;
  z-index: 10;
  line-height: 1;
}
.ai-assist-close:hover {
  color: #333;
}
.ai-assist-questionarea {
  min-width: 220px;
  min-height: 60px;
  resize: vertical;
  margin-bottom: 8px;
}
.ai-assist-btn-row {
  display: flex;
  flex-direction: row;
  gap: 12px;
  justify-content: center;
  margin-top: 8px;
}
.ai-assist-btn {
  flex: 1 1 0;
  min-width: 0;
  max-width: 100%;
  white-space: normal;
}

.ai-assist-result-container,
.ai-assist-image-container {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ai-assist-result-container .alert {
  margin-bottom: 0;
}

.ai-assist-result-container .btn,
.ai-assist-image-container .btn {
  align-self: flex-start;
}

.ai-assist-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 15px;
}

.ai-assist-buttons .btn {
  min-width: 120px;
}

.edit-button {
  margin-bottom: 10px;
  padding: 5px 10px;
  background-color: #007bff;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.edit-button:hover {
  background-color: #0056b3;
}

.copy-button {
  margin-left: 10px;
  margin-bottom: 10px;
  padding: 5px 10px;
  background-color: #28a745;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.copy-button:hover {
  background-color: #1e7e34;
}

.delete-button {
  margin-left: 10px;
  margin-bottom: 10px;
  padding: 5px 10px;
  background-color: #dc3545;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background-color 0.2s ease;
}

.delete-button:hover {
  background-color: #c82333;
}

.delete-button:active {
  background-color: #bd2130;
}

.button-group {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

/* Reordering Styles */
.reorder-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 10px;
  padding: 4px 8px;
  background-color: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

.reorder-button {
  padding: 2px 6px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  min-width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.reorder-button:hover:not(:disabled) {
  background-color: #0056b3;
}

.reorder-button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
  opacity: 0.5;
}

.position-indicator {
  font-size: 11px;
  color: #6c757d;
  font-weight: 500;
  white-space: nowrap;
}

.reorder-all-button {
  padding: 2px 6px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  min-width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.reorder-all-button:hover {
  background-color: #1e7e34;
}

/* Reorder Modal Styles */
.reorder-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.reorder-modal-content {
  background: #fff;
  border-radius: 10px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.reorder-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 10px;
  border-bottom: 1px solid #e9ecef;
}

.reorder-header h3 {
  margin: 0;
  font-size: 1.4rem;
  color: #333;
}

.reorder-close {
  background: none;
  border: none;
  font-size: 2rem;
  color: #888;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.reorder-close:hover {
  color: #333;
}

.reorder-instructions {
  padding: 15px 24px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  font-size: 0.9rem;
  color: #6c757d;
}

.reorder-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  min-height: 200px;
  max-height: 400px;
}

.reorder-item {
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  background-color: #fff;
  cursor: move;
  transition: all 0.2s ease;
}

.reorder-item:hover {
  border-color: #007bff;
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.1);
}

.reorder-item-dragging {
  opacity: 0.5;
  transform: rotate(2deg);
  border-color: #007bff;
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.2);
}

.reorder-item-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.drag-handle {
  color: #6c757d;
  font-weight: bold;
  cursor: grab;
  user-select: none;
  font-family: monospace;
}

.drag-handle:active {
  cursor: grabbing;
}

.node-preview {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}

.node-type-icon {
  font-size: 1.2rem;
  min-width: 24px;
}

.node-details {
  flex: 1;
}

.node-title {
  font-weight: 500;
  color: #333;
  margin-bottom: 2px;
}

.node-type {
  font-size: 0.8rem;
  color: #6c757d;
  text-transform: capitalize;
}

.position-input {
  display: flex;
  align-items: center;
  gap: 6px;
}

.position-input label {
  font-size: 0.85rem;
  color: #6c757d;
  white-space: nowrap;
}

.position-number {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.9rem;
  text-align: center;
}

.position-number:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.reorder-actions {
  padding: 15px 24px;
  border-top: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.reorder-actions .btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
}

.reorder-actions .btn-secondary {
  background-color: #6c757d;
  color: white;
}

.reorder-actions .btn-secondary:hover {
  background-color: #545b62;
}

.reorder-actions .btn-primary {
  background-color: #007bff;
  color: white;
}

.reorder-actions .btn-primary:hover {
  background-color: #0056b3;
}

@media (max-width: 768px) {
  .reorder-controls {
    flex-direction: column;
    gap: 4px;
    margin-left: 0;
    margin-top: 8px;
  }

  .reorder-modal-content {
    width: 95%;
    max-height: 90vh;
  }

  .reorder-item-content {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .node-preview {
    justify-content: center;
  }

  .position-input {
    justify-content: center;
  }
}

/* Chart Sheet Editor Styles */
.linechart-sheet-editor {
  padding: 20px;
  max-width: 100%;
}

.chart-settings {
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 6px;
}

.setting-row {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  gap: 10px;
}

.setting-row:last-child {
  margin-bottom: 0;
}

.setting-row label {
  min-width: 100px;
  font-weight: 500;
  color: #333;
}

.chart-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
}

.chart-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.chart-data-table {
  background: white;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.sheet-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.sheet-table th,
.sheet-table td {
  padding: 8px 12px;
  border: 1px solid #dee2e6;
  text-align: center;
  vertical-align: middle;
}

.sheet-table th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #495057;
}

.series-header {
  position: relative;
  min-width: 120px;
}

.series-name-input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #ced4da;
  border-radius: 3px;
  font-size: 13px;
  margin-bottom: 4px;
}

.series-name-input:focus {
  outline: none;
  border-color: #007bff;
}

.remove-series-btn {
  background: none;
  border: none;
  color: #dc3545;
  cursor: pointer;
  font-size: 12px;
  padding: 2px;
}

.remove-series-btn:hover {
  background-color: #f8d7da;
  border-radius: 3px;
}

.add-series-btn {
  background-color: #28a745;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.add-series-btn:hover {
  background-color: #218838;
}

.label-input,
.value-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ced4da;
  border-radius: 3px;
  font-size: 13px;
}

.label-input:focus,
.value-input:focus {
  outline: none;
  border-color: #007bff;
}

.value-input {
  text-align: center;
}

.remove-row-btn {
  background: none;
  border: none;
  color: #dc3545;
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
}

.remove-row-btn:hover {
  background-color: #f8d7da;
  border-radius: 3px;
}

.table-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background-color: #f8f9fa;
  border-top: 1px solid #dee2e6;
}

.add-row-btn {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.add-row-btn:hover {
  background-color: #0056b3;
}

.switch-mode-btn {
  background-color: #6c757d;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.switch-mode-btn:hover {
  background-color: #545b62;
}

@media (max-width: 768px) {
  .linechart-sheet-editor {
    padding: 10px;
  }

  .setting-row {
    flex-direction: column;
    align-items: stretch;
    gap: 5px;
  }

  .setting-row label {
    min-width: auto;
  }

  .sheet-table th,
  .sheet-table td {
    padding: 6px 8px;
    font-size: 12px;
  }

  .table-actions {
    flex-direction: column;
    gap: 10px;
  }
}

.leftside-content {
  margin-left: 20px;
}
.rightside-content {
  margin-right: 20px;
}

.leftside-content p,
.rightside-content p {
  margin-bottom: 1em;
}

.comment-block {
  border-left: 4px solid #ccc;
  margin: 1.5em 0;
  padding: 0.75em 1em;
  font-size: 0.97em;
  background: #464545;
  color: #cfcaca;
  border-radius: 4px;
}
.comment-author {
  font-weight: bold;
  margin-bottom: 0.5em;
  color: #888;
  font-size: 0.93em;
}

/* Quick Format Loading Overlay */
.quick-format-loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  backdrop-filter: blur(4px);
}

.loading-content {
  background: #fff;
  border-radius: 16px;
  padding: 40px;
  text-align: center;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  animation: fadeInScale 0.3s ease-out;
}

.loading-content h3 {
  margin: 20px 0 10px 0;
  color: #333;
  font-size: 1.4rem;
}

.loading-content p {
  margin: 0 0 20px 0;
  color: #666;
  font-size: 1rem;
}

.loading-content small {
  color: #888;
  font-size: 0.85rem;
}

.spinner-large {
  width: 50px;
  height: 50px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #6f42c1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px auto;
}

.loading-progress {
  margin: 20px 0;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background-color: #e9ecef;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #6f42c1, #8b5cf6, #6f42c1);
  background-size: 200% 100%;
  animation: progressSlide 2s ease-in-out infinite;
  border-radius: 3px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes fadeInScale {
  0% {
    opacity: 0;
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes progressSlide {
  0% {
    width: 0%;
    background-position: 0% 50%;
  }
  50% {
    width: 70%;
    background-position: 100% 50%;
  }
  100% {
    width: 100%;
    background-position: 200% 50%;
  }
}

/* Image Change Wrapper */
.image-change-wrapper {
  position: relative;
  display: inline-block;
  max-width: 100%;
}

/* Image Button Container Styles */
.image-button-container {
  display: flex;
  gap: 6px;
  margin: 8px 0;
  justify-content: center;
  flex-wrap: wrap;
}

/* Change Image Button Styles */
.change-image-btn {
  padding: 6px 12px;
  background: linear-gradient(135deg, #6f42c1, #8b5cf6);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(111, 66, 193, 0.3);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
  white-space: nowrap;
}

.change-image-btn:hover {
  background: linear-gradient(135deg, #5a359a, #7c3aed);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(111, 66, 193, 0.4);
}

.change-image-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(111, 66, 193, 0.4);
}

/* Google Photos Button Styles */
.google-photos-btn {
  padding: 6px 12px;
  background: linear-gradient(135deg, #4285f4, #4fc3f7);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(66, 133, 244, 0.3);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
  white-space: nowrap;
}

.google-photos-btn:hover {
  background: linear-gradient(135deg, #3367d6, #29b6f6);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(66, 133, 244, 0.4);
}

.google-photos-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(66, 133, 244, 0.4);
}

/* Position image button containers in different containers */
.header-image-container .image-button-container {
  margin: 10px auto 0 auto;
  justify-content: center;
}

.rightside-image .image-button-container,
.leftside-image .image-button-container {
  margin: 8px 0;
  justify-content: center;
}

.rightside-image .change-image-btn,
.rightside-image .google-photos-btn,
.leftside-image .change-image-btn,
.leftside-image .google-photos-btn {
  font-size: 0.8rem;
  padding: 4px 8px;
}

/* Ensure button containers don't break image layouts */
.rightside-container .image-button-container,
.leftside-container .image-button-container {
  margin: 8px 0 0 0;
}

/* Dynamic width container for larger images */
.dynamic-width-container {
  align-items: flex-start;
}

.dynamic-width-container .rightside-image,
.dynamic-width-container .leftside-image {
  /* Override default flex settings for dynamic width containers */
  flex-shrink: 0;
}

.dynamic-width-container .rightside-content,
.dynamic-width-container .leftside-content {
  /* Ensure content doesn't overflow in dynamic containers */
  min-width: 0;
  overflow-wrap: break-word;
}

/* Mobile responsiveness for dynamic width containers */
@media (max-width: 768px) {
  .dynamic-width-container {
    flex-direction: column !important;
  }

  .dynamic-width-container .rightside-image,
  .dynamic-width-container .leftside-image {
    width: 100% !important;
    max-width: 400px !important;
    margin: 0 auto !important;
    flex: 0 0 auto !important;
  }

  .dynamic-width-container .rightside-content,
  .dynamic-width-container .leftside-content {
    max-width: 100% !important;
    width: 100% !important;
  }

  /* Mobile-specific adjustments */
}

/* Action Test Node Styles */
.action-test-content {
  padding: 15px;
  border: 2px solid #ff9500;
  border-radius: 10px;
  background: linear-gradient(145deg, #fff3e0, #ffcc80);
  box-shadow: 0 4px 8px rgba(255, 149, 0, 0.2);
  margin: 10px 0;
}

.action-test-content .node-label {
  color: #e65100;
  margin-bottom: 15px;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(255, 149, 0, 0.2);
}

.action-test-info {
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  padding: 15px;
  border: 1px solid rgba(255, 149, 0, 0.3);
}

.endpoint-info {
  margin-bottom: 12px;
  padding: 8px 12px;
  background-color: #e3f2fd;
  border-left: 4px solid #2196f3;
  border-radius: 4px;
  font-size: 0.9rem;
}

.question-info {
  padding: 8px 12px;
  background-color: #f3e5f5;
  border-left: 4px solid #9c27b0;
  border-radius: 4px;
  font-size: 0.9rem;
}

.question-content {
  margin-top: 8px;
  padding: 10px;
  background-color: rgba(255, 255, 255, 0.7);
  border-radius: 6px;
  border: 1px dashed #9c27b0;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 768px) {
  .action-test-content {
    padding: 10px;
    margin: 8px 0;
  }

  .action-test-info {
    padding: 10px;
  }

  .endpoint-info,
  .question-info {
    padding: 6px 8px;
    font-size: 0.85rem;
  }

  .question-content {
    padding: 8px;
    font-size: 0.8rem;
  }
}

/* Action Test Loading Overlay */
.action-test-loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  backdrop-filter: blur(4px);
}

.action-test-loading-overlay .loading-content {
  background: #fff;
  border-radius: 16px;
  padding: 40px;
  text-align: center;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  animation: fadeInScale 0.3s ease-out;
}

.action-test-loading-overlay .loading-content h3 {
  margin: 20px 0 10px 0;
  color: #333;
  font-size: 1.4rem;
}

.action-test-loading-overlay .loading-content p {
  margin: 0 0 20px 0;
  color: #666;
  font-size: 1rem;
}

.action-test-loading-overlay .loading-content small {
  color: #888;
  font-size: 0.85rem;
}

.action-test-loading-overlay .spinner-large {
  width: 50px;
  height: 50px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #ff9500;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px auto;
}

.action-test-loading-overlay .loading-progress {
  margin: 20px 0;
}

.action-test-loading-overlay .progress-bar {
  width: 100%;
  height: 6px;
  background-color: #e9ecef;
  border-radius: 3px;
  overflow: hidden;
}

.action-test-loading-overlay .progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff9500, #ffcc00, #ff9500);
  background-size: 200% 100%;
  animation: progressSlide 2s ease-in-out infinite;
  border-radius: 3px;
}

.worker-code-block {
  background: #23272e;
  color: #f8f8f2;
  padding: 1em;
  border-radius: 6px;
  font-family: 'Fira Mono', 'Consolas', monospace;
  font-size: 0.98em;
  overflow-x: auto;
  margin-top: 0.5em;
}
</style>

<!-- Global print styles (not scoped) -->
<style>
@media print {
  body * {
    visibility: hidden !important;
  }
  .graph-viewer,
  .graph-viewer * {
    visibility: visible !important;
  }
  .graph-viewer {
    position: absolute !important;
    left: 0;
    top: 0;
    width: 100vw;
    background: #fff !important;
    box-shadow: none !important;
    padding: 0 !important;
  }
  .btn,
  .alert,
  .modal,
  .navbar,
  .sidebar,
  .footer {
    display: none !important;
  }
  .node-info button {
    display: none !important;
  }
  .change-image-btn,
  .google-photos-btn,
  .image-button-container {
    display: none !important;
  }
}
</style>
