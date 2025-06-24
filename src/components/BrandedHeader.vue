<template>
  <header class="branded-header" :style="headerStyle">
    <div class="container-fluid">
      <div class="row align-items-center py-3">
        <div class="col-auto">
          <img
            :src="currentLogo"
            :alt="currentSiteTitle + ' Logo'"
            class="logo"
            @error="onLogoError"
          />
        </div>
        <div class="col-auto">
          <slot name="actions"></slot>
        </div>
      </div>
    </div>
  </header>
</template>

<script>
import { computed } from 'vue'
import { useBranding } from '@/composables/useBranding'

export default {
  name: 'BrandedHeader',
  setup() {
    const { currentDomain, isCustomDomain, currentLogo, currentSiteTitle, currentTheme } =
      useBranding()

    const headerStyle = computed(() => ({
      backgroundColor: currentTheme.value.primaryColor,
      color: 'white',
      borderBottom: `3px solid ${currentTheme.value.accentColor}`,
    }))

    const titleStyle = computed(() => ({
      color: 'white',
      fontSize: isCustomDomain.value ? '1.8rem' : '2rem',
    }))

    const subtitleStyle = computed(() => ({
      color: currentTheme.value.secondaryColor,
      fontSize: '0.9rem',
      fontStyle: 'italic',
    }))

    const onLogoError = () => {
      console.warn('Failed to load custom logo, falling back to default')
      // Could implement fallback logic here
    }

    return {
      currentDomain,
      isCustomDomain,
      currentLogo,
      currentSiteTitle,
      currentTheme,
      headerStyle,
      titleStyle,
      subtitleStyle,
      onLogoError,
    }
  },
}
</script>

<style scoped>
.branded-header {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.logo {
  max-height: 60px;
  max-width: 200px;
  object-fit: contain;
}

.site-title {
  font-weight: 600;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
}

.site-subtitle {
  opacity: 0.8;
}
</style>
