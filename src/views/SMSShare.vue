<template>
  <div class="sms-share-page">
    <div class="container">
      <div class="sms-share-card">
        <!-- Header -->
        <div class="page-header">
          <h1>
            <i class="bi bi-chat-dots-fill"></i>
            Share via SMS
          </h1>
          <p class="subtitle">Send this knowledge graph to your contacts</p>
        </div>

        <!-- Tab Navigation -->
        <ul class="nav nav-tabs mb-4">
          <li class="nav-item">
            <a
              class="nav-link"
              :class="{ active: activeTab === 'send' }"
              @click="activeTab = 'send'"
              href="#"
            >
              <i class="bi bi-send"></i> Send SMS
            </a>
          </li>
          <li class="nav-item">
            <a
              class="nav-link"
              :class="{ active: activeTab === 'lists' }"
              @click="activeTab = 'lists'; loadLists()"
              href="#"
            >
              <i class="bi bi-people"></i> Lists
            </a>
          </li>
          <li class="nav-item">
            <a
              class="nav-link"
              :class="{ active: activeTab === 'history' }"
              @click="activeTab = 'history'; loadHistory()"
              href="#"
            >
              <i class="bi bi-clock-history"></i> History
            </a>
          </li>
        </ul>

        <!-- Send SMS Tab -->
        <div v-if="activeTab === 'send'">

        <!-- Share Content Preview -->
        <div class="content-preview">
          <label class="form-label">Message Preview</label>
          <textarea
            v-model="shareContent"
            class="form-control message-preview"
            rows="6"
          ></textarea>
          <small class="text-muted">
            {{ messageCharCount }} characters
          </small>
        </div>

        <!-- Recipients -->
        <div class="recipients-section">
          <label class="form-label">
            Recipients
            <span class="badge bg-primary ms-2">{{ recipients.length }}</span>
          </label>

          <!-- Load from List -->
          <div class="mb-3">
            <label class="form-label small">Quick Load from List</label>
            <div class="input-group">
              <select v-model="selectedListForSend" class="form-select" @change="loadListRecipientsForSend">
                <option value="">-- Select a list --</option>
                <option v-for="list in recipientLists" :key="list.id" :value="list.id">
                  {{ list.name }}
                </option>
              </select>
              <button
                @click="loadListRecipientsForSend"
                class="btn btn-outline-primary"
                :disabled="!selectedListForSend"
              >
                <i class="bi bi-download"></i> Load
              </button>
            </div>
          </div>

          <!-- Add Recipient Input -->
          <div class="add-recipient-group">
            <input
              v-model="newRecipient"
              type="tel"
              class="form-control"
              placeholder="Enter phone number (e.g., 4790914095)"
              @keyup.enter="addRecipient"
            />
            <button @click="addRecipient" class="btn btn-primary" :disabled="!newRecipient.trim()">
              <i class="bi bi-plus-circle"></i> Add
            </button>
          </div>

          <!-- Recipients List -->
          <div v-if="recipients.length > 0" class="recipients-list">
            <div v-for="(recipient, index) in recipients" :key="index" class="recipient-item">
              <i class="bi bi-phone"></i>
              <span class="phone-number">{{ formatPhoneNumber(recipient) }}</span>
              <button @click="removeRecipient(index)" class="btn-remove" title="Remove">
                <i class="bi bi-x-circle"></i>
              </button>
            </div>
          </div>
          <div v-else class="empty-recipients">
            <i class="bi bi-inbox"></i>
            <p>No recipients added yet</p>
          </div>
        </div>

        <!-- Optional: Sender Name -->
        <div class="sender-section">
          <label class="form-label">
            Sender Name <span class="text-muted">(optional, max 11 characters)</span>
          </label>
          <input
            v-model="senderName"
            type="text"
            class="form-control"
            placeholder="e.g., Vegvisr"
            maxlength="11"
          />
          <small class="text-muted">
            {{ senderName.length }}/11 characters
          </small>
        </div>

        <!-- Action Buttons -->
        <div class="action-buttons">
          <button @click="sendSMS" class="btn btn-success btn-lg" :disabled="!canSend || sending">
            <span v-if="!sending">
              <i class="bi bi-send-fill"></i> Send SMS
            </span>
            <span v-else>
              <span class="spinner-border spinner-border-sm me-2"></span>
              Sending...
            </span>
          </button>
          <button @click="goBack" class="btn btn-outline-secondary btn-lg">
            <i class="bi bi-arrow-left"></i> Back
          </button>
        </div>

        <!-- Status Messages -->
        <div v-if="successMessage" class="alert alert-success mt-3" role="alert">
          <i class="bi bi-check-circle-fill"></i> {{ successMessage }}
        </div>
        <div v-if="errorMessage" class="alert alert-danger mt-3" role="alert">
          <i class="bi bi-exclamation-triangle-fill"></i> {{ errorMessage }}
        </div>

        <!-- Cost Estimate -->
        <div v-if="recipients.length > 0" class="cost-estimate">
          <i class="bi bi-info-circle"></i>
          Estimated cost: ~${{ (recipients.length * 0.68).toFixed(2) }} for {{ recipients.length }} recipient{{ recipients.length > 1 ? 's' : '' }}
        </div>
        </div>

        <!-- Lists Tab -->
        <div v-if="activeTab === 'lists'">
          <!-- Create New List -->
          <div class="mb-4">
            <h5>Create New List</h5>
            <div class="input-group mb-3">
              <input
                v-model="newListName"
                type="text"
                class="form-control"
                placeholder="List name (e.g., Family, Work, Friends)"
                @keyup.enter="createList"
              />
              <input
                v-model="newListDescription"
                type="text"
                class="form-control"
                placeholder="Description (optional)"
                @keyup.enter="createList"
              />
              <button @click="createList" class="btn btn-primary" :disabled="!newListName.trim()">
                <i class="bi bi-plus-circle"></i> Create
              </button>
            </div>
          </div>

          <!-- Lists Display -->
          <div v-if="loadingLists" class="text-center py-5">
            <div class="spinner-border text-primary"></div>
            <p class="mt-2">Loading lists...</p>
          </div>

          <div v-else-if="recipientLists.length === 0" class="text-center py-5 text-muted">
            <i class="bi bi-inbox" style="font-size: 3rem; display: block; margin-bottom: 1rem;"></i>
            <p>No recipient lists yet. Create one above!</p>
          </div>

          <div v-else class="lists-container">
            <div v-for="list in recipientLists" :key="list.id" class="list-card">
              <div class="list-header">
                <div>
                  <h6>{{ list.name }}</h6>
                  <small class="text-muted">{{ list.description }}</small>
                </div>
                <div class="list-actions">
                  <button @click="selectList(list)" class="btn btn-sm btn-outline-primary">
                    <i class="bi bi-eye"></i> View
                  </button>
                  <button @click="deleteList(list.id)" class="btn btn-sm btn-outline-danger">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Selected List Recipients -->
          <div v-if="selectedList" class="mt-4">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h5>{{ selectedList.name }} - Recipients</h5>
              <button @click="selectedList = null; loadFromList = false" class="btn btn-sm btn-secondary">
                <i class="bi bi-x"></i> Close
              </button>
            </div>

            <!-- Add Recipient to List -->
            <div class="input-group mb-3">
              <input
                v-model="newRecipientName"
                type="text"
                class="form-control"
                placeholder="Name (optional)"
              />
              <input
                v-model="newRecipientPhone"
                type="tel"
                class="form-control"
                placeholder="Phone number"
                @keyup.enter="addRecipientToList"
              />
              <button @click="addRecipientToList" class="btn btn-success" :disabled="!newRecipientPhone.trim()">
                <i class="bi bi-plus"></i> Add
              </button>
            </div>

            <!-- Import from CSV/Excel -->
            <div class="import-section mb-3">
              <h6>Import from File</h6>
              <div class="input-group">
                <input
                  ref="fileInput"
                  type="file"
                  class="form-control"
                  accept=".csv,.xlsx,.xls"
                  @change="handleFileUpload"
                />
                <button @click="importFile" class="btn btn-info" :disabled="!selectedFile || importing">
                  <span v-if="!importing">
                    <i class="bi bi-upload"></i> Import
                  </span>
                  <span v-else>
                    <span class="spinner-border spinner-border-sm me-1"></span> Importing...
                  </span>
                </button>
              </div>
              <small class="text-muted">
                Supported: CSV, Excel (.xlsx, .xls). Expected columns: Name, Phone (or Phone Number)
              </small>
            </div>

            <!-- Load to Send Form -->
            <button @click="loadRecipientsToSend" class="btn btn-primary mb-3">
              <i class="bi bi-arrow-right"></i> Load All to Send Form
            </button>

            <!-- Recipients in Selected List -->
            <div v-if="listRecipients.length === 0" class="text-muted text-center py-3">
              No recipients in this list yet
            </div>
            <div v-else class="list-recipients">
              <div v-for="recipient in listRecipients" :key="recipient.id" class="recipient-card">
                <div>
                  <strong>{{ recipient.name || 'No name' }}</strong>
                  <br />
                  <small>{{ recipient.phone_number }}</small>
                </div>
                <button @click="deleteRecipient(recipient.id)" class="btn btn-sm btn-outline-danger">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- History Tab -->
        <div v-if="activeTab === 'history'">
          <div v-if="loadingHistory" class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">Loading SMS history...</p>
          </div>

          <div v-else-if="historyError" class="alert alert-danger">
            <i class="bi bi-exclamation-triangle"></i> {{ historyError }}
          </div>

          <div v-else-if="smsHistory.length === 0" class="text-center py-5 text-muted">
            <i class="bi bi-inbox" style="font-size: 3rem; display: block; margin-bottom: 1rem;"></i>
            <p>No SMS history found</p>
          </div>

          <div v-else>
            <!-- History List -->
            <div class="history-list">
              <div
                v-for="(sms, index) in smsHistory"
                :key="index"
                class="history-item"
              >
                <div class="history-header">
                  <span class="history-date">
                    <i class="bi bi-calendar3"></i>
                    {{ formatDate(sms.date) }}
                  </span>
                  <span class="history-status" :class="getStatusClass(sms.status)">
                    {{ sms.status }}
                  </span>
                </div>
                <div class="history-recipient">
                  <i class="bi bi-phone"></i>
                  <strong>To:</strong> {{ sms.to }}
                </div>
                <div class="history-message">
                  {{ sms.body }}
                </div>
                <div class="history-footer">
                  <span v-if="sms.from" class="history-from">
                    <i class="bi bi-person"></i> From: {{ sms.from }}
                  </span>
                  <span v-if="sms.price" class="history-price">
                    <i class="bi bi-currency-dollar"></i> {{ sms.price }} {{ sms.currency || 'NOK' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Pagination -->
            <div v-if="totalPages > 1" class="pagination-controls">
              <button
                @click="loadHistory(currentPage - 1)"
                :disabled="currentPage === 1"
                class="btn btn-outline-primary"
              >
                <i class="bi bi-chevron-left"></i> Previous
              </button>
              <span class="page-info">
                Page {{ currentPage }} of {{ totalPages }}
              </span>
              <button
                @click="loadHistory(currentPage + 1)"
                :disabled="currentPage === totalPages"
                class="btn btn-outline-primary"
              >
                Next <i class="bi bi-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

// Reactive data
const activeTab = ref('send')
const shareContent = ref('')
const recipients = ref([])
const newRecipient = ref('')
const senderName = ref('')
const sending = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

// Lists data
const recipientLists = ref([])
const loadingLists = ref(false)
const newListName = ref('')
const newListDescription = ref('')
const selectedList = ref(null)
const listRecipients = ref([])
const newRecipientName = ref('')
const newRecipientPhone = ref('')
const loadFromList = ref(false)
const selectedFile = ref(null)
const fileInput = ref(null)
const importing = ref(false)
const selectedListForSend = ref('')

// History data
const smsHistory = ref([])
const loadingHistory = ref(false)
const historyError = ref('')
const currentPage = ref(1)
const totalPages = ref(1)

// Computed
const messageCharCount = computed(() => shareContent.value.length)

const canSend = computed(() => {
  return recipients.value.length > 0 && shareContent.value.trim() !== '' && !sending.value
})

// Methods
const addRecipient = () => {
  const phone = newRecipient.value.trim()
  if (phone && !recipients.value.includes(phone)) {
    recipients.value.push(phone)
    newRecipient.value = ''
  }
}

const removeRecipient = (index) => {
  recipients.value.splice(index, 1)
}

const formatPhoneNumber = (phone) => {
  // Simple formatting for display
  if (phone.startsWith('47')) {
    return `+${phone.substring(0, 2)} ${phone.substring(2, 5)} ${phone.substring(5)}`
  }
  return phone
}

const sendSMS = async () => {
  if (!canSend.value) return

  sending.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const payload = {
      to: recipients.value,
      message: shareContent.value,
    }

    // Add sender name if provided
    if (senderName.value.trim()) {
      payload.sender = senderName.value.trim()
    }

    console.log('Sending SMS:', payload)

    const response = await fetch('https://sms-gateway.torarnehave.workers.dev/api/sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    console.log('SMS API Response Status:', response.status, response.statusText)

    const result = await response.json()

    console.log('SMS API Response Data:', result)

    if (result.success) {
      successMessage.value = `Successfully sent SMS to ${result.successfulSends} recipient${result.successfulSends > 1 ? 's' : ''}!`

      // Show cost information if available from ClickSend
      if (result.totalPrice) {
        const currency = result.currency || 'NOK'
        successMessage.value += ` Cost: ${result.totalPrice.toFixed(2)} ${currency}`
      }

      // Clear recipients after successful send
      setTimeout(() => {
        recipients.value = []
      }, 3000)
    } else {
      console.error('SMS sending failed:', result)
      errorMessage.value = result.error?.message || 'Failed to send SMS. Please try again.'
    }

  } catch (error) {
    console.error('Error sending SMS:', error)
    errorMessage.value = 'Network error. Please check your connection and try again.'
  } finally {
    console.log('SMS sending completed. Sending:', sending.value)
    sending.value = false
  }
}

const goBack = () => {
  router.back()
}

// ===== LISTS FUNCTIONS =====

const loadLists = async () => {
  if (!userStore.email) return

  loadingLists.value = true
  try {
    const response = await fetch(
      `https://sms-gateway.torarnehave.workers.dev/api/lists?userEmail=${encodeURIComponent(userStore.email)}`
    )
    const result = await response.json()
    if (result.success) {
      recipientLists.value = result.lists || []
    }
  } catch (error) {
    console.error('Error loading lists:', error)
  } finally {
    loadingLists.value = false
  }
}

const createList = async () => {
  if (!newListName.value.trim() || !userStore.email) return

  try {
    const response = await fetch('https://sms-gateway.torarnehave.workers.dev/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail: userStore.email,
        userId: userStore.userId,
        name: newListName.value.trim(),
        description: newListDescription.value.trim()
      })
    })

    const result = await response.json()
    if (result.success) {
      newListName.value = ''
      newListDescription.value = ''
      await loadLists()
    }
  } catch (error) {
    console.error('Error creating list:', error)
  }
}

