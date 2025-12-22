<template>
  <transition name="sanskrit-achievement-fade">
    <div
      v-if="showAchievement"
      class="sanskrit-achievement-popup"
    >
      <div class="sanskrit-achievement-popup__content">
        {{ currentAchievement }}
      </div>
    </div>
  </transition>
</template>

<script>
import { computed } from 'vue';
import { useSanskritLearnerStore } from '@/stores/sanskritLearner';

export default {
  name: 'SanskritAchievementPopup',
  setup() {
    const store = useSanskritLearnerStore();

    const showAchievement = computed(() => store.sanskritShowAchievement);
    const currentAchievement = computed(() => store.sanskritCurrentAchievement);

    return {
      showAchievement,
      currentAchievement
    };
  }
};
</script>

<style scoped>
.sanskrit-achievement-popup {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
}

.sanskrit-achievement-popup__content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px 40px;
  border-radius: 50px;
  font-size: 20px;
  font-weight: bold;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  animation: sanskrit-achievement-bounce 0.5s ease;
}

@keyframes sanskrit-achievement-bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.sanskrit-achievement-fade-enter-active,
.sanskrit-achievement-fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.sanskrit-achievement-fade-enter-from,
.sanskrit-achievement-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}
</style>
