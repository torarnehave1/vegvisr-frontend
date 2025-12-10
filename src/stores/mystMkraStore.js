import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const WORKER_URL = 'https://mystmkra-worker.torarnehave.workers.dev'

export const useMystMkraStore = defineStore('mystMkra', () => {
  const documents = ref([])
  const currentDocument = ref(null)
  const ready = ref(false)
  const initialized = ref(false)

  const hasDocuments = computed(() => documents.value.length > 0)

  const initialize = async (retries = 3) => {
    if (initialized.value) return
    initialized.value = true

      for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[MystMkraStore] Attempt ${attempt}/${retries}`)

        // Warmup with longer timeout on first attempt
        const healthTimeout = attempt === 1 ? 8000 : 5000
        await Promise.race([
          fetch(`${WORKER_URL}/health`),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), healthTimeout))
        ])

        // Fetch files with timeout - fetch first 20 to match component pagination
        const fetchTimeout = attempt === 1 ? 20000 : 15000
        const res = await Promise.race([
          fetch(`${WORKER_URL}/files?limit=20&offset=0`),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Files fetch timeout')), fetchTimeout))
        ])

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        }

        const data = await res.json()

        const mapped = (data.files || []).map(f => ({
          id: f.id || f._id,
          _id: f._id || f.id,
          ...f,
        }))

        if (mapped.length === 0) {
          console.warn('[MystMkraStore] First fetch returned empty:', data)
        }

        documents.value = mapped
        ready.value = true
        console.log(`[MystMkraStore] Success! Loaded ${mapped.length} documents`)
        return // Success - exit retry loop
      } catch (err) {
        console.error(`[MystMkraStore] Attempt ${attempt} failed:`, err.message)

        if (attempt === retries) {
          // Final attempt failed
          console.error('[MystMkraStore] All retries exhausted')
          documents.value = []
          ready.value = true
          throw err
        }

        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        console.log(`[MystMkraStore] Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  const fetchDocument = async (id) => {
    if (!id) return null

    const cached = documents.value.find((d) => d._id === id || d.id === id)
    if (cached && cached.content) {
      currentDocument.value = cached
      return cached
    }

    try {
      const res = await fetch(`${WORKER_URL}/file/${id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const file = data.file || data

      // Merge back into list so subsequent opens are cached with content
      const merged = { id: file.id || file._id, _id: file._id || file.id, ...file }
      const idx = documents.value.findIndex((d) => d._id === merged._id || d.id === merged.id)
      if (idx >= 0) {
        documents.value[idx] = { ...documents.value[idx], ...merged }
      } else {
        documents.value.unshift(merged)
      }

      currentDocument.value = merged
      return merged
    } catch (err) {
      console.error('[MystMkraStore] fetchDocument failed:', err)
      return null
    }
  }

  const setCurrentDocument = (doc) => {
    currentDocument.value = doc
  }

  return {
    documents,
    currentDocument,
    ready,
    hasDocuments,
    initialize,
    fetchDocument,
    setCurrentDocument
  }
})