const deleteList = async (listId) => {
  if (!confirm('Delete this list and all its recipients?')) return

  try {
    await fetch(`https://sms-gateway.torarnehave.workers.dev/api/lists/${listId}`, {
      method: 'DELETE'
    })
    await loadLists()
    if (selectedList.value?.id === listId) {
      selectedList.value = null
    }
  } catch (error) {
    console.error('Error deleting list:', error)
  }
}

const selectList = async (list) => {
  selectedList.value = list
  try {
    const response = await fetch(
      `https://sms-gateway.torarnehave.workers.dev/api/lists/${list.id}/recipients`
    )
    const result = await response.json()
    if (result.success) {
      listRecipients.value = result.recipients || []
    }
  } catch (error) {
    console.error('Error loading recipients:', error)
  }
}

const addRecipientToList = async () => {
  if (!newRecipientPhone.value.trim() || !selectedList.value) return

  try {
    const response = await fetch(
      `https://sms-gateway.torarnehave.workers.dev/api/lists/${selectedList.value.id}/recipients`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRecipientName.value.trim(),
          phoneNumber: newRecipientPhone.value.trim()
        })
      }
    )

    const result = await response.json()
    if (result.success) {
      newRecipientName.value = ''
      newRecipientPhone.value = ''
      await selectList(selectedList.value)
    }
  } catch (error) {
    console.error('Error adding recipient:', error)
  }
}

