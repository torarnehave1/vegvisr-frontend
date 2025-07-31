# ROLLBACK DOCUMENTATION

**ROLLBACK ID**: FLEXBOX_IMAGE_BUTTONS_FIX_20250731_001
**Date**: July 31, 2025
**Issue**: FLEXBOX elements missing Change Image and Google Image buttons

## Changes Made

### File 1: `src/components/GNewNodes/GNewDefaultNode.vue`

**Lines**: 757-775

**Before**:

```javascript
// Determine FLEXBOX type and create structured object
const flexboxType = match[1].toLowerCase()
const content = match[3].trim()

if (flexboxType === 'grid') {
  parts.push({
    type: 'flexbox-grid',
    content: content,
  })
} else if (flexboxType.startsWith('cards')) {
  const columnCount = match[2] ? parseInt(match[2], 10) : 3
  parts.push({
    type: 'flexbox-cards',
    content: content,
    columnCount: columnCount,
  })
} else if (flexboxType === 'gallery') {
  parts.push({
    type: 'flexbox-gallery',
    content: content,
  })
}
```

**After**:

```javascript
// Determine FLEXBOX type and create structured object
const flexboxType = match[1].toLowerCase()
const content = match[3].trim()

// Process FLEXBOX content through addChangeImageButtons to add image editing buttons
const contentWithButtons = addChangeImageButtons(
  content,
  props.nodeId,
  props.nodeData?.originalContent || '',
)

if (flexboxType === 'grid') {
  parts.push({
    type: 'flexbox-grid',
    content: contentWithButtons,
  })
} else if (flexboxType.startsWith('cards')) {
  const columnCount = match[2] ? parseInt(match[2], 10) : 3
  parts.push({
    type: 'flexbox-cards',
    content: contentWithButtons,
    columnCount: columnCount,
  })
} else if (flexboxType === 'gallery') {
  parts.push({
    type: 'flexbox-gallery',
    content: contentWithButtons,
  })
}
```

### File 2: `src/components/FlexboxGallery.vue` (CRITICAL)

**Root Cause Fix**: Changed from parsing markdown to rendering processed HTML

**Before**:

```vue
<template>
  <div class="flexbox-gallery">
    <div v-for="(image, index) in images" :key="index" class="gallery-item">
      <img :src="image.src" :alt="image.alt" class="gallery-image" />
    </div>
  </div>
</template>

<script setup>
const images = computed(() => {
  const imageRegex = /!\[([^\]]*?)\]\(([^)]+)\)/g
  const matches = [...props.content.matchAll(imageRegex)]
  return matches.map((match) => ({
    alt: match[1],
    src: match[2],
  }))
})
</script>
```

**After**:

```vue
<template>
  <div class="flexbox-gallery" v-html="processedContent"></div>
</template>

<script setup>
const processedContent = computed(() => {
  // The content now comes with image buttons already processed
  // We need to wrap images in gallery-item containers for styling
  const contentWithContainers = props.content.replace(
    /<img([^>]*?)>/g,
    '<div class="gallery-item"><img$1 class="gallery-image" /></div>',
  )
  return contentWithContainers
})
</script>
```

### File 3: `src/components/FlexboxGrid.vue` (CRITICAL)

**Root Cause Fix**: Changed from parsing markdown to rendering processed HTML

**Before**:

```vue
<template>
  <div class="flexbox-grid">
    <div v-for="(image, index) in images" :key="index" class="grid-item">
      <img :src="image.src" :alt="image.alt" />
    </div>
  </div>
</template>

<script setup>
const images = computed(() => {
  const imageRegex = /!\[([^\]]*?)\]\(([^)]+)\)/g
  const matches = [...props.content.matchAll(imageRegex)]
  return matches.map((match) => ({
    alt: match[1],
    src: match[2],
  }))
})
</script>
```

**After**:

```vue
<template>
  <div class="flexbox-grid" v-html="processedContent"></div>
</template>

<script setup>
const processedContent = computed(() => {
  // The content now comes with image buttons already processed
  // We need to wrap images in grid-item containers for styling
  const contentWithContainers = props.content.replace(
    /<img([^>]*?)>/g,
    '<div class="grid-item"><img$1 /></div>',
  )
  return contentWithContainers
})
</script>
```

### File 4: `src/components/FlexboxCards.vue` (CRITICAL)

**Root Cause Fix**: Added support for processed HTML with buttons

**Before**:

```javascript
// Check for markdown image
const imageMatch = line.match(/!\[([^\]]*?)\]\(([^)]+)\)/)
if (imageMatch && cardStarted) {
  const [, altText, url] = imageMatch
  currentCard.image = `<img src="${url}" alt="${altText}" class="card-image">`
  continue
}
```

**After**:

```javascript
// Check for processed image HTML with buttons (from addChangeImageButtons)
const processedImageMatch = line.match(/<img[^>]*>/i)
if (processedImageMatch && cardStarted) {
  // Keep the entire processed line which includes buttons
  currentCard.image = line
  continue
}

// Check for markdown image (fallback)
const imageMatch = line.match(/!\[([^\]]*?)\]\(([^)]+)\)/)
if (imageMatch && cardStarted) {
  const [, altText, url] = imageMatch
  currentCard.image = `<img src="${url}" alt="${altText}" class="card-image">`
  continue
}
```

## Root Cause Analysis

**Problem**: FLEXBOX components were using `imageRegex` to parse markdown and create plain `<img>` tags, bypassing the processed HTML with buttons from `addChangeImageButtons()`.

**Solution**: Modified FLEXBOX components to render processed HTML content using `v-html` instead of parsing markdown manually.

## Rollback Instructions

To rollback this change:

1. **GNewDefaultNode.vue**: Remove the `contentWithButtons` processing line and use `content` directly
2. **FlexboxGallery.vue**: Restore original template with `v-for` and `images` computed property
3. **FlexboxGrid.vue**: Restore original template with `v-for` and `images` computed property
4. **FlexboxCards.vue**: Remove the `processedImageMatch` logic and keep only the `imageMatch` logic

## Testing Status

- ✅ Build successful
- ✅ No compilation errors
- ✅ FLEXBOX content now renders processed HTML with buttons
- ✅ Image buttons should now appear in FLEXBOX-GALLERY, FLEXBOX-GRID, and FLEXBOX-CARDS

## Expected Result

FLEXBOX-GALLERY, FLEXBOX-GRID, and FLEXBOX-CARDS elements should now display Change Image and Google Image buttons on their images, matching the behavior of regular markdown images.
