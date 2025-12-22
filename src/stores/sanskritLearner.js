// Pinia Store for Sanskrit Learner
// Place this in: src/stores/sanskritLearner.js

import { defineStore } from 'pinia';

const API_BASE = 'https://sanskrit.vegvisr.org';

export const useSanskritLearnerStore = defineStore('sanskritLearner', {
  state: () => ({
    sanskritLetters: [],
    sanskritCurrentLetter: null,
    sanskritUserProgress: {},
    sanskritCurrentMode: 'recognition',
    sanskritSessionStats: {
      sessionId: null,
      correct: 0,
      total: 0,
      streak: 0,
      startTime: null
    },
    sanskritAchievements: [],
    sanskritShowAchievement: false,
    sanskritCurrentAchievement: null,
    sanskritUserId: 'default',
    sanskritLoading: false,
    sanskritAnswerOptions: []
  }),

  getters: {
    sanskritMasteredLetters: (state) => {
      return Object.values(state.sanskritUserProgress).filter(p => p.mastery_level >= 4).length;
    },

    sanskritCurrentStreak: (state) => {
      return state.sanskritSessionStats.streak;
    },

    sanskritNextLetter: (state) => {
      // Get a letter that needs practice (low mastery or not practiced)
      const unpracticedLetters = state.sanskritLetters.filter(letter => {
        const progress = state.sanskritUserProgress[letter.id];
        return !progress || progress.mastery_level < 3;
      });

      if (unpracticedLetters.length > 0) {
        return unpracticedLetters[Math.floor(Math.random() * unpracticedLetters.length)];
      }

      // If all are practiced, return random
      return state.sanskritLetters[Math.floor(Math.random() * state.sanskritLetters.length)];
    },

    sanskritProgressPercentage: (state) => {
      const total = state.sanskritLetters.length;
      const mastered = Object.values(state.sanskritUserProgress).filter(p => p.mastery_level >= 4).length;
      return total > 0 ? Math.round((mastered / total) * 100) : 0;
    }
  },

  actions: {
    async fetchSanskritLetters(category = null, difficulty = null) {
      this.sanskritLoading = true;
      try {
        const params = new URLSearchParams();
        if (category) params.append('category', category);
        if (difficulty) params.append('difficulty', difficulty);

        const response = await fetch(`${API_BASE}/api/sanskrit/letters?${params}`);
        const data = await response.json();
        this.sanskritLetters = data.letters;
      } catch (error) {
        console.error('Error fetching Sanskrit letters:', error);
      } finally {
        this.sanskritLoading = false;
      }
    },

    async loadSanskritProgress() {
      this.sanskritLoading = true;
      try {
        const response = await fetch(`${API_BASE}/api/sanskrit/progress?userId=${this.sanskritUserId}`);
        const data = await response.json();

        // Convert array to object keyed by letter_id
        this.sanskritUserProgress = {};
        data.progress.forEach(p => {
          this.sanskritUserProgress[p.letter_id] = p;
        });
      } catch (error) {
        console.error('Error loading Sanskrit progress:', error);
      } finally {
        this.sanskritLoading = false;
      }
    },

    async startSanskritSession(mode) {
      this.sanskritCurrentMode = mode;
      this.sanskritSessionStats = {
        sessionId: null,
        correct: 0,
        total: 0,
        streak: 0,
        startTime: Date.now()
      };

      try {
        const response = await fetch(`${API_BASE}/api/sanskrit/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: this.sanskritUserId,
            mode
          })
        });
        const data = await response.json();
        this.sanskritSessionStats.sessionId = data.sessionId;
      } catch (error) {
        console.error('Error starting Sanskrit session:', error);
      }
    },

    async endSanskritSession() {
      if (!this.sanskritSessionStats.sessionId) return;

      const duration = Math.floor((Date.now() - this.sanskritSessionStats.startTime) / 1000);

      try {
        await fetch(`${API_BASE}/api/sanskrit/session`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: this.sanskritSessionStats.sessionId,
            score: this.sanskritSessionStats.correct,
            totalQuestions: this.sanskritSessionStats.total,
            duration
          })
        });
      } catch (error) {
        console.error('Error ending Sanskrit session:', error);
      }
    },

    async submitSanskritAnswer(letterId, correct) {
      this.sanskritSessionStats.total++;
      if (correct) {
        this.sanskritSessionStats.correct++;
        this.sanskritSessionStats.streak++;
      } else {
        this.sanskritSessionStats.streak = 0;
      }

      try {
        await fetch(`${API_BASE}/api/sanskrit/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: this.sanskritUserId,
            letterId,
            correct,
            mode: this.sanskritCurrentMode
          })
        });

        // Reload progress to get updated mastery
        await this.loadSanskritProgress();

        // Check for achievements
        await this.checkSanskritAchievements();
      } catch (error) {
        console.error('Error submitting Sanskrit answer:', error);
      }
    },

    async checkSanskritAchievements() {
      const achievements = [];

      // First letter mastered
      if (this.sanskritMasteredLetters === 1) {
        achievements.push('first_letter_mastered');
      }

      // 5 in a row
      if (this.sanskritSessionStats.streak === 5) {
        achievements.push('five_streak');
      }

      // 10 in a row
      if (this.sanskritSessionStats.streak === 10) {
        achievements.push('ten_streak');
      }

      // All vowels mastered
      const vowelsMastered = Object.values(this.sanskritUserProgress).filter(p => {
        const letter = this.sanskritLetters.find(l => l.id === p.letter_id);
        return letter && letter.category === 'vowel' && p.mastery_level >= 4;
      }).length;

      const totalVowels = this.sanskritLetters.filter(l => l.category === 'vowel').length;
      if (vowelsMastered === totalVowels && totalVowels > 0) {
        achievements.push('all_vowels_mastered');
      }

      // Unlock new achievements
      for (const achievement of achievements) {
        try {
          const response = await fetch(`${API_BASE}/api/sanskrit/achievements`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: this.sanskritUserId,
              achievementType: achievement
            })
          });
          const data = await response.json();

          if (data.unlocked) {
            this.showSanskritAchievement(achievement);
          }
        } catch (error) {
          console.error('Error unlocking achievement:', error);
        }
      }
    },

    showSanskritAchievement(achievementType) {
      const messages = {
        first_letter_mastered: '🎉 First Letter Mastered!',
        five_streak: '🔥 5 in a Row!',
        ten_streak: '⚡ 10 Streak Master!',
        all_vowels_mastered: '🌟 All Vowels Conquered!'
      };

      this.sanskritCurrentAchievement = messages[achievementType] || '🎊 Achievement Unlocked!';
      this.sanskritShowAchievement = true;

      setTimeout(() => {
        this.sanskritShowAchievement = false;
      }, 3000);
    },

    generateSanskritAnswerOptions(correctLetter) {
      // Generate 3 wrong answers + 1 correct answer
      const options = [correctLetter];
      const availableLetters = this.sanskritLetters.filter(l => l.id !== correctLetter.id);

      while (options.length < 4 && availableLetters.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableLetters.length);
        options.push(availableLetters.splice(randomIndex, 1)[0]);
      }

      // Shuffle options
      return options.sort(() => Math.random() - 0.5);
    },

    setNextSanskritLetter() {
      this.sanskritCurrentLetter = this.sanskritNextLetter;
      if (this.sanskritCurrentLetter) {
        this.sanskritAnswerOptions = this.generateSanskritAnswerOptions(this.sanskritCurrentLetter);
      }
    }
  }
});