const deleteRecipient = async (recipientId) => {
  if (!selectedList.value) return

  try {
    await fetch(
      `https://sms-gateway.torarnehave.workers.dev/api/lists/${selectedList.value.id}/recipients/${recipientId}`,
      { method: 'DELETE' }
    )
    await selectList(selectedList.value)
  } catch (error) {
    console.error('Error deleting recipient:', error)
  }
}

const loadRecipientsToSend = () => {
  recipients.value = listRecipients.value.map(r => r.phone_number)
  activeTab.value = 'send'
  successMessage.value = `Loaded ${recipients.value.length} recipients from ${selectedList.value.name}`
  setTimeout(() => { successMessage.value = '' }, 3000)
}

const loadListRecipientsForSend = async () => {
  if (!selectedListForSend.value) return

  try {
    const response = await fetch(`https://sms-gateway.torarnehave.workers.dev/api/sms/lists/${selectedListForSend.value}/recipients`, {
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch recipients')
    }

    const data = await response.json()
    recipients.value = data.map(r => r.phone_number)

    const listName = recipientLists.value.find(l => l.id === selectedListForSend.value)?.name
    successMessage.value = `Loaded ${recipients.value.length} recipients from ${listName}`
    setTimeout(() => { successMessage.value = '' }, 3000)
  } catch (err) {
    errorMessage.value = `Failed to load recipients: ${err.message}`
    setTimeout(() => { errorMessage.value = '' }, 3000)
  }
}

const handleFileUpload = (event) => {
  selectedFile.value = event.target.files[0]
}

const importFile = async () => {
  if (!selectedFile.value || !selectedList.value) return

  importing.value = true
  try {
    const fileName = selectedFile.value.name.toLowerCase()
    let parsedData = []

    if (fileName.endsWith('.csv')) {
      parsedData = await parseCSV(selectedFile.value)
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      parsedData = await parseExcel(selectedFile.value)
    } else {
      alert('Unsupported file format. Please use CSV or Excel files.')
      return
    }

    // Import recipients in batch
    let imported = 0
    for (const recipient of parsedData) {
      if (recipient.phone) {
        try {
          const response = await fetch(
            `https://sms-gateway.torarnehave.workers.dev/api/lists/${selectedList.value.id}/recipients`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: recipient.name || '',
                phoneNumber: recipient.phone
              })
            }
          )
          if ((await response.json()).success) {
            imported++
          }
        } catch (error) {
          console.error('Error importing recipient:', error)
        }
      }
    }

    // Refresh the list
    await selectList(selectedList.value)

    // Clear file input
    selectedFile.value = null
    if (fileInput.value) {
      fileInput.value.value = ''
    }

    alert(`Successfully imported ${imported} out of ${parsedData.length} recipients`)
  } catch (error) {
    console.error('Error importing file:', error)
    alert('Error importing file. Please check the format and try again.')
  } finally {
    importing.value = false
  }
}

