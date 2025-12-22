<template>
  <div class="sanskrit-learner">
    <div class="sanskrit-learner__header">
      <h2>Sanskrit Letter Learning</h2>
      <div class="sanskrit-learner__stats">
        <span>Progress: {{ progressPercentage }}%</span>
        <span>Mastered: {{ masteredLetters }}</span>
        <span>Streak: {{ currentStreak }}</span>
      </div>
    </div>

    <div class="sanskrit-learner__mode-selector">
      <button
        @click="selectMode('recognition')"
        :class="{ active: currentMode === 'recognition' }"
        class="sanskrit-learner__mode-btn"
      >
        Recognition
      </button>
      <button
        @click="selectMode('writing')"
        :class="{ active: currentMode === 'writing' }"
        class="sanskrit-learner__mode-btn"
      >
        Writing
      </button>
      <button
        @click="selectMode('reading')"
        :class="{ active: currentMode === 'reading' }"
        class="sanskrit-learner__mode-btn"
      >
        Reading
      </button>
    </div>

    <div class="sanskrit-learner__content">
      <SanskritLetterRecognition v-if="currentMode === 'recognition'" />
      <SanskritLetterWriter v-else-if="currentMode === 'writing'" />
      <SanskritLetterReader v-else-if="currentMode === 'reading'" />
    </div>

    <SanskritProgressDashboard />
    <SanskritAchievementPopup />
  </div>
</template>

<script>
import { computed, onMounted } from 'vue';
import { useSanskritLearnerStore } from '@/stores/sanskritLearner';
import SanskritLetterRecognition from './SanskritLetterRecognition.vue';
import SanskritLetterWriter from './SanskritLetterWriter.vue';
import SanskritLetterReader from './SanskritLetterReader.vue';
import SanskritProgressDashboard from './SanskritProgressDashboard.vue';
import SanskritAchievementPopup from './SanskritAchievementPopup.vue';

export default {
  name: 'SanskritLearner',
  components: {
    SanskritLetterRecognition,
    SanskritLetterWriter,
    SanskritLetterReader,
    SanskritProgressDashboard,
    SanskritAchievementPopup
  },
  setup() {
    const store = useSanskritLearnerStore();

    const currentMode = computed(() => store.sanskritCurrentMode);
    const progressPercentage = computed(() => store.sanskritProgressPercentage);
    const masteredLetters = computed(() => store.sanskritMasteredLetters);
    const currentStreak = computed(() => store.sanskritCurrentStreak);

    const selectMode = async (mode) => {
      await store.endSanskritSession();
      await store.startSanskritSession(mode);
      store.setNextSanskritLetter();
    };

    onMounted(async () => {
      await store.fetchSanskritLetters();
      await store.loadSanskritProgress();
      await store.startSanskritSession('recognition');
      store.setNextSanskritLetter();
    });

    return {
      currentMode,
      progressPercentage,
      masteredLetters,
      currentStreak,
      selectMode
    };
  }
};
</script>

<style scoped>
.sanskrit-learner {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: sans-serif;
}

.sanskrit-learner__header {
  text-align: center;
  margin-bottom: 30px;
}

.sanskrit-learner__header h2 {
  margin: 0 0 15px 0;
  color: #333;
}

.sanskrit-learner__stats {
  display: flex;
  justify-content: center;
  gap: 20px;
  font-size: 14px;
  color: #666;
}

.sanskrit-learner__mode-selector {
  display: flex;
  gap: 10px;
  margin-bottom: 30px;
  justify-content: center;
}

.sanskrit-learner__mode-btn {
  padding: 10px 20px;
  border: 2px solid #ddd;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.sanskrit-learner__mode-btn:hover {
  border-color: #999;
}

.sanskrit-learner__mode-btn.active {
  background: #4CAF50;
  color: white;
  border-color: #4CAF50;
}

.sanskrit-learner__content {
  min-height: 400px;
}
</style>
