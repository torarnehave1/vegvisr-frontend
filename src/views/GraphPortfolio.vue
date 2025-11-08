<template>
  <div>
    <!-- Mobile Menu Overlay -->
    <div
      v-if="showMobileMenu"
      class="mobile-menu-overlay"
      :class="{ 'bg-dark': props.theme === 'dark' }"
      @click="closeMobileMenu"
    >
      <div
        class="mobile-menu-content"
        :class="{ 'bg-dark': props.theme === 'dark', 'text-white': props.theme === 'dark' }"
        @click.stop
      >
        <div class="mobile-menu-header">
          <h5>Menu</h5>
          <button class="btn-close" @click="closeMobileMenu" aria-label="Close"></button>
        </div>

        <!-- Admin Buttons (Mobile) -->
        <div v-if="userStore.role === 'Superadmin'" class="mobile-menu-section">
          <h6>Admin Actions</h6>
          <button class="btn btn-warning w-100 mb-2" @click="generateMetaAreas">
            Auto-Generate Meta Areas (GROK AI)
          </button>
          <button class="btn btn-danger w-100 mb-2" @click="resetMetaAreas">
            Reset All Meta Areas
          </button>
        </div>

        <!-- Search (Mobile) -->
        <div class="mobile-menu-section">
          <h6>Search</h6>
          <input
            type="text"
            v-model="portfolioStore.searchQuery"
            class="form-control mb-2"
            placeholder="🔍 Search by title, slug, or #tag..."
            @input="filterGraphs"
          />
          <small class="text-muted">
            Portfolio Filter • Type SEO slug or #MetaArea • For global search, use the search bar above
          </small>
        </div>

        <!-- Sort Options (Mobile) -->
        <div class="mobile-menu-section">
          <h6>Sort By</h6>
          <select v-model="portfolioStore.sortBy" class="form-select mb-2" @change="sortGraphs">
            <option value="title-asc">Name (A-Z)</option>
            <option value="title-desc">Name (Z-A)</option>
            <option value="date-desc">Date (Newest First)</option>
            <option value="date-asc">Date (Oldest First)</option>
            <option value="nodes">Sort by Node Count</option>
            <option value="category">Sort by Category</option>
          </select>
        </div>

        <!-- View Mode Toggle (Mobile) -->
        <div class="mobile-menu-section">
          <h6>View Mode</h6>
          <div class="btn-group w-100 mb-2" role="group">
            <button
              class="btn btn-outline-primary"
              :class="{ active: portfolioStore.viewMode === 'detailed' }"
              @click="portfolioStore.viewMode = 'detailed'"
            >
              Detailed
            </button>
            <button
              class="btn btn-outline-secondary"
              :class="{ active: portfolioStore.viewMode === 'simple' }"
              @click="portfolioStore.viewMode = 'simple'"
            >
              Simple
            </button>
            <button
              class="btn btn-outline-success"
              :class="{ active: portfolioStore.viewMode === 'table' }"
              @click="portfolioStore.viewMode = 'table'"
            >
              Table
            </button>
          </div>
        </div>

        <!-- Meta Area Sidebar (Mobile) -->
        <div class="mobile-menu-section">
          <h6>Meta Area</h6>
          <div class="mobile-meta-areas">
            <div
              class="mobile-meta-item"
              :class="{ active: portfolioStore.selectedMetaArea === null }"
              @click="selectMetaArea(null)"
            >
              All
            </div>
            <div
              v-for="area in portfolioStore.sortedMetaAreas"
              :key="area"
              class="mobile-meta-item"
              :class="{ active: portfolioStore.selectedMetaArea === area }"
              @click="selectMetaArea(area)"
            >
              {{ area }}
              <span class="badge bg-secondary ms-2"
                >({{ portfolioStore.metaAreaFrequencies[area] }})</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="d-flex">
      <!-- Desktop Sidebar (hidden on mobile) -->
      <MetaAreaSidebar
        :selected="portfolioStore.selectedMetaArea"
        @select="portfolioStore.selectedMetaArea = $event"
        class="d-none d-md-block"
      />

      <div class="flex-grow-1">
        <!-- Mobile Header with Hamburger -->
        <div class="mobile-header d-md-none">
          <button
            class="hamburger-btn"
            :class="{ active: showMobileMenu }"
            @click="toggleMobileMenu"
            aria-label="Open menu"
          >
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
          </button>
          <h1 class="mobile-title">Portfolio</h1>
        </div>

        <div
          class="portfolio-page"
          :class="{ 'bg-dark': props.theme === 'dark', 'text-white': props.theme === 'dark' }"
        >
          <div class="container-fluid">
            <!-- Desktop Header (hidden on mobile) -->
            <div class="row mb-4 d-none d-md-block">
              <div class="col-12">
                <!-- Admin Buttons (Desktop) -->
                <button
                  v-if="userStore.role === 'Superadmin'"
                  class="btn btn-warning mb-3"
                  @click="generateMetaAreas"
                >
                  Auto-Generate Meta Areas (GROK AI)
                </button>
                <button
                  v-if="userStore.role === 'Superadmin'"
                  class="btn btn-danger mb-3 ms-2"
                  @click="resetMetaAreas"
                >
                  Reset All Meta Areas
                </button>

                <h1 class="text-center">Knowledge Graph Portfolio</h1>
                <div class="d-flex justify-content-between align-items-center mb-3">
                  <div class="search-box">
                    <input
                      type="text"
                      v-model="portfolioStore.searchQuery"
                      class="form-control"
                      placeholder="🔍 Search by title, slug, or #tag..."
                      @input="filterGraphs"
                    />
                    <small class="text-muted">
                      Portfolio Filter • Type SEO slug or #MetaArea • For global search, use the search bar above
                    </small>
                  </div>
                  <div class="view-options d-flex align-items-center" style="gap: 0.5rem">
                    <label class="mb-0">Sort:</label>
                    <select
                      v-model="portfolioStore.sortBy"
                      class="form-select"
                      @change="sortGraphs"
                    >
                      <option value="title-asc">Name (A-Z)</option>
                      <option value="title-desc">Name (Z-A)</option>
                      <option value="date-desc">Date (Newest First)</option>
                      <option value="date-asc">Date (Oldest First)</option>
                      <option value="nodes">Sort by Node Count</option>
                      <option value="category">Sort by Category</option>
                    </select>
                  </div>
                </div>
                <!-- View Mode Toggle (Desktop) -->
                <div class="view-toggle mb-3">
                  <button
                    class="btn btn-outline-primary me-2"
                    :class="{ active: portfolioStore.viewMode === 'detailed' }"
                    @click="portfolioStore.viewMode = 'detailed'"
                  >
                    Detailed View
                  </button>
                  <button
                    class="btn btn-outline-secondary me-2"
                    :class="{ active: portfolioStore.viewMode === 'simple' }"
                    @click="portfolioStore.viewMode = 'simple'"
                  >
                    Simple View
                  </button>
                  <button
                    class="btn btn-outline-success"
                    :class="{ active: portfolioStore.viewMode === 'table' }"
                    @click="portfolioStore.viewMode = 'table'"
                  >
                    Table View
                  </button>
                </div>

                <!-- Success State -->
                <div v-if="successMessage" class="alert alert-success mt-3" role="alert">
                  {{ successMessage }}
                </div>

                <!-- Error State -->
                <div v-if="error" class="alert alert-danger mt-3" role="alert">
                  {{ error }}
                </div>
              </div>
            </div>

            <!-- Mobile Success/Error Messages -->
            <div class="d-md-none">
              <div v-if="successMessage" class="alert alert-success mt-3" role="alert">
                {{ successMessage }}
              </div>
              <div v-if="error" class="alert alert-danger mt-3" role="alert">
                {{ error }}
              </div>
            </div>

            <!-- Simple View (GraphGallery) -->
            <GraphGallery
              v-if="portfolioStore.viewMode === 'simple'"
              :graphs="galleryGraphs"
              :isViewOnly="userStore.role === 'ViewOnly'"
              @view-graph="handleGalleryViewGraph"
              @edit-graph="editGraph"
              @delete-graph="confirmDelete"
            />

            <!-- Table View -->
            <GraphTable
              v-if="portfolioStore.viewMode === 'table'"
              :graphs="filteredGraphs"
              :isViewOnly="userStore.role === 'ViewOnly'"
              @view-graph="viewGraph"
              @edit-graph="editGraph"
              @delete-graph="confirmDelete"
            />

            <!-- Detailed View (original card/list) -->
            <div v-if="portfolioStore.viewMode === 'detailed'">
              <!-- Portfolio Grid -->
              <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 g-4">
                <div v-for="graph in filteredGraphs" :key="graph.id" class="col">
                  <div
                    class="card h-100"
                    :class="{
                      'bg-dark': props.theme === 'dark',
                      'text-white': props.theme === 'dark',
                    }"
                    :data-graph-id="graph.id"
                  >
                    <div class="card-body">
                      <!-- Edit Mode -->
                      <div v-if="editingGraphId === graph.id" class="edit-form">
                        <div class="mb-3">
                          <label class="form-label">Title</label>
                          <div class="input-group">
                            <input
                              type="text"
                              class="form-control"
                              v-model="editingGraph.metadata.title"
                              placeholder="Enter title"
                            />
                            <button
                              class="btn btn-outline-primary"
                              @click="suggestTitle(graph)"
                              :disabled="isLoadingTitle"
                              title="Get AI title suggestion"
                            >
                              <i
                                class="bi"
                                :class="isLoadingTitle ? 'bi-hourglass-split' : 'bi-magic'"
                              ></i>
                            </button>
                          </div>
                        </div>
                        <div class="mb-3">
                          <label class="form-label"
                            >Categories (use # to separate multiple categories)</label
                          >
                          <div class="input-group">
                            <input
                              type="text"
                              class="form-control"
                              v-model="editingGraph.metadata.category"
                              placeholder="e.g., #Research #Project #Analysis"
                            />
                            <button
                              class="btn btn-outline-primary"
                              @click="suggestCategories(graph)"
                              :disabled="isLoadingCategories"
                              title="Get AI category suggestions"
                            >
                              <i
                                class="bi"
                                :class="isLoadingCategories ? 'bi-hourglass-split' : 'bi-magic'"
                              ></i>
                            </button>
                          </div>
                        </div>
                        <div class="mb-3">
                          <label class="form-label">Description</label>
                          <div class="input-group">
                            <textarea
                              class="form-control"
                              v-model="editingGraph.metadata.description"
                              rows="3"
                              placeholder="Enter description"
                            ></textarea>
                            <button
                              class="btn btn-outline-primary"
                              @click="suggestDescription(graph)"
                              :disabled="isLoadingDescription"
                              title="Get AI description suggestion"
                            >
                              <i
                                class="bi"
                                :class="isLoadingDescription ? 'bi-hourglass-split' : 'bi-magic'"
                              ></i>
                            </button>
                          </div>
                        </div>
                        <div class="mb-3">
                          <label class="form-label">Created By</label>
                          <input
                            type="text"
                            class="form-control"
                            v-model="editingGraph.metadata.createdBy"
                            placeholder="Enter creator name"
                          />
                        </div>
                        <div class="mb-3">
                          <button
                            class="btn btn-outline-primary"
                            @click="openR2ImageModal"
                            :disabled="isLoadingPortfolioImage"
                          >
                            <i
                              class="bi"
                              :class="isLoadingPortfolioImage ? 'bi-hourglass-split' : 'bi-image'"
                            ></i>
                            Insert Portfolio Image
                          </button>
                        </div>
                        <div class="mb-3 position-relative">
                          <label class="form-label"
                            >Meta Areas (use # to separate multiple areas)</label
                          >
                          <input
                            type="text"
                            class="form-control"
                            v-model="editingGraph.metadata.metaArea"
                            placeholder="e.g., #Technology #Management #WebDesign"
                            @input="onMetaAreaInput"
                            @keydown.tab.prevent="selectSuggestion"
                            @keydown.enter.prevent="selectSuggestion"
                            @keydown.down.prevent="moveSuggestion(1)"
                            @keydown.up.prevent="moveSuggestion(-1)"
                            @blur="handleBlur"
                            autocomplete="off"
                          />
                          <ul v-if="showSuggestions" class="autocomplete-list">
                            <li
                              v-for="(suggestion, idx) in filteredSuggestions"
                              :key="suggestion"
                              :class="{ active: idx === suggestionIndex }"
                              @mousedown.prevent="selectSuggestion(idx)"
                            >
                              {{ suggestion }}
                            </li>
                          </ul>
                        </div>
                        <div class="d-flex justify-content-end gap-2">
                          <button class="btn btn-secondary btn-sm" @click="cancelEdit">
                            Cancel
                          </button>
                          <button class="btn btn-primary btn-sm" @click="saveEdit(graph)">
                            Save
                          </button>
                        </div>
                      </div>

                      <!-- View Mode -->
                      <template v-else>
                        <div class="d-flex justify-content-between align-items-start">
                          <h5 class="card-title mb-0">
                            {{ graph.metadata?.title || 'Untitled Graph' }}
                          </h5>
                          <button
                            class="btn btn-outline-primary btn-sm share-btn"
                            @click="openShareModal(graph)"
                            title="Share Graph"
                          >
                            <i class="bi bi-share"></i> Share
                          </button>
                        </div>
                        <!-- Add portfolio image display -->
                        <div
                          v-if="getPortfolioImage(graph.nodes)"
                          class="portfolio-image-container mt-2 mb-2"
                        >
                          <img
                            :src="getPortfolioImage(graph.nodes).path"
                            :alt="getPortfolioImage(graph.nodes).label"
                            class="portfolio-image"
                            @error="() => {}"
                          />
                        </div>
                        <p class="card-text text-muted" v-if="graph.metadata?.description">
                          {{ truncateText(graph.metadata.description) }}
                        </p>
                        <div class="graph-meta">
                          <span class="badge bg-primary">
                            {{ Array.isArray(graph.nodes) ? graph.nodes.length : 0 }} Nodes
                            <small v-if="Array.isArray(graph.nodes) && graph.nodes.length > 0"
                              >({{ getNodeTypes(graph.nodes) }})</small
                            >
                          </span>
                          <span class="badge bg-secondary ms-2">
                            {{ Array.isArray(graph.edges) ? graph.edges.length : 0 }} Edges
                          </span>
                          <span class="badge bg-info ms-2" v-if="graph.metadata?.version">
                            v{{ graph.metadata.version }}
                          </span>
                          <span
                            v-if="graph.vectorization?.isVectorized"
                            class="badge bg-success ms-2"
                            title="Graph is vectorized for semantic search"
                          >
                            <i class="bi bi-search"></i>
                            {{ graph.vectorization.vectorCount }} Vectors
                          </span>
                          <span
                            v-if="graph.ambassadorStatus?.hasAmbassadors"
                            class="badge bg-gold ms-2"
                            :title="`${graph.ambassadorStatus.affiliateCount} affiliate ambassadors promoting this graph`"
                          >
                            <i class="bi bi-person-badge"></i>
                            {{ graph.ambassadorStatus.affiliateCount }} Ambassadors
                          </span>
                          <!-- Publication State Badge (Superadmin only) -->
                          <span
                            v-if="userStore.role === 'Superadmin'"
                            class="badge ms-2 publication-state-badge"
                            :class="graph.metadata?.publicationState === 'published' ? 'bg-success' : 'bg-warning text-dark'"
                            :title="graph.metadata?.publicationState === 'published' ? 'Published - Visible to all users' : 'Draft - Only visible to Superadmin'"
                          >
                            {{ graph.metadata?.publicationState === 'published' ? '✅ Published' : '📝 Draft' }}
                          </span>
                          <span
                            v-if="hasAffiliate(graph.id)"
                            class="badge bg-affiliate ms-2"
                            :title="`This graph has ${getAffiliateDeal(graph.id)?.affiliateCount} affiliate partners`"
                          >
                            <i class="bi bi-handshake"></i>
                            {{ getAffiliateDeal(graph.id)?.affiliateCount }} Affiliate{{
                              getAffiliateDeal(graph.id)?.affiliateCount !== 1 ? 's' : ''
                            }}
                          </span>
                          <template v-if="graph.metadata?.category">
                            <span
                              v-for="(cat, index) in getCategories(graph.metadata.category)"
                              :key="index"
                              class="badge bg-success ms-2"
                            >
                              {{ cat }}
                            </span>
                          </template>
                          <template v-if="graph.metadata?.metaArea">
                            <span
                              v-for="(area, idx) in getMetaAreas(graph.metadata.metaArea)"
                              :key="idx"
                              class="badge bg-warning ms-2 cursor-pointer"
                              :title="`Click to filter by ${area}`"
                              @click="filterByMetaArea(area)"
                            >
                              {{ area }}
                            </span>
                          </template>
                          <template v-if="graph.metadata?.seoSlug">
                            <span
                              class="badge bg-info ms-2 cursor-pointer"
                              title="Click to show all graphs with SEO slugs"
                              @click="filterBySEO"
                            >
                              🔗 SEO
                            </span>
                          </template>
                        </div>
                        <div class="graph-info mt-3">
                          <small class="text-muted">
                            Created by: {{ graph.metadata?.createdBy || 'Unknown' }}
                          </small>
                          <br />
                          <small class="text-muted">
                            Last updated: {{ formatDate(graph.metadata?.updatedAt) }}
                          </small>
                          <br />
                          <small class="text-muted"> ID: {{ graph.id }} </small>
                          <template v-if="graph.metadata?.mystmkraUrl">
                            <br />
                            <small class="text-muted">
                              <a
                                :href="graph.metadata.mystmkraUrl"
                                target="_blank"
                                class="text-info"
                              >
                                <i class="bi bi-link-45deg"></i> View on Mystmkra.io
                              </a>
                            </small>
                          </template>
                        </div>
                      </template>
                    </div>
                    <div class="card-footer">
                      <div class="d-flex justify-content-between">
                        <div class="d-flex gap-2">
                          <button class="btn btn-primary btn-sm" @click="viewGraph(graph)">
                            View Graph
                          </button>
                          <!-- Vectorization Button (Superadmin only) -->
                          <button
                            v-if="
                              userStore.role === 'Superadmin' &&
                              !graph.vectorization?.isVectorized &&
                              !graph.vectorization?.isVectorizing
                            "
                            class="btn btn-outline-success btn-sm"
                            @click="vectorizeGraph(graph)"
                            title="Enable semantic search for this graph"
                          >
                            <i class="bi bi-search"></i> Vectorize
                          </button>
                          <button
                            v-if="userStore.role === 'Superadmin' && graph.vectorization?.isVectorizing"
                            class="btn btn-outline-warning btn-sm"
                            disabled
                            title="Vectorization in progress..."
                          >
                            <i class="bi bi-hourglass-split"></i> Vectorizing...
                          </button>
                          <span
                            v-if="userStore.role === 'Superadmin' && graph.vectorization?.isVectorized"
                            class="btn btn-success btn-sm"
                            title="Graph is vectorized and searchable"
                          >
                            <i class="bi bi-check-circle"></i> Vectorized
                          </span>
                        </div>
                        <div
                          class="btn-group"
                          v-if="userStore.role === 'Admin' || userStore.role === 'Superadmin'"
                        >
                          <button
                            v-if="editingGraphId !== graph.id"
                            class="btn btn-outline-secondary btn-sm"
                            @click="startEdit(graph)"
                          >
                            Edit Info
                          </button>
                          <button
                            v-if="editingGraphId !== graph.id"
                            class="btn btn-outline-secondary btn-sm"
                            @click="editGraph(graph)"
                          >
                            Edit Graph
                          </button>
                          <!-- Toggle Publication State (Superadmin only) -->
                          <button
                            v-if="userStore.role === 'Superadmin' && editingGraphId !== graph.id"
                            class="btn btn-sm"
                            :class="graph.metadata?.publicationState === 'published' ? 'btn-outline-warning' : 'btn-outline-success'"
                            @click="toggleGraphPublicationState(graph)"
                            :title="graph.metadata?.publicationState === 'published' ? 'Unpublish (make draft)' : 'Publish (make visible to users)'"
                          >
                            {{ graph.metadata?.publicationState === 'published' ? '📝 Unpublish' : '✅ Publish' }}
                          </button>
                          <button
                            v-if="editingGraphId !== graph.id"
                            class="btn btn-danger btn-sm"
                            @click="confirmDelete(graph)"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="text-center mt-5">
              <div class="spinner-border" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
            </div>

            <!-- No Results State -->
            <div v-if="!loading && !error && filteredGraphs.length === 0" class="text-center mt-5">
              <p class="text-muted">No knowledge graphs found.</p>
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
                <div
                  class="modal-content"
                  :class="{
                    'bg-dark': props.theme === 'dark',
                    'text-white': props.theme === 'dark',
                  }"
                >
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
                    <div class="mb-3" v-if="currentGraph?.metadata?.seoSlug">
                      <label class="form-label">Share Type</label>
                      <div class="form-check">
                        <input
                          class="form-check-input"
                          type="radio"
                          name="shareType"
                          id="shareTypeSEO"
                          value="seo"
                          v-model="shareType"
                          @change="updateShareContent"
                        />
                        <label class="form-check-label" for="shareTypeSEO">
                          <strong>📄 Static SEO Page</strong> - Optimized for social media with rich previews
                        </label>
                      </div>
                      <div class="form-check">
                        <input
                          class="form-check-input"
                          type="radio"
                          name="shareType"
                          id="shareTypeDynamic"
                          value="dynamic"
                          v-model="shareType"
                          @change="updateShareContent"
                        />
                        <label class="form-check-label" for="shareTypeDynamic">
                          <strong>🔗 Interactive Graph</strong> - Dynamic experience in the app
                        </label>
                      </div>
                    </div>
                    <div class="mb-3">
                      <label for="shareContent" class="form-label">Share Content</label>
                      <textarea
                        class="form-control"
                        id="shareContent"
                        rows="6"
                        v-model="shareContent"
                        readonly
                      ></textarea>
                    </div>
                    <div class="share-buttons d-flex gap-2 justify-content-center flex-wrap">
                      <button
                        class="btn btn-outline-primary share-btn instagram-btn"
                        @click="shareToInstagram"
                        title="Share to Instagram"
                      >
                        <i class="bi bi-instagram"></i> Instagram
                      </button>
                      <button
                        class="btn btn-outline-primary share-btn linkedin-btn"
                        @click="shareToLinkedIn"
                        title="Share to LinkedIn"
                      >
                        <i class="bi bi-linkedin"></i> LinkedIn
                      </button>
                      <button
                        class="btn btn-outline-primary share-btn twitter-btn"
                        @click="shareToTwitter"
                        title="Share to Twitter"
                      >
                        <i class="bi bi-twitter-x"></i> Twitter
                      </button>
                      <button
                        class="btn btn-outline-primary share-btn facebook-btn"
                        @click="shareToFacebook"
                        title="Share to Facebook"
                      >
                        <i class="bi bi-facebook"></i> Facebook
                      </button>
                    </div>
                  </div>
                  <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- R2 Image Selection Modal -->
            <div
              class="modal fade"
              id="r2ImageModal"
              tabindex="-1"
              aria-labelledby="r2ImageModalLabel"
              aria-hidden="true"
            >
              <div class="modal-dialog modal-xl" style="max-width: 1000px">
                <div
                  class="modal-content"
                  :class="{
                    'bg-dark': props.theme === 'dark',
                    'text-white': props.theme === 'dark',
                  }"
                >
                  <div class="modal-header">
                    <h5 class="modal-title" id="r2ImageModalLabel">Select Portfolio Image</h5>
                    <button
                      type="button"
                      class="btn-close"
                      data-bs-dismiss="modal"
                      aria-label="Close"
                    ></button>
                  </div>
                  <div class="modal-body" style="max-height: 80vh; overflow-y: auto">
                    <!-- Quality Controls Section -->
                    <div class="quality-controls mb-4 p-3 border rounded">
                      <h6 class="mb-3">Image Quality & Size Settings</h6>

                      <!-- Quality Presets -->
                      <div class="mb-3">
                        <label class="form-label fw-bold">Quality Preset:</label>
                        <div class="btn-group w-100" role="group">
                          <input
                            type="radio"
                            class="btn-check"
                            name="qualityPreset"
                            id="ultraFast"
                            value="ultraFast"
                            v-model="imageQualitySettings.preset"
                            @change="updateImagePreview"
                          />
                          <label class="btn btn-outline-success" for="ultraFast">
                            <i class="bi bi-lightning-fill"></i> Ultra Fast
                          </label>

                          <input
                            type="radio"
                            class="btn-check"
                            name="qualityPreset"
                            id="balanced"
                            value="balanced"
                            v-model="imageQualitySettings.preset"
                            @change="updateImagePreview"
                          />
                          <label class="btn btn-outline-primary" for="balanced">
                            <i class="bi bi-speedometer2"></i> Balanced
                          </label>

                          <input
                            type="radio"
                            class="btn-check"
                            name="qualityPreset"
                            id="highQuality"
                            value="highQuality"
                            v-model="imageQualitySettings.preset"
                            @change="updateImagePreview"
                          />
                          <label class="btn btn-outline-warning" for="highQuality">
                            <i class="bi bi-gem"></i> High Quality
                          </label>
                        </div>
                      </div>

                      <!-- Custom Size Controls -->
                      <div class="row mb-3">
                        <div class="col-12 mb-2">
                          <div class="form-check">
                            <input
                              class="form-check-input"
                              type="checkbox"
                              id="lockAspectRatio"
                              v-model="imageQualitySettings.lockAspectRatio"
                            />
                            <label class="form-check-label fw-bold" for="lockAspectRatio">
                              <i
                                class="bi bi-lock-fill"
                                v-if="imageQualitySettings.lockAspectRatio"
                              ></i>
                              <i class="bi bi-unlock-fill" v-else></i>
                              Lock Aspect Ratio ({{ aspectRatio }})
                            </label>
                          </div>
                        </div>
                        <div class="col-md-6">
                          <label class="form-label fw-bold">Width:</label>
                          <div class="input-group">
                            <input
                              type="range"
                              class="form-range"
                              min="50"
                              max="800"
                              v-model="imageQualitySettings.width"
                              @input="onWidthChange"
                            />
                            <input
                              type="number"
                              class="form-control"
                              style="max-width: 80px"
                              v-model="imageQualitySettings.width"
                              @input="onWidthChange"
                              min="50"
                              max="800"
                            />
                            <span class="input-group-text">px</span>
                          </div>
                        </div>
                        <div class="col-md-6">
                          <label class="form-label fw-bold">Height:</label>
                          <div class="input-group">
                            <input
                              type="range"
                              class="form-range"
                              min="50"
                              max="600"
                              v-model="imageQualitySettings.height"
                              @input="onHeightChange"
                            />
                            <input
                              type="number"
                              class="form-control"
                              style="max-width: 80px"
                              v-model="imageQualitySettings.height"
                              @input="onHeightChange"
                              min="50"
                              max="600"
                            />
                            <span class="input-group-text">px</span>
                          </div>
                        </div>
                      </div>

                      <!-- Preview URL Display -->
                      <div class="mb-3">
                        <label class="form-label fw-bold">Preview URL Parameters:</label>
                        <div class="alert alert-info p-2">
                          <small class="font-monospace">{{ previewUrlParams }}</small>
                        </div>
                      </div>

                      <!-- Reset Button -->
                      <button
                        class="btn btn-sm btn-outline-secondary"
                        @click="resetQualitySettings"
                      >
                        <i class="bi bi-arrow-clockwise"></i> Reset to Defaults
                      </button>
                    </div>

                    <!-- Image Grid -->
                    <div class="portfolio-grid">
                      <div
                        v-for="img in r2Images"
                        :key="img.key"
                        class="portfolio-card"
                        @click="selectR2Image(img)"
                      >
                        <img
                          :src="getOptimizedImageUrl(img.url)"
                          :alt="img.key"
                          class="portfolio-thumb"
                          loading="lazy"
                        />
                        <div class="portfolio-caption">{{ img.key }}</div>
                      </div>
                    </div>
                  </div>
                  <div class="modal-footer">
                    <div class="me-auto">
                      <small class="text-muted">
                        <strong>{{ r2Images.length }}</strong> images • Quality:
                        <strong>{{ imageQualitySettings.preset }}</strong> • Size:
                        <strong
                          >{{ imageQualitySettings.width }}×{{
                            imageQualitySettings.height
                          }}</strong
                        >
                      </small>
                    </div>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useUserStore } from '@/stores/userStore'