const parseCSV = (file) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data.map(row => ({
          name: row.Name || row.name || row.NAME || '',
          phone: row.Phone || row.phone || row.PHONE || row['Phone Number'] || row['phone number'] || ''
        }))
        resolve(data)
      },
      error: (error) => reject(error)
    })
  })
}

const parseExcel = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(firstSheet)

        const parsedData = jsonData.map(row => ({
          name: row.Name || row.name || row.NAME || '',
          phone: row.Phone || row.phone || row.PHONE || row['Phone Number'] || row['phone number'] || ''
        }))

        resolve(parsedData)
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = (error) => reject(error)
    reader.readAsArrayBuffer(file)
  })
}

const loadHistory = async (page = 1) => {
  loadingHistory.value = true
  historyError.value = ''

  try {
    const response = await fetch(
      `https://sms-gateway.torarnehave.workers.dev/api/sms/history?page=${page}&status=all`
    )

    const result = await response.json()

    if (result.success && result.data) {
      const data = result.data
      smsHistory.value = data.data || []
      currentPage.value = data.current_page || page
      totalPages.value = data.last_page || 1
    } else {
      historyError.value = result.error || 'Failed to load SMS history'
    }
  } catch (error) {
    console.error('Error loading SMS history:', error)
    historyError.value = 'Failed to load SMS history. Please try again.'
  } finally {
    loadingHistory.value = false
  }
}

