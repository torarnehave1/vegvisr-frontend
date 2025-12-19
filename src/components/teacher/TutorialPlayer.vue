<template>
  <div class="tutorial-player">
    <!-- Progress Header -->
    <div class="player-header">
      <button class="back-btn" @click="$emit('close')">
        ✕
      </button>
      <div class="step-indicator">
        Step {{ currentStep + 1 }} of {{ totalSteps }}
      </div>
      <div class="progress-dots">
        <span
          v-for="i in totalSteps"
          :key="i"
          class="dot"
          :class="{
            active: i - 1 === currentStep,
            completed: i - 1 < currentStep
          }"
        ></span>
      </div>
    </div>

    <!-- Step Content -->
    <div class="step-content" v-if="currentStepData">
      <!-- Step Title -->
      <h3 class="step-title">
        <span class="step-number">{{ currentStep + 1 }}</span>
        {{ currentStepData.title }}
      </h3>

      <!-- Step Description -->
      <p class="step-description">{{ currentStepData.description }}</p>

      <!-- Action Hint -->
      <div v-if="currentStepData.action" class="action-hint">
        <span class="action-icon">👆</span>
        <span class="action-text">{{ currentStepData.action }}</span>
      </div>

      <!-- Keyboard Shortcut -->
      <div v-if="currentStepData.shortcut" class="shortcut-hint">
        <span class="shortcut-label">Shortcut:</span>
        <kbd class="shortcut-key">{{ currentStepData.shortcut }}</kbd>
      </div>

      <!-- Image/GIF -->
      <div v-if="currentStepData.image" class="step-media">
        <img :src="currentStepData.image" :alt="currentStepData.title" />
      </div>

      <!-- Audio Controls -->
      <div class="audio-controls" v-if="teacherStore.settings.voiceEnabled">
        <button
          class="audio-btn"
          :class="{ playing: teacherStore.isPlaying }"
          @click="toggleAudio"
        >
          {{ teacherStore.isPlaying ? '⏹️ Stop' : '🔊 Listen' }}
        </button>
      </div>
    </div>

    <!-- Navigation Footer -->
    <div class="player-footer">
      <button
        class="nav-btn prev-btn"
        :disabled="currentStep === 0"
        @click="teacherStore.prevStep()"
      >
        ← Previous
      </button>
      
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
      
      <button
        class="nav-btn next-btn"
        @click="teacherStore.nextStep()"
      >
        {{ isLastStep ? '✓ Complete' : 'Next →' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useTeacherStore } from '../../stores/teacherStore'

defineEmits(['close'])

const teacherStore = useTeacherStore()

const currentStep = computed(() => teacherStore.currentStep)
const totalSteps = computed(() => teacherStore.totalSteps)
const currentStepData = computed(() => teacherStore.currentStepData)
const progressPercent = computed(() => teacherStore.progressPercent)
const isLastStep = computed(() => teacherStore.isLastStep)

function toggleAudio() {
  if (teacherStore.isPlaying) {
    teacherStore.stopAudio()
  } else if (currentStepData.value?.narration) {
    teacherStore.speak(currentStepData.value.narration)
  }
}
</script>

<style scoped>
.tutorial-player {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 400px;
}

/* Header */
.player-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--teacher-border, #e2e8f0);
  margin-bottom: 16px;
}

.back-btn {
  align-self: flex-end;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--teacher-border, #e2e8f0);
  background: transparent;
  color: var(--teacher-text, #1e293b);
  cursor: pointer;
  font-size: 14px;
}

.back-btn:hover {
  background: var(--teacher-border, #e2e8f0);
}

.step-indicator {
  text-align: center;
  font-size: 13px;
  color: var(--teacher-text-dim, #64748b);
}

.progress-dots {
  display: flex;
  justify-content: center;
  gap: 6px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--teacher-border, #e2e8f0);
  transition: background 0.2s, transform 0.2s;
}

.dot.active {
  background: var(--teacher-primary, #6366f1);
  transform: scale(1.3);
}

.dot.completed {
  background: var(--teacher-success, #22c55e);
}

/* Step Content */
.step-content {
  flex: 1;
  overflow-y: auto;
}

.step-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 12px 0;
  font-size: 16px;
  color: var(--teacher-text, #1e293b);
}

.step-number {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--teacher-primary, #6366f1);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
}

.step-description {
  margin: 0 0 16px 0;
  font-size: 14px;
  color: var(--teacher-text-dim, #64748b);
  line-height: 1.6;
}

.action-hint {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 10px;
  margin-bottom: 12px;
}

.action-icon {
  font-size: 20px;
}

.action-text {
  font-size: 14px;
  color: var(--teacher-text, #1e293b);
  font-weight: 500;
}

.shortcut-hint {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.shortcut-label {
  font-size: 13px;
  color: var(--teacher-text-dim, #64748b);
}

.shortcut-key {
  padding: 6px 12px;
  background: var(--teacher-surface, #f8fafc);
  border: 1px solid var(--teacher-border, #e2e8f0);
  border-radius: 6px;
  font-family: monospace;
  font-size: 13px;
  color: var(--teacher-text, #1e293b);
}

.step-media {
  margin: 16px 0;
  border-radius: 10px;
  overflow: hidden;
}

.step-media img {
  width: 100%;
  height: auto;
  display: block;
}

.audio-controls {
  margin-top: 12px;
}

.audio-btn {
  padding: 10px 20px;
  border: 1px solid var(--teacher-border, #e2e8f0);
  border-radius: 8px;
  background: var(--teacher-surface, #f8fafc);
  color: var(--teacher-text, #1e293b);
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.audio-btn:hover {
  background: var(--teacher-border, #e2e8f0);
}

.audio-btn.playing {
  background: var(--teacher-primary, #6366f1);
  border-color: var(--teacher-primary, #6366f1);
}

/* Footer */
.player-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--teacher-border, #e2e8f0);
  margin-top: 16px;
}

.nav-btn {
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: background 0.2s, opacity 0.2s;
}

.prev-btn {
  background: var(--teacher-surface, #f8fafc);
  color: var(--teacher-text, #1e293b);
}

.prev-btn:hover:not(:disabled) {
  background: var(--teacher-border, #e2e8f0);
}

.prev-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.next-btn {
  background: var(--teacher-primary, #6366f1);
  color: white;
}

.next-btn:hover {
  background: var(--teacher-secondary, #4f46e5);
}

.progress-bar {
  flex: 1;
  height: 4px;
  background: var(--teacher-border, #e2e8f0);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--teacher-primary, #6366f1);
  transition: width 0.3s ease;
}
</style>