import { useContentFilter } from '@/composables/useContentFilter'
import { Modal } from 'bootstrap'
import GraphGallery from './GraphGallery.vue'
import GraphTable from './GraphTable.vue'
import MetaAreaSidebar from '@/components/MetaAreaSidebar.vue'
import { apiUrls, getApiUrl } from '@/config/api'

const props = defineProps({
  theme: {
    type: String,
    default: 'light',
  },
})

const router = useRouter()
const graphStore = useKnowledgeGraphStore()
const portfolioStore = usePortfolioStore()
const userStore = useUserStore()
const contentFilter = useContentFilter()
const graphs = ref([])
const loading = ref(true)
const error = ref(null)
const successMessage = ref(null)
const editingGraphId = ref(null)
const editingGraph = ref(null)
const shareContent = ref('')
const shareType = ref('dynamic') // Default to dynamic sharing
const currentGraph = ref(null)
const shareModal = ref(null)
const isLoadingTitle = ref(false)
const isLoadingCategories = ref(false)
const isLoadingDescription = ref(false)
const showSuggestions = ref(false)
const filteredSuggestions = ref([])
const suggestionIndex = ref(0)
const isLoadingPortfolioImage = ref(false)
const r2Images = ref([])
const r2ImageModal = ref(null)
const selectedImage = ref(null)

