# Enhanced Social Sharing Implementation

## Overview
Enhanced the social sharing functionality in both Portfolio View and GNewViewer to allow users to choose between sharing a static SEO page or the dynamic interactive graph view.

## Changes Made

### 1. Portfolio View (`src/views/GraphPortfolio.vue`)

#### New UI Elements
- **Share Type Selection:** Radio buttons to choose between SEO page and dynamic graph
- **Dynamic Content:** Share content updates based on selected type
- **Conditional Display:** Only shows SEO option if graph has an SEO slug

#### New JavaScript Functions
```javascript
// Reactive variables
const shareType = ref('dynamic') // Default to dynamic sharing
const currentGraph = ref(null)

// Updated functions
const openShareModal = (graph) => {
  currentGraph.value = graph
  shareType.value = graph.metadata?.seoSlug ? 'seo' : 'dynamic'
  updateShareContent()
  // ... modal display logic
}

const updateShareContent = () => {
  // Generate different content and URLs based on shareType
  let shareUrl = ''
  let shareLabel = ''
  
  if (shareType.value === 'seo' && graph.metadata?.seoSlug) {
    shareUrl = `https://seo.vegvisr.org/graph/${graph.metadata.seoSlug}`
    shareLabel = 'View this SEO-optimized knowledge graph: '
  } else {
    shareUrl = `${window.location.origin}/gnew-viewer?graphId=${graph.id}`
    shareLabel = 'Explore this interactive knowledge graph: '
  }
  // ... content generation
}
```

#### Updated Share Functions
- `shareToLinkedIn()` - Uses correct URL based on share type
- `shareToTwitter()` - Uses correct URL based on share type  
- `shareToFacebook()` - Uses correct URL based on share type

### 2. ShareModal Component (`src/components/ShareModal.vue`)

#### New UI Elements
```vue
<div class="mb-3" v-if="props.graphData?.metadata?.seoSlug">
  <label class="form-label">Share Type</label>
  <div class="form-check">
    <input type="radio" name="shareType" value="seo" v-model="shareType" @change="updateShareType" />
    <label>📄 Static SEO Page - Optimized for social media with rich previews</label>
  </div>
  <div class="form-check">
    <input type="radio" name="shareType" value="dynamic" v-model="shareType" @change="updateShareType" />
    <label>🔗 Interactive Graph - Dynamic experience in the app</label>
  </div>
</div>
```

#### New JavaScript Functions
```javascript
// Reactive variables
const shareType = ref('dynamic')

// New functions
const updateShareType = () => {
  generateShareContent() // Regenerate content when type changes
}

const getShareUrl = () => {
  if (shareType.value === 'seo' && props.graphData?.metadata?.seoSlug) {
    return `https://seo.vegvisr.org/graph/${props.graphData.metadata.seoSlug}`
  } else {
    return `https://${props.currentDomain}/gnew-viewer?graphId=${props.currentGraphId}`
  }
}
```

#### Updated Content Generation
- **AI Content:** Uses `getShareUrl()` for both AI-generated and fallback content
- **Share Labels:** Different labels for SEO vs dynamic links
- **URL Selection:** Automatically chooses appropriate URL based on share type

## User Experience Flow

### For Graphs WITH SEO Pages
1. **User clicks Share button** → Modal opens
2. **Radio buttons appear** → User can choose SEO page or dynamic graph
3. **Default selection:** SEO page (optimized for social sharing)
4. **Content updates** → Share text reflects chosen type
5. **Social platforms** → Receive appropriate URL for best experience

### For Graphs WITHOUT SEO Pages
1. **User clicks Share button** → Modal opens
2. **No radio buttons** → Only dynamic graph option available
3. **Standard behavior** → Shares interactive graph link
4. **Consistent experience** → Same as before for non-SEO graphs

## URL Structure

### Static SEO Pages
- **Format:** `https://seo.vegvisr.org/graph/{seoSlug}`
- **Benefits:** 
  - Rich meta tags for social previews
  - Optimized for Facebook, Twitter, LinkedIn sharing
  - Fast loading static content
  - Better SEO indexing

### Dynamic Graph Views
- **Format:** `https://{domain}/gnew-viewer?graphId={graphId}`
- **Benefits:**
  - Interactive graph experience
  - Full application functionality
  - Real-time data
  - User engagement features

## Share Content Examples

### SEO Page Share
```
Artificial Sweeteners and Gut Health Impacts

This knowledge graph explores the complex relationship between artificial sweeteners and human health...

Nodes: 45
Edges: 67
Categories: #ArtificialSweeteners #GutHealth #Microbiome

View this SEO-optimized knowledge graph: https://seo.vegvisr.org/graph/artificial-sweeteners-and-gut-health-impacts
```

### Dynamic Graph Share
```
Artificial Sweeteners and Gut Health Impacts

This knowledge graph explores the complex relationship between artificial sweeteners and human health...

Nodes: 45
Edges: 67
Categories: #ArtificialSweeteners #GutHealth #Microbiome

Explore this interactive knowledge graph: https://vegvisr.org/gnew-viewer?graphId=12345
```

## Technical Benefits

### For Social Media Sharing
- **SEO pages** provide rich meta tags (og:image, og:title, og:description)
- **Better click-through rates** from social platforms
- **Professional presentation** with optimized previews

### For Direct Engagement
- **Dynamic links** provide full interactive experience
- **User retention** within the application
- **Access to all features** (editing, commenting, etc.)

## Platform-Specific Optimizations

### Facebook
- Uses SEO pages for rich previews when available
- Fallback to dynamic links for full functionality

### LinkedIn
- Professional presentation with SEO pages
- Detailed summaries for business sharing

### Twitter
- Concise format works well with both URL types
- Character optimization for better engagement

### Instagram
- Copy-paste functionality for both formats
- Visual appeal maintained regardless of link type

## Testing Checklist

- [ ] Share button appears in Portfolio View
- [ ] Share button appears in GNewViewer
- [ ] Radio buttons show only for graphs with SEO slugs
- [ ] Content updates when switching share types
- [ ] URLs generate correctly for both types
- [ ] Social platform sharing works with both URL types
- [ ] Default selection logic works (SEO when available, dynamic otherwise)
- [ ] AI-generated content works with both URL types
- [ ] Fallback content works with both URL types