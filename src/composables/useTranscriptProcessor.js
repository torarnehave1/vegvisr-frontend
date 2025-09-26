import { ref, computed } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'

/**
 * Composable for transcript processing functionality
 * Provides shared logic for both modal and full page implementations
 */
export function useTranscriptProcessor() {
  const userStore = useUserStore()
  const knowledgeGraphStore = useKnowledgeGraphStore()

  // State
  const transcriptText = ref('')
  const sourceLanguage = ref('auto')
  const keepOriginalLanguage = ref(false)
  const isProcessing = ref(false)
  const processingStage = ref('')
  const processingProgress = ref(0)
  const processingMessage = ref('')
  const knowledgeGraphPreview = ref(null)

  // YouTube-specific state
  const youtubeUrl = ref('')
  const videoId = ref('')
  const searchQuery = ref('')
  const searchResults = ref([])
  const selectedVideo = ref(null)
  const isLoadingTranscript = ref(false)
  const isSearching = ref(false)
  const videoMetadata = ref(null)

  // Computed
  const hasTranscript = computed(() => transcriptText.value.trim().length > 0)
  const transcriptStats = computed(() => {
    if (!transcriptText.value) return { characters: 0, words: 0, kb: 0 }
    return {
      characters: transcriptText.value.length,
      words: Math.round(transcriptText.value.split(' ').length),
      kb: Math.round(transcriptText.value.length / 1000)
    }
  })

  // Helper function to extract video ID from any YouTube URL
  const extractVideoIdFromUrl = (url) => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }
    return null
  }

  const extractVideoId = () => {
    if (youtubeUrl.value) {
      const extracted = extractVideoIdFromUrl(youtubeUrl.value.trim())
      videoId.value = extracted || ''
    }
  }

  // File handling
  const processFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        transcriptText.value = e.target.result
        resolve(e.target.result)
      }
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  // YouTube transcript fetching
  const fetchYouTubeTranscriptIO = async () => {
    if (!videoId.value) {
      throw new Error('No video ID provided')
    }

    isLoadingTranscript.value = true

    try {
      console.log('🌐 Fetching Transcript IO for video ID:', videoId.value)

      const response = await fetch(`https://api.vegvisr.org/youtube-transcript-io/${videoId.value}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      console.log('📊 YouTube Transcript IO response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        console.log('✅ YouTube Transcript IO response:', data)

        if (
          data.success &&
          data.transcript &&
          Array.isArray(data.transcript) &&
          data.transcript.length > 0
        ) {
          const transcriptEntry = data.transcript[0]
          console.log('🔍 Transcript entry structure:', JSON.stringify(transcriptEntry, null, 2))

          // Extract transcript text from the correct path
          let transcriptParts = ''
          let transcriptLanguage = 'Unknown'
          let totalSegments = 0

          if (
            transcriptEntry.tracks &&
            Array.isArray(transcriptEntry.tracks) &&
            transcriptEntry.tracks.length > 0
          ) {
            const track = transcriptEntry.tracks[0] // Use first available track
            transcriptLanguage = track.language || 'Unknown'

            if (track.transcript && Array.isArray(track.transcript)) {
              transcriptParts = track.transcript.map((segment) => segment.text).join(' ')
              totalSegments = track.transcript.length
            }
          }

          transcriptText.value = transcriptParts

          // Extract metadata from microformat
          const microformat = transcriptEntry.microformat?.playerMicroformatRenderer
          if (microformat) {
            console.log('📺 Microformat data:', JSON.stringify(microformat, null, 2))

            // Store video metadata for YouTube Transcript IO
            videoMetadata.value = {
              title:
                microformat.title?.simpleText ||
                transcriptEntry.title ||
                `YouTube Video ${videoId.value}`,
              description: microformat.description?.simpleText || '',
              thumbnail: `https://img.youtube.com/vi/${videoId.value}/maxresdefault.jpg`,
              channelTitle: microformat.ownerChannelName || 'Unknown Channel',
              channelId: microformat.externalChannelId || '',
              channelUrl: microformat.externalChannelId
                ? `https://www.youtube.com/channel/${microformat.externalChannelId}`
                : '',
              duration: microformat.lengthSeconds ? parseInt(microformat.lengthSeconds) : null,
              publishedAt: microformat.publishDate || null,
              category: microformat.category || '',
              transcriptLanguage: transcriptLanguage,
              transcriptFormat: 'YouTube Transcript IO',
              source: 'YouTube Transcript IO',
              videoId: videoId.value,
              url: `https://www.youtube.com/watch?v=${videoId.value}`,
            }

            console.log('📊 YouTube Transcript IO metadata captured:', videoMetadata.value)
          }

          console.log(`📝 Transcript IO extracted: ${transcriptParts.length} characters`)
          console.log(`📊 Total segments: ${totalSegments}`)
          console.log(`🌍 Language: ${transcriptLanguage}`)

          // Set source language if detected
          if (transcriptLanguage && transcriptLanguage !== 'Unknown') {
            sourceLanguage.value = transcriptLanguage === 'en' ? 'english' : 'auto'
          }

          return transcriptParts
        } else {
          throw new Error('No transcript data found in response')
        }
      } else {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
    } catch (error) {
      console.error('YouTube Transcript IO fetch error:', error)
      throw error
    } finally {
      isLoadingTranscript.value = false
    }
  }

  const fetchDownsubTranscript = async () => {
    // For DOWNSUB, we can use either videoId or the raw URL
    const inputUrl = youtubeUrl.value.trim()
    if (!inputUrl && !videoId.value) {
      throw new Error('Please enter a valid video URL (YouTube, Vimeo, etc.) or YouTube Video ID')
    }

    // Use the raw URL if available, otherwise construct YouTube URL from videoId
    const targetUrl = inputUrl || `https://www.youtube.com/watch?v=${videoId.value}`

    isLoadingTranscript.value = true

    try {
      console.log('🔽 Fetching DOWNSUB transcript for URL:', targetUrl)

      // Define variables that will be used throughout the function
      // const isYouTubeUrl = targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be')

      // For non-YouTube URLs, we need to send the URL in the request body
      // For YouTube URLs, we can use the existing endpoint
      let response
      if (inputUrl && !inputUrl.includes('youtube.com') && !inputUrl.includes('youtu.be')) {
        // Use POST request for non-YouTube URLs
        response = await fetch(`https://api.vegvisr.org/downsub-url-transcript`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: targetUrl }),
        })
      } else {
        // Use existing GET endpoint for YouTube URLs
        const videoIdToUse = videoId.value || extractVideoIdFromUrl(targetUrl)
        response = await fetch(`https://api.vegvisr.org/downsub-transcript/${videoIdToUse}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      }

      console.log('📊 DOWNSUB response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        console.log('✅ DOWNSUB response:', data)

        if (data.success && data.transcript && data.transcript.data) {
          const transcriptData = data.transcript.data

          console.log('🔍 DOWNSUB transcript data structure:', JSON.stringify(transcriptData, null, 2))

          // Look for English subtitles first (default language)
          let targetSubtitles = null

          // Try to find English subtitles in the main subtitles array
          if (transcriptData.subtitles && Array.isArray(transcriptData.subtitles)) {
            targetSubtitles = transcriptData.subtitles.find(
              (sub) =>
                sub.language === 'en' ||
                sub.language === 'English' ||
                sub.language.includes('English') ||
                sub.language.includes('en') ||
                sub.language === 'en-US' ||
                sub.language === 'en-GB',
            )
          }

          // If no English subtitles found, try the first available subtitle
          if (!targetSubtitles && transcriptData.subtitles && transcriptData.subtitles.length > 0) {
            targetSubtitles = transcriptData.subtitles[0]
            console.log('🌐 No English subtitles found, using first available:', targetSubtitles.language)
          }

          // Check translatedSubtitles if still no subtitles found
          if (!targetSubtitles && transcriptData.translatedSubtitles && Array.isArray(transcriptData.translatedSubtitles)) {
            targetSubtitles = transcriptData.translatedSubtitles.find(
              (sub) =>
                sub.language === 'en' ||
                sub.language === 'English' ||
                sub.language.includes('English') ||
                sub.language.includes('en') ||
                sub.language === 'en-US' ||
                sub.language === 'en-GB',
            )
          }

          if (targetSubtitles) {
            console.log('🎯 Found subtitles for language:', targetSubtitles.language)

            // Look for TXT format URL
            let txtUrl = null

            if (targetSubtitles.formats && typeof targetSubtitles.formats === 'object') {
              const possibleTxtKeys = ['TXT', 'txt', 'text', 'TEXT']
              for (const key of possibleTxtKeys) {
                if (targetSubtitles.formats[key] && targetSubtitles.formats[key].url) {
                  txtUrl = targetSubtitles.formats[key].url
                  console.log(`📋 Found TXT format with key: ${key}`)
                  break
                }
              }
            } else {
              // Fallback: check direct format keys
              const possibleTxtKeys = ['TXT', 'txt', 'text', 'TEXT']
              for (const key of possibleTxtKeys) {
                if (targetSubtitles[key] && targetSubtitles[key].url) {
                  txtUrl = targetSubtitles[key].url
                  console.log(`📋 Found TXT format with key: ${key}`)
                  break
                }
              }
            }

            if (txtUrl) {
              console.log('📥 Downloading TXT file from:', txtUrl)

              // Fetch the actual transcript text
              const txtResponse = await fetch(txtUrl)
              if (txtResponse.ok) {
                const transcriptContent = await txtResponse.text()
                transcriptText.value = transcriptContent


                // Set video metadata
                videoMetadata.value = {
                  title: transcriptData.title || 'Video Transcript',
                  description: '',
                  thumbnail: transcriptData.thumbnail || '',
                  channelTitle: transcriptData.source || 'Unknown Source',
                  duration: transcriptData.duration || '',
                  publishedAt: '',
                  transcriptLanguage: targetSubtitles.language || 'Auto-detected',
                  transcriptFormat: 'DOWNSUB',
                  source: 'DOWNSUB',
                  url: targetUrl,
                }

                console.log(`📝 DOWNSUB transcript extracted: ${transcriptContent.length} characters`)
                return transcriptContent
              } else {
                throw new Error('Failed to download transcript file')
              }
            } else {
              throw new Error('No TXT format found in subtitles')
            }
          } else {
            throw new Error('No suitable subtitles found')
          }
        } else {
          throw new Error('No transcript data found in response')
        }
      } else {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
    } catch (error) {
      console.error('DOWNSUB transcript fetch error:', error)
      throw error
    } finally {
      isLoadingTranscript.value = false
    }
  }

  // YouTube search
  const searchYouTubeVideos = async () => {
    if (!searchQuery.value.trim()) {
      throw new Error('No search query provided')
    }

    isSearching.value = true

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/youtube-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery.value.trim(),
          maxResults: 20
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.videos) {
        searchResults.value = data.videos
        return data.videos
      } else {
        throw new Error(data.error || 'Failed to search videos')
      }
    } catch (error) {
      console.error('YouTube search error:', error)
      throw error
    } finally {
      isSearching.value = false
    }
  }

  const selectVideo = (video) => {
    selectedVideo.value = video
    youtubeUrl.value = `https://www.youtube.com/watch?v=${video.videoId}`
    videoId.value = video.videoId

    // Clear previous transcript and metadata
    transcriptText.value = ''
    videoMetadata.value = null
  }

  // Helper function to create YouTube node (copied from working modal)
  const createYouTubeNode = () => {
    console.log('=== createYouTubeNode DEBUG ===')
    console.log('videoMetadata.value:', videoMetadata.value)
    console.log('videoId.value:', videoId.value)

    if (!videoMetadata.value) {
      console.log('❌ No video metadata available')
      return null
    }

    const metadata = videoMetadata.value
    console.log('Using metadata:', metadata)

    const videoTitle = metadata.title || `YouTube Video ${videoId.value}`
    const channelTitle = metadata.channelTitle || 'Unknown Channel'
    const description = metadata.description || ''
    const duration = metadata.duration || null
    const publishedAt = metadata.publishedAt || null
    const videoUrl = `https://www.youtube.com/watch?v=${videoId.value}`
    const embedUrl = `https://www.youtube.com/embed/${videoId.value}`

    // Format duration if available
    const durationText = duration
      ? formatDuration(duration) || 'Unknown duration'
      : 'Unknown duration'

    // Format publish date if available
    const publishText = publishedAt ? formatDate(publishedAt) || 'Unknown date' : 'Unknown date'

    // Create rich info content
    const infoContent = `[SECTION | background-color:'#FFF'; color:'#333']
**${videoTitle}**

**Channel:** ${channelTitle}
**Duration:** ${durationText}
**Published:** ${publishText}

${description ? `**Description:**\n${description.length > 500 ? description.substring(0, 500) + '...' : description}` : ''}

**Source:** [Watch on YouTube](${videoUrl})
[END SECTION]`

    const youtubeNode = {
      id: `youtube_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      label: `![YOUTUBE src=${embedUrl}]${videoTitle}[END YOUTUBE]`,
      color: '#FF0000',
      type: 'youtube-video',
      info: infoContent,
      bibl: [videoUrl],
      imageWidth: '100%',
      imageHeight: '100%',
      visible: true,
      path: null,
    }

    console.log('✅ YouTube node created:', youtubeNode)
    return youtubeNode
  }

  // Fallback method to create knowledge graph locally (copied from working modal)
  const createLocalKnowledgeGraph = async () => {
    try {
      const text = transcriptText.value
      const words = text.split(/\s+/)
      const chunkSize = 500 // words per node
      const chunks = []

      // Split into chunks
      for (let i = 0; i < words.length; i += chunkSize) {
        chunks.push(words.slice(i, i + chunkSize).join(' '))
      }

      // Create nodes from chunks
      const nodes = chunks.map((chunk, index) => ({
        id: `transcript_${Date.now()}_${index}`,
        label: `DEL ${index + 1}`,
        color: '#f9f9f9',
        type: 'fulltext',
        info: `## DEL ${index + 1}\n\n${chunk}\n\n*Note: This content was created using local processing. For full AI translation and enhancement, please ensure the API service is available.*`,
        bibl: [],
        imageWidth: '100%',
        imageHeight: '100%',
        visible: true,
        path: null,
      }))

      // Add YouTube node if video metadata exists
      console.log('=== FALLBACK YOUTUBE NODE DEBUG ===')
      console.log('videoMetadata.value:', videoMetadata.value)
      console.log('videoId.value:', videoId.value)
      console.log('===================================')

      if (videoMetadata.value && videoId.value) {
        console.log('🎬 Creating YouTube node in fallback...')
        const youtubeNode = createYouTubeNode()
        console.log('Generated YouTube node in fallback:', youtubeNode)
        if (youtubeNode) {
          nodes.push(youtubeNode)
          console.log('✅ YouTube node added to fallback nodes')
          console.log('Total nodes now:', nodes.length)
        } else {
          console.log('❌ YouTube node creation failed in fallback')
        }
      } else {
        console.log('❌ YouTube node creation skipped in fallback - conditions not met')
        console.log('videoMetadata.value exists:', !!videoMetadata.value)
        console.log('videoId.value exists:', !!videoId.value)
      }

      return {
        nodes,
        edges: [],
        fallbackMode: true,
      }
    } catch (error) {
      console.error('Local processing failed:', error)
      return null
    }
  }

  // Main processing function
  const processTranscript = async () => {
    if (!transcriptText.value.trim()) {
      throw new Error('No transcript text to process')
    }

    try {
      isProcessing.value = true
      processingProgress.value = 20
      processingStage.value = '🔍 Analyzing transcript...'
      processingMessage.value = 'Processing content structure'

      const requestPayload = {
        transcript: transcriptText.value,
        sourceLanguage: sourceLanguage.value,
        targetLanguage: keepOriginalLanguage.value ? 'original' : 'norwegian',
      }

      console.log('=== TRANSCRIPT API REQUEST ===')
      console.log('URL:', 'https://api.vegvisr.org/process-transcript')
      console.log('Transcript Length:', transcriptText.value.length)
      console.log('Source Language:', sourceLanguage.value)
      console.log('Target Language:', keepOriginalLanguage.value ? 'original' : 'norwegian')
      console.log('===============================')

      const response = await fetch('https://api.vegvisr.org/process-transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      })

      processingStage.value = '🧠 Generating knowledge graph...'
      processingProgress.value = 80
      processingMessage.value = 'Creating Norwegian content'

      if (!response.ok) {
        let errorMessage = `Processing failed: ${response.status}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          const errorText = await response.text()
          errorMessage = errorText || errorMessage
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()

      processingStage.value = '✅ Complete!'
      processingProgress.value = 100
      processingMessage.value = 'Knowledge graph ready'

      console.log('=== PROCESSING COMPLETE ===')
      console.log('API Result:', result)
      console.log('Knowledge Graph:', result.knowledgeGraph)
      console.log('===========================')

      // Add YouTube node if video metadata exists
      console.log('=== YOUTUBE NODE CREATION DEBUG ===')
      console.log('videoMetadata.value:', videoMetadata.value)
      console.log('videoId.value:', videoId.value)
      console.log('=====================================')

      if (videoMetadata.value && videoId.value) {
        console.log('🎬 Creating YouTube node...')
        const youtubeNode = createYouTubeNode()
        console.log('Generated YouTube node:', youtubeNode)
        if (youtubeNode) {
          result.knowledgeGraph.nodes.push(youtubeNode)
          console.log('✅ YouTube node added to knowledge graph')
          console.log('Total nodes now:', result.knowledgeGraph.nodes.length)
        } else {
          console.log('❌ YouTube node creation failed')
        }
      } else {
        console.log('❌ YouTube node creation skipped - conditions not met')
        console.log('videoMetadata.value exists:', !!videoMetadata.value)
        console.log('videoId.value exists:', !!videoId.value)
      }

      knowledgeGraphPreview.value = result.knowledgeGraph
      isProcessing.value = false

      return result.knowledgeGraph

    } catch (error) {
      console.error('Error processing transcript:', error)

      // Fallback: Create nodes locally if API fails
      console.log('API failed, attempting local processing...')
      processingStage.value = '🔄 Using fallback method...'
      processingProgress.value = 50
      processingMessage.value = 'Creating nodes locally'

      try {
        const fallbackResult = await createLocalKnowledgeGraph()
        if (fallbackResult) {
          processingStage.value = '✅ Complete!'
          processingProgress.value = 100
          processingMessage.value = 'Knowledge graph ready (local)'

          knowledgeGraphPreview.value = fallbackResult
          isProcessing.value = false
          return fallbackResult
        }
      } catch (fallbackError) {
        console.error('Fallback method also failed:', fallbackError)
      }

      isProcessing.value = false
      throw new Error(`Processing failed: ${error.message}`)
    }
  }

  // Import to current graph
  const importToGraph = () => {
    if (!knowledgeGraphPreview.value) {
      throw new Error('No knowledge graph preview available!')
    }

    // Add nodes to the current graph data
    knowledgeGraphPreview.value.nodes.forEach((node, index) => {
      const newNode = {
        id: node.id || `transcript_${Date.now()}_${index}`,
        label: node.label || 'Imported Node',
        color: node.color || '#f9f9f9',
        type: node.type || 'fulltext',
        info: node.info || '',
        size: 3,
        position: { x: 100 + index * 200, y: 100 + Math.floor(index / 5) * 300 },
      }

      knowledgeGraphStore.nodes.push(newNode)
    })

    console.log(`Added ${knowledgeGraphPreview.value.nodes.length} transcript nodes to current graph`)
    return knowledgeGraphPreview.value
  }

  // Create new graph
  const createNewGraph = async () => {
    if (!knowledgeGraphPreview.value) {
      throw new Error('No knowledge graph preview available!')
    }

    try {
      // Create graph metadata
      const today = new Date()
      const dateStr = today.toLocaleDateString('no-NO')
      const timeStr = today.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
      const nodeCount = knowledgeGraphPreview.value.nodes?.length || 0

      // Use video title if available, otherwise generic title
      const videoTitle = selectedVideo.value?.title || videoMetadata.value?.title || 'Transkript'
      const graphTitle = selectedVideo.value || videoMetadata.value
        ? `🎬 ${videoTitle.substring(0, 50)}${videoTitle.length > 50 ? '...' : ''} (${nodeCount} deler)`
        : `📝 Transkript ${dateStr} (${nodeCount} deler)`

      const graphMetadata = {
        title: graphTitle,
        description: selectedVideo.value
          ? `Norsk kunnskapsgraf fra YouTube video: "${videoTitle}" (${selectedVideo.value.channelTitle}). Prosessert ${dateStr} kl. ${timeStr}. Inneholder ${nodeCount} tekstdeler.`
          : videoMetadata.value
          ? `Norsk kunnskapsgraf fra video: "${videoTitle}" (${videoMetadata.value.channelTitle}). Prosessert ${dateStr} kl. ${timeStr}. Inneholder ${nodeCount} tekstdeler.`
          : `Automatisk generert norsk kunnskapsgraf fra transkript prosessert ${dateStr} kl. ${timeStr}. Inneholder ${nodeCount} tekstdeler.`,
        createdBy: userStore.email || 'Anonymous',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Prepare graph data with positions
      const graphData = {
        metadata: graphMetadata,
        nodes: knowledgeGraphPreview.value.nodes.map((node, index) => ({
          ...node,
          position: { x: 100 + (index % 3) * 300, y: 100 + Math.floor(index / 3) * 250 },
          visible: true,
        })),
        edges: knowledgeGraphPreview.value.edges || [],
      }

      // Generate unique graph ID
      const graphId = `graph_${Date.now()}`

      // Save to backend
      const response = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Token': userStore.emailVerificationToken,
        },
        body: JSON.stringify({
          id: graphId,
          graphData,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        const finalGraphId = result.graphId || graphId

        // Update store
        knowledgeGraphStore.setCurrentGraphId(finalGraphId)
        knowledgeGraphStore.updateGraphFromJson({
          nodes: graphData.nodes,
          edges: graphData.edges,
          metadata: graphData.metadata,
        })

        return { graphId: finalGraphId, graphData }
      } else {
        const errorText = await response.text()
        throw new Error(`Failed to save new graph: ${response.status} - ${errorText}`)
      }
    } catch (error) {
      console.error('Error creating new graph:', error)
      throw error
    }
  }

  // Reset all state
  const resetProcessor = () => {
    transcriptText.value = ''
    knowledgeGraphPreview.value = null
    isProcessing.value = false
    processingStage.value = ''
    processingProgress.value = 0
    processingMessage.value = ''
    youtubeUrl.value = ''
    videoId.value = ''
    searchQuery.value = ''
    searchResults.value = []
    selectedVideo.value = null
    videoMetadata.value = null
    sourceLanguage.value = 'auto'
    keepOriginalLanguage.value = false
  }

  // Utility functions
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown'
    return new Date(dateString).toLocaleDateString()
  }

  const formatDuration = (duration) => {
    if (!duration) return 'Unknown'

    // Handle various duration formats
    if (typeof duration === 'string') {
      return duration
    }

    // Convert seconds to HH:MM:SS format
    if (typeof duration === 'number') {
      const hours = Math.floor(duration / 3600)
      const minutes = Math.floor((duration % 3600) / 60)
      const seconds = duration % 60

      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`
      }
    }

    return 'Unknown'
  }

  const handleImageError = (e) => {
    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjkwIiB2aWV3Qm94PSIwIDAgMTIwIDkwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjkwIiBmaWxsPSIjZjBmMGYwIi8+Cjx0ZXh0IHg9IjYwIiB5PSI0NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9IjAuM2VtIiBmb250LWZhbWlseT0iYXJpYWwiIGZvbnQtc2l6ZT0iMTJweCIgZmlsbD0iIzk5OTk5OSI+Tm8gSW1hZ2U8L3RleHQ+Cjwvc3ZnPgo='
  }

  return {
    // State
    transcriptText,
    sourceLanguage,
    keepOriginalLanguage,
    isProcessing,
    processingStage,
    processingProgress,
    processingMessage,
    knowledgeGraphPreview,
    youtubeUrl,
    videoId,
    searchQuery,
    searchResults,
    selectedVideo,
    isLoadingTranscript,
    isSearching,
    videoMetadata,

    // Computed
    hasTranscript,
    transcriptStats,

    // Methods
    extractVideoId,
    processFile,
    fetchYouTubeTranscriptIO,
    fetchDownsubTranscript,
    searchYouTubeVideos,
    selectVideo,
    processTranscript,
    importToGraph,
    createNewGraph,
    resetProcessor,
    formatDate,
    formatDuration,
    handleImageError,
  }
}