// Affiliate data for badge display (metadata-based approach)
const affiliateCache = ref(new Map()) // Cache affiliate status per graph

// Image Quality Settings
const imageQualitySettings = ref({
  preset: 'balanced',
  width: 150,
  height: 94,
  lockAspectRatio: true,
  originalAspectRatio: 150 / 94,
})

// Computed property for preview URL parameters
const previewUrlParams = computed(() => {
  const settings = imageQualitySettings.value
  const presets = {
    ultraFast: `w=${settings.width}&h=${settings.height}&fit=crop&auto=format,compress&q=30`,
    balanced: `w=${settings.width}&h=${settings.height}&fit=crop&crop=entropy&auto=format,enhance,compress&q=65&dpr=2`,
    highQuality: `w=${settings.width}&h=${settings.height}&fit=crop&crop=entropy&auto=format,enhance&q=85&sharp=1&sat=5`,
  }
  return presets[settings.preset] || presets.balanced
})

// Add the allMetaAreas computed property
const allMetaAreas = computed(() => portfolioStore.allMetaAreas)

// Check vectorization status for multiple graphs
const checkVectorizationStatus = async (graphIds) => {
  try {
    const response = await fetch(
      'https://vector-search-worker.torarnehave.workers.dev/vectorization-status',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ graphIds }),
      },
    )

    if (response.ok) {
      const data = await response.json()
      return data.statusMap
    }
  } catch {
    // Failed to check vectorization status
  }
  return {}
}

