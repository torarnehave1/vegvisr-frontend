<template>
  <div class="sanskrit-overview">
    <div class="sanskrit-overview__header">
      <h2>Sanskrit Letters Overview</h2>
      <p>Browse all vowels and consonants.</p>
      <div class="sanskrit-overview__actions">
        <button
          type="button"
          class="sanskrit-overview__toggle"
          @click="showDevanagari = !showDevanagari"
        >
          {{ showDevanagari ? 'Hide Sanskrit letters' : 'Show Sanskrit letters' }}
        </button>
        <button
          type="button"
          class="sanskrit-overview__toggle"
          @click="showRomanization = !showRomanization"
        >
          {{ showRomanization ? 'Hide romanization' : 'Show romanization' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="sanskrit-overview__loading">
      Loading letters...
    </div>

    <div v-else class="sanskrit-overview__content">
      <details class="sanskrit-overview__basics" open>
        <summary>Basic terms</summary>
        <div class="sanskrit-overview__basics-body">
          <p><strong>Svarah</strong> are vowels that can stand on their own.</p>
          <p><strong>Vyanjana</strong> are consonants that combine with vowels to form syllables.</p>
          <p>
            <strong>Ayogavaha</strong> are special final sounds like anusvara (m) and
            visarga (h).
          </p>
          <p>Tip: tap a card with the speaker icon to hear a recording.</p>
        </div>
      </details>
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
            <div v-if="showDevanagari" class="sanskrit-overview__devanagari">
              {{ letter.devanagari }}
            </div>
            <div v-if="showRomanization" class="sanskrit-overview__romanization">
              {{ letter.romanization }}
            </div>
            <div class="sanskrit-overview__difficulty">Level {{ letter.difficulty_level }}</div>
            <div v-if="hasAudio(letter)" class="sanskrit-overview__audio-indicator">🔊</div>
            <div v-if="hasAudio(letter)" class="sanskrit-overview__play-hint">Click to play</div>
          </div>
        </div>
      </section>

      <section v-if="finalSounds.length" class="sanskrit-overview__section">
        <div class="sanskrit-overview__section-header">
          <h3>Final sounds</h3>
          <span class="sanskrit-overview__count">{{ finalSounds.length }}</span>
        </div>
        <div class="sanskrit-overview__grid">
          <div
            v-for="letter in finalSounds"
            :key="letter.id"
            class="sanskrit-overview__card"
            :class="{ 'sanskrit-overview__card--has-audio': hasAudio(letter) }"
            role="button"
            tabindex="0"
            @click="playLetter(letter)"
            @keydown.enter.prevent="playLetter(letter)"
          >
            <div v-if="showDevanagari" class="sanskrit-overview__devanagari">
              {{ letter.devanagari }}
            </div>
            <div v-if="showRomanization" class="sanskrit-overview__romanization">
              {{ letter.romanization }}
            </div>
            <div class="sanskrit-overview__difficulty">Level {{ letter.difficulty_level }}</div>
            <div v-if="hasAudio(letter)" class="sanskrit-overview__audio-indicator">🔊</div>
            <div v-if="hasAudio(letter)" class="sanskrit-overview__play-hint">Click to play</div>
          </div>
        </div>
      </section>

      <section class="sanskrit-overview__section">
        <div class="sanskrit-overview__section-header">
          <h3>Consonants</h3>
          <span class="sanskrit-overview__count">{{ consonantsByVarga.length }}</span>
        </div>
        <div class="sanskrit-overview__varga-container">
          <template v-for="(letter, index) in consonantsByVarga" :key="letter.id">
            <!-- Varga label row -->
            <div v-if="getVargaName(index)" class="sanskrit-overview__varga-label">
              {{ getVargaName(index) }}
            </div>
            <div
              class="sanskrit-overview__card"
              :class="{ 'sanskrit-overview__card--has-audio': hasAudio(letter) }"
              role="button"
              tabindex="0"
              @click="playLetter(letter)"
              @keydown.enter.prevent="playLetter(letter)"
            >
              <div v-if="showDevanagari" class="sanskrit-overview__devanagari">
                {{ letter.devanagari }}
              </div>
              <div v-if="showRomanization" class="sanskrit-overview__romanization">
                {{ letter.romanization }}
              </div>
              <div class="sanskrit-overview__difficulty">Level {{ letter.difficulty_level }}</div>
              <div v-if="hasAudio(letter)" class="sanskrit-overview__audio-indicator">🔊</div>
              <div v-if="hasAudio(letter)" class="sanskrit-overview__play-hint">Click to play</div>
            </div>
          </template>
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
    const showDevanagari = ref(true);
    const showRomanization = ref(true);

    const loading = computed(() => store.sanskritLoading);
    const sortById = (letters) =>
      [...letters].sort((a, b) => Number(a.id) - Number(b.id));

    const isFinalCategory = (category) =>
      ['final', 'final-sound', 'final_sounds', 'avslutningslyder', 'ayogavaha'].includes(
        String(category || '').toLowerCase(),
      );

    const vowels = computed(() =>
      sortById(store.sanskritLetters.filter((l) => l.category === 'vowel')),
    );
    const finalSounds = computed(() =>
      sortById(store.sanskritLetters.filter((l) => isFinalCategory(l.category))),
    );
    const consonants = computed(() =>
      sortById(store.sanskritLetters.filter((l) => l.category === 'consonant')),
    );

    // Traditional Sanskrit varga order for consonants (5x5 arrangement)
    const vargaOrder = [
      // Kavarga (gutturals)
      'ka', 'kha', 'ga', 'gha', 'ṅa',
      // Cavarga (palatals)
      'ca', 'cha', 'ja', 'jha', 'ña',
      // Ṭavarga (retroflexes)
      'ṭa', 'ṭha', 'ḍa', 'ḍha', 'ṇa',
      // Tavarga (dentals)
      'ta', 'tha', 'da', 'dha', 'na',
      // Pavarga (labials)
      'pa', 'pha', 'ba', 'bha', 'ma',
      // Antastha (semivowels)
      'ya', 'ra', 'la', 'va',
      // Ūṣman (sibilants and aspirate)
      'śa', 'ṣa', 'sa', 'ha',
    ];

    // Group consonants by varga (5 per row for the main 25, then others)
    const consonantsByVarga = computed(() => {
      const allConsonants = consonants.value;
      const ordered = [];
      const used = new Set();

      // First, add consonants in varga order
      vargaOrder.forEach((roman) => {
        const match = allConsonants.find(
          (c) => c.romanization?.toLowerCase() === roman.toLowerCase()
        );
        if (match) {
          ordered.push(match);
          used.add(match.id);
        }
      });

      // Add any remaining consonants not in the standard order
      allConsonants.forEach((c) => {
        if (!used.has(c.id)) {
          ordered.push(c);
        }
      });

      return ordered;
    });

    // Get varga name for display
    const getVargaName = (index) => {
      if (index === 0) return 'Kavarga (Gutturals)';
      if (index === 5) return 'Cavarga (Palatals)';
      if (index === 10) return 'Ṭavarga (Retroflexes)';
      if (index === 15) return 'Tavarga (Dentals)';
      if (index === 20) return 'Pavarga (Labials)';
      if (index === 25) return 'Antastha (Semivowels)';
      if (index === 29) return 'Ūṣman (Sibilants)';
      return null;
    };
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

    const matchesLetter = (letter, recording) => {
      const meta = recording?.metadata || {};
      if (meta.letter_id != null) {
        return String(meta.letter_id) === String(letter.id);
      }

      const romanization = meta.letter_romanization || meta.romanization;
      if (romanization) {
        return buildSlug(romanization) === buildSlug(letter.romanization || letter.id);
      }

      const tags = getTags(recording);
      const slug = buildSlug(letter.romanization || letter.id);
      return tags.includes(slug);
    };

    const audioMap = computed(() => {
      const map = {};
      const letters = store.sanskritLetters || [];
      if (!letters.length || !recordings.value.length) return map;

      letters.forEach((letter) => {
        const slug = buildSlug(letter.romanization || letter.id);
        const matches = recordings.value.filter((recording) => matchesLetter(letter, recording));
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
      finalSounds,
      consonants,
      consonantsByVarga,
      getVargaName,
      playbackError,
      hasAudio,
      playLetter,
      showDevanagari,
      showRomanization,
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

.sanskrit-overview__actions {
  margin-top: 12px;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
}

.sanskrit-overview__toggle {
  border: 1px solid #cfcfcf;
  background: #f7f7f7;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
}

.sanskrit-overview__toggle:hover {
  border-color: #4caf50;
  color: #2e7d32;
}

.sanskrit-overview__loading {
  text-align: center;
  padding: 50px;
  color: #666;
}

.sanskrit-overview__section {
  margin-bottom: 30px;
}

.sanskrit-overview__basics {
  background: #f4f7f2;
  border: 1px solid #dde7d7;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 20px;
}

.sanskrit-overview__basics summary {
  cursor: pointer;
  font-weight: 600;
  color: #2e7d32;
}

.sanskrit-overview__basics-body {
  margin-top: 10px;
  font-size: 13px;
  color: #444;
  line-height: 1.5;
}

.sanskrit-overview__basics-body p {
  margin: 0 0 8px 0;
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

.sanskrit-overview__varga-container {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.sanskrit-overview__varga-label {
  grid-column: 1 / -1;
  font-weight: 600;
  color: #2e7d32;
  padding: 12px 0 6px 0;
  border-bottom: 2px solid #e8f5e9;
  margin-bottom: 4px;
  font-size: 14px;
}

.sanskrit-overview__varga-label:first-child {
  padding-top: 0;
}

@media (max-width: 700px) {
  .sanskrit-overview__varga-container {
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
  }

  .sanskrit-overview__varga-container .sanskrit-overview__card {
    padding: 8px 4px;
  }

  .sanskrit-overview__varga-container .sanskrit-overview__devanagari {
    font-size: 24px;
  }

  .sanskrit-overview__varga-container .sanskrit-overview__romanization {
    font-size: 12px;
  }

  .sanskrit-overview__varga-container .sanskrit-overview__difficulty,
  .sanskrit-overview__varga-container .sanskrit-overview__play-hint {
    display: none;
  }
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
