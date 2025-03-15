<script setup>
import WelcomeItem from './WelcomeItem.vue'
import DocumentationIcon from './icons/IconDocumentation.vue'
import ToolingIcon from './icons/IconTooling.vue'
import EcosystemIcon from './icons/IconEcosystem.vue'
import CommunityIcon from './icons/IconCommunity.vue'
import SupportIcon from './icons/IconSupport.vue'
</script>

<template>
  <div class="container mt-5">
    <div class="row">
      <div class="col-md-6 mb-4" v-for="(item, index) in items" :key="index">
        <WelcomeItem>
          <template #icon>
            <component :is="item.icon" />
          </template>
          <template #heading>{{ item.heading }}</template>
          <div v-html="item.content"></div>
        </WelcomeItem>
      </div>
    </div>
  </div>
</template>

<script>
const items = [
  {
    icon: DocumentationIcon,
    heading: 'Documentation',
    content: `Vue’s <a href="https://vuejs.org/" target="_blank" rel="noopener">official documentation</a> provides you with all information you need to get started.`,
  },
  {
    icon: ToolingIcon,
    heading: 'Tooling',
    content: `This project is served and bundled with <a href="https://vite.dev/guide/features.html" target="_blank" rel="noopener">Vite</a>. The recommended IDE setup is <a href="https://code.visualstudio.com/" target="_blank" rel="noopener">VSCode</a> + <a href="https://github.com/johnsoncodehk/volar" target="_blank" rel="noopener">Volar</a>. If you need to test your components and web pages, check out <a href="https://vitest.dev/" target="_blank" rel="noopener">Vitest</a> and <a href="https://www.cypress.io/" target="_blank" rel="noopener">Cypress</a> / <a href="https://playwright.dev/" target="_blank" rel="noopener">Playwright</a>.<br />More instructions are available in <a href="javascript:void(0)" @click="openReadmeInEditor"><code>README.md</code></a>.`,
  },
  {
    icon: EcosystemIcon,
    heading: 'Ecosystem',
    content: `Get official tools and libraries for your project: <a href="https://pinia.vuejs.org/" target="_blank" rel="noopener">Pinia</a>, <a href="https://router.vuejs.org/" target="_blank" rel="noopener">Vue Router</a>, <a href="https://test-utils.vuejs.org/" target="_blank" rel="noopener">Vue Test Utils</a>, and <a href="https://github.com/vuejs/devtools" target="_blank" rel="noopener">Vue Dev Tools</a>. If you need more resources, we suggest paying <a href="https://github.com/vuejs/awesome-vue" target="_blank" rel="noopener">Awesome Vue</a> a visit.`,
  },
  {
    icon: CommunityIcon,
    heading: 'Community',
    content: `Got stuck? Ask your question on <a href="https://chat.vuejs.org" target="_blank" rel="noopener">Vue Land</a> (our official Discord server), or <a href="https://stackoverflow.com/questions/tagged/vue.js" target="_blank" rel="noopener">StackOverflow</a>. You should also follow the official <a href="https://bsky.app/profile/vuejs.org" target="_blank" rel="noopener">@vuejs.org</a> Bluesky account or the <a href="https://x.com/vuejs" target="_blank" rel="noopener">@vuejs</a> X account for latest news in the Vue world.`,
  },
  {
    icon: SupportIcon,
    heading: 'Support Vue',
    content: `As an independent project, Vue relies on community backing for its sustainability. You can help us by <a href="https://vuejs.org/sponsor/" target="_blank" rel="noopener">becoming a sponsor</a>.`,
  },
]
</script>
