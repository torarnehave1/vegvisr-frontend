import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // Treat these as custom elements (Web Components)
          isCustomElement: (tag) =>
            tag.startsWith('gmp-') ||
            tag === 'component-manager' ||
            tag === 'knowledge-graph-viewer',
        },
      },
    }),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Add aliases for Node.js built-in modules if needed
      fs: 'browserify-fs',
      path: 'path-browserify',
      url: 'url',
    },
  },
  build: {
    rollupOptions: {
      // Configure Rollup to handle Node.js built-in modules
      external: ['fs', 'path', 'url'],
    },
  },
})
