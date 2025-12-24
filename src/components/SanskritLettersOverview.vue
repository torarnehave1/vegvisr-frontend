<template>
  <div class="sanskrit-overview">
    <div class="sanskrit-overview__header">
      <h2>Sanskrit Letters Overview</h2>
      <p>Browse all vowels and consonants.</p>
    </div>

    <div v-if="loading" class="sanskrit-overview__loading">
      Loading letters...
    </div>

    <div v-else class="sanskrit-overview__content">
      <section class="sanskrit-overview__section">
        <div class="sanskrit-overview__section-header">
          <h3>Vowels</h3>
          <span class="sanskrit-overview__count">{{ vowels.length }}</span>
        </div>
        <div class="sanskrit-overview__grid">
          <div
            v-for="letter in vowels"
            :key="letter.id"
            class="sanskrit-overview__card"
            :class="{ 'sanskrit-overview__card--has-audio': hasAudio(letter) }"
            role="button"
            tabindex="0"
            @click="playLetter(letter)"
            @keydown.enter.prevent="playLetter(letter)"
          >
            <div class="sanskrit-overview__devanagari">{{ letter.devanagari }}</div>
            <div class="sanskrit-overview__romanization">{{ letter.romanization }}</div>
            <div class="sanskrit-overview__difficulty">Level {{ letter.difficulty_level }}</div>
            <div v-if="hasAudio(letter)" class="sanskrit-overview__audio-indicator">🔊</div>
            <div v-if="hasAudio(letter)" class="sanskrit-overview__play-hint">Click to play</div>
          </div>
        </div>
      </section>

      <section class="sanskrit-overview__section">
        <div class="sanskrit-overview__section-header">
          <h3>Consonants</h3>
          <span class="sanskrit-overview__count">{{ consonants.length }}</span>
        </div>
        <div class="sanskrit-overview__grid">
          <div
            v-for="letter in consonants"
            :key="letter.id"
            class="sanskrit-overview__card"
            :class="{ 'sanskrit-overview__card--has-audio': hasAudio(letter) }"
            role="button"
            tabindex="0"
            @click="playLetter(letter)"
            @keydown.enter.prevent="playLetter(letter)"
          >
            <div class="sanskrit-overview__devanagari">{{ letter.devanagari }}</div>
            <div class="sanskrit-overview__romanization">{{ letter.romanization }}</div>
            <div class="sanskrit-overview__difficulty">Level {{ letter.difficulty_level }}</div>
            <div v-if="hasAudio(letter)" class="sanskrit-overview__audio-indicator">🔊</div>
            <div v-if="hasAudio(letter)" class="sanskrit-overview__play-hint">Click to play</div>
          </div>
        </div>
      </section>
    </div>
    <div v-if="playbackError" class="sanskrit-overview__status">
      {{ playbackError }}
    </div>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue';
import { useSanskritLearnerStore } from '@/stores/sanskritLearner';

export default {
  name: 'SanskritLettersOverview',
  setup() {
    const store = useSanskritLearnerStore();
    const recordings = ref([]);
    const playbackError = ref('');
    const audioPlayer = ref(null);

    const loading = computed(() => store.sanskritLoading);
    const vowels = computed(() => store.sanskritLetters.filter((l) => l.category === 'vowel'));
    const consonants = computed(() => store.sanskritLetters.filter((l) => l.category === 'consonant'));
    const buildSlug = (value) => {
      return String(value || '')
        .toLowerCase()
        .trim()
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
        .replace(/[śṣ]/g, 'sh')
        .replace(/ṃ/g, 'm')
        .replace(/ḥ/g, 'h')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-');
    };

    const getTags = (recording) => recording?.metadata?.tags || recording?.tags || [];

    const audioMap = computed(() => {
      const map = {};
      const letters = store.sanskritLetters || [];
      if (!letters.length || !recordings.value.length) return map;

      letters.forEach((letter) => {
        const slug = buildSlug(letter.romanization || letter.id);
        const matches = recordings.value.filter((recording) => getTags(recording).includes(slug));
        if (!matches.length) return;
        const shortMatch = matches.find((recording) => getTags(recording).includes('short'));
        map[slug] = shortMatch || matches[0];
      });

      return map;
    });

    const fetchRecordings = async () => {
      try {
        playbackError.value = '';
        const response = await fetch(
          'https://audio-portfolio-worker.torarnehave.workers.dev/list-recordings-public?tag=sanskrit&limit=500',
        );

        if (!response.ok) {
          throw new Error(`Failed to load recordings: ${response.statusText}`);
        }

        const data = await response.json();
        recordings.value = data.recordings || [];
      } catch (error) {
        playbackError.value = error.message;
        recordings.value = [];
      }
    };

    const hasAudio = (letter) => {
      const slug = buildSlug(letter.romanization || letter.id);
      return Boolean(audioMap.value[slug]?.r2Url);
    };

    const playLetter = async (letter) => {
      const slug = buildSlug(letter.romanization || letter.id);
      const recording = audioMap.value[slug];
      const url = recording?.r2Url;

      if (!url) {
        playbackError.value = 'No published audio found for this letter yet.';
        return;
      }

      try {
        playbackError.value = '';
        if (!audioPlayer.value) {
          audioPlayer.value = new Audio();
        }
        if (audioPlayer.value.src !== url) {
          audioPlayer.value.src = url;
        }
        await audioPlayer.value.play();
      } catch (error) {
        playbackError.value = error.message || 'Failed to play audio.';
      }
    };

    onMounted(async () => {
      if (!store.sanskritLetters.length) {
        await store.fetchSanskritLetters();
      }
      await fetchRecordings();
    });

    return {
      loading,
      vowels,
      consonants,
      playbackError,
      hasAudio,
      playLetter,
    };
  },
};
</script>

<style scoped>
.sanskrit-overview {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  font-family: sans-serif;
}

.sanskrit-overview__header {
  text-align: center;
  margin-bottom: 30px;
}

.sanskrit-overview__header h2 {
  margin: 0 0 10px 0;
  color: #333;
}

.sanskrit-overview__header p {
  margin: 0;
  color: #666;
}

.sanskrit-overview__loading {
  text-align: center;
  padding: 50px;
  color: #666;
}

.sanskrit-overview__section {
  margin-bottom: 30px;
}

.sanskrit-overview__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 15px;
}

.sanskrit-overview__section-header h3 {
  margin: 0;
  color: #333;
}

.sanskrit-overview__count {
  background: #4caf50;
  color: white;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
}

.sanskrit-overview__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.sanskrit-overview__card {
  border: 2px solid #eee;
  border-radius: 10px;
  padding: 12px;
  text-align: center;
  background: white;
  transition: transform 0.2s, border-color 0.2s;
  position: relative;
  cursor: pointer;
}

.sanskrit-overview__card:hover {
  transform: translateY(-2px);
  border-color: #4caf50;
}

.sanskrit-overview__card--has-audio {
  border-color: #cdeccf;
}

.sanskrit-overview__devanagari {
  font-size: 36px;
  font-weight: bold;
  color: #333;
  margin-bottom: 6px;
}

.sanskrit-overview__romanization {
  font-size: 16px;
  color: #555;
}

.sanskrit-overview__difficulty {
  margin-top: 6px;
  font-size: 12px;
  color: #888;
}

.sanskrit-overview__audio-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 14px;
}

.sanskrit-overview__play-hint {
  margin-top: 8px;
  font-size: 11px;
  color: #2e7d32;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.sanskrit-overview__status {
  margin-top: 16px;
  text-align: center;
  color: #b00020;
}
</style>
