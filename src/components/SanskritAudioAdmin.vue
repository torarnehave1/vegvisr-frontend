<template>
  <div class="sanskrit-audio-admin">
    <div class="sanskrit-audio-admin__header">
      <h2>🔊 Sanskrit Audio Admin</h2>
      <p>Upload letter audio to the Audio Portfolio with proper metadata.</p>
    </div>

    <div v-if="!userStore.email" class="alert">
      Please log in to upload audio.
    </div>

    <div v-else class="sanskrit-audio-admin__form">
      <label class="form-label">Sanskrit Letters</label>
      <div class="letters-grid">
        <button
          v-for="letter in letters"
          :key="letter.id"
          type="button"
          class="letter-card"
          :class="{ active: selectedLetterId === letter.id }"
          @click="selectLetter(letter)"
        >
          <div class="letter-devanagari">{{ letter.devanagari }}</div>
          <div class="letter-romanization">{{ letter.romanization }}</div>
          <div class="letter-category">
            {{ letter.category === 'vowel' ? 'Vowel' : 'Consonant' }}
          </div>
        </button>
      </div>

      <div v-if="selectedLetter" class="letter-details">
        <div class="letter-description">
          <strong>{{ selectedLetter.devanagari }} — {{ selectedLetter.romanization }}</strong>
          <span class="letter-description__meta">
            {{ selectedLetter.category === 'vowel' ? 'Vowel' : 'Consonant' }}
          </span>
        </div>
        <div class="letter-description__text">
          {{ selectedLetter.category === 'vowel'
            ? `This is a vowel (${selectedLetter.devanagari}) in Sanskrit.`
            : `This is a consonant (${selectedLetter.devanagari}) in Sanskrit.` }}
        </div>
      </div>

      <label class="form-label">Variant</label>
      <input
        v-model="variant"
        type="text"
        class="form-control"
        placeholder="e.g., short, long, aspirated"
      />

      <label class="form-label">Speaker</label>
      <input
        v-model="speaker"
        type="text"
        class="form-control"
        placeholder="e.g., teacher01"
      />

      <label class="form-label">Notes (optional)</label>
      <textarea
        v-model="notes"
        class="form-control"
        rows="3"
        placeholder="Recording notes or context"
      ></textarea>

      <label class="form-label">Audio File</label>
      <input
        type="file"
        accept="audio/*"
        class="form-control"
        @change="handleFileChange"
      />
      <small v-if="selectedLetter" class="file-preview">
        File name preview: <code>{{ fileNamePreview }}</code>
      </small>

      <div class="button-row">
        <button
          class="btn btn-primary"
          :disabled="!canSubmit || isUploading"
          @click="uploadAudio"
        >
          {{ isUploading ? 'Uploading...' : 'Upload Audio' }}
        </button>
        <span v-if="statusMessage" :class="['status', statusType]">
          {{ statusMessage }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useSanskritLearnerStore } from '@/stores/sanskritLearner'
import { useUserStore } from '@/stores/userStore'

const NORWEGIAN_WORKER_URL = 'https://norwegian-transcription-worker.torarnehave.workers.dev'
const AUDIO_PORTFOLIO_URL = 'https://audio-portfolio-worker.torarnehave.workers.dev/save-recording'

const store = useSanskritLearnerStore()
const userStore = useUserStore()

const selectedLetterId = ref('')
const variant = ref('short')
const speaker = ref('')
const notes = ref('')
const audioFile = ref(null)
const audioDuration = ref(0)
const isUploading = ref(false)
const statusMessage = ref('')
const statusType = ref('info')

const letters = computed(() => store.sanskritLetters || [])
const selectedLetter = computed(
  () => letters.value.find((l) => l.id === selectedLetterId.value) || null,
)

const canSubmit = computed(() => {
  return Boolean(userStore.email && selectedLetter.value && audioFile.value)
})

const buildSlug = (value) => {
  if (!value) return ''
  const ascii = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/ā/g, 'aa')
    .replace(/ī/g, 'ii')
    .replace(/ū/g, 'uu')
    .replace(/ṛ/g, 'ri')
    .replace(/ṝ/g, 'rii')
    .replace(/ḷ/g, 'li')
    .replace(/ḹ/g, 'lii')
    .replace(/ṅ/g, 'ng')
    .replace(/ñ/g, 'ny')
    .replace(/ṭ/g, 't')
    .replace(/ḍ/g, 'd')
    .replace(/ṇ/g, 'n')
    .replace(/ś/g, 'sh')
    .replace(/ṣ/g, 'sh')
    .replace(/ṃ/g, 'm')
    .replace(/ḥ/g, 'h')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return ascii
}

const handleFileChange = (event) => {
  const file = event.target.files?.[0]
  audioFile.value = file || null
  audioDuration.value = 0

  if (file) {
    const audio = new Audio()
    audio.src = URL.createObjectURL(file)
    audio.addEventListener('loadedmetadata', () => {
      audioDuration.value = Math.round(audio.duration)
      URL.revokeObjectURL(audio.src)
    })
  }
}

const selectLetter = (letter) => {
  selectedLetterId.value = letter.id
  if (!variant.value) {
    variant.value = 'short'
  }
}