const formatDate = (timestamp) => {
  if (!timestamp) return 'N/A'
  const date = new Date(timestamp * 1000)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getStatusClass = (status) => {
  const statusLower = (status || '').toLowerCase()
  if (statusLower === 'delivered') return 'status-success'
  if (statusLower === 'sent') return 'status-info'
  if (statusLower === 'failed') return 'status-danger'
  return 'status-default'
}

// Load content from URL parameters
onMounted(() => {
  shareContent.value = route.query.content || 'Check out this knowledge graph!'

  // Optionally pre-populate sender name
  senderName.value = 'Vegvisr'

  // Load recipient lists for dropdown in Send tab
  loadLists()
})
</script>

<style scoped>
.sms-share-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem 1rem;
}

.container {
  max-width: 800px;
  margin: 0 auto;
}

.sms-share-card {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.page-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid #f0f0f0;
}

.page-header h1 {
  color: #333;
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.page-header h1 i {
  color: #28a745;
}

.subtitle {
  color: #666;
  font-size: 1.1rem;
  margin: 0;
}

.content-preview {
  margin-bottom: 2rem;
}

.form-label {
  font-weight: 600;
  color: #333;
  margin-bottom: 0.5rem;
  display: block;
}

.message-preview {
  width: 100%;
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 0.95rem;
  line-height: 1.5;
  background-color: #f9f9f9;
  resize: vertical;
}

.recipients-section {
  margin-bottom: 2rem;
}

.add-recipient-group {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.add-recipient-group input {
  flex: 1;
}

.add-recipient-group .btn {
  white-space: nowrap;
}

.recipients-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.recipient-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: white;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
  transition: all 0.2s;
}

.recipient-item:hover {
  border-color: #28a745;
  box-shadow: 0 2px 8px rgba(40, 167, 69, 0.1);
}

.recipient-item i.bi-phone {
  color: #28a745;
  font-size: 1.1rem;
}

.phone-number {
  flex: 1;
  font-weight: 500;
  color: #333;
}

.btn-remove {
  background: none;
  border: none;
  color: #dc3545;
  cursor: pointer;
  padding: 0.25rem;
  font-size: 1.2rem;
  transition: transform 0.2s;
}

.btn-remove:hover {
  transform: scale(1.1);
}

.empty-recipients {
  text-align: center;
  padding: 2rem;
  color: #999;
}

.empty-recipients i {
  font-size: 3rem;
  margin-bottom: 1rem;
  display: block;
}

.sender-section {
  margin-bottom: 2rem;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 2rem;
}

.btn-lg {
  padding: 0.75rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
}

.cost-estimate {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #e7f5ff;
  border-left: 4px solid #007bff;
  border-radius: 6px;
  color: #004085;
  font-size: 0.9rem;
}

.cost-estimate i {
  margin-right: 0.5rem;
}

.cost-estimate i {
  margin-right: 0.5rem;
}

.nav-tabs {
  border-bottom: 2px solid #e0e0e0;
}

.nav-tabs .nav-link {
  color: #666;
  border: none;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  transition: all 0.3s;
}

.nav-tabs .nav-link:hover {
  color: #28a745;
  border-bottom: 2px solid #28a745;
}

.nav-tabs .nav-link.active {
  color: #28a745;
  font-weight: 600;
  border-bottom: 2px solid #28a745;
  background: none;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 650px; /* ~5 items */
  overflow-y: scroll; /* Always show scrollbar */
  padding-right: 0.5rem;
  scrollbar-width: thin; /* For Firefox */
  scrollbar-color: #28a745 #f1f1f1; /* For Firefox */
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
  background: #fafafa;
}

.history-list::-webkit-scrollbar {
  width: 10px;
  display: block; /* Force display */
}

.history-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 5px;
}

