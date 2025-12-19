<template>
  <div class="tutorial-card" :class="{ highlighted, completed: isCompleted }">
    <div class="card-header">
      <span class="difficulty-badge" :class="tutorial.difficulty">
        {{ difficultyLabel }}
      </span>
      <span v-if="isCompleted" class="completed-badge">✓</span>
    </div>

    <h4 class="card-title">{{ tutorial.title }}</h4>
    <p class="card-description">{{ tutorial.description }}</p>

    <div class="card-meta">
      <span class="meta-item">
        <span class="meta-icon">📍</span>
        {{ tutorial.steps?.length || 0 }} steps
      </span>
      <span class="meta-item">
        <span class="meta-icon">⏱️</span>
        ~{{ estimatedTime }} min
      </span>
    </div>

    <div v-if="hasProgress && !isCompleted" class="progress-bar">
      <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      <span class="progress-text">{{ progressPercent }}%</span>
    </div>

    <button
      class="start-btn"
      @click="$emit('start', tutorial.id)"
    >
      {{ buttonLabel }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useTeacherStore } from '../../stores/teacherStore'

const props = defineProps({
  tutorial: {
    type: Object,
    required: true
  },
  highlighted: {
    type: Boolean,
    default: false
  }
})

defineEmits(['start'])

const teacherStore = useTeacherStore()

const progress = computed(() => teacherStore.getProgressForTutorial(props.tutorial.id))
const hasProgress = computed(() => progress.value?.currentStep > 0)
const isCompleted = computed(() => progress.value?.completed)

const progressPercent = computed(() => {
  if (!progress.value || !props.tutorial.steps?.length) return 0
  return Math.round((progress.value.currentStep / props.tutorial.steps.length) * 100)
})

const estimatedTime = computed(() => {
  const steps = props.tutorial.steps?.length || 0
  return Math.max(1, Math.ceil(steps * 0.5)) // ~30 sec per step
})

const difficultyLabel = computed(() => {
  const labels = {
    beginner: '🌱 Beginner',
    intermediate: '🌿 Intermediate',
    advanced: '🌳 Advanced'
  }
  return labels[props.tutorial.difficulty] || labels.beginner
})

const buttonLabel = computed(() => {
  if (isCompleted.value) return '↻ Review'
  if (hasProgress.value) return '▶ Continue'
  return '▶ Start'
})
</script>

<style scoped>
.tutorial-card {
  background: var(--teacher-surface, #f8fafc);
  border: 1px solid var(--teacher-border, #e2e8f0);
  border-radius: 12px;
  padding: 16px;
  transition: border-color 0.2s, transform 0.2s;
}

.tutorial-card:hover {
  border-color: var(--teacher-primary, #6366f1);
  transform: translateY(-2px);
}

.tutorial-card.highlighted {
  border-color: var(--teacher-warning, #f59e0b);
  background: rgba(245, 158, 11, 0.1);
}

.tutorial-card.completed {
  opacity: 0.8;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.difficulty-badge {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(99, 102, 241, 0.2);
  color: var(--teacher-primary, #6366f1);
}

.difficulty-badge.beginner {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.difficulty-badge.intermediate {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.difficulty-badge.advanced {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.completed-badge {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--teacher-success, #22c55e);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.card-title {
  margin: 0 0 8px 0;
  font-size: 15px;
  color: var(--teacher-text, #e4e4e7);
}

.card-description {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: var(--teacher-text-dim, #a1a1aa);
  line-height: 1.4;
}

.card-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--teacher-text-dim, #a1a1aa);
}

.meta-icon {
  font-size: 14px;
}

.progress-bar {
  position: relative;
  height: 6px;
  background: var(--teacher-border, #3f3f5a);
  border-radius: 3px;
  margin-bottom: 12px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--teacher-primary, #6366f1);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  position: absolute;
  right: 0;
  top: -18px;
  font-size: 11px;
  color: var(--teacher-text-dim, #a1a1aa);
}

.start-btn {
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: var(--teacher-primary, #6366f1);
  color: white;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.2s, transform 0.1s;
}

.start-btn:hover {
  background: var(--teacher-secondary, #4f46e5);
}

.start-btn:active {
  transform: scale(0.98);
}

.tutorial-card.completed .start-btn {
  background: var(--teacher-surface, #f8fafc);
  border: 1px solid var(--teacher-border, #e2e8f0);
  color: var(--teacher-text, #1e293b);
}
</style>