// Check affiliate ambassador status for multiple graphs
const checkAmbassadorStatus = async (graphIds) => {
  try {
    const response = await fetch(
      'https://aff-worker.torarnehave.workers.dev/graph-ambassador-status',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ graphIds }),
      },
    )

    if (response.ok) {
      const data = await response.json()
      return data.statusMap
    }
  } catch {
    // Failed to check ambassador status
  }
  return {}
}

// Check if a graph has affiliate partners by looking up the deal_name directly
const checkAffiliateStatus = async (graphId) => {
  if (affiliateCache.value.has(graphId)) {
    return affiliateCache.value.get(graphId) || false
  }

  try {
    const response = await fetch(
      `https://aff-worker.torarnehave.workers.dev/check-affiliate-deal?deal_name=${encodeURIComponent(graphId)}`,
    )

    if (response.ok) {
      const data = await response.json()

      const hasAffiliates = data.success && data.hasAffiliates
      affiliateCache.value.set(graphId, hasAffiliates)
      return hasAffiliates
    }
  } catch {
    // Failed to check affiliate status
  }

  affiliateCache.value.set(graphId, false)
  return false
}

// Load affiliate deals to show affiliate badges (deprecated - keeping for compatibility)
const loadAffiliateDeals = async () => {
  // No longer needed since we check per graph
}

// Check if a graph has affiliate partners (from metadata)
const hasAffiliate = (graphId) => {
  // Find the graph in our data
  const graph = filteredGraphs.value.find((g) => g.id === graphId)
  if (!graph || !graph.metadata) return false

  // Check metadata for affiliate info
  const affiliateInfo = graph.metadata.affiliates
  if (!affiliateInfo) return false

  return affiliateInfo.hasAffiliates === true && affiliateInfo.affiliateCount > 0
}

// Get affiliate deal info for a graph (metadata-based)
const getAffiliateDeal = (graphId) => {
  const graph = filteredGraphs.value.find((g) => g.id === graphId)
  if (!graph || !graph.metadata || !graph.metadata.affiliates) return null

  return {
    dealName: graphId,
    affiliateCount: graph.metadata.affiliates.affiliateCount,
    hasAffiliates: graph.metadata.affiliates.hasAffiliates,
    lastUpdated: graph.metadata.affiliates.lastUpdated,
  }
}

// Vectorize a single graph
const vectorizeGraph = async (graph) => {
  // Set vectorizing state
  graph.vectorization = {
    isVectorized: false,
    isVectorizing: true,
    vectorCount: 0,
  }

  try {
    const response = await fetch(
      'https://vector-search-worker.torarnehave.workers.dev/index-graph',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ graphId: graph.id }),
      },
    )

    if (response.ok) {
      const result = await response.json()

      if (result.alreadyVectorized) {
        // Graph was already vectorized
        graph.vectorization = {
          isVectorized: true,
          isVectorizing: false,
          vectorCount: parseInt(result.message.match(/(\d+) vectors/)?.[1] || 0),
        }
      } else {
        // Graph was newly vectorized
        graph.vectorization = {
          isVectorized: true,
          isVectorizing: false,
          vectorCount: result.vectorsCreated || 0,
        }
      }
    } else {
      const errorData = await response.text()
      // Reset state on failure
      graph.vectorization = {
        isVectorized: false,
        isVectorizing: false,
        vectorCount: 0,
      }
      error.value = `Failed to vectorize graph: ${errorData}`
    }
  } catch (err) {
    // Reset state on failure
    graph.vectorization = {
      isVectorized: false,
      isVectorizing: false,
      vectorCount: 0,
    }
    error.value = `Vectorization error: ${err.message}`
  }
}

