<template>
  <div class="flexbox-cards-container" :class="`flexbox-cards-${columnCount}`">
    <div v-for="(card, index) in cards" :key="index" class="flexbox-card">
      <div v-if="card.image" class="card-image">
        <div v-html="card.image"></div>

        <!-- Add image buttons if user is Superadmin and card has image -->
        <div
          v-if="userStore.loggedIn && userStore.role === 'Superadmin' && card.imageUrl"
          class="image-button-container"
        >
          <button
            class="btn btn-sm btn-outline-primary change-image-btn"
            :data-image-url="card.imageUrl"
            :data-image-alt="`Card ${index + 1} image`"
            :data-image-type="'FLEXBOX-CARDS'"
            :data-image-context="`FLEXBOX-CARDS card ${index + 1}`"
            :data-node-id="props.nodeId"
            :data-node-content="props.nodeContent"
            title="Change this image"
          >
            Change Image
          </button>
          <button
            class="btn btn-sm btn-outline-secondary google-photos-btn"
            :data-image-url="card.imageUrl"
            :data-image-alt="`Card ${index + 1} image`"
            :data-image-type="'FLEXBOX-CARDS'"
            :data-image-context="`FLEXBOX-CARDS card ${index + 1}`"
            :data-node-id="props.nodeId"
            :data-node-content="props.nodeContent"
            title="Search Google Images"
          >
            Google Image
          </button>
        </div>
      </div>

      <h4 v-if="card.title" class="card-title">{{ card.title }}</h4>
      <div v-if="card.text" class="card-text">{{ card.text }}</div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, computed } from 'vue'
import { useUserStore } from '@/stores/userStore'

const props = defineProps({
  content: {
    type: String,
    required: true,
  },
  columnCount: {
    type: Number,
    default: 3,
  },
  nodeId: {
    type: String,
    required: true,
  },
  nodeContent: {
    type: String,
    required: true,
  },
})

const userStore = useUserStore()

const cards = computed(() => {
  const cleanContent = props.content.trim()
  const cards = []
  let currentCard = { title: '', image: '', text: '', imageUrl: '' }
  let cardStarted = false

  const lines = cleanContent
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line)

  for (const line of lines) {
    // Check for markdown title (bold text) - this starts a new card
    const titleMatch = line.match(/^\*\*(.+?)\*\*$/)
    if (titleMatch) {
      // If we have a previous card that was started, save it
      if (cardStarted && (currentCard.title || currentCard.image || currentCard.text)) {
        cards.push({ ...currentCard })
      }
      // Start new card
      currentCard = { title: titleMatch[1], image: '', text: '', imageUrl: '' }
      cardStarted = true
      continue
    }

    // Check for markdown image
    const imageMatch = line.match(/!\[([^\]]*?)\]\(([^)]+)\)/)
    if (imageMatch && cardStarted) {
      const [, altText, url] = imageMatch
      currentCard.image = `<img src="${url}" alt="${altText}" class="card-image">`
      currentCard.imageUrl = url // Store the URL for button functionality
      continue
    }

    // Everything else is text content
    if (line && cardStarted) {
      currentCard.text += (currentCard.text ? ' ' : '') + line
    }
  }

  // Don't forget the last card
  if (cardStarted && (currentCard.title || currentCard.image || currentCard.text)) {
    cards.push(currentCard)
  }

  return cards
})
</script>

<style scoped>
.flexbox-cards-container {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  justify-content: center;
  max-width: 1200px;
  margin: 25px auto;
  padding: 20px;
}

.flexbox-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.flexbox-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.card-image {
  width: 100%;
  margin-bottom: 15px;
  border-radius: 8px;
  overflow: hidden;
}

.card-image :deep(img) {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 8px;
}

.image-button-container {
  margin-top: 8px;
  display: flex;
  justify-content: center;
  gap: 8px;
}

.change-image-btn,
.google-photos-btn {
  font-size: 0.8rem;
  padding: 4px 8px;
}

.card-title {
  font-size: 1.3rem;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 12px;
  line-height: 1.3;
}

.card-text {
  color: #6c757d;
  line-height: 1.6;
  font-size: 0.95rem;
  text-align: left;
  flex-grow: 1;
}

/* Column-specific widths */
.flexbox-cards-1 .flexbox-card {
  flex: 0 1 calc(100% - 40px);
  max-width: calc(100% - 40px);
}

.flexbox-cards-2 .flexbox-card {
  flex: 0 1 calc(50% - 20px);
  max-width: calc(50% - 20px);
}

.flexbox-cards-3 .flexbox-card {
  flex: 0 1 calc(33.333% - 20px);
  max-width: calc(33.333% - 20px);
}

.flexbox-cards-4 .flexbox-card {
  flex: 0 1 calc(25% - 20px);
  max-width: calc(25% - 20px);
}

.flexbox-cards-5 .flexbox-card {
  flex: 0 1 calc(20% - 20px);
  max-width: calc(20% - 20px);
}

.flexbox-cards-6 .flexbox-card {
  flex: 0 1 calc(16.666% - 20px);
  max-width: calc(16.666% - 20px);
}

/* Responsive design */
@media (max-width: 1024px) {
  .flexbox-cards-4 .flexbox-card,
  .flexbox-cards-5 .flexbox-card,
  .flexbox-cards-6 .flexbox-card {
    flex: 0 1 calc(33.333% - 20px);
    max-width: calc(33.333% - 20px);
  }
}

@media (max-width: 768px) {
  .flexbox-cards-container {
    padding: 15px;
  }

  .flexbox-cards-2 .flexbox-card,
  .flexbox-cards-3 .flexbox-card,
  .flexbox-cards-4 .flexbox-card,
  .flexbox-cards-5 .flexbox-card,
  .flexbox-cards-6 .flexbox-card {
    flex: 0 1 calc(50% - 15px);
    max-width: calc(50% - 15px);
  }
}

@media (max-width: 480px) {
  .flexbox-cards-1 .flexbox-card,
  .flexbox-cards-2 .flexbox-card,
  .flexbox-cards-3 .flexbox-card,
  .flexbox-cards-4 .flexbox-card,
  .flexbox-cards-5 .flexbox-card,
  .flexbox-cards-6 .flexbox-card {
    flex: 0 1 100%;
    max-width: 100%;
  }
}
</style>