const fileNamePreview = computed(() => {
  if (!selectedLetter.value || !audioFile.value) return ''
  const letterSlug = buildSlug(selectedLetter.value.romanization || selectedLetter.value.id)
  const speakerSlug = buildSlug(speaker.value || 'unknown')
  const variantSlug = buildSlug(variant.value || 'default')
  const fileExt = audioFile.value.name.split('.').pop() || 'wav'
  return `sanskrit_${letterSlug}_${variantSlug}_${speakerSlug}.${fileExt}`
})

const uploadAudio = async () => {
  if (!canSubmit.value || !audioFile.value || !selectedLetter.value) return

  isUploading.value = true
  statusMessage.value = ''

  try {
    const letterSlug = buildSlug(selectedLetter.value.romanization || selectedLetter.value.id)
    const speakerSlug = buildSlug(speaker.value || 'unknown')
    const variantSlug = buildSlug(variant.value || 'default')
    const fileExt = audioFile.value.name.split('.').pop() || 'wav'
    const fileName = `sanskrit_${letterSlug}_${variantSlug}_${speakerSlug}_${Date.now()}.${fileExt}`

    const uploadResponse = await fetch(`${NORWEGIAN_WORKER_URL}/upload`, {
      method: 'POST',
      headers: {
        'X-File-Name': fileName,
      },
      body: audioFile.value,
    })

    if (!uploadResponse.ok) {
      const uploadError = await uploadResponse.json().catch(() => ({}))
      throw new Error(uploadError.error || `Upload failed: ${uploadResponse.status}`)
    }

    const uploadResult = await uploadResponse.json()

    const recordingData = {
      userEmail: userStore.email,
      fileName,
      displayName: `${selectedLetter.value.devanagari} ${selectedLetter.value.romanization} (${variant.value || 'default'})`,
      fileSize: audioFile.value.size,
      duration: audioDuration.value || 0,

      r2Key: uploadResult.r2Key,
      r2Url: uploadResult.audioUrl,

      transcriptionText: notes.value || '',

      category: 'Sanskrit Letter Audio',
      tags: [
        'sanskrit',
        'letter',
        letterSlug,
        variantSlug,
        speakerSlug,
      ],

      audioFormat: audioFile.value.type.split('/')[1] || fileExt,
      aiService: 'none',
      aiModel: 'none',
      processingTime: 0,

      metadata: {
        letter_id: selectedLetter.value.id,
        letter_devanagari: selectedLetter.value.devanagari,
        letter_romanization: selectedLetter.value.romanization,
        variant: variant.value || 'default',
        speaker: speaker.value || 'unknown',
        notes: notes.value || '',
      },
    }

    const saveResponse = await fetch(AUDIO_PORTFOLIO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Email': userStore.email,
      },
      body: JSON.stringify(recordingData),
    })

    if (!saveResponse.ok) {
      const saveError = await saveResponse.json().catch(() => ({}))
      throw new Error(saveError.error || `Portfolio save failed: ${saveResponse.status}`)
    }

    statusType.value = 'success'
    statusMessage.value = '✅ Audio uploaded and saved to portfolio.'

    audioFile.value = null
    notes.value = ''
  } catch (error) {
    statusType.value = 'error'
    statusMessage.value = error.message
  } finally {
    isUploading.value = false
    setTimeout(() => {
      statusMessage.value = ''
    }, 4000)
  }
}

onMounted(async () => {
  if (!store.sanskritLetters.length) {
    await store.fetchSanskritLetters()
  }
})
</script>

<style scoped>
.sanskrit-audio-admin {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
  font-family: sans-serif;
}

.sanskrit-audio-admin__header {
  text-align: center;
  margin-bottom: 20px;
}

.sanskrit-audio-admin__header h2 {
  margin: 0 0 8px 0;
  color: #333;
}

.sanskrit-audio-admin__header p {
  margin: 0;
  color: #666;
}

.sanskrit-audio-admin__form {
  display: grid;
  gap: 12px;
}

.letters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
}

.letter-card {
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px;
  background: white;
  cursor: pointer;
  text-align: center;
  transition: border-color 0.2s, transform 0.2s;
}

.letter-card:hover {
  border-color: #4caf50;
  transform: translateY(-2px);
}

.letter-card.active {
  border-color: #ef4444;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
}

.letter-devanagari {
  font-size: 28px;
  font-weight: 700;
  color: #222;
}

.letter-romanization {
  font-size: 14px;
  color: #555;
}

.letter-category {
  margin-top: 4px;
  font-size: 12px;
  color: #777;
}

.letter-details {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px;
  background: #f9fafb;
}

.letter-description {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.letter-description__meta {
  font-size: 12px;
  color: #666;
  background: #e5e7eb;
  padding: 2px 8px;
  border-radius: 999px;
}

.letter-description__text {
  margin-top: 6px;
  color: #555;
}

.form-label {
  font-weight: 600;
  color: #444;
}

.form-control {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.button-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}

.btn {
  padding: 10px 16px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
}

.btn-primary {
  background: #4caf50;
  color: white;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status {
  font-size: 14px;
}

.status.success {
  color: #2e7d32;
}

.status.error {
  color: #c62828;
}

.file-preview {
  color: #555;
}

.alert {
  padding: 12px 16px;
  border-radius: 8px;
  background: #fff3cd;
  color: #856404;
  text-align: center;
}
</style>