// Fetch all knowledge graphs
const fetchGraphs = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await fetch(apiUrls.getKnowledgeGraphs())
    if (response.ok) {
      const data = await response.json()

      if (data.results) {
        // Fetch complete data for each graph
        const graphPromises = data.results.map(async (graph) => {
          try {
            const graphResponse = await fetch(apiUrls.getKnowledgeGraph(graph.id))
            if (graphResponse.ok) {
              const graphData = await graphResponse.json()

              // Extract nodes and edges, ensuring they are arrays
              const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
              const edges = Array.isArray(graphData.edges) ? graphData.edges : []

              // Create the processed graph object
              return {
                id: graph.id,
                metadata: {
                  // Preserve all existing metadata from the API
                  ...graphData.metadata,
                  // Override with specific fields that have fallbacks
                  title: graphData.metadata?.title || graph.title || 'Untitled Graph',
                  description: graphData.metadata?.description || '',
                  createdBy: graphData.metadata?.createdBy || 'Unknown',
                  version: graphData.metadata?.version || 1,
                  updatedAt: graphData.updated_at || graphData.created_date || 'Unknown',
                  category: graphData.metadata?.category || '#Uncategorized',
                  metaArea: graphData.metadata?.metaArea || '',
                  mystmkraUrl: graphData.metadata?.mystmkraUrl || null,
                  mystmkraDocumentId: graphData.metadata?.mystmkraDocumentId || null,
                  mystmkraNodeId: graphData.metadata?.mystmkraNodeId || null,
                  // Publication State (NEW) - Auto-publish if SEO slug exists
                  publicationState: graphData.metadata?.publicationState ||
                                   (graphData.metadata?.seoSlug ? 'published' : 'draft'),
                  publishedAt: graphData.metadata?.publishedAt || null,
                },
                nodes: nodes.map((node) => ({
                  id: node.id,
                  label: node.label || node.id,
                  type: node.type || 'default',
                  color: node.color || 'gray',
                  info: node.info || null,
                  position: node.position || { x: 0, y: 0 },
                  visible: node.visible !== false,
                  path: node.path || null,
                  mystmkraUrl: node.mystmkraUrl || null,
                  mystmkraDocumentId: node.mystmkraDocumentId || null,
                })),
                edges: edges.map((edge) => ({
                  source: edge.source,
                  target: edge.target,
                  type: edge.type || 'default',
                  label: edge.label || null,
                })),
              }
            }
            return null
          } catch {
            return null
          }
        })

        // Wait for all graph data to be fetched
        const processedGraphs = await Promise.all(graphPromises)
        const validGraphs = processedGraphs.filter((graph) => graph !== null)

        // Apply KV-based content filtering
        graphs.value = contentFilter.filterGraphsByMetaAreas(validGraphs)

        // Check vectorization status for all graphs
        const graphIds = graphs.value.map((g) => g.id)
        const vectorizationStatus = await checkVectorizationStatus(graphIds)

        // Add vectorization status to each graph
        graphs.value.forEach((graph) => {
          const status = vectorizationStatus[graph.id] || { isVectorized: false, vectorCount: 0 }
          graph.vectorization = {
            isVectorized: status.isVectorized,
            isVectorizing: false,
            vectorCount: status.vectorCount,
          }
        })

        // Check affiliate ambassador status for all graphs (NEW)
        const ambassadorStatus = await checkAmbassadorStatus(graphIds)

        // Add ambassador status to each graph (NEW)
        graphs.value.forEach((graph) => {
          const status = ambassadorStatus[graph.id] || { hasAmbassadors: false, affiliateCount: 0 }
          graph.ambassadorStatus = {
            hasAmbassadors: status.hasAmbassadors,
            affiliateCount: status.affiliateCount,
            totalCommissions: status.totalCommissions || '0.00',
            averageRate: status.averageRate || 0,
            topAffiliate: status.topAffiliate || null,
          }
        })

        // Filter by publication state based on user role (NEW)
        if (userStore.role !== 'Superadmin') {
          // Regular users only see published graphs
          // Graphs with SEO slugs are automatically considered published
          graphs.value = graphs.value.filter(graph =>
            graph.metadata?.publicationState === 'published' ||
            graph.metadata?.seoSlug
          )
        }
        // Superadmin sees everything (no filtering needed)

        // Update meta areas in the store
        portfolioStore.updateMetaAreas(graphs.value)
      } else {
        graphs.value = []
      }
    } else {
      throw new Error('Failed to fetch knowledge graphs')
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const filteredGraphs = computed(() => {
  let filtered = graphs.value
  if (portfolioStore.selectedMetaArea) {
    filtered = filtered.filter((g) =>
      getMetaAreas(g.metadata?.metaArea).includes(portfolioStore.selectedMetaArea),
    )
  }
  // Apply search filter
  if (portfolioStore.searchQuery) {
    const query = portfolioStore.searchQuery.toLowerCase().trim()

    // Check for special :has-seo filter
    if (query === ':has-seo') {
      filtered = filtered.filter((graph) => {
        return graph.metadata?.seoSlug && graph.metadata.seoSlug.trim() !== ''
      })
    }
    // Check if searching by meta area (starts with #)
    else if (query.startsWith('#')) {
      const metaAreaSearch = query.substring(1) // Remove the #
      filtered = filtered.filter((graph) => {
        const graphMetaArea = graph.metadata?.metaArea || ''
        // Normalize: remove # if it exists in the stored value
        const normalizedMetaArea = graphMetaArea.startsWith('#')
          ? graphMetaArea.substring(1).toLowerCase()
          : graphMetaArea.toLowerCase()

        return normalizedMetaArea.includes(metaAreaSearch)
      })
    } else {
      // Regular search (existing functionality)
      filtered = filtered.filter((graph) => {
        const categories = getCategories(graph.metadata?.category || '')
        // Collect all node types as a string
        const nodeTypes = Array.isArray(graph.nodes)
          ? graph.nodes
              .map((node) => node.type || '')
              .join(' ')
              .toLowerCase()
          : ''

        // Collect all node labels (titles) as a string
        const nodeLabels = Array.isArray(graph.nodes)
          ? graph.nodes
              .map((node) => node.label || '')
              .join(' ')
              .toLowerCase()
          : ''

        // Collect all node info content as a string
        const nodeInfoContent = Array.isArray(graph.nodes)
          ? graph.nodes
              .map((node) => {
                // Handle different types of node.info content
                if (typeof node.info === 'string') {
                  return node.info
                } else if (typeof node.info === 'object' && node.info !== null) {
                  // For structured data (charts, etc.), convert to searchable string
                  return JSON.stringify(node.info)
                }
                return ''
              })
              .join(' ')
              .toLowerCase()
          : ''

        return (
          graph.metadata?.title?.toLowerCase().includes(query) ||
          graph.metadata?.description?.toLowerCase().includes(query) ||
          graph.metadata?.seoSlug?.toLowerCase().includes(query) || // Search by SEO slug
          categories.some((cat) => cat.toLowerCase().includes(query)) ||
          graph.id?.toLowerCase().includes(query) ||
          nodeTypes.includes(query) || // Enable node type search
          nodeLabels.includes(query) || // Enable node label search
          nodeInfoContent.includes(query) // Enable node content search
        )
      })
    }
  }

  // Apply sorting
  return filtered.sort((a, b) => {
    let aCategories, bCategories
    switch (portfolioStore.sortBy) {
      case 'title-asc':
        return (a.metadata?.title || '').localeCompare(b.metadata?.title || '')
      case 'title-desc':
        return (b.metadata?.title || '').localeCompare(a.metadata?.title || '')
      case 'date-desc':
        return new Date(b.metadata?.updatedAt || 0) - new Date(a.metadata?.updatedAt || 0)
      case 'date-asc':
        return new Date(a.metadata?.updatedAt || 0) - new Date(b.metadata?.updatedAt || 0)
      case 'nodes':
        return (b.nodes?.length || 0) - (a.nodes?.length || 0)
      case 'category':
        aCategories = getCategories(a.metadata?.category || '')
        bCategories = getCategories(b.metadata?.category || '')
        return (aCategories[0] || 'Uncategorized').localeCompare(bCategories[0] || 'Uncategorized')
      default:
        return 0
    }
  })
})

const truncateText = (text) => {
  if (!text) return ''
  const words = text.split(/\s+/)
  if (words.length <= 100) return text
  return words.slice(0, 100).join(' ') + '...'
}

const formatDate = (dateString) => {
  if (!dateString || dateString === 'Unknown') return 'Unknown'
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

const viewGraph = (graph) => {
  // Set the current graph ID in the store
  graphStore.setCurrentGraphId(graph.id)
  // Update the store with the graph's nodes and edges
  graphStore.updateGraph(graph.nodes, graph.edges)
  // Navigate to the modern graph viewer
  router.push({ name: 'gnew-viewer', query: { graphId: graph.id } })
}

const editGraph = async (graph) => {
  try {
    // Set the current graph ID in the store
    graphStore.setCurrentGraphId(graph.id)

    // Fetch the complete graph data
    const response = await fetch(apiUrls.getKnowledgeGraph(graph.id))
    if (response.ok) {
      const graphData = await response.json()

      // Process nodes with positions
      graphStore.nodes = graphData.nodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label || node.id,
          color: node.color || 'gray',
          type: node.type || null,
          info: node.info || null,
          bibl: Array.isArray(node.bibl) ? node.bibl : [],
          imageWidth: node.imageWidth || '100%',
          imageHeight: node.imageHeight || '100%',
          visible: node.visible !== false,
          path: node.path || null,
        },
        position: node.position || { x: 0, y: 0 },
      }))

      graphStore.edges = graphData.edges.map((edge) => ({
        data: {
          source: edge.source,
          target: edge.target,
          label: edge.label || null,
          type: edge.type || null,
          info: edge.info || null,
        },
      }))

      // Set the current version
      graphStore.setCurrentVersion(graphData.metadata?.version || 1)

      // Navigate to the graph admin
      router.push({ name: 'GraphAdmin', query: { graphId: graph.id } })
    } else {
      throw new Error('Failed to fetch graph data')
    }
  } catch (err) {
    error.value = err.message
  }
}

const filterGraphs = () => {
  // The filtering is handled by the computed property
}

const sortGraphs = () => {
  // The sorting is handled by the computed property
}

const getNodeTypes = (nodes) => {
  if (!Array.isArray(nodes)) return ''
  const types = new Set(nodes.map((node) => node?.type || 'default'))
  return Array.from(types).join(', ')
}

const getCategories = (categoryString) => {
  if (!categoryString) return []
  return categoryString
    .split('#')
    .map((cat) => cat.trim())
    .filter((cat) => cat.length > 0)
}

// Start editing a graph
const startEdit = (graph) => {
  editingGraphId.value = graph.id
  editingGraph.value = JSON.parse(JSON.stringify(graph)) // Deep copy
}

// Cancel editing
const cancelEdit = () => {
  editingGraphId.value = null
  editingGraph.value = null
}

// Save edited graph
const saveEdit = async (originalGraph) => {
  try {
    // Fetch latest graph data to ensure metadata preservation (same pattern as GraphAdmin)
    const latestResponse = await fetch(
      `https://knowledge.vegvisr.org/getknowgraph?id=${originalGraph.id}`,
    )
    if (!latestResponse.ok) {
      throw new Error('Failed to fetch latest graph data')
    }
    const latestGraph = await latestResponse.json()

    // Handle case where metadata doesn't exist at all
    const existingMetadata = latestGraph.metadata || {}

    // Get the current version from the latest graph data
    const currentVersion = existingMetadata.version || 1

    // Build safe metadata with explicit defaults
    const preservedMetadata = {
      title: existingMetadata.title || 'Untitled Graph',
      description: existingMetadata.description || '',
      createdBy: existingMetadata.createdBy || 'Unknown',
      category: existingMetadata.category || '',
      metaArea: existingMetadata.metaArea || '',
      createdAt: existingMetadata.createdAt || new Date().toISOString(),
      // Preserve any other existing fields (excluding version and updatedAt)
      ...Object.fromEntries(
        Object.entries(existingMetadata).filter(([key]) => !['version', 'updatedAt'].includes(key)),
      ),
      // Apply user edits BUT exclude version and updatedAt (let backend handle these)
      ...Object.fromEntries(
        Object.entries(editingGraph.value.metadata).filter(
          ([key]) => !['version', 'updatedAt'].includes(key),
        ),
      ),
      // Set version LAST to ensure it's not overwritten by spreads above
      version: currentVersion, // Use the current version from latest fetch
      // Let backend handle version control and timestamps entirely
    }

    // Use saveGraphWithHistory to ensure metadata updates create new versions
    // This fixes the table mismatch between knowledge_graphs and knowledge_graph_history
    const response = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken,
      },
      body: JSON.stringify({
        id: originalGraph.id,
        graphData: {
          ...latestGraph, // Use latest graph data instead of stale originalGraph
          metadata: preservedMetadata,
        },
        override: false, // Create new version
      }),
    })

    if (response.ok) {
      const result = await response.json()

      // Extract version number from different possible response structures
      const newVersion =
        result.version || result.newVersion || result.data?.version || currentVersion + 1

      // Update the local graph data
      const index = graphs.value.findIndex((g) => g.id === originalGraph.id)
      if (index !== -1) {
        graphs.value[index] = {
          ...originalGraph,
          metadata: {
            ...editingGraph.value.metadata,
            version: newVersion,
            updatedAt: new Date().toISOString(),
          },
        }
      }
      editingGraphId.value = null
      editingGraph.value = null

      // Update meta areas in the store
      portfolioStore.updateMetaAreas(graphs.value)

      // Success - no alert needed, console logs provide feedback

      // Scroll to the card after a short delay to ensure DOM update
      setTimeout(() => {
        const cardElement = document.querySelector(`[data-graph-id="${originalGraph.id}"]`)
        if (cardElement) {
          cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        }, 100)
    } else {
      const errorText = await response.text()
      throw new Error(`Failed to update graph: ${response.status} - ${errorText}`)
    }
  } catch (err) {
    error.value = err.message
  }
}

