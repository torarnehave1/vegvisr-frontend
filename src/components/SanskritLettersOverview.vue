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
          >
            <div class="sanskrit-overview__devanagari">{{ letter.devanagari }}</div>
            <div class="sanskrit-overview__romanization">{{ letter.romanization }}</div>
            <div class="sanskrit-overview__difficulty">Level {{ letter.difficulty_level }}</div>
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
          >
            <div class="sanskrit-overview__devanagari">{{ letter.devanagari }}</div>
            <div class="sanskrit-overview__romanization">{{ letter.romanization }}</div>
            <div class="sanskrit-overview__difficulty">Level {{ letter.difficulty_level }}</div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script>
import { computed, onMounted } from 'vue';
import { useSanskritLearnerStore } from '@/stores/sanskritLearner';

export default {
  name: 'SanskritLettersOverview',
  setup() {
    const store = useSanskritLearnerStore();

    const loading = computed(() => store.sanskritLoading);
    const vowels = computed(() => store.sanskritLetters.filter((l) => l.category === 'vowel'));
    const consonants = computed(() => store.sanskritLetters.filter((l) => l.category === 'consonant'));

    onMounted(async () => {
      if (!store.sanskritLetters.length) {
        await store.fetchSanskritLetters();
      }
    });

    return {
      loading,
      vowels,
      consonants,
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
}

.sanskrit-overview__card:hover {
  transform: translateY(-2px);
  border-color: #4caf50;
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
</style>
