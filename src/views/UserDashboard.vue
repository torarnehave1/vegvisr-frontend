<template>
  <div v-if="isStoreReady" class="container my-5">
    <!-- Title Section: full width, centered -->
    <div class="row mb-4">
      <div class="col-12 text-center">
        <h1>User Dashboard</h1>
      </div>
    </div>

    <!-- Main Content Row: Profile and Settings -->
    <div class="row">
      <!-- Profile Section -->
      <div class="col-md-7 text-center">
        <img
          :src="profileImage"
          alt="Profile Image"
          class="img-fluid rounded-circle mb-3"
          style="max-width: 150px"
        />
        <p><strong>Role:</strong> {{ userRole || 'N/A' }}</p>

        <h4>{{ email }}</h4>
        <div class="mb-3">
          <label for="bioInput" class="form-label"><strong>Your Biography:</strong></label>
          <div v-if="!editingBio && bio">
            <div v-html="renderedBio" class="text-start"></div>
            <button class="btn btn-outline-secondary btn-sm mt-2" @click="editingBio = true">
              Edit Bio
            </button>
          </div>
          <div v-else>
            <textarea
              id="bioInput"
              class="form-control"
              v-model="bio"
              rows="4"
              placeholder="E.g. I am a software developer passionate about open source and hiking."
            ></textarea>
            <div class="form-text text-start">
              Tip: Write a short biography about yourself, your interests, or your background.
              <br />
              <span class="text-muted">Markdown is supported!</span>
            </div>
            <button class="btn btn-primary btn-sm mt-2" @click="saveBio">Save</button>
            <button v-if="bio" class="btn btn-link btn-sm mt-2" @click="cancelEditBio">
              Cancel
            </button>
          </div>
        </div>
      </div>

      <!-- Settings Section -->
      <div class="col-md-5">
        <div class="form-check form-switch mt-3">
          <input
            class="form-check-input"
            type="checkbox"
            id="notificationToggle"
            v-model="data.settings.notifications"
          />
          <label class="form-check-label" for="notificationToggle">
            Notifications: {{ data.settings.notifications ? 'On' : 'Off' }}
          </label>
        </div>

        <div class="mt-3">
          <label for="themeSelect" class="form-label"><strong>Theme:</strong></label>
          <select
            id="themeSelect"
            class="form-select"
            v-model="data.settings.theme"
            @change="applyTheme"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <!-- File Upload -->
        <div class="mt-4">
          <label for="fileInput" class="form-label">Upload Profile Image</label>
          <input type="file" id="fileInput" class="form-control" @change="onFileChange" />
        </div>

        <!-- Mystmkra Reference (moved here) -->
        <div class="mb-3 mt-4">
          <label for="mystmkraCommentLike" class="form-label"
            ><strong>Mystmkra Reference:</strong></label
          >
          <input
            type="text"
            id="mystmkraCommentLike"
            name="mystmkraCommentLike"
            class="form-control"
            v-model="newMystmkraUserId"
            placeholder="Enter your Mystmkra reference"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
          />
          <div class="form-text text-start">This is your Mystmkra.io user ID for integration.</div>
          <button
            v-if="newMystmkraUserId"
            class="btn btn-primary btn-sm mt-2"
            @click="saveMystmkraUserId"
          >
            Save
          </button>
          <div v-if="mystmkraUserId" class="d-flex align-items-center mt-2">
            <span class="me-2">{{ maskedMystmkraUserId }}</span>
            <button class="btn btn-outline-secondary btn-sm" @click="copyMystmkraUserId">
              Copy
            </button>
          </div>
        </div>

        <!-- Custom Domain Branding Section - Available to User, Admin, and Superadmin -->
        <div v-if="hasBrandingAccess" class="mt-4">
          <div
            class="branding-card"
            style="
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              border-radius: 12px;
              padding: 1.5rem;
              color: white;
              position: relative;
              overflow: hidden;
            "
          >
            <div
              class="branding-pattern"
              style="
                position: absolute;
                top: 0;
                right: 0;
                width: 100px;
                height: 100px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 50%;
                transform: translate(30px, -30px);
              "
            ></div>
            <div class="branding-content" style="position: relative; z-index: 2">
              <h5 class="mb-3 d-flex align-items-center">
                🎨 <span class="ms-2">Custom Domain Branding</span>
              </h5>
              <p class="mb-3" style="opacity: 0.9; line-height: 1.5">
                Create fully branded experiences with your own domains. Set up custom logos, domain
                routing, and content filtering for each domain.
              </p>

              <!-- Multi-Domain Status -->
              <div class="branding-status mb-3">
                <div v-if="domainConfigs.length > 0" class="domain-list">
                  <div class="d-flex flex-wrap gap-2">
                    <span
                      v-for="config in domainConfigs"
                      :key="config.domain"
                      class="badge bg-success d-flex align-items-center"
                      style="
                        background: rgba(255, 255, 255, 0.2) !important;
                        backdrop-filter: blur(10px);
                      "
                    >
                      ✓ {{ config.domain }}
                      <small
                        class="ms-1"
                        v-if="config.selectedCategories && config.selectedCategories.length > 0"
                      >
                        ({{ config.selectedCategories.length }} filters)
                      </small>
                    </span>
                  </div>
                  <small class="text-light mt-2 d-block" style="opacity: 0.8">
                    {{ domainConfigs.length }} custom domain{{
                      domainConfigs.length !== 1 ? 's' : ''
                    }}
                    configured
                  </small>
                </div>

                <!-- Legacy single domain display (for backward compatibility) -->
                <div v-else-if="mySite" class="legacy-domain">
                  <span
                    class="badge bg-success"
                    style="background: rgba(255, 255, 255, 0.2) !important"
                  >
                    ✓ {{ mySite }} (Legacy)
                  </span>
                  <small class="text-light mt-2 d-block" style="opacity: 0.8">
                    Legacy single domain configuration
                  </small>
                </div>

                <!-- No domains configured -->
                <div v-else class="no-domains">
                  <span
                    class="badge bg-warning"
                    style="background: rgba(255, 193, 7, 0.3) !important"
                  >
                    ⚠ No domains configured
                  </span>
                </div>
              </div>

              <div class="d-flex justify-content-end">
                <button
                  @click="openBrandingModal"
                  class="btn btn-light btn-sm"
                  style="font-weight: 600"
                >
                  <i class="fas fa-external-link-alt me-1"></i>
                  {{ domainConfigs.length > 0 ? 'Manage Domains' : 'Setup Branding' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Superadmin Affiliate Management Section -->
        <div v-if="userRole === 'Superadmin'" class="mt-4">
          <div
            class="affiliate-management-card"
            style="
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              border-radius: 12px;
              padding: 1.5rem;
              color: white;
              position: relative;
              overflow: hidden;
            "
          >
            <div
              class="affiliate-pattern"
              style="
                position: absolute;
                top: 0;
                right: 0;
                width: 100px;
                height: 100px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 50%;
                transform: translate(30px, -30px);
              "
            ></div>
            <div class="affiliate-content" style="position: relative; z-index: 2">
              <h5 class="mb-3 d-flex align-items-center">
                🎯 <span class="ms-2">Affiliate Partner Management</span>
              </h5>
              <p class="mb-3" style="opacity: 0.9; line-height: 1.5">
                Send professional invitation emails to potential affiliate partners. Manage
                commission rates, track invitations, and grow your affiliate network.
              </p>

              <div class="affiliate-stats mb-3" style="opacity: 0.9">
                <div class="row text-center">
                  <div class="col-4">
                    <div style="font-size: 1.2rem; font-weight: bold">
                      {{ affiliateStats.totalInvitations || 0 }}
                    </div>
                    <small>Invitations Sent</small>
                  </div>
                  <div class="col-4">
                    <div style="font-size: 1.2rem; font-weight: bold">
                      {{ affiliateStats.activeAffiliates || 0 }}
                    </div>
                    <small>Active Affiliates</small>
                  </div>
                  <div class="col-4">
                    <div style="font-size: 1.2rem; font-weight: bold">
                      {{ affiliateStats.totalCommission || '0%' }}
                    </div>
                    <small>Avg Commission</small>
                  </div>
                </div>
              </div>

              <div class="d-flex justify-content-end">
                <button
                  @click="openAffiliateManagement"
                  class="btn btn-light btn-sm"
                  style="font-weight: 600"
                >
                  <i class="fas fa-envelope me-1"></i>
                  Manage Affiliates
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Superadmin Template Management Section -->
        <div v-if="userRole === 'Superadmin'" class="mt-4">
          <div
            class="template-management-card"
            style="
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              border-radius: 12px;
              padding: 1.5rem;
              color: white;
              position: relative;
              overflow: hidden;
            "
          >
            <div
              class="template-pattern"
              style="
                position: absolute;
                top: 0;
                right: 0;
                width: 100px;
                height: 100px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 50%;
                transform: translate(30px, -30px);
              "
            ></div>
            <div class="template-content" style="position: relative; z-index: 2">
              <h5 class="mb-3 d-flex align-items-center">
                📊 <span class="ms-2">Knowledge Graph Templates</span>
              </h5>
              <p class="mb-3" style="opacity: 0.9; line-height: 1.5">
                Manage AI-powered templates for the Knowledge Graph. Create, edit, and delete
                templates with custom nodes, edges, and AI instructions for different use cases.
              </p>

              <div class="d-flex justify-content-end">
                <router-link
                  to="/template-manager"
                  class="btn btn-light btn-sm"
                  style="font-weight: 600; text-decoration: none"
                >
                  <i class="fas fa-cogs me-1"></i>
                  Manage Templates
                </router-link>
              </div>
            </div>
          </div>
        </div>

        <!-- App Builder Section (All Users) -->
        <div v-if="userStore.loggedIn" class="mt-4">
          <div
            class="app-builder-card"
            style="
              background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
              border-radius: 12px;
              padding: 1.5rem;
              color: white;
              position: relative;
              overflow: hidden;
            "
          >
            <div
              class="app-builder-pattern"
              style="
                position: absolute;
                top: 0;
                right: 0;
                width: 100px;
                height: 100px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 50%;
                transform: translate(30px, -30px);
              "
            ></div>
            <div class="app-builder-content" style="position: relative; z-index: 2">
              <h5 class="mb-3 d-flex align-items-center">
                🚀 <span class="ms-2">App Builder</span>
              </h5>
              <p class="mb-3" style="opacity: 0.9; line-height: 1.5">
                Create and deploy custom applications powered by AI. Build todo lists, calculators,
                dashboards, and more with simple prompts. Deploy instantly to Cloudflare Workers.
              </p>

              <div class="d-flex justify-content-end">
                <router-link
                  to="/app-builder"
                  class="btn btn-light btn-sm"
                  style="font-weight: 600; text-decoration: none"
                >
                  <i class="fas fa-rocket me-1"></i>
                  Build an App
                </router-link>
              </div>
            </div>
          </div>
        </div>

        <!-- User Secret Section -->
        <div class="user-id-section alert alert-info mt-5">
          <p>Current User Secret:</p>
          <div class="d-flex align-items-center">
            <p class="mb-0 me-3">
              {{ maskedUserId }}
            </p>
            <button class="btn btn-outline-secondary btn-sm" @click="copyUserId">Copy</button>
          </div>
        </div>

        <!-- Application Token Section -->
        <div
          class="mt-4"
          style="background: #fff9db; border-radius: 8px; padding: 1rem; border: 1px solid #ffe066"
        >
          <p>Application Token:</p>
          <div class="d-flex align-items-center">
            <p class="mb-0 me-3">{{ maskedAppToken }}</p>
            <button class="btn btn-outline-secondary btn-sm" @click="copyAppToken">Copy</button>
          </div>
        </div>

        <!-- Mystmkra User ID Secret Section -->
        <div
          class="mt-4 mystmkra-secret-section"
          style="background: #e6f7ff; border-radius: 8px; padding: 1rem; border: 1px solid #91d5ff"
        >
          <p>Mystmkra User ID:</p>
          <div class="d-flex align-items-center">
            <p class="mb-0 me-3">{{ maskedMystmkraUserId }}</p>
            <button class="btn btn-outline-secondary btn-sm" @click="copyMystmkraUserId">
              Copy
            </button>
          </div>
        </div>

        <!-- API Token Management Section -->
        <div class="mt-5">
          <TokenManagement />
        </div>

        <!-- Subscription Management for All Users -->
        <div v-if="userStore.loggedIn" class="mt-4">
          <div
            class="subscription-card"
            style="
              background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
              border-radius: 12px;
              padding: 1.5rem;
              color: white;
              position: relative;
              overflow: hidden;
            "
          >
            <div
              class="subscription-pattern"
              style="
                position: absolute;
                top: 0;
                right: 0;
                width: 100px;
                height: 100px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 50%;
                transform: translate(30px, -30px);
              "
            ></div>
            <div class="subscription-content" style="position: relative; z-index: 2">
              <h5 class="mb-3 d-flex align-items-center">
                📬 <span class="ms-2">{{ getNotificationSectionTitle() }}</span>
              </h5>

              <!-- Current Subscriptions -->
              <div v-if="currentSubscriptions.length > 0" class="mb-3">
                <p style="opacity: 0.9; margin-bottom: 0.75rem">You receive updates for:</p>
                <div class="d-flex flex-wrap gap-2">
                  <span
                    v-for="subscription in currentSubscriptions"
                    :key="subscription.id"
                    class="badge bg-light text-dark d-flex align-items-center"
                    style="
                      background: rgba(255, 255, 255, 0.9) !important;
                      color: #333 !important;
                      font-size: 0.85em;
                      padding: 0.4rem 0.7rem;
                    "
                  >
                    {{ formatSubscriptionTitle(subscription) }}
                    <button
                      @click="unsubscribeFromMetaArea(subscription)"
                      class="btn-close ms-2"
                      style="font-size: 0.6em"
                      :disabled="isUnsubscribing"
                      title="Unsubscribe"
                    ></button>
                  </span>
                </div>
                <small class="text-light mt-2 d-block" style="opacity: 0.8">
                  {{ currentSubscriptions.length }} active subscription{{
                    currentSubscriptions.length !== 1 ? 's' : ''
                  }}
                </small>
              </div>

              <!-- No Subscriptions -->
              <div v-else class="mb-3">
                <span
                  class="badge bg-warning"
                  style="background: rgba(255, 193, 7, 0.3) !important"
                >
                  ⚠ No active subscriptions
                </span>
                <small class="text-light mt-2 d-block" style="opacity: 0.8">
                  {{ getNotificationHintText() }}
                </small>
              </div>

              <!-- Subscription Benefits Explanation -->
              <div class="subscription-info mb-3" style="opacity: 0.9">
                <h6 class="text-light mb-2">📧 What You Get:</h6>
                <ul class="text-light small mb-0" style="padding-left: 1.2rem">
                  <li>Regular updates when new graphs are added to your subscribed meta areas</li>
                  <li>
                    Instant notifications when existing content in your areas of interest is updated
                  </li>
                  <li>Weekly digest of activity in your knowledge domains</li>
                  <li>Early access to new features and content in subscribed areas</li>
                </ul>
              </div>

              <!-- Notification Toggle -->
              <div
                class="notification-toggle mb-3 d-flex align-items-center justify-content-between"
              >
                <div>
                  <span class="text-light" style="font-weight: 500">🔔 Email Notifications</span>
                  <br />
                  <small class="text-light" style="opacity: 0.8">Receive updates via email</small>
                </div>
                <div class="form-check form-switch">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    id="notificationToggle"
                    v-model="data.settings.notifications"
                    @change="saveNotificationSettings"
                    style="transform: scale(1.2)"
                  />
                  <label class="form-check-label text-light" for="notificationToggle">
                    {{ data.settings.notifications ? 'On' : 'Off' }}
                  </label>
                </div>
              </div>

              <div class="d-flex justify-content-end">
                <button
                  @click="openSubscriptionModal"
                  class="btn btn-light btn-sm"
                  style="font-weight: 600"
                >
                  <i class="fas fa-plus me-1"></i>
                  Add Subscription
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Save Button -->
        <button class="btn btn-primary mt-3" @click="saveAllData">Save Changes</button>
      </div>
    </div>

    <div v-if="isSaving" class="saving-message-animated">
      <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
      {{ saveMessage }}
    </div>

    <!-- Branding Modal -->
    <BrandingModal
      :isOpen="showBrandingModal"
      :existingDomainConfigs="domainConfigs"
      @close="closeBrandingModal"
      @saved="handleBrandingSaved"
    />

    <!-- Affiliate Management Modal -->
    <div
      v-if="showAffiliateManagement"
      class="modal fade show"
      style="display: block"
      tabindex="-1"
    >
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">🎯 Affiliate Partner Management</h5>
            <button type="button" class="btn-close" @click="closeAffiliateManagement"></button>
          </div>
          <div class="modal-body p-0">
            <AffiliateManagement />
          </div>
        </div>
      </div>
    </div>
    <div v-if="showAffiliateManagement" class="modal-backdrop fade show"></div>

    <!-- Subscription Modal -->
    <div
      v-if="showSubscriptionModal"
      class="modal fade show"
      style="display: block"
      tabindex="-1"
      aria-labelledby="subscriptionModalLabel"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-md">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="subscriptionModalLabel">📬 Add New Subscription</h5>
            <button
              type="button"
              class="btn-close"
              @click="closeSubscriptionModal"
              aria-label="Close"
            ></button>
          </div>
          <div class="modal-body">
            <!-- Subscription Explanation -->
            <div class="mb-4 p-3 bg-light rounded">
              <h6 class="text-primary mb-2">📧 How Subscriptions Work</h6>
              <p class="text-muted mb-2 small">
                When you subscribe to meta areas or system events, you'll receive:
              </p>
              <ul class="text-muted small mb-0">
                <li>
                  <strong>Instant alerts</strong> when new graphs are created in your subscribed
                  areas
                </li>
                <li><strong>Update notifications</strong> when existing content is modified</li>
                <li>
                  <strong>Weekly digests</strong> summarizing activity in your areas of interest
                </li>
              </ul>
              <p class="text-muted mt-2 mb-0 small">
                💡 <strong>Tip:</strong> Use the notification toggle in your dashboard to control
                email delivery.
              </p>
            </div>

            <!-- Subscription Type Selection -->
            <div class="mb-4">
              <label class="form-label">Subscription Types:</label>
              <div class="subscription-types">
                <div
                  v-for="type in availableSubscriptionTypes"
                  :key="type.id"
                  class="subscription-type-card mb-2 p-3 border rounded"
                  :class="{ 'bg-light': selectedSubscriptionType === type.id }"
                  @click="selectedSubscriptionType = type.id"
                  style="cursor: pointer; border: 1px solid #dee2e6"
                >
                  <div class="d-flex align-items-start">
                    <span class="me-2" style="font-size: 1.2em">{{ type.icon }}</span>
                    <div class="flex-grow-1">
                      <h6 class="mb-1">{{ type.label }}</h6>
                      <small class="text-muted">{{ type.description }}</small>
                    </div>
                    <input
                      type="radio"
                      :value="type.id"
                      v-model="selectedSubscriptionType"
                      class="form-check-input ms-2"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Meta Area Selection (only for meta_area type) -->
            <div v-if="selectedSubscriptionType === 'meta_area'">
              <!-- Selected Subscriptions -->
              <div v-if="newSelectedSubscriptions.length > 0" class="mb-3">
                <label class="form-label">Selected Meta Areas:</label>
                <div class="selected-subscriptions">
                  <span
                    v-for="metaArea in newSelectedSubscriptions"
                    :key="metaArea"
                    class="badge bg-primary me-1 mb-1"
                  >
                    {{ metaArea }}
                    <button
                      type="button"
                      class="btn-close btn-close-white ms-1"
                      @click="removeSelectedSubscription(metaArea)"
                      style="font-size: 0.7em"
                    ></button>
                  </span>
                </div>
              </div>

              <!-- Meta Area Input -->
              <div class="mb-3">
                <label for="subscription-input" class="form-label">Add Meta Area:</label>
                <div class="autocomplete-container">
                  <input
                    id="subscription-input"
                    v-model="newSubscriptionInput"
                    type="text"
                    class="form-control"
                    placeholder="Type # to browse meta areas..."
                    @input="onSubscriptionInput"
                    @focus="onSubscriptionFocus"
                    @blur="hideSubscriptionDropdown"
                    autocomplete="off"
                  />
                  <!-- Loading dropdown -->
                  <div
                    v-if="showMetaAreaDropdown && isLoadingMetaAreas"
                    class="suggestions-dropdown"
                  >
                    <div class="suggestion-item text-muted">
                      <i class="fas fa-spinner fa-spin me-2"></i>
                      Loading meta areas...
                    </div>
                  </div>
                  <!-- Meta areas dropdown -->
                  <div
                    v-else-if="showMetaAreaDropdown && filteredAvailableMetaAreas.length > 0"
                    class="suggestions-dropdown"
                  >
                    <div
                      v-for="metaArea in filteredAvailableMetaAreas"
                      :key="metaArea"
                      class="suggestion-item"
                      :class="{
                        disabled:
                          newSelectedSubscriptions.includes(metaArea) ||
                          isAlreadySubscribed(metaArea),
                      }"
                      @mousedown.prevent="selectSubscriptionMetaArea(metaArea)"
                    >
                      {{ metaArea }}
                      <span
                        v-if="newSelectedSubscriptions.includes(metaArea)"
                        class="text-muted ms-1"
                      >
                        ✓ Selected
                      </span>
                      <span v-else-if="isAlreadySubscribed(metaArea)" class="text-muted ms-1">
                        ✓ Already subscribed
                      </span>
                    </div>
                  </div>
                </div>
                <div v-if="isLoadingMetaAreas" class="text-muted small mt-2">
                  <i class="fas fa-spinner fa-spin me-1"></i>
                  Loading available meta areas...
                </div>
                <small v-else class="form-text text-muted">
                  💡 Type <strong>#</strong> to see all available meta areas
                </small>
              </div>
            </div>

            <!-- Error/Success Messages -->
            <div v-if="subscriptionError" class="alert alert-danger">
              {{ subscriptionError }}
            </div>
            <div v-if="subscriptionSuccess" class="alert alert-success">
              {{ subscriptionSuccess }}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeSubscriptionModal">
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-primary"
              @click="createNewSubscriptions"
              :disabled="!canCreateSubscription || isCreatingSubscriptions"
            >
              <span
                v-if="isCreatingSubscriptions"
                class="spinner-border spinner-border-sm me-2"
              ></span>
              {{ isCreatingSubscriptions ? 'Subscribing...' : 'Add Subscription' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Backdrop -->
    <div v-if="showSubscriptionModal" class="modal-backdrop fade show"></div>
  </div>
</template>

<script>
import { useUserStore } from '@/stores/userStore' // Import Pinia store
import { usePortfolioStore } from '@/stores/portfolioStore' // Import portfolio store for meta areas
import { marked } from 'marked' // Import marked.js
import { useRouter } from 'vue-router' // Import router
import { apiUrls } from '@/config/api' // Import API configuration
import BrandingModal from '@/components/BrandingModal.vue' // Import branding modal
import AffiliateManagement from '@/components/AffiliateManagement.vue' // Import affiliate management
import TokenManagement from '@/components/TokenManagement.vue' // Import token management

export default {
  components: {
    BrandingModal,
    AffiliateManagement,
    TokenManagement,
  },
  data() {
    return {
      bio: '',
      data: {
        settings: {
          darkMode: false,
          notifications: true,
          theme: 'light',
        },
      },
      profileImage: '',
      selectedFile: null,
      isStoreReady: false,
      emailVerificationToken: '',
      editingBio: false,
      isSaving: false,
      saveMessage: '',
      mystmkraUserId: '',
      editingMystmkraUserId: false,
      newMystmkraUserId: '',
      mySite: '', // Legacy - kept for backward compatibility
      myLogo: '', // Legacy - kept for backward compatibility
      logoError: false,
      showBrandingModal: false,
      domainConfigs: [], // New: Array of domain configurations
      // Affiliate management
      showAffiliateManagement: false,
      affiliateStats: {
        totalInvitations: 0,
        activeAffiliates: 0,
        totalCommission: '15%',
      },
      // Subscription management
      currentSubscriptions: [],
      showSubscriptionModal: false,
      selectedSubscriptionType: 'meta_area', // Default to meta areas
      newSubscriptionInput: '',
      newSelectedSubscriptions: [],
      filteredAvailableMetaAreas: [], // Reactive data property for filtered results
      showMetaAreaDropdown: false,
      isCreatingSubscriptions: false,
      isUnsubscribing: false,
      subscriptionError: '',
      subscriptionSuccess: '',
    }
  },
  computed: {
    renderedBio() {
      return marked(this.bio || '') // Convert bio Markdown to HTML
    },
    maskedUserId() {
      const userId = this.userStore.user_id || 'xxx-xxxx-xxx-xxx'
      if (userId.length > 8) {
        return `${userId.slice(0, 4)}...${userId.slice(-4)}`
      }
      return userId
    },
    email() {
      return this.userStore.email || null // Fetch email from Vuex store
    },
    userRole() {
      return this.userStore.role || null // Fetch role from Vuex store
    },
    maskedAppToken() {
      const token = this.emailVerificationToken || 'xxxxxxxxxxxxxxxxxxxx'
      if (token.length > 8) {
        return `${token.slice(0, 4)}...${token.slice(-4)}`
      }
      return token
    },
    maskedMystmkraUserId() {
      const id = this.mystmkraUserId || ''
      if (id.length > 8) {
        return `${id.slice(0, 4)}...${id.slice(-4)}`
      }
      return id
    },
    isAdminOrSuperadmin() {
      const role = this.userStore.role || ''
      return role === 'admin' || role === 'superadmin'
    },
    hasBrandingAccess() {
      const role = this.userStore.role || ''
      return ['User', 'Admin', 'Superadmin'].includes(role)
    },
    availableSubscriptionTypes() {
      const role = this.userRole || 'User'
      const types = []

      // Meta areas available to all roles
      types.push({
        id: 'meta_area',
        label: 'Meta Areas',
        description: 'Subscribe to specific knowledge areas for regular content updates',
        icon: '🏷️',
      })

      // Role-specific subscription types
      if (role === 'Superadmin') {
        types.push({
          id: 'system_events',
          label: 'System Events',
          description: 'Subscribe to user registrations, role changes, and system alerts',
          icon: '⚡',
        })
        types.push({
          id: 'all_content',
          label: 'All Content Updates',
          description: 'Subscribe to all graph creations and content updates',
          icon: '🌍',
        })
      }

      if (['Admin', 'Superadmin'].includes(role)) {
        types.push({
          id: 'user_activity',
          label: 'User Activity',
          description: 'Subscribe to user actions and collaboration activities',
          icon: '👥',
        })
      }

      return types
    },
    canCreateSubscription() {
      if (this.selectedSubscriptionType === 'meta_area') {
        return this.newSelectedSubscriptions.length > 0
      }
      // For system events and user activity, no specific selections needed
      return ['system_events', 'all_content', 'user_activity'].includes(
        this.selectedSubscriptionType,
      )
    },
    // Meta areas from portfolio store (same pattern as BrandingModal)
    availableMetaAreas() {
      return this.portfolioStore.allMetaAreas || []
    },
    // Loading state for meta areas
    isLoadingMetaAreas() {
      return this.availableMetaAreas.length === 0
    },
  },
  setup() {
    const userStore = useUserStore() // Use Pinia store
    const portfolioStore = usePortfolioStore() // Use portfolio store for meta areas
    const router = useRouter() // Use router

    return {
      userStore,
      portfolioStore,
      router,
    }
  },
  mounted() {
    // Check if user is logged in
    if (!this.userStore.loggedIn) {
      console.log('User not logged in, redirecting to login')
      this.router.push('/login')
      return
    }
    this.waitForStore()
    this.fetchUserData() // Fetch user data on mount
    this.newMystmkraUserId = ''

    // Load affiliate stats for Superadmins
    if (this.userRole === 'Superadmin') {
      this.loadAffiliateStats()
    }
  },
  watch: {
    // Watch for changes in loggedIn state
    'userStore.loggedIn': {
      handler(newValue) {
        if (!newValue) {
          console.log('User logged out, redirecting to login')
          this.router.push('/login')
        }
      },
      immediate: true,
    },
  },
  methods: {
    async waitForStore() {
      const timeout = 5000 // Maximum wait time in milliseconds
      const startTime = Date.now()

      const checkInterval = setInterval(() => {
        if (this.email && this.userRole) {
          this.isStoreReady = true
          console.log('Store is ready: Email:', this.email, 'Role:', this.userRole)

          // Load subscription data for all logged in users
          this.loadMetaAreasAsync()

          clearInterval(checkInterval)
        } else if (Date.now() - startTime > timeout) {
          console.error('Timeout waiting for store to initialize')
          clearInterval(checkInterval)
        } else {
          console.warn(
            'Waiting for store to initialize: Email:',
            this.email,
            'Role:',
            this.userRole,
          )
        }
      }, 100) // Check every 100ms
    },
    async fetchUserData() {
      try {
        const response = await fetch(apiUrls.getUserData(this.email))
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const result = await response.json()
        console.log('Raw user data response:', result) // Debug log
        if (result) {
          console.log('Bio from response:', result.bio) // Debug log
          this.bio = result.bio || ''
          console.log('Bio after assignment:', this.bio) // Debug log
          this.profileImage = result.profileimage || ''
          if (result.emailVerificationToken) {
            this.emailVerificationToken = result.emailVerificationToken
          }
          // Store the user_id in the store
          if (result.user_id) {
            this.userStore.setUserId(result.user_id)
          }
          // Load settings from meta if it exists
          if (result.data && result.data.settings) {
            this.data.settings = {
              darkMode: result.data.settings.darkMode || false,
              notifications: result.data.settings.notifications || true,
              theme: result.data.settings.theme || 'light',
            }
            if (this.data.settings.theme) {
              this.applyTheme()
            }
          }
          // Extract mystmkraUserId from meta data structure
          if (result.data && result.data.profile && result.data.profile.mystmkraUserId) {
            this.mystmkraUserId = result.data.profile.mystmkraUserId
            this.userStore.setMystmkraUserId(this.mystmkraUserId)
            console.log('Set mystmkraUserId in store (fetch):', this.mystmkraUserId)
            this.newMystmkraUserId = ''
          } else {
            this.mystmkraUserId = ''
            this.userStore.setMystmkraUserId('')
            console.log('No mystmkraUserId found in fetched data, set to empty string in store.')
            this.newMystmkraUserId = ''
          }

          // Extract subscription data for subscribers
          if (result.data && result.data.subscriptions) {
            this.data.subscriptions = result.data.subscriptions
            console.log('Loaded subscription data:', this.data.subscriptions)
          } else {
            this.data.subscriptions = []
            console.log('No subscription data found, initialized empty array')
          }

          // Extract site branding data
          if (
            result.data &&
            result.data.domainConfigs &&
            Array.isArray(result.data.domainConfigs)
          ) {
            // New multi-domain structure
            this.domainConfigs = result.data.domainConfigs
            console.log('Loaded domain configs:', this.domainConfigs)
          } else if (result.data && result.data.branding) {
            // Legacy single domain structure - convert to new format
            this.mySite = result.data.branding.mySite || ''
            this.myLogo = result.data.branding.myLogo || ''

            // If we have legacy branding data, create a single domain config for backward compatibility
            if (this.mySite) {
              this.domainConfigs = [
                {
                  domain: this.mySite,
                  logo: this.myLogo,
                  contentFilter: 'none', // Default for legacy
                  selectedCategories: [],
                },
              ]
              console.log('Converted legacy branding to domain config:', this.domainConfigs)
            }
          } else {
            this.mySite = ''
            this.myLogo = ''
            this.domainConfigs = []
          }

          // Load current subscriptions for subscribers
          this.loadCurrentSubscriptions()
        } else {
          console.warn('No user data found')
        }
      } catch (error) {
        console.error('Error fetching user data:', error)
      }
    },
    async onFileChange(event) {
      this.selectedFile = event.target.files[0]
    },
    async saveAllData() {
      try {
        this.isSaving = true
        this.saveMessage = 'Saving your settings...'
        if (this.selectedFile) {
          const formData = new FormData()
          formData.append('file', this.selectedFile)
          formData.append('email', this.email)

          const uploadResponse = await fetch(apiUrls.uploadFile(), {
            method: 'POST',
            body: formData,
          })

          if (!uploadResponse.ok) {
            throw new Error(`HTTP error! status: ${uploadResponse.status}`)
          }

          const uploadResult = await uploadResponse.json()
          if (uploadResult.success) {
            this.profileImage = uploadResult.fileUrl // Update profileImage
          } else {
            alert('Error uploading profile image')
            return
          }
        }

        // Always use the mystmkraUserId from the input/store
        const payload = {
          email: this.email,
          bio: this.bio, // Only top-level bio
          profileimage: this.profileImage,
          data: {
            profile: {
              user_id: this.userStore.user_id,
              email: this.email,
              mystmkraUserId: this.mystmkraUserId,
            },
            settings: {
              darkMode: this.data.settings.darkMode,
              notifications: this.data.settings.notifications,
              theme: this.data.settings.theme,
            },
            branding: {
              mySite: this.mySite,
              myLogo: this.myLogo,
            },
            domainConfigs: this.domainConfigs, // New multi-domain structure
          },
          mystmkraUserId: this.mystmkraUserId, // Also send as top-level for backend robustness
        }
        console.log('Saving mystmkraUserId:', this.mystmkraUserId)
        console.log('Sending PUT /userdata request:', JSON.stringify(payload, null, 2))
        const response = await fetch(apiUrls.updateUserData(), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const result = await response.json()
        if (result.success) {
          this.saveMessage = 'Settings saved!'
          this.userStore.setMystmkraUserId(this.mystmkraUserId)
          this.editingMystmkraUserId = false
          console.log('Set mystmkraUserId in store (save):', this.mystmkraUserId)
          setTimeout(() => {
            this.isSaving = false
            this.saveMessage = ''
          }, 1500)
        } else {
          this.saveMessage = 'Error updating user data'
          setTimeout(() => {
            this.isSaving = false
            this.saveMessage = ''
          }, 2000)
        }
      } catch (error) {
        this.saveMessage = `Error saving user data: ${error.message}`
        setTimeout(() => {
          this.isSaving = false
          this.saveMessage = ''
        }, 2000)
      }
    },
    applyTheme() {
      if (this.data.settings?.theme === 'dark') {
        document.body.classList.add('bg-dark', 'text-white')
      } else {
        document.body.classList.remove('bg-dark', 'text-white')
      }
    },
    copyUserId() {
      const userId = this.userStore.user_id || 'xxx-xxxx-xxx-xxx'
      navigator.clipboard.writeText(userId).then(
        () => {
          const infoElement = document.createElement('div')
          infoElement.className = 'alert alert-success position-fixed top-0 end-0 m-3'
          infoElement.style.zIndex = '1050'
          infoElement.textContent = 'User ID copied to clipboard!'
          document.body.appendChild(infoElement)

          setTimeout(() => {
            document.body.removeChild(infoElement)
          }, 2000)
        },
        (err) => {
          console.error('Failed to copy User ID:', err)
        },
      )
    },
    copyAppToken() {
      navigator.clipboard.writeText(this.emailVerificationToken).then(
        () => {
          const infoElement = document.createElement('div')
          infoElement.className = 'alert alert-success position-fixed top-0 end-0 m-3'
          infoElement.style.zIndex = '1050'
          infoElement.textContent = 'Application Token copied to clipboard!'
          document.body.appendChild(infoElement)
          setTimeout(() => {
            document.body.removeChild(infoElement)
          }, 2000)
        },
        (err) => {
          console.error('Failed to copy Application Token:', err)
        },
      )
    },
    copyMystmkraUserId() {
      navigator.clipboard.writeText(this.mystmkraUserId).then(
        () => {
          const infoElement = document.createElement('div')
          infoElement.className = 'alert alert-success position-fixed top-0 end-0 m-3'
          infoElement.style.zIndex = '1050'
          infoElement.textContent = 'Mystmkra User ID copied to clipboard!'
          document.body.appendChild(infoElement)
          setTimeout(() => {
            document.body.removeChild(infoElement)
          }, 2000)
        },
        (err) => {
          console.error('Failed to copy Mystmkra User ID:', err)
        },
      )
    },
    async saveBio() {
      this.isSaving = true
      this.saveMessage = 'Saving your biography...'
      await this.saveAllData()
      this.editingBio = false
      this.saveMessage = 'Biography saved!'
      setTimeout(() => {
        this.isSaving = false
        this.saveMessage = ''
      }, 1500)
    },
    cancelEditBio() {
      this.editingBio = false
    },
    saveMystmkraUserId() {
      if (this.newMystmkraUserId) {
        this.mystmkraUserId = this.newMystmkraUserId
        this.userStore.setMystmkraUserId(this.newMystmkraUserId)
        this.newMystmkraUserId = ''
        // Optionally, call saveAllData() here if you want to persist immediately
      }
    },
    openBrandingModal() {
      // Navigate to the dedicated branding page instead of opening modal
      this.$router.push('/branding')
    },
    closeBrandingModal() {
      this.showBrandingModal = false
    },
    openAffiliateManagement() {
      this.showAffiliateManagement = true
    },
    closeAffiliateManagement() {
      this.showAffiliateManagement = false
    },
    async loadAffiliateStats() {
      try {
        // This would be implemented when you have affiliate stats endpoints
        // For now, using placeholder data
        this.affiliateStats = {
          totalInvitations: 12,
          activeAffiliates: 8,
          totalCommission: '15%',
        }
      } catch (error) {
        console.error('Error loading affiliate stats:', error)
      }
    },
    handleBrandingSaved(message, updatedDomainConfigs) {
      this.saveMessage = message
      this.isSaving = true

      // Update domain configs if provided by the modal
      if (updatedDomainConfigs) {
        this.domainConfigs = updatedDomainConfigs
        console.log('Updated domain configs from modal:', this.domainConfigs)
      }

      // Refresh user data to show updated branding status
      this.fetchUserData()

      setTimeout(() => {
        this.isSaving = false
        this.saveMessage = ''
      }, 2000)
    },

    // Format subscription title for display
    formatSubscriptionTitle(subscription) {
      const typeIcons = {
        system_events: '⚡ System Events',
        all_content: '🌍 All Content',
        user_activity: '👥 User Activity',
        meta_area: subscription.target_title,
        category: subscription.target_title,
      }

      return typeIcons[subscription.subscription_type] || subscription.target_title
    },

    // Role-specific section title
    getNotificationSectionTitle() {
      switch (this.userRole) {
        case 'Superadmin':
          return 'System Subscriptions'
        case 'Admin':
          return 'Admin Subscriptions'
        case 'Subscriber':
          return 'My Subscriptions'
        default:
          return 'My Subscriptions'
      }
    },

    // Role-specific notification hint
    getNotificationHintText() {
      switch (this.userRole) {
        case 'Superadmin':
          return 'Subscribe to system events, user activity, and all content updates'
        case 'Admin':
          return 'Subscribe to content changes and user activity in your domain'
        case 'User':
          return 'Subscribe to meta areas to receive content update notifications'
        case 'ViewOnly':
          return 'Subscribe to meta areas to stay updated on new content'
        case 'Subscriber':
          return 'Subscribe to meta areas to receive regular email updates'
        default:
          return 'Subscribe to topics that interest you for regular updates'
      }
    },

    // Save notification settings immediately when toggled
    async saveNotificationSettings() {
      try {
        console.log('Saving notification setting:', this.data.settings.notifications)

        // Use existing saveAllData method to persist the change
        await this.saveAllData()

        // Show brief success feedback
        this.saveMessage = `Email notifications ${this.data.settings.notifications ? 'enabled' : 'disabled'}`

        setTimeout(() => {
          this.saveMessage = ''
        }, 2000)
      } catch (error) {
        console.error('Error saving notification settings:', error)

        // Revert the toggle on error
        this.data.settings.notifications = !this.data.settings.notifications

        this.saveMessage = 'Error saving notification settings'
        setTimeout(() => {
          this.saveMessage = ''
        }, 3000)
      }
    },

    // Subscription Management Methods
    async loadCurrentSubscriptions() {
      if (!this.userStore.loggedIn) return

      try {
        // Extract subscriptions from user data
        if (this.data && this.data.subscriptions) {
          this.currentSubscriptions = this.data.subscriptions.filter(
            (sub) => sub.status === 'active',
          )
        }
        console.log('Loaded current subscriptions:', this.currentSubscriptions)
      } catch (error) {
        console.error('Error loading subscriptions:', error)
      }
    },

    // Load meta areas asynchronously using portfolio store (same pattern as BrandingModal)
    async loadMetaAreasAsync() {
      try {
        console.log('=== STARTING META AREA LOAD ===')
        console.log('User role:', this.userRole)
        console.log('Current hostname:', window.location.hostname)

        // CRITICAL: Use exact same approach as BrandingModal to bypass content filtering
        console.log('Making API call WITHOUT x-original-hostname header to bypass filtering...')

        // Create headers object for inspection
        const requestHeaders = {
          // Don't send x-original-hostname to avoid content filtering
          'Content-Type': 'application/json',
        }
        console.log('Request headers being sent:', requestHeaders)

        // Fetch ALL knowledge graphs from the system to get all available meta areas
        // CRITICAL: Don't send x-original-hostname to avoid content filtering (same as BrandingModal)
        const response = await fetch('https://knowledge.vegvisr.org/getknowgraphs', {
          headers: requestHeaders,
        })

        console.log('API response status:', response.status, response.statusText)
        console.log('API response headers:', Object.fromEntries(response.headers.entries()))

        if (response.ok) {
          const data = await response.json()
          console.log('=== META AREA LOADING DEBUG ===')
          console.log('Raw API response:', data)
          console.log('Graphs returned:', data.results?.length || 0)
          console.log('First few graph IDs:', data.results?.slice(0, 5).map((g) => g.id) || [])

          if (data.results) {
            // Fetch complete data for each graph to get meta areas
            const metaAreasSet = new Set()
            let processedGraphs = 0
            let graphsWithMetaAreas = 0

            for (const graph of data.results) {
              try {
                const graphResponse = await fetch(
                  `https://knowledge.vegvisr.org/getknowgraph?id=${graph.id}`,
                )
                if (graphResponse.ok) {
                  const graphData = await graphResponse.json()
                  const metaAreaString = graphData.metadata?.metaArea || ''

                  processedGraphs++

                  if (metaAreaString) {
                    graphsWithMetaAreas++
                    // Parse meta areas and add to set
                    const metaAreas = metaAreaString
                      .split('#')
                      .map((area) => area.trim())
                      .filter((area) => area.length > 0)

                    console.log(`Graph ${graph.id} meta areas:`, metaAreas)
                    metaAreas.forEach((area) => metaAreasSet.add(area))
                  } else {
                    console.log(`Graph ${graph.id} has no meta areas`)
                  }
                }
              } catch (error) {
                console.warn(`Error fetching graph ${graph.id}:`, error)
              }
            }

            // Convert set to array and update the store (same as BrandingModal)
            const allMetaAreas = Array.from(metaAreasSet).sort()
            console.log('=== FINAL RESULTS ===')
            console.log('Processed graphs:', processedGraphs, 'of', data.results.length)
            console.log('Graphs with meta areas:', graphsWithMetaAreas)
            console.log('Unique meta areas found:', allMetaAreas.length)
            console.log('All meta areas:', allMetaAreas)
            console.log('User role for comparison:', this.userRole)

            // Role-based validation for Superadmins
            if (this.userRole === 'Superadmin') {
              console.log('🔍 SUPERADMIN CHECK - You should see ALL system meta areas')
              console.log('Expected: Many meta areas from all users across the system')
              console.log('Actual count:', allMetaAreas.length)

              if (allMetaAreas.length < 10) {
                console.warn('⚠️  WARNING: Superadmin getting suspiciously few meta areas!')
                console.warn('This might indicate content filtering is still being applied')
              } else {
                console.log('✅ Good: Superadmin getting comprehensive meta area list')
              }
            }

            // Compare with existing store data to detect if filtering is still happening
            const existingMetaAreas = this.portfolioStore.allMetaAreas || []
            if (existingMetaAreas.length > 0 && allMetaAreas.length > 0) {
              console.log('Comparison with existing store data:')
              console.log('Previous count:', existingMetaAreas.length)
              console.log('New count:', allMetaAreas.length)

              const newAreas = allMetaAreas.filter((area) => !existingMetaAreas.includes(area))
              const removedAreas = existingMetaAreas.filter((area) => !allMetaAreas.includes(area))

              if (newAreas.length > 0) {
                console.log('✅ New meta areas found:', newAreas)
              }
              if (removedAreas.length > 0) {
                console.log('⚠️  Previously available meta areas no longer found:', removedAreas)
              }
              if (
                newAreas.length === 0 &&
                removedAreas.length === 0 &&
                allMetaAreas.length === existingMetaAreas.length
              ) {
                console.log(
                  '⚠️  WARNING: Exact same results as before - filtering might still be applied',
                )
              }
            }

            // Update portfolio store with all meta areas
            this.portfolioStore.setAllMetaAreas(allMetaAreas)

            // Initialize filtered results for autocomplete
            this.filteredAvailableMetaAreas = [...allMetaAreas]
            console.log('🔄 Initialized filtered meta areas for autocomplete')
          }
        } else {
          console.error('Failed to fetch system graphs:', response.status, response.statusText)
        }
      } catch (error) {
        console.error('Error loading meta areas:', error)
      }
    },

    // DEBUG: Manual test method for comparing meta area results (call from browser console)
    async testMetaAreaLoading() {
      console.log('=== MANUAL META AREA TEST ===')

      // Test 1: Current approach (should bypass filtering)
      console.log('TEST 1: Current approach (without x-original-hostname)')
      await this.loadMetaAreasAsync()
      const unfiltered = [...this.availableMetaAreas]

      console.log('TEST 1 Results:', unfiltered.length, 'meta areas')
      console.log('Sample areas:', unfiltered.slice(0, 10))

      // Test 2: Simulated filtered approach (for comparison)
      console.log('TEST 2: For comparison - what hostname filtering would look like')
      try {
        const response = await fetch('https://knowledge.vegvisr.org/getknowgraphs', {
          headers: {
            'Content-Type': 'application/json',
            'x-original-hostname': window.location.hostname, // This would trigger filtering
          },
        })

        if (response.ok) {
          const data = await response.json()
          console.log('With hostname filtering - graphs returned:', data.results?.length || 0)
        }
      } catch (error) {
        console.log('Filtered test failed (expected):', error.message)
      }

      console.log('=== TEST COMPLETE ===')
      console.log('If you see different results, the fix is working!')

      return {
        unfilteredCount: unfiltered.length,
        unfilteredSample: unfiltered.slice(0, 10),
        userRole: this.userRole,
        hostname: window.location.hostname,
      }
    },

    // DEBUG: Test autocomplete functionality (call from browser console)
    testAutocomplete(searchTerm = 'A') {
      console.log('=== TESTING AUTOCOMPLETE ===')
      console.log('Search term:', searchTerm)
      console.log('Available meta areas:', this.availableMetaAreas.length)
      console.log('Current filtered results:', this.filteredAvailableMetaAreas.length)

      // Simulate user input
      this.newSubscriptionInput = searchTerm
      this.onSubscriptionInput()

      console.log('After filtering:')
      console.log('- Dropdown visible:', this.showMetaAreaDropdown)
      console.log('- Filtered results:', this.filteredAvailableMetaAreas.length)
      console.log('- Sample results:', this.filteredAvailableMetaAreas.slice(0, 5))

      return {
        searchTerm,
        availableCount: this.availableMetaAreas.length,
        filteredCount: this.filteredAvailableMetaAreas.length,
        dropdownVisible: this.showMetaAreaDropdown,
        sampleResults: this.filteredAvailableMetaAreas.slice(0, 5),
      }
    },

    // Subscription Modal Methods
    openSubscriptionModal() {
      // Load meta areas asynchronously in background if not already loaded
      if (this.availableMetaAreas.length === 0) {
        this.loadMetaAreasAsync()
      }
      // Open modal immediately without waiting
      this.showSubscriptionModal = true
    },

    closeSubscriptionModal() {
      console.log('🚪 Closing subscription modal')
      this.showSubscriptionModal = false
      this.selectedSubscriptionType = 'meta_area'
      this.newSubscriptionInput = ''
      this.newSelectedSubscriptions = []
      this.filteredAvailableMetaAreas = []
      this.showMetaAreaDropdown = false
      this.subscriptionError = ''
      this.subscriptionSuccess = ''
      console.log('🚪 Modal closed, all states reset')
    },

    onSubscriptionInput() {
      const input = this.newSubscriptionInput.toLowerCase()
      console.log('🔍 Autocomplete input:', input)
      console.log('Available meta areas count:', this.availableMetaAreas.length)

      if (input === '#') {
        this.filteredAvailableMetaAreas = [...this.availableMetaAreas]
        this.showMetaAreaDropdown = true
        console.log('📋 Showing all meta areas:', this.filteredAvailableMetaAreas.length)
        return
      }

      let query = input
      if (input.startsWith('#')) {
        query = input.slice(1)
      }

      this.filteredAvailableMetaAreas = this.availableMetaAreas.filter((metaArea) =>
        metaArea.toLowerCase().includes(query),
      )
      this.showMetaAreaDropdown = this.filteredAvailableMetaAreas.length > 0
      console.log(
        '🔍 Filtered results for "' + query + '":',
        this.filteredAvailableMetaAreas.length,
      )
      console.log('Sample results:', this.filteredAvailableMetaAreas.slice(0, 5))
    },

    onSubscriptionFocus() {
      console.log('🎯 Focus event - input value:', this.newSubscriptionInput)
      console.log('Available meta areas on focus:', this.availableMetaAreas.length)

      if (this.newSubscriptionInput === '#' || this.newSubscriptionInput === '') {
        this.filteredAvailableMetaAreas = [...this.availableMetaAreas]
        this.showMetaAreaDropdown = this.availableMetaAreas.length > 0
        console.log('📋 Focus: showing all meta areas')
      } else {
        this.onSubscriptionInput()
      }
    },

    hideSubscriptionDropdown() {
      console.log('👋 Blur event - hiding dropdown after delay')
      // Longer timeout to allow for mousedown.prevent to work
      setTimeout(() => {
        this.showMetaAreaDropdown = false
        console.log('👋 Dropdown hidden after timeout')
      }, 300)
    },

    selectSubscriptionMetaArea(metaArea) {
      console.log('✅ Selecting meta area:', metaArea)

      if (
        !this.newSelectedSubscriptions.includes(metaArea) &&
        !this.isAlreadySubscribed(metaArea)
      ) {
        this.newSelectedSubscriptions.push(metaArea)
        console.log('✅ Added to selections:', this.newSelectedSubscriptions)
      } else {
        console.log('⚠️ Meta area already selected or subscribed:', metaArea)
      }

      this.newSubscriptionInput = ''
      this.filteredAvailableMetaAreas = []
      this.showMetaAreaDropdown = false
      console.log('✅ Dropdown closed, input cleared')
    },

    removeSelectedSubscription(metaArea) {
      const index = this.newSelectedSubscriptions.indexOf(metaArea)
      if (index > -1) {
        this.newSelectedSubscriptions.splice(index, 1)
      }
    },

    isAlreadySubscribed(metaArea) {
      return this.currentSubscriptions.some(
        (sub) => sub.target_id === metaArea || sub.target_title === metaArea,
      )
    },

    async createNewSubscriptions() {
      if (!this.canCreateSubscription) return

      this.isCreatingSubscriptions = true
      this.subscriptionError = ''
      this.subscriptionSuccess = ''

      try {
        const results = []

        if (this.selectedSubscriptionType === 'meta_area') {
          // Handle meta area subscriptions
          for (const metaArea of this.newSelectedSubscriptions) {
            const subscriptionData = {
              email: this.email,
              subscription_type: 'meta_area',
              target_id: metaArea,
              target_title: metaArea,
              subscribed_at: new Date().toISOString(),
            }

            const response = await fetch(
              'https://subscription-worker.torarnehave.workers.dev/subscribe',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${this.userStore.token}`,
                },
                body: JSON.stringify(subscriptionData),
              },
            )

            const data = await response.json()
            results.push({
              target: metaArea,
              success: data.success,
              error: data.error,
            })
          }
        } else {
          // Handle system-level subscriptions (system_events, all_content, user_activity)
          const subscriptionTypeLabels = {
            system_events: 'System Events',
            all_content: 'All Content Updates',
            user_activity: 'User Activity',
          }

          const subscriptionData = {
            email: this.email,
            subscription_type: this.selectedSubscriptionType,
            target_id: this.selectedSubscriptionType,
            target_title: subscriptionTypeLabels[this.selectedSubscriptionType],
            subscribed_at: new Date().toISOString(),
          }

          const response = await fetch(
            'https://subscription-worker.torarnehave.workers.dev/subscribe',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.userStore.token}`,
              },
              body: JSON.stringify(subscriptionData),
            },
          )

          const data = await response.json()
          results.push({
            target: subscriptionTypeLabels[this.selectedSubscriptionType],
            success: data.success,
            error: data.error,
          })
        }

        const successful = results.filter((r) => r.success)
        const failed = results.filter((r) => !r.success)

        if (successful.length > 0) {
          this.subscriptionSuccess = `Successfully subscribed to: ${successful.map((s) => s.target).join(', ')}`

          // Refresh user data to show new subscriptions
          await this.fetchUserData()
          this.loadCurrentSubscriptions()

          // Clear selections after delay
          setTimeout(() => {
            this.closeSubscriptionModal()
          }, 2000)
        }

        if (failed.length > 0) {
          this.subscriptionError = `Failed to subscribe to: ${failed.map((f) => f.target).join(', ')}`
        }
      } catch (error) {
        console.error('Error creating subscriptions:', error)
        this.subscriptionError = 'Network error. Please try again.'
      } finally {
        this.isCreatingSubscriptions = false
      }
    },

    async unsubscribeFromMetaArea(subscription) {
      if (!confirm(`Are you sure you want to unsubscribe from ${subscription.target_title}?`)) {
        return
      }

      this.isUnsubscribing = true

      try {
        // Call unsubscribe API (assuming there's an unsubscribe endpoint)
        const response = await fetch(
          `https://subscription-worker.torarnehave.workers.dev/unsubscribe`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.userStore.token}`,
            },
            body: JSON.stringify({
              email: this.email,
              subscription_id: subscription.id,
              unsubscribe_token: subscription.unsubscribe_token,
            }),
          },
        )

        const data = await response.json()

        if (data.success) {
          // Remove from local list
          const index = this.currentSubscriptions.findIndex((sub) => sub.id === subscription.id)
          if (index > -1) {
            this.currentSubscriptions.splice(index, 1)
          }

          this.saveMessage = `Successfully unsubscribed from ${subscription.target_title}`
          this.isSaving = true

          // Refresh user data
          await this.fetchUserData()
          this.loadCurrentSubscriptions()

          setTimeout(() => {
            this.isSaving = false
            this.saveMessage = ''
          }, 2000)
        } else {
          alert(`Failed to unsubscribe: ${data.error || 'Unknown error'}`)
        }
      } catch (error) {
        console.error('Error unsubscribing:', error)
        alert('Network error. Please try again.')
      } finally {
        this.isUnsubscribing = false
      }
    },
  },
}
</script>

<style scoped>
.saving-message-animated {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 2000;
  background: #fffbe6;
  color: #856404;
  border: 1px solid #ffe066;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  animation: fadeIn 0.3s;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Subscription Modal Styles */
.autocomplete-container {
  position: relative;
}

.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 1050;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  /* Prevent scroll from triggering blur on parent input */
  user-select: none;
}

/* Improve scrolling experience */
.suggestions-dropdown::-webkit-scrollbar {
  width: 6px;
}

.suggestions-dropdown::-webkit-scrollbar-thumb {
  background-color: #ccc;
  border-radius: 3px;
}

.suggestions-dropdown::-webkit-scrollbar-track {
  background-color: #f1f1f1;
}

.autocomplete-container {
  position: relative;
}

.suggestion-item {
  padding: 0.5rem 1rem;
  cursor: pointer;
  border-bottom: 1px solid #f8f9fa;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.suggestion-item:hover {
  background-color: #f8f9fa;
}

.suggestion-item.disabled {
  opacity: 0.6;
  cursor: default;
}

.suggestion-item.disabled:hover {
  background-color: transparent;
}

.selected-subscriptions {
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 0.5rem;
  background-color: #f8f9fa;
}

.selected-subscriptions .badge {
  font-size: 0.85em;
  display: inline-flex;
  align-items: center;
}

.subscription-type-card {
  transition: all 0.2s ease;
}

.subscription-type-card:hover {
  background-color: #f8f9fa !important;
  border-color: #007bff !important;
}

.subscription-type-card.bg-light {
  background-color: #e3f2fd !important;
  border-color: #007bff !important;
}

.subscription-info ul li {
  margin-bottom: 0.25rem;
}

.notification-toggle .form-check-input:checked {
  background-color: #ffffff;
  border-color: #ffffff;
}

.notification-toggle .form-check-input {
  background-color: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
}

.notification-toggle .form-check-input:focus {
  box-shadow: 0 0 0 0.2rem rgba(255, 255, 255, 0.25);
}
.mystmkra-secret-section {
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 8px;
  padding: 1rem;
}
</style>