// Toggle publication state for graphs (Superadmin only)
const toggleGraphPublicationState = async (graph) => {
  if (userStore.role !== 'Superadmin') {
    alert('Only Superadmin can change publication state')
    return
  }

  const newState = graph.metadata?.publicationState === 'published' ? 'draft' : 'published'
  const confirmMessage = newState === 'published'
    ? `Publish "${graph.metadata?.title || 'Untitled Graph'}"?\n\nThis will make it visible to all users.`
    : `Unpublish "${graph.metadata?.title || 'Untitled Graph'}"?\n\nThis will make it only visible to Superadmin.`

  if (!confirm(confirmMessage)) {
    return
  }

  try {
    // Fetch latest graph data to preserve all fields
    const graphResponse = await fetch(apiUrls.getKnowledgeGraph(graph.id))
    if (!graphResponse.ok) {
      throw new Error('Failed to fetch current graph data')
    }
    const latestGraph = await graphResponse.json()

    // Update publication state in metadata
    const updatedMetadata = {
      ...latestGraph.metadata,
      publicationState: newState,
      publishedAt: newState === 'published' ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    }

    // Save with updated metadata
    const response = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken,
      },
      body: JSON.stringify({
        id: graph.id,
        graphData: {
          ...latestGraph,
          metadata: updatedMetadata,
        },
        override: false, // Create new version
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to update publication state: ${response.statusText}`)
    }

    // Update local graph data
    graph.metadata.publicationState = newState
    graph.metadata.publishedAt = updatedMetadata.publishedAt

    console.log(`Graph ${newState === 'published' ? 'published' : 'unpublished'} successfully`)
  } catch (err) {
    console.error('Error updating publication state:', err)
    alert('Failed to update publication state: ' + err.message)
  }
}

const confirmDelete = async (graph) => {
  if (
    confirm(
      `Are you sure you want to delete the graph "${graph.metadata?.title || 'Untitled Graph'}"? This action cannot be undone.`,
    )
  ) {
    try {
      const response = await fetch(apiUrls.deleteKnowledgeGraph(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: graph.id,
        }),
      })

      if (!response.ok) {
        let errorMessage
        try {
          const errorData = await response.json()
          if (response.status === 404) {
            errorMessage = 'Graph not found. It may have been already deleted.'
          } else {
            errorMessage = errorData.error || `Server error (${response.status})`
            if (errorData.details) {
              errorMessage += `\nDetails: ${errorData.details}`
            }
          }
        } catch {
          errorMessage = `Server error (${response.status})`
        }
        throw new Error(errorMessage)
      }

      // Remove the graph from the local array
      graphs.value = graphs.value.filter((g) => g.id !== graph.id)

      // Show success message
      error.value = null // Clear any existing error
      successMessage.value = 'Successfully deleted KnowledgeGraph'

      // Auto-clear success message after 3 seconds
      setTimeout(() => {
        successMessage.value = null
      }, 3000)
    } catch (err) {
      successMessage.value = null // Clear any existing success message
      error.value = err.message
      alert(
        `Failed to delete graph: ${err.message}\n\nPlease try again later or contact support if the problem persists.`,
      )
    }
  }
}

const openShareModal = (graph) => {
  currentGraph.value = graph

  // Set default share type based on whether SEO slug exists
  shareType.value = graph.metadata?.seoSlug ? 'seo' : 'dynamic'

  updateShareContent()

  if (!shareModal.value) {
    shareModal.value = new Modal(document.getElementById('shareModal'))
  }
  shareModal.value.show()
}

const updateShareContent = () => {
  if (!currentGraph.value) return

  const graph = currentGraph.value
  const nodeCount = Array.isArray(graph.nodes) ? graph.nodes.length : 0
  const edgeCount = Array.isArray(graph.edges) ? graph.edges.length : 0
  const categories = getCategories(graph.metadata?.category || '')
  const categoryText = categories.length > 0 ? `Categories: ${categories.join(', ')}` : ''

  let shareUrl = ''
  let shareLabel = ''

  if (shareType.value === 'seo' && graph.metadata?.seoSlug) {
    shareUrl = `https://seo.vegvisr.org/graph/${graph.metadata.seoSlug}`
    shareLabel = 'View this SEO-optimized knowledge graph: '
  } else {
    shareUrl = `${window.location.origin}/gnew-viewer?graphId=${graph.id}`
    shareLabel = 'Explore this interactive knowledge graph: '
  }

  shareContent.value =
    `${graph.metadata?.title || 'Untitled Graph'}\n\n` +
    `${graph.metadata?.description || ''}\n\n` +
    `Nodes: ${nodeCount}\n` +
    `Edges: ${edgeCount}\n` +
    `${categoryText}\n\n` +
    `${shareLabel}${shareUrl}`
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

  let url = ''
  if (shareType.value === 'seo' && currentGraph.value?.metadata?.seoSlug) {
    url = encodeURIComponent(`https://seo.vegvisr.org/graph/${currentGraph.value.metadata.seoSlug}`)
  } else {
    url = encodeURIComponent(`${window.location.origin}/gnew-viewer?graphId=${currentGraph.value?.id}`)
  }

  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}&title=${title}&summary=${summary}`
  window.open(linkedInUrl, '_blank', 'width=600,height=400')
}

const shareToTwitter = () => {
  const title = shareContent.value.split('\n')[0]

  let url = ''
  if (shareType.value === 'seo' && currentGraph.value?.metadata?.seoSlug) {
    url = `https://seo.vegvisr.org/graph/${currentGraph.value.metadata.seoSlug}`
  } else {
    url = `${window.location.origin}/gnew-viewer?graphId=${currentGraph.value?.id}`
  }

  // Twitter has a 280 character limit, so we'll create a shorter message
  const tweetText = encodeURIComponent(`${title}\n\nView this knowledge graph: ${url}`)
  const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}`
  window.open(twitterUrl, '_blank', 'width=600,height=400')
}

const shareToFacebook = () => {
  let url = ''
  if (shareType.value === 'seo' && currentGraph.value?.metadata?.seoSlug) {
    url = encodeURIComponent(`https://seo.vegvisr.org/graph/${currentGraph.value.metadata.seoSlug}`)
  } else {
    url = encodeURIComponent(`${window.location.origin}/gnew-viewer?graphId=${currentGraph.value?.id}`)
  }

  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`
  window.open(facebookUrl, '_blank', 'width=600,height=400')
}

const suggestTitle = async (graph) => {
  try {
    isLoadingTitle.value = true
    const response = await fetch('https://api.vegvisr.org/suggest-title', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nodes: graph.nodes,
        edges: graph.edges,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to get title suggestion: ${response.status}`)
    }

    const data = await response.json()
    editingGraph.value.metadata.title = data.title
  } catch (err) {
    alert('Failed to get title suggestion: ' + err.message)
  } finally {
    isLoadingTitle.value = false
  }
}

const suggestCategories = async (graph) => {
  try {
    isLoadingCategories.value = true
    const response = await fetch('https://api.vegvisr.org/suggest-categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nodes: graph.nodes,
        edges: graph.edges,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to get category suggestions: ${response.status}`)
    }

    const data = await response.json()
    editingGraph.value.metadata.category = data.categories
  } catch (err) {
    alert('Failed to get category suggestions: ' + err.message)
  } finally {
    isLoadingCategories.value = false
  }
}

const suggestDescription = async (graph) => {
  try {
    isLoadingDescription.value = true
    const response = await fetch('https://api.vegvisr.org/suggest-description', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nodes: graph.nodes,
        edges: graph.edges,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to get description suggestion: ${response.status}`)
    }

    const data = await response.json()
    editingGraph.value.metadata.description = data.description
  } catch (err) {
    alert('Failed to get description suggestion: ' + err.message)
  } finally {
    isLoadingDescription.value = false
  }
}

const getPortfolioImage = (nodes) => {
  if (!Array.isArray(nodes)) return null

  const imageNode = nodes.find((node) => node.type === 'portfolio-image')
  if (!imageNode) return null

  // The path is directly on the node object
  const path = imageNode.path
  if (!path) {
    return null
  }

  return {
    path,
    label: imageNode.label || 'Portfolio Image',
  }
}

// Compute galleryGraphs for the gallery view
const galleryGraphs = computed(() =>
  filteredGraphs.value.map((graph) => {
    let image = null
    if (Array.isArray(graph.nodes)) {
      const imgNode = graph.nodes.find((n) => n.type === 'portfolio-image' && n.path)
      if (imgNode) image = imgNode.path
    }
    if (!image) image = 'https://via.placeholder.com/180x120?text=No+Image'
    return {
      id: graph.id,
      title: graph.metadata?.title || 'Untitled Graph',
      image,
    }
  }),
)

// Handler to map galleryGraph to full graph object
const handleGalleryViewGraph = (galleryGraph) => {
  const fullGraph = filteredGraphs.value.find((g) => g.id === galleryGraph.id)
  if (fullGraph) {
    viewGraph(fullGraph)
  }
}

// Helper to parse meta areas from string
function getMetaAreas(metaAreaString) {
  if (!metaAreaString) return []
  return metaAreaString
    .split('#')
    .map((area) => area.trim())
    .filter((area) => area.length > 0)
}

function onMetaAreaInput() {
  const value = editingGraph.value.metadata.metaArea || ''
  const match = value.match(/#([\w-]*)$/)
  if (match) {
    const search = match[1].toLowerCase()
    filteredSuggestions.value = allMetaAreas.value.filter((area) =>
      area.toLowerCase().includes(search),
    )
    showSuggestions.value = filteredSuggestions.value.length > 0
    suggestionIndex.value = 0
  } else {
    showSuggestions.value = false
  }
}

function selectSuggestion(idx = suggestionIndex.value) {
  if (!showSuggestions.value || !filteredSuggestions.value.length) return

  const value = editingGraph.value.metadata.metaArea || ''
  const match = value.match(/#([\w-]*)$/)

  if (match) {
    const before = value.slice(0, match.index + 1)
    const after = value.slice(match.index + match[0].length)
    const selectedArea = filteredSuggestions.value[idx]

    if (selectedArea) {
      editingGraph.value.metadata.metaArea = before + selectedArea + ' ' + after
    }
  }

  showSuggestions.value = false
}

function moveSuggestion(dir) {
  if (!showSuggestions.value) return
  suggestionIndex.value =
    (suggestionIndex.value + dir + filteredSuggestions.value.length) %
    filteredSuggestions.value.length
}

function handleBlur() {
  setTimeout(() => {
    showSuggestions.value = false
  }, 200)
}

const generateMetaAreas = async () => {
  try {
    loading.value = true
    const response = await fetch('https://api.vegvisr.org/generate-meta-areas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': userStore.role || '',
      },
      body: JSON.stringify({}),
    })
    if (!response.ok) throw new Error('Failed to generate meta areas')
    await fetchGraphs()
    alert('Meta Areas updated!')
  } catch (err) {
    alert('Error: ' + err.message)
  } finally {
    loading.value = false
  }
}

const resetMetaAreas = async () => {
  try {
    loading.value = true
    const response = await fetch(getApiUrl('resetMetaAreas', {}, true), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': userStore.role || '',
      },
      body: JSON.stringify({}),
    })
    if (!response.ok) throw new Error('Failed to reset meta areas')
    await fetchGraphs()
    alert('All Meta Areas have been reset!')
  } catch (err) {
    alert('Error: ' + err.message)
  } finally {
    loading.value = false
  }
}

const fetchR2Images = async () => {
  try {
    const res = await fetch('https://api.vegvisr.org/list-r2-images?size=small')
    const data = await res.json()
    r2Images.value = data.images
  } catch {
    // Error fetching R2 images
  }
}

const selectR2Image = (img) => {
  selectedImage.value = img
  r2ImageModal.value.hide()
  const optimizedUrl = getOptimizedImageUrl(img.url)
  insertPortfolioImage(optimizedUrl)
}

const insertPortfolioImage = async (imageUrl = null) => {
  try {
    isLoadingPortfolioImage.value = true

    // Check if there's already a portfolio image node
    const existingPortfolioNode = editingGraph.value.nodes?.find(
      (node) => node.type === 'portfolio-image',
    )

    if (existingPortfolioNode) {
      // Update existing node
      existingPortfolioNode.path = imageUrl
    } else {
      // Create new node if none exists
      const portfolioNode = {
        id: crypto.randomUUID(),
        label: 'My Portfolio Image',
        color: 'white',
        type: 'portfolio-image',
        info: null,
        bibl: [],
        imageWidth: '100%',
        imageHeight: '100%',
        visible: true,
        path: imageUrl || 'https://vegvisr.imgix.net/tilopa01.jpg',
      }
      editingGraph.value.nodes = [...(editingGraph.value.nodes || []), portfolioNode]
    }

    // Update the graph
    const response = await fetch(apiUrls.updateKnowledgeGraph(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: editingGraph.value.id,
        graphData: editingGraph.value,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to update portfolio image')
    }

    // Update the main graphs array to reflect the changes
    const graphIndex = graphs.value.findIndex((g) => g.id === editingGraph.value.id)
    if (graphIndex !== -1) {
      graphs.value[graphIndex] = {
        ...graphs.value[graphIndex],
        nodes: editingGraph.value.nodes,
      }
    }

    // Show success message
    alert('Portfolio image updated successfully!')

    // Refresh the graphs data
    await fetchGraphs()
  } catch (error) {
    alert('Failed to update portfolio image: ' + error.message)
  } finally {
    isLoadingPortfolioImage.value = false
  }
}

const openR2ImageModal = () => {
  if (!r2ImageModal.value) {
    r2ImageModal.value = new Modal(document.getElementById('r2ImageModal'))
  }
  fetchR2Images()
  r2ImageModal.value.show()
}

// Image Quality Control Functions
const getOptimizedImageUrl = (baseUrl) => {
  if (!baseUrl) return baseUrl

  const settings = imageQualitySettings.value
  const presets = {
    ultraFast: `?w=${settings.width}&h=${settings.height}&fit=crop&auto=format,compress&q=30`,
    balanced: `?w=${settings.width}&h=${settings.height}&fit=crop&crop=entropy&auto=format,enhance,compress&q=65&dpr=2`,
    highQuality: `?w=${settings.width}&h=${settings.height}&fit=crop&crop=entropy&auto=format,enhance&q=85&sharp=1&sat=5`,
  }

  const params = presets[settings.preset] || presets.balanced

  // If URL already has parameters, replace them; otherwise add them
  if (baseUrl.includes('?')) {
    return baseUrl.split('?')[0] + params
  }
  return baseUrl + params
}

const updateImagePreview = () => {
  // Force reactivity update by triggering computed property recalculation
  // The images will automatically update due to the reactive getOptimizedImageUrl
}

const resetQualitySettings = () => {
  imageQualitySettings.value = {
    preset: 'balanced',
    width: 150,
    height: 94,
    lockAspectRatio: true,
    originalAspectRatio: 150 / 94,
  }
  updateImagePreview()
}

const onWidthChange = () => {
  if (imageQualitySettings.value.lockAspectRatio) {
    const newHeight = Math.round(
      imageQualitySettings.value.width / imageQualitySettings.value.originalAspectRatio,
    )
    imageQualitySettings.value.height = Math.max(50, Math.min(600, newHeight))
  } else {
    // Update aspect ratio when not locked
    updateAspectRatio()
  }
  updateImagePreview()
}

const onHeightChange = () => {
  if (imageQualitySettings.value.lockAspectRatio) {
    const newWidth = Math.round(
      imageQualitySettings.value.height * imageQualitySettings.value.originalAspectRatio,
    )
    imageQualitySettings.value.width = Math.max(50, Math.min(800, newWidth))
  } else {
    // Update aspect ratio when not locked
    updateAspectRatio()
  }
  updateImagePreview()
}

const updateAspectRatio = () => {
  if (imageQualitySettings.value.width > 0 && imageQualitySettings.value.height > 0) {
    imageQualitySettings.value.originalAspectRatio =
      imageQualitySettings.value.width / imageQualitySettings.value.height
  }
}

const aspectRatio = computed(() => {
  const width = imageQualitySettings.value.width
  const height = imageQualitySettings.value.height
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b))
  if (width > 0 && height > 0) {
    const divisor = gcd(width, height)
    return `${width / divisor}:${height / divisor}`
  }
  return '16:9'
})

// Mobile Menu State
const showMobileMenu = ref(false)
const toggleMobileMenu = () => {
  if (showMobileMenu.value) {
    closeMobileMenu()
  } else {
    showMobileMenu.value = true
    document.body.style.overflow = 'hidden' // Prevent body scroll
    setTimeout(() => {
      document.querySelector('.mobile-menu-overlay')?.classList.add('show')
    }, 10)
  }
}
const closeMobileMenu = () => {
  document.querySelector('.mobile-menu-overlay')?.classList.remove('show')
  setTimeout(() => {
    showMobileMenu.value = false
    document.body.style.overflow = '' // Restore body scroll
  }, 300)
}

// Close mobile menu on ESC key
const handleEscKey = (event) => {
  if (event.key === 'Escape' && showMobileMenu.value) {
    closeMobileMenu()
  }
}

// Add keyboard listener
onMounted(() => {
  document.addEventListener('keydown', handleEscKey)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscKey)
  document.body.style.overflow = '' // Cleanup
})

onMounted(() => {
  fetchGraphs()
})

const selectMetaArea = (area) => {
  portfolioStore.selectedMetaArea = area
  closeMobileMenu()
}

const filterBySEO = () => {
  // Set a special search query to filter graphs with SEO slugs
  portfolioStore.searchQuery = ':has-seo'
  closeMobileMenu()
  // Scroll to top to show filtered results
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const filterByMetaArea = (area) => {
  // Filter by meta area without modifying search box (same as clicking sidebar)
  portfolioStore.selectedMetaArea = area
  closeMobileMenu()
  // Scroll to top to show filtered results
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<style scoped>
.portfolio-image-container {
  width: 100%;
  max-width: 300px;
  height: 200px;
  overflow: hidden;
  border-radius: 4px;
  margin: 0.5rem 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.portfolio-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
  max-width: 100%;
  box-sizing: border-box;
}

.graph-meta .badge {
  max-width: 100%;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: break-word;
  display: inline-block;
  vertical-align: middle;
  margin-bottom: 2px;
}

.cursor-pointer {
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}

.cursor-pointer:hover {
  opacity: 0.85;
  transform: scale(1.05);
}

.graph-meta .badge.bg-primary {
  text-overflow: ellipsis;
  overflow: hidden;
  max-width: 95%;
}

.graph-meta .badge.bg-gold {
  background-color: #ffd700 !important;
  color: #333 !important;
  border: 1px solid #e6c200;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.graph-meta .badge.bg-gold:hover {
  background-color: #ffed4a !important;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.graph-meta .badge.bg-affiliate {
  background-color: #6f42c1 !important;
  color: white !important;
  border: 1px solid #5a34a3;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.graph-meta .badge.bg-affiliate:hover {
  background-color: #8a63d1 !important;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

@media (max-width: 768px) {
  .portfolio-image-container {
    max-width: 100%;
    width: 100%;
    height: 150px;
    margin-left: 0;
    margin-right: 0;
  }

  .portfolio-image {
    max-width: 100%;
    width: 100%;
  }
}

@media (max-width: 576px) {
  .portfolio-image-container {
    height: 120px;
    max-width: 100%;
    width: 100%;
  }
}

.autocomplete-list {
  position: absolute;
  z-index: 1000;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 100%;
  max-height: 200px;
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.autocomplete-list li {
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.autocomplete-list li.active,
.autocomplete-list li:hover {
  background: #007bff;
  color: #fff;
}

.portfolio-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  padding: 12px;
}

.portfolio-card {
  width: 100%;
  border: 1px solid #eee;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: transform 0.2s;
}

.portfolio-card:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
}

.portfolio-thumb {
  width: 100%;
  height: 80px;
  object-fit: cover;
  display: block;
}

.portfolio-caption {
  font-size: 0.8em;
  padding: 4px;
  text-align: center;
  word-break: break-all;
  max-height: 32px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* Quality Controls Styles */
.quality-controls {
  background: rgba(248, 249, 250, 0.8);
  border: 1px solid #dee2e6 !important;
}

.quality-controls h6 {
  color: #495057;
  margin-bottom: 1rem;
}

.quality-controls .btn-group .btn {
  flex: 1;
  font-size: 0.9rem;
  padding: 0.5rem 1rem;
}

.quality-controls .btn-check:checked + .btn {
  background-color: var(--bs-primary);
  border-color: var(--bs-primary);
  color: white;
}

.quality-controls .form-range {
  flex: 1;
  margin-right: 0.5rem;
}

.quality-controls .alert-info {
  background-color: #e7f3ff;
  border-color: #b3d7ff;
  color: #0c5460;
  font-size: 0.85rem;
}

/* Dark theme support for quality controls */
.bg-dark .quality-controls {
  background: rgba(52, 58, 64, 0.8);
  border-color: #6c757d !important;
}

.bg-dark .quality-controls h6 {
  color: #e9ecef;
}

.bg-dark .quality-controls .alert-info {
  background-color: #1a2e3a;
  border-color: #2a4a5a;
  color: #7dd3fc;
}

/* Aspect Ratio Lock Styling */
.quality-controls .form-check {
  background: rgba(255, 255, 255, 0.5);
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #dee2e6;
}

.quality-controls .form-check-label {
  cursor: pointer;
  transition: color 0.2s;
}

.quality-controls .form-check-input:checked ~ .form-check-label {
  color: #0d6efd;
}

.bg-dark .quality-controls .form-check {
  background: rgba(108, 117, 125, 0.3);
  border-color: #6c757d;
}

.bg-dark .quality-controls .form-check-input:checked ~ .form-check-label {
  color: #6ea8fe;
}

/* Vectorization Button Styling */
.btn-group .btn-sm {
  font-size: 0.8rem;
  padding: 0.375rem 0.5rem;
}

.vectorization-badge {
  font-size: 0.75rem;
}

.vectorization-badge .bi {
  font-size: 0.7rem;
}

/* Card footer responsive layout */
@media (max-width: 768px) {
  .card-footer .d-flex {
    flex-direction: column;
    gap: 0.5rem;
  }

  .card-footer .d-flex .d-flex {
    justify-content: center;
  }

  .card-footer .btn-group {
    justify-content: center;
  }
}

/* Mobile Menu Overlay Styles */
.mobile-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1050; /* Bootstrap modal z-index */
  display: flex;
  justify-content: flex-start;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.3s ease-in-out,
    visibility 0.3s ease-in-out;
}

.mobile-menu-overlay.show {
  opacity: 1;
  visibility: visible;
}

.mobile-menu-content {
  background-color: var(--bs-body-bg);
  width: 80%; /* Adjust as needed */
  max-width: 400px; /* Adjust as needed */
  height: 100%;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.2);
  transform: translateX(-100%);
  transition: transform 0.3s ease-in-out;
  display: flex;
  flex-direction: column;
  overflow-y: auto; /* Allow scrolling for content */
}

.mobile-menu-overlay.show .mobile-menu-content {
  transform: translateX(0);
}

.mobile-menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #eee;
}

.mobile-menu-header h5 {
  margin-bottom: 0;
}

.mobile-menu-section {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #eee;
}

/* Dark mode support for mobile menu */
.bg-dark .mobile-menu-header {
  border-bottom: 1px solid #555;
}

.bg-dark .mobile-menu-section {
  border-bottom: 1px solid #555;
}

.bg-dark .mobile-menu-section h6 {
  color: #adb5bd;
}

.bg-dark .mobile-meta-item {
  background-color: #495057;
  border-color: #6c757d;
  color: #e9ecef;
}

.bg-dark .mobile-meta-item:hover {
  background-color: #5a6268;
  border-color: #7a8288;
}

.bg-dark .mobile-meta-item.active {
  background-color: #0d6efd;
  color: white;
  border-color: #0d6efd;
}

.bg-dark .hamburger-line {
  background-color: #e9ecef;
}

.bg-dark .mobile-header {
  border-bottom: 1px solid #555;
}

.mobile-menu-section h6 {
  margin-bottom: 0.5rem;
  color: #6c757d;
}

.mobile-meta-areas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.mobile-meta-item {
  display: flex;
  align-items: center;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  padding: 0.375rem 0.75rem;
  cursor: pointer;
  transition:
    background-color 0.2s,
    border-color 0.2s;
}

.mobile-meta-item:hover {
  background-color: #e9ecef;
  border-color: #ced4da;
}

.mobile-meta-item.active {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
}

.mobile-meta-item .badge {
  margin-left: 0.5rem;
}

.hamburger-btn {
  background-color: transparent;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  width: 2rem;
  height: 1.5rem;
  position: relative;
  z-index: 1060; /* Above modal */
}

.hamburger-line {
  width: 100%;
  height: 2px;
  background-color: var(--bs-dark); /* Use a dark color for hamburger */
  border-radius: 2px;
  transition: transform 0.3s ease-in-out;
}

.hamburger-btn.active .hamburger-line:nth-child(1) {
  transform: translateY(8px) rotate(45deg);
}

.hamburger-btn.active .hamburger-line:nth-child(2) {
  opacity: 0;
}

.hamburger-btn.active .hamburger-line:nth-child(3) {
  transform: translateY(-8px) rotate(-45deg);
}

.mobile-header {
  display: flex;
  align-items: center;
  padding: 1rem 1.5rem;
  background-color: var(--bs-body-bg);
  border-bottom: 1px solid #eee;
  position: sticky;
  top: 0;
  z-index: 1040; /* Below modal, above content */
}

.mobile-title {
  margin-bottom: 0;
  margin-left: 1rem;
}

@media (max-width: 768px) {
  .mobile-header {
    padding: 0.75rem 1rem;
  }
  .mobile-title {
    margin-left: 0.5rem;
  }

  /* Fix portfolio card width on mobile */
  .container-fluid {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }

  .portfolio-page {
    padding: 0;
  }

  /* Adjust grid gap on mobile */
  .row.g-4 {
    --bs-gutter-x: 0.5rem;
    --bs-gutter-y: 1rem;
  }

  /* Ensure cards don't overflow on mobile */
  .card {
    margin-bottom: 0.5rem;
  }

  .card-body {
    padding: 0.75rem;
  }

  .card-footer {
    padding: 0.5rem 0.75rem;
  }
}

@media (max-width: 576px) {
  /* Extra small screens - further reduce padding */
  .container-fluid {
    padding-left: 0.25rem;
    padding-right: 0.25rem;
  }

  .row.g-4 {
    --bs-gutter-x: 0.25rem;
    --bs-gutter-y: 0.75rem;
  }

  .card-body {
    padding: 0.5rem;
  }

  .card-footer {
    padding: 0.5rem;
  }

  /* Adjust mobile header for smaller screens */
  .mobile-header {
    padding: 0.5rem 0.75rem;
  }

  .mobile-title {
    font-size: 1.1rem;
  }
}

/* Publication State Badge */
.publication-state-badge {
  font-size: 0.75rem;
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
