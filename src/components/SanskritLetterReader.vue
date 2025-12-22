<template>
  <div class="sanskrit-reader">
    <div v-if="loading" class="sanskrit-reader__loading">
      Loading...
    </div>

    <div v-else-if="currentLetter" class="sanskrit-reader__quiz">
      <div class="sanskrit-reader__question">
        <div class="sanskrit-reader__romanization">
          {{ currentLetter.romanization }}
        </div>
        <p>Select the correct Devanagari letter</p>
      </div>

      <div class="sanskrit-reader__options">
        <button
          v-for="option in answerOptions"
          :key="option.id"
          @click="selectAnswer(option)"
          :disabled="answered"
          :class="{
            'sanskrit-reader__option': true,
            'correct': answered && option.id === currentLetter.id,
            'incorrect': answered && selectedAnswer?.id === option.id && option.id !== currentLetter.id
          }"
        >
          {{ option.devanagari }}
        </button>
      </div>

      <div v-if="answered" class="sanskrit-reader__feedback">
        <p :class="{ correct: isCorrect, incorrect: !isCorrect }">
          {{ isCorrect ? '✓ Correct!' : '✗ Incorrect' }}
        </p>
        <button @click="nextQuestion" class="sanskrit-reader__next-btn">
          Next Letter
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, ref } from 'vue';
import { useSanskritLearnerStore } from '@/stores/sanskritLearner';

export default {
  name: 'SanskritLetterReader',
  setup() {
    const store = useSanskritLearnerStore();
    const answered = ref(false);
    const selectedAnswer = ref(null);
    const isCorrect = ref(false);

    const loading = computed(() => store.sanskritLoading);
    const currentLetter = computed(() => store.sanskritCurrentLetter);
    const answerOptions = computed(() => store.sanskritAnswerOptions);

    const selectAnswer = async (option) => {
      if (answered.value) return;

      selectedAnswer.value = option;
      isCorrect.value = option.id === currentLetter.value.id;
      answered.value = true;

      await store.submitSanskritAnswer(currentLetter.value.id, isCorrect.value);
    };

    const nextQuestion = () => {
      answered.value = false;
      selectedAnswer.value = null;
      isCorrect.value = false;
      store.setNextSanskritLetter();
    };

    return {
      loading,
      currentLetter,
      answerOptions,
      answered,
      selectedAnswer,
      isCorrect,
      selectAnswer,
      nextQuestion
    };
  }
};
</script>

<style scoped>
.sanskrit-reader {
  padding: 20px;
}

.sanskrit-reader__loading {
  text-align: center;
  padding: 50px;
  color: #666;
}

.sanskrit-reader__quiz {
  max-width: 500px;
  margin: 0 auto;
}

.sanskrit-reader__question {
  text-align: center;
  margin-bottom: 30px;
}

.sanskrit-reader__romanization {
  font-size: 60px;
  font-weight: bold;
  margin-bottom: 20px;
  color: #333;
  font-family: monospace;
}

.sanskrit-reader__question p {
  font-size: 18px;
  color: #666;
}

.sanskrit-reader__options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 20px;
}

.sanskrit-reader__option {
  padding: 20px;
  font-size: 48px;
  border: 2px solid #ddd;
  background: white;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sanskrit-reader__option:hover:not(:disabled) {
  border-color: #4CAF50;
  transform: translateY(-2px);
}

.sanskrit-reader__option:disabled {
  cursor: not-allowed;
}

.sanskrit-reader__option.correct {
  background: #4CAF50;
  color: white;
  border-color: #4CAF50;
}

.sanskrit-reader__option.incorrect {
  background: #f44336;
  color: white;
  border-color: #f44336;
}

.sanskrit-reader__feedback {
  text-align: center;
}

.sanskrit-reader__feedback p {
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 15px;
}

.sanskrit-reader__feedback p.correct {
  color: #4CAF50;
}

.sanskrit-reader__feedback p.incorrect {
  color: #f44336;
}

.sanskrit-reader__next-btn {
  padding: 12px 30px;
  font-size: 16px;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.3s;
}

.sanskrit-reader__next-btn:hover {
  background: #1976D2;
}
</style>
