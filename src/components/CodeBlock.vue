<template>
  <div class="code-block-wrapper">
    <pre ref="preElement" :class="preClasses"><code ref="codeElement" :class="codeClasses">{{ code }}</code></pre>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import Prism from 'prismjs'

// Import Prism theme and plugin
import 'prismjs/themes/prism-tomorrow.css'
import 'prismjs/plugins/line-numbers/prism-line-numbers.css'
import 'prismjs/plugins/line-numbers/prism-line-numbers.js'

// Import languages
import 'prismjs/components/prism-javascript.js'
import 'prismjs/components/prism-typescript.js'
import 'prismjs/components/prism-css.js'
import 'prismjs/components/prism-markup.js'
import 'prismjs/components/prism-json.js'
import 'prismjs/components/prism-python.js'
import 'prismjs/components/prism-bash.js'
import 'prismjs/components/prism-sql.js'

const props = defineProps({
  code: {
    type: String,
    required: true
  },
  language: {
    type: String,
    default: 'javascript'
  },
  lineNumbers: {
    type: Boolean,
    default: true
  }
})

const preElement = ref(null)
const codeElement = ref(null)

const preClasses = ref(['language-' + props.language])
const codeClasses = ref(['language-' + props.language])

const highlight = () => {
  if (!codeElement.value) return
  
  // Add line-numbers class if enabled
  if (props.lineNumbers && preElement.value) {
    preElement.value.classList.add('line-numbers')
  }
  
  // Let Prism do its magic
  Prism.highlightElement(codeElement.value)
}

onMounted(() => {
  highlight()
})

watch(() => props.code, () => {
  highlight()
})

watch(() => props.language, (newLang) => {
  preClasses.value = ['language-' + newLang]
  codeClasses.value = ['language-' + newLang]
  if (props.lineNumbers && preElement.value) {
    preElement.value.classList.add('line-numbers')
  }
  highlight()
})
</script>

<style>
/* Non-scoped styles - let Prism's CSS work naturally */
.code-block-wrapper {
  margin: 1.5em 0;
}

.code-block-wrapper pre[class*="language-"] {
  background: #2d2d2d;
  border: 1px solid #444;
  border-radius: 8px;
  margin: 0;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.code-block-wrapper code[class*="language-"] {
  font-family: 'Fira Code', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.95em;
  line-height: 1.6;
}

/* Minimal override for line numbers - trust Prism's plugin CSS */
.code-block-wrapper pre.line-numbers {
  padding-left: 3.8em; /* Space for line numbers */
}

/* Custom scrollbar */
.code-block-wrapper pre::-webkit-scrollbar {
  height: 8px;
  width: 8px;
}

.code-block-wrapper pre::-webkit-scrollbar-track {
  background: #1e1e1e;
  border-radius: 4px;
}

.code-block-wrapper pre::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
}

.code-block-wrapper pre::-webkit-scrollbar-thumb:hover {
  background: #777;
}
</style>
