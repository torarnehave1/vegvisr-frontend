<template>
  <div :class="['book-view', { 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }]">
    <div class="cover-container">
      <img src="https://vegvisr.org/bookcover.svg" alt="Hagala Book Cover" class="book-cover" />
    </div>

    <div class="text-container">
      <h1>Hagala: The Ancient Sound Code Behind the Vegvísir Mystery</h1>
      <div class="intro-textarea">
        Explore the lost vibrational key hidden within the Vegvísir. Could \"Hagala\" be the
        forgotten sound of the Wayfinder? This open-source project investigates the ancient
        phonetics, sacred sound structures, and interconnected wisdom of Norse, Taoist, and Sumerian
        traditions.
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'BookView',
}
</script>

<style>
.book-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px;
  background-color: #f8f8f8;
}

.bg-dark {
  background-color: #343a40 !important;
}

.text-white {
  color: #fff !important;
}

.cover-container {
  margin-bottom: 20px;
  width: 100%;
  display: flex;
  justify-content: center;
  background-color: #e0e0e0; /* Added background color for visibility */
  padding: 20px;
}

.book-cover {
  max-width: 300px;
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.text-container {
  max-width: 600px;
}

h1 {
  color: #c9adad;
  font-size: 28px;
  margin-bottom: 15px;
}

.intro-textarea {
  width: 100%;
  height: 150px;
  font-size: 18px;
  line-height: 1.6;
  color: #333;
  margin-bottom: 15px;
  padding: 10px;
  border-radius: 5px;
  border: 1px solid #ccc;
}

.btn {
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
}
</style>
