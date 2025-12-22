<template>
  <div class="sanskrit-writer">
    <div v-if="loading" class="sanskrit-writer__loading">
      Loading...
    </div>

    <div v-else-if="currentLetter" class="sanskrit-writer__practice">
      <div class="sanskrit-writer__instruction">
        <h3>Practice writing: {{ currentLetter.romanization }}</h3>
        <div class="sanskrit-writer__reference">
          {{ currentLetter.devanagari }}
        </div>
      </div>

      <div class="sanskrit-writer__canvas-container">
        <canvas
          ref="canvas"
          @mousedown="startDrawing"
          @mousemove="draw"
          @mouseup="stopDrawing"
          @mouseleave="stopDrawing"
          @touchstart.prevent="startDrawingTouch"
          @touchmove.prevent="drawTouch"
          @touchend.prevent="stopDrawing"
          class="sanskrit-writer__canvas"
        ></canvas>
      </div>

      <div class="sanskrit-writer__controls">
        <button @click="clearCanvas" class="sanskrit-writer__btn">Clear</button>
        <button @click="submitDrawing" class="sanskrit-writer__btn sanskrit-writer__btn--primary">
          Submit
        </button>
        <button @click="skipLetter" class="sanskrit-writer__btn">Skip</button>
      </div>

      <div v-if="feedback" class="sanskrit-writer__feedback">
        {{ feedback }}
      </div>
    </div>
  </div>
</template>

<script>
import { computed, ref, onMounted, nextTick } from 'vue';
import { useSanskritLearnerStore } from '@/stores/sanskritLearner';

export default {
  name: 'SanskritLetterWriter',
  setup() {
    const store = useSanskritLearnerStore();
    const canvas = ref(null);
    const ctx = ref(null);
    const isDrawing = ref(false);
    const feedback = ref('');

    const loading = computed(() => store.sanskritLoading);
    const currentLetter = computed(() => store.sanskritCurrentLetter);

    const initCanvas = () => {
      if (canvas.value) {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.value.getBoundingClientRect();

        canvas.value.width = rect.width * dpr;
        canvas.value.height = rect.height * dpr;

        ctx.value = canvas.value.getContext('2d');
        ctx.value.scale(dpr, dpr);
        ctx.value.lineCap = 'round';
        ctx.value.lineJoin = 'round';
        ctx.value.lineWidth = 3;
        ctx.value.strokeStyle = '#333';
      }
    };

    const getCoordinates = (e) => {
      const rect = canvas.value.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    const getTouchCoordinates = (e) => {
      const rect = canvas.value.getBoundingClientRect();
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    };

    const startDrawing = (e) => {
      isDrawing.value = true;
      const { x, y } = getCoordinates(e);
      ctx.value.beginPath();
      ctx.value.moveTo(x, y);
    };

    const startDrawingTouch = (e) => {
      isDrawing.value = true;
      const { x, y } = getTouchCoordinates(e);
      ctx.value.beginPath();
      ctx.value.moveTo(x, y);
    };

    const draw = (e) => {
      if (!isDrawing.value) return;
      const { x, y } = getCoordinates(e);
      ctx.value.lineTo(x, y);
      ctx.value.stroke();
    };

    const drawTouch = (e) => {
      if (!isDrawing.value) return;
      const { x, y } = getTouchCoordinates(e);
      ctx.value.lineTo(x, y);
      ctx.value.stroke();
    };

    const stopDrawing = () => {
      isDrawing.value = false;
    };

    const clearCanvas = () => {
      const rect = canvas.value.getBoundingClientRect();
      ctx.value.clearRect(0, 0, rect.width, rect.height);
      feedback.value = '';
    };

    const submitDrawing = async () => {
      // In a real implementation, you'd use ML to check the drawing
      // For now, we'll just mark it as practiced
      feedback.value = 'Great practice! Keep it up!';
      await store.submitSanskritAnswer(currentLetter.value.id, true);

      setTimeout(() => {
        nextLetter();
      }, 1500);
    };

    const skipLetter = () => {
      nextLetter();
    };

    const nextLetter = () => {
      clearCanvas();
      feedback.value = '';
      store.setNextSanskritLetter();
    };

    onMounted(async () => {
      await nextTick();
      initCanvas();
      window.addEventListener('resize', initCanvas);
    });

    return {
      loading,
      currentLetter,
      canvas,
      feedback,
      startDrawing,
      startDrawingTouch,
      draw,
      drawTouch,
      stopDrawing,
      clearCanvas,
      submitDrawing,
      skipLetter
    };
  }
};
</script>

<style scoped>
.sanskrit-writer {
  padding: 20px;
}

.sanskrit-writer__loading {
  text-align: center;
  padding: 50px;
  color: #666;
}

.sanskrit-writer__practice {
  max-width: 600px;
  margin: 0 auto;
}

.sanskrit-writer__instruction {
  text-align: center;
  margin-bottom: 20px;
}

.sanskrit-writer__instruction h3 {
  margin: 0 0 15px 0;
  color: #333;
}

.sanskrit-writer__reference {
  font-size: 80px;
  color: #ccc;
  font-weight: bold;
}

.sanskrit-writer__canvas-container {
  border: 3px solid #ddd;
  border-radius: 10px;
  margin-bottom: 20px;
  background: white;
}

.sanskrit-writer__canvas {
  display: block;
  width: 100%;
  height: 400px;
  cursor: crosshair;
  touch-action: none;
}

.sanskrit-writer__controls {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-bottom: 15px;
}

.sanskrit-writer__btn {
  padding: 10px 20px;
  font-size: 16px;
  border: 2px solid #ddd;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.sanskrit-writer__btn:hover {
  border-color: #999;
}

.sanskrit-writer__btn--primary {
  background: #4CAF50;
  color: white;
  border-color: #4CAF50;
}

.sanskrit-writer__btn--primary:hover {
  background: #45a049;
}

.sanskrit-writer__feedback {
  text-align: center;
  font-size: 18px;
  color: #4CAF50;
  font-weight: bold;
}
</style>
