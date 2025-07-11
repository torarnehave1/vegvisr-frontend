import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useTemplateStore = defineStore('template', () => {
  // Template definitions for all current node types
  const nodeTemplates = ref([
    // Content Nodes Category
    {
      id: 'fulltext-basic',
      category: 'Content Nodes',
      icon: '📄',
      label: 'Fulltext',
      description: 'Rich text content with formatting support',
      template: {
        type: 'fulltext',
        label: 'New Fulltext Node',
        info: 'Your content here...\n\nYou can use:\n- **Bold** and *italic* text\n- Lists and links\n- [SECTION] and [FANCY] elements',
        color: '#f9f9f9',
        visible: true,
        position: { x: 100, y: 100 },
        bibl: [],
      },
    },
    {
      id: 'title-basic',
      category: 'Content Nodes',
      icon: '🎯',
      label: 'Title',
      description: 'Main heading or title node',
      template: {
        type: 'title',
        label: 'New Title',
        info: 'Your title content here',
        color: '#e8f4fd',
        visible: true,
        position: { x: 100, y: 100 },
        bibl: [],
      },
    },
    {
      id: 'worknote-basic',
      category: 'Content Nodes',
      icon: '📝',
      label: 'Work Note',
      description: 'Structured work note with attribution',
      template: {
        type: 'fulltext',
        label: 'Work Note',
        info: "[WNOTE | Cited='Author']\nYour work note content here\n[END WNOTE]",
        color: '#fff9e6',
        visible: true,
        position: { x: 100, y: 100 },
        bibl: [],
      },
    },

    // Audio Transcription Templates
    {
      id: 'audio-enhanced-transcription',
      category: 'Content Nodes',
      icon: '✨',
      label: 'Enhanced Audio Transcription',
      description: 'Insert AI-enhanced transcription from your audio recordings',
      isAudioTemplate: true,
      transcriptionType: 'enhanced',
      template: {
        type: 'fulltext',
        label: 'Enhanced Audio Transcription',
        info: 'Enhanced transcription content will be inserted here',
        color: '#e8f5e8',
        visible: true,
        position: { x: 100, y: 100 },
        bibl: [],
      },
    },
    {
      id: 'audio-raw-transcription',
      category: 'Content Nodes',
      icon: '🎤',
      label: 'Raw Audio Transcription',
      description: 'Insert raw transcription from your audio recordings',
      isAudioTemplate: true,
      transcriptionType: 'raw',
      template: {
        type: 'fulltext',
        label: 'Raw Audio Transcription',
        info: 'Raw transcription content will be inserted here',
        color: '#f8f9fa',
        visible: true,
        position: { x: 100, y: 100 },
        bibl: [],
      },
    },
    {
      id: 'audio-both-transcriptions',
      category: 'Content Nodes',
      icon: '📋',
      label: 'Both Audio Transcriptions',
      description: 'Insert both enhanced and raw transcriptions as separate nodes',
      isAudioTemplate: true,
      transcriptionType: 'both',
      template: {
        type: 'fulltext',
        label: 'Audio Transcriptions',
        info: 'Both transcription nodes will be created',
        color: '#f0f8ff',
        visible: true,
        position: { x: 100, y: 100 },
        bibl: [],
      },
    },

    // Charts & Data Category
    {
      id: 'chart-bar',
      category: 'Charts & Data',
      icon: '📊',
      label: 'Bar Chart',
      description: 'Vertical bar chart visualization',
      template: {
        type: 'chart',
        label: 'Bar Chart',
        info: '{"data": [{"label": "Q1", "value": 100}, {"label": "Q2", "value": 150}, {"label": "Q3", "value": 120}], "title": "Sample Bar Chart", "xLabel": "Quarters", "yLabel": "Values"}',
        color: '#e6f3ff',
        visible: true,
        position: { x: 100, y: 100 },
        bibl: [],
      },
    },
    {
      id: 'chart-pie',
      category: 'Charts & Data',
      icon: '🥧',
      label: 'Pie Chart',
      description: 'Circular pie chart with segments',
      template: {
        type: 'piechart',
        label: 'Pie Chart',
        info: '{"data": [{"label": "Category A", "value": 40}, {"label": "Category B", "value": 35}, {"label": "Category C", "value": 25}], "title": "Sample Pie Chart"}',
        color: '#f0f8e6',
        visible: true,
        position: { x: 100, y: 100 },
        bibl: [],
      },
    },
    {
      id: 'chart-line',
      category: 'Charts & Data',
      icon: '📈',
      label: 'Line Chart',
      description: 'Line graph for trends over time',
      template: {
        type: 'linechart',
        label: 'Line Chart',
        info: '{"data": [{"x": "Jan", "y": 10}, {"x": "Feb", "y": 20}, {"x": "Mar", "y": 15}, {"x": "Apr", "y": 25}], "title": "Sample Line Chart", "xLabel": "Months", "yLabel": "Values"}',
        color: '#ffe6f0',
        visible: true,
        position: { x: 100, y: 100 },
        bibl: [],
      },
    },
    {
      id: 'chart-timeline',
      category: 'Charts & Data',
      icon: '⏱️',
      label: 'Timeline',
      description: 'Timeline visualization for events',
      template: {
        type: 'timeline',
        label: 'Timeline Chart',
        info: '{"events": [{"date": "2024-01", "title": "Project Start", "description": "Initial planning phase"}, {"date": "2024-03", "title": "Development", "description": "Core development work"}, {"date": "2024-06", "title": "Launch", "description": "Product launch"}], "title": "Project Timeline"}',
        color: '#f5e6ff',
        visible: true,
        position: { x: 100, y: 100 },
        bibl: [],
      },
    },
    {
      id: 'chart-bubble',
      category: 'Charts & Data',
      icon: '🫧',
      label: 'Bubble Chart',
      description: 'Multi-dimensional bubble visualization',
      template: {
        type: 'bubblechart',
        label: 'Bubble Chart',
        info: '{"data": [{"x": 10, "y": 20, "size": 15, "label": "Item A"}, {"x": 25, "y": 35, "size": 20, "label": "Item B"}, {"x": 40, "y": 15, "size": 10, "label": "Item C"}], "title": "Sample Bubble Chart", "xLabel": "X Axis", "yLabel": "Y Axis"}',
        color: '#e6fff0',
        visible: true,
        position: { x: 100, y: 100 },
        bibl: [],
      },
    },
    {
      id: 'chart-swot',
      category: 'Charts & Data',
      icon: '🎯',
      label: 'SWOT Analysis',
      description: 'Strategic SWOT diagram',
      template: {
        type: 'swot',
        label: 'SWOT Analysis',
        info: '{"strengths": ["Strong team", "Good market position"], "weaknesses": ["Limited resources", "New technology"], "opportunities": ["Market growth", "New partnerships"], "threats": ["Competition", "Economic changes"], "title": "SWOT Analysis"}',
        color: '#fff0e6',
        visible: true,
        position: { x: 100, y: 100 },
        bibl: [],
      },
    },

    // Visual Elements Category
    {
      id: 'image-markdown',
      category: 'Visual Elements',
      icon: '🖼️',
      label: 'Image Node',
      description: 'Display images with captions',
      template: {
        type: 'markdown-image',
        label: 'Image Node',
        info: 'https://vegvisr.imgix.net/placeholder.jpg',
        color: '#f0f0f0',
        visible: true,
        position: { x: 100, y: 100 },
        bibl: [],
        imageWidth: '100%',
        imageHeight: '100%',
      },
    },
    {
      id: 'video-youtube',
      category: 'Visual Elements',
      icon: '🎬',
      label: 'Video Node',
      description: 'Embed YouTube videos',
      template: {
        type: 'youtube-video',
        label: 'Video Node',
        info: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        color: '#ffe6e6',
        visible: true,
        position: { x: 100, y: 100 },
        bibl: [],
      },
    },
    {
      id: 'imagequote-basic',
      category: 'Visual Elements',
      icon: '✨',
      label: 'Image Quote',
      description: 'Styled quote with background image',
      template: {
        type: 'imagequote',
        label: 'Image Quote',
        info: "[IMAGEQUOTE backgroundImage:'https://vegvisr.imgix.net/placeholder.jpg' fontFamily:'Arial' fontSize:'24px' textColor:'#333']\nYour inspiring quote here\n[END IMAGEQUOTE]",
        color: '#f8f0ff',
        visible: true,
        position: { x: 100, y: 100 },
        bibl: [],
      },
    },
    {
      id: 'fancy-title',
      category: 'Visual Elements',
      icon: '🎭',
      label: 'Fancy Title',
      description: 'Styled title with formatting',
      template: {
        type: 'fulltext',
        label: 'Fancy Title',
        info: '[FANCY | font-size: 4.5em; color: #2c3e50; text-align: center]\nYour Fancy Title\n[END FANCY]',
        color: '#f0f8ff',
        visible: true,
        position: { x: 100, y: 100 },
        bibl: [],
      },
    },
    {
      id: 'audio-player',
      category: 'Visual Elements',
      icon: '🎵',
      label: 'Audio Player',
      description: 'Add an audio player with controls',
      template: {
        type: 'audio',
        label: 'Audio Recording',
        info: 'Audio description and notes...',
        path: '', // Audio URL will be set here
        color: '#28a745',
      },
    },

    // Interactive Category
    {
      id: 'button-row',
      category: 'Interactive',
      icon: '🎮',
      label: 'Button Row',
      description: 'Interactive button collection',
      template: {
        type: 'button_row',
        label: 'Button Row',
        info: '{"buttons": [{"id": "btn1", "text": "Start Graph", "action": "route", "target": "/graph-canvas", "style": "primary"}, {"id": "btn2", "text": "View Gallery", "action": "route", "target": "/graph-gallery", "style": "secondary"}, {"id": "btn3", "text": "See Examples", "action": "route", "target": "/graph-gallery", "style": "canvas"}], "layout": "horizontal", "justifyContent": "center", "gap": "0.75rem"}',
        color: '#f0fff0',
        visible: true,
        position: { x: 100, y: 100 },
        bibl: [],
      },
    },
    {
      id: 'stripe-button',
      category: 'Interactive',
      icon: '💳',
      label: 'Stripe Button',
      description: 'Payment button with Stripe integration',
      template: {
        type: 'stripe-button',
        label: 'Buy Now',
        info: '{"buyButtonId": "buy_btn_1RfjQlFf3ByP0X118yBbkFNb", "publishableKey": "pk_live_51OnmWsFf3ByP0X11XDQuCtB7QdS2IMaHap97i9gWcZT9G4xEz0WAX5asIzCe1jEbVK3UU8OnZ1ZxLN0Ky2P2ktVo00IKtQqKDH", "description": "Secure payment processing with Stripe"}',
        color: '#f8f5ff',
        visible: true,
        position: { x: 100, y: 100 },
        bibl: [],
      },
    },
    {
      id: 'ai-test',
      category: 'Interactive',
      icon: '🤖',
      label: 'AI Test Node',
      description: 'AI endpoint testing interface',
      template: {
        type: 'action_test',
        label: 'AI Test Node',
        info: 'AI endpoint testing node - Configure your API testing here',
        color: '#fff5e6',
        visible: true,
        position: { x: 100, y: 100 },
        bibl: [],
      },
    },
    {
      id: 'audio-transcription',
      category: 'Interactive',
      icon: '🎤',
      label: 'Audio Transcription',
      description: 'Transcribe audio files and recordings to text using AI',
      template: {
        type: 'audio-transcription',
        label: 'Audio Transcription',
        info: 'Upload audio or record to transcribe with AI',
        color: '#f3e8ff',
        visible: true,
        position: { x: 100, y: 100 },
        bibl: [],
      },
    },
    {
      id: 'image-analysis',
      category: 'Interactive',
      icon: '🔍',
      label: 'Image Analysis',
      description: 'Analyze images using AI vision models (OpenAI GPT-4o)',
      template: {
        type: 'image-analysis',
        label: 'Image Analysis',
        info: 'Upload an image to analyze with AI vision models',
        color: '#e8f5e8',
        visible: true,
        position: { x: 100, y: 100 },
        bibl: [],
      },
    },
  ])

  // Computed properties for template organization
  const templateCategories = computed(() => {
    const categories = {}
    nodeTemplates.value.forEach((template) => {
      if (!categories[template.category]) {
        categories[template.category] = []
      }
      categories[template.category].push(template)
    })
    return categories
  })

  const categoryList = computed(() => {
    return Object.keys(templateCategories.value)
  })

  // Search and filter functionality
  const searchTemplates = (query) => {
    if (!query.trim()) return nodeTemplates.value

    const lowerQuery = query.toLowerCase()
    return nodeTemplates.value.filter(
      (template) =>
        template.label.toLowerCase().includes(lowerQuery) ||
        template.description.toLowerCase().includes(lowerQuery) ||
        template.category.toLowerCase().includes(lowerQuery),
    )
  }

  const getTemplatesByCategory = (category) => {
    return templateCategories.value[category] || []
  }

  const getTemplateById = (id) => {
    return nodeTemplates.value.find((template) => template.id === id)
  }

  // Template creation helper
  const createNodeFromTemplate = (templateId, customPosition = null) => {
    const template = getTemplateById(templateId)
    if (!template) {
      console.warn(`Template not found: ${templateId}`)
      return null
    }

    // Create a unique node with template defaults
    const newNode = {
      ...template.template,
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }

    // Apply custom positioning if provided
    if (customPosition) {
      newNode.position = customPosition
    }

    return newNode
  }

  return {
    nodeTemplates,
    templateCategories,
    categoryList,
    searchTemplates,
    getTemplatesByCategory,
    getTemplateById,
    createNodeFromTemplate,
  }
})
