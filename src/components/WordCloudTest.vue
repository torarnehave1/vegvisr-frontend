<template>
  <div style="width: 400px; height: 300px; border: 1px solid #ccc; margin: 2rem auto">
    <WordCloud
      :words="testWords"
      :wordStyle="() => ({ cursor: 'pointer', fill: '#007bff' })"
      @word-click="onWordClick"
      style="width: 100%; height: 100%"
    />
  </div>
</template>

<script setup>
import WordCloud from 'vue3-word-cloud'

const testWords = [
  { text: 'Hello', weight: 10 },
  { text: 'World', weight: 8 },
  { text: 'Vue', weight: 6 },
  { text: 'Cloud', weight: 4 },
  { text: 'Test', weight: 2 },
]

function onWordClick(word) {
  alert(`You clicked: ${word.text}`)
}
</script>