.history-list::-webkit-scrollbar-thumb {
  background: #28a745;
  border-radius: 5px;
  border: 2px solid #f1f1f1;
}

.history-list::-webkit-scrollbar-thumb:hover {
  background: #1e7e34;
}

.history-item {
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
  transition: all 0.2s;
}

.history-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-color: #28a745;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e0e0e0;
}

.history-date {
  font-size: 0.9rem;
  color: #666;
}

.history-date i {
  margin-right: 0.25rem;
}

.history-status {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-success {
  background: #d4edda;
  color: #155724;
}

.status-info {
  background: #d1ecf1;
  color: #0c5460;
}

.status-danger {
  background: #f8d7da;
  color: #721c24;
}

.status-default {
  background: #e2e3e5;
  color: #383d41;
}

.history-recipient {
  margin-bottom: 0.75rem;
  color: #333;
  font-size: 0.95rem;
}

.history-recipient i {
  color: #28a745;
  margin-right: 0.5rem;
}

.history-message {
  background: white;
  padding: 0.75rem;
  border-radius: 6px;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
  line-height: 1.5;
  color: #333;
}

.history-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  color: #666;
}

.history-from,
.history-price {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.pagination-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 2px solid #e0e0e0;
}

.page-info {
  font-weight: 600;
  color: #333;
}

.page-info {
  font-weight: 600;
  color: #333;
}

/* Lists Tab Styles */
.lists-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 400px;
  overflow-y: auto;
}

.list-card {
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
  transition: all 0.2s;
}

.list-card:hover {
  border-color: #28a745;
  box-shadow: 0 2px 8px rgba(40, 167, 69, 0.1);
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.list-header h6 {
  margin: 0;
  color: #333;
  font-weight: 600;
}

.list-actions {
  display: flex;
  gap: 0.5rem;
}

.list-recipients {
  max-height: 300px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.recipient-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
}

.recipient-card:hover {
  border-color: #28a745;
}

.import-section {
  background: #f0f8ff;
  border: 1px dashed #007bff;
  border-radius: 8px;
  padding: 1rem;
}

.import-section h6 {
  margin-bottom: 0.75rem;
  color: #007bff;
  font-weight: 600;
}

@media (max-width: 768px) {
  .sms-share-card {
    padding: 1.5rem;
  }

  .page-header h1 {
    font-size: 1.5rem;
  }

  .action-buttons {
    flex-direction: column;
  }

  .btn-lg {
    width: 100%;
  }

  .history-list {
    max-height: 500px; /* ~5 items on mobile */
  }

  .history-footer {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}
</style>
