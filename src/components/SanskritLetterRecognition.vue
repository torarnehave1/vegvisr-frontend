<template>
  <div class="sanskrit-recognition">
    <div v-if="loading" class="sanskrit-recognition__loading">
      Loading...
    </div>

    <div v-else-if="currentLetter" class="sanskrit-recognition__quiz">
      <div class="sanskrit-recognition__question">
        <div class="sanskrit-recognition__letter">
          {{ currentLetter.devanagari }}
        </div>
        <p>What is this letter?</p>
      </div>

      <div class="sanskrit-recognition__options">
        <button
          v-for="option in answerOptions"
          :key="option.id"
          @click="selectAnswer(option)"
          :disabled="answered"
          :class="{
            'sanskrit-recognition__option': true,
            'correct': answered && option.id === currentLetter.id,
            'incorrect': answered && selectedAnswer?.id === option.id && option.id !== currentLetter.id
          }"
        >
          {{ option.romanization }}
        </button>
      </div>

      <div v-if="answered" class="sanskrit-recognition__feedback">
        <p :class="{ correct: isCorrect, incorrect: !isCorrect }">
          {{ isCorrect ? '✓ Correct!' : '✗ Incorrect' }}
        </p>
        <button @click="nextQuestion" class="sanskrit-recognition__next-btn">
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
  name: 'SanskritLetterRecognition',
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
.sanskrit-recognition {
  padding: 20px;
}

.sanskrit-recognition__loading {
  text-align: center;
  padding: 50px;
  color: #666;
}

.sanskrit-recognition__quiz {
  max-width: 500px;
  margin: 0 auto;
}

.sanskrit-recognition__question {
  text-align: center;
  margin-bottom: 30px;
}

.sanskrit-recognition__letter {
  font-size: 120px;
  font-weight: bold;
  margin-bottom: 20px;
  color: #333;
}

.sanskrit-recognition__question p {
  font-size: 18px;
  color: #666;
}

.sanskrit-recognition__options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 20px;
}

.sanskrit-recognition__option {
  padding: 20px;
  font-size: 18px;
  border: 2px solid #ddd;
  background: white;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
}

.sanskrit-recognition__option:hover:not(:disabled) {
  border-color: #4CAF50;
  transform: translateY(-2px);
}

.sanskrit-recognition__option:disabled {
  cursor: not-allowed;
}

.sanskrit-recognition__option.correct {
  background: #4CAF50;
  color: white;
  border-color: #4CAF50;
}

.sanskrit-recognition__option.incorrect {
  background: #f44336;
  color: white;
  border-color: #f44336;
}

.sanskrit-recognition__feedback {
  text-align: center;
}

.sanskrit-recognition__feedback p {
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 15px;
}

.sanskrit-recognition__feedback p.correct {
  color: #4CAF50;
}

.sanskrit-recognition__feedback p.incorrect {
  color: #f44336;
}

.sanskrit-recognition__next-btn {
  padding: 12px 30px;
  font-size: 16px;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.3s;
}

.sanskrit-recognition__next-btn:hover {
  background: #1976D2;
}
</style>
