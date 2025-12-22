<template>
  <div class="sanskrit-progress">
    <h3>Your Progress</h3>

    <div class="sanskrit-progress__stats">
      <div class="sanskrit-progress__stat">
        <div class="sanskrit-progress__stat-value">{{ progressPercentage }}%</div>
        <div class="sanskrit-progress__stat-label">Complete</div>
      </div>

      <div class="sanskrit-progress__stat">
        <div class="sanskrit-progress__stat-value">{{ masteredLetters }}</div>
        <div class="sanskrit-progress__stat-label">Mastered</div>
      </div>

      <div class="sanskrit-progress__stat">
        <div class="sanskrit-progress__stat-value">{{ sessionStats.correct }}/{{ sessionStats.total }}</div>
        <div class="sanskrit-progress__stat-label">Today</div>
      </div>
    </div>

    <div class="sanskrit-progress__bar-container">
      <div
        class="sanskrit-progress__bar"
        :style="{ width: progressPercentage + '%' }"
      ></div>
    </div>

    <div class="sanskrit-progress__letters">
      <div
        v-for="letter in letters"
        :key="letter.id"
        class="sanskrit-progress__letter-item"
        :class="getMasteryClass(letter.id)"
        :title="`${letter.devanagari} (${letter.romanization}) - ${getMasteryLevel(letter.id)} stars`"
      >
        {{ letter.devanagari }}
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';
import { useSanskritLearnerStore } from '@/stores/sanskritLearner';

export default {
  name: 'SanskritProgressDashboard',
  setup() {
    const store = useSanskritLearnerStore();

    const letters = computed(() => store.sanskritLetters);
    const progressPercentage = computed(() => store.sanskritProgressPercentage);
    const masteredLetters = computed(() => store.sanskritMasteredLetters);
    const sessionStats = computed(() => store.sanskritSessionStats);

    const getMasteryLevel = (letterId) => {
      const progress = store.sanskritUserProgress[letterId];
      return progress ? progress.mastery_level : 0;
    };

    const getMasteryClass = (letterId) => {
      const level = getMasteryLevel(letterId);
      if (level >= 4) return 'mastered';
      if (level >= 2) return 'learning';
      if (level >= 1) return 'started';
      return 'not-started';
    };

    return {
      letters,
      progressPercentage,
      masteredLetters,
      sessionStats,
      getMasteryLevel,
      getMasteryClass
    };
  }
};
</script>

<style scoped>
.sanskrit-progress {
  margin-top: 40px;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 10px;
}

.sanskrit-progress h3 {
  margin: 0 0 20px 0;
  color: #333;
  text-align: center;
}

.sanskrit-progress__stats {
  display: flex;
  justify-content: space-around;
  margin-bottom: 20px;
}

.sanskrit-progress__stat {
  text-align: center;
}

.sanskrit-progress__stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #4CAF50;
}

.sanskrit-progress__stat-label {
  font-size: 14px;
  color: #666;
}

.sanskrit-progress__bar-container {
  width: 100%;
  height: 20px;
  background: #ddd;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 20px;
}

.sanskrit-progress__bar {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #8BC34A);
  transition: width 0.5s ease;
}

.sanskrit-progress__letters {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
  gap: 8px;
}

.sanskrit-progress__letter-item {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  border-radius: 5px;
  cursor: pointer;
  transition: transform 0.2s;
}

.sanskrit-progress__letter-item:hover {
  transform: scale(1.1);
}

.sanskrit-progress__letter-item.not-started {
  background: #e0e0e0;
  color: #999;
}

.sanskrit-progress__letter-item.started {
  background: #FFE082;
  color: #333;
}

.sanskrit-progress__letter-item.learning {
  background: #81C784;
  color: white;
}

.sanskrit-progress__letter-item.mastered {
  background: #4CAF50;
  color: white;
}
</style>
