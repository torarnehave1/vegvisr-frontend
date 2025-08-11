// Image Analysis Worker
// Handles image analysis using OpenAI Vision API (GPT-4o, GPT-4o-mini)

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-API-Key, X-Model-Type, X-Analysis-Type',
}

const createResponse = (body, status = 200, headers = {}) => {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...headers },
  })
}

const createErrorResponse = (message, status) => {
  console.error('[Image Analysis Worker]', message)
  return createResponse(JSON.stringify({ error: message }), status)
}

// Helper function to validate image format
const isValidImageFormat = (contentType, fileName) => {
  const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']

  // Check MIME type
  if (contentType && validMimeTypes.includes(contentType.toLowerCase())) {
    return true
  }

  // Check file extension if provided
  if (fileName) {
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
    return validExtensions.includes(extension)
  }

  return false
}

// Helper function to convert image to base64
const convertImageToBase64 = async (imageBuffer, contentType) => {
  // Convert ArrayBuffer to base64
  const bytes = new Uint8Array(imageBuffer)
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = btoa(binary)

  return `data:${contentType};base64,${base64}`
}

// Analysis type templates
const getAnalysisPrompt = (analysisType, customPrompt = '') => {
  const prompts = {
    general: 'Describe this image in detail. What do you see?',
    detailed:
      'Provide a comprehensive analysis of this image. Include details about objects, people, setting, mood, colors, composition, and any notable features.',
    objects:
      'Identify and list all objects visible in this image. Describe their locations, sizes, and relationships to each other.',
    text: 'Extract and transcribe all text visible in this image. Preserve the original formatting and structure as much as possible.',
    medical:
      'Analyze this medical image. Describe any visible anatomical structures, potential abnormalities, or clinically relevant findings. Note: This is for educational purposes only.',
    technical:
      'Provide a technical analysis of this image. Focus on technical aspects, components, measurements, or engineering details visible.',
    artistic:
      'Analyze this image from an artistic perspective. Comment on composition, color theory, style, technique, and aesthetic qualities.',
    custom: customPrompt || 'Analyze this image.',
  }

  return prompts[analysisType] || prompts.general
}

// Parse context data from AI response
const parseContextData = (contextText) => {
  const context = {}

  try {
    const lines = contextText.split('\n').map(line => line.trim()).filter(line => line)

    for (const line of lines) {
      if (line.includes(':')) {
        const [key, ...valueParts] = line.split(':')
        const value = valueParts.join(':').trim()

        switch (key.trim().toLowerCase()) {
          case 'domain':
            context.domain = value
            break
          case 'geography':
            context.geography = value
            break
          case 'content type':
            context.contentType = value
            break
          case 'suggested graph type':
            context.suggestedGraphType = value
            break
          case 'suggested node types':
            context.suggestedNodeTypes = value.split(',').map(type => type.trim())
            break
        }
      }
    }

    return context
  } catch (error) {
    console.warn('Failed to parse context data:', error)
    return {
      domain: 'Unknown',
      geography: 'Unknown',
      contentType: 'Unknown',
      suggestedGraphType: 'General Analysis',
      suggestedNodeTypes: ['concept', 'info']
    }
  }
}

// Main image analysis handler
const handleAnalyzeImage = async (request, env) => {
  try {
    console.log('🔍 Image analysis request received:', {
      method: request.method,
      url: request.url,
      timestamp: new Date().toISOString(),
    })

    // Parse request body
    const requestBody = await request.json()
    const {
      image,
      imageUrl,
      prompt,
      analysisType = 'general',
      model = 'gpt-4o',
      maxTokens = 1024,
      enableContextDetection = false,
      requestedOutputs = {},
    } = requestBody

    console.log('📝 Analysis request:', {
      hasImage: !!image,
      hasImageUrl: !!imageUrl,
      analysisType,
      model,
      maxTokens,
      promptLength: prompt?.length || 0,
      enableContextDetection,
      requestedOutputs,
    })

    // Validate input
    if (!image && !imageUrl) {
      return createErrorResponse('Missing required parameter: image or imageUrl', 400)
    }

    if (!prompt && !analysisType) {
      return createErrorResponse('Missing required parameter: prompt or analysisType', 400)
    }

    // Check OpenAI API key
    if (!env.OPENAI_API_KEY) {
      return createErrorResponse('OpenAI API key not configured', 500)
    }

    // Prepare the analysis prompt
    let analysisPrompt = prompt || getAnalysisPrompt(analysisType)

    // Enhanced prompt for context detection
    if (enableContextDetection) {
      analysisPrompt += `

Additional instructions for AI context analysis:
1. After your main analysis, provide a context assessment in this exact format:
[CONTEXT_START]
Domain: [identify the main field/domain like Economics, Medical, Technical, Academic, etc.]
Geography: [identify geographic context like Norwegian Market, European Union, Global, etc.]
Content Type: [identify content type like Chart, Document, Diagram, Photo, etc.]
Suggested Graph Type: [suggest appropriate knowledge graph structure]
Suggested Node Types: [list recommended node types like economic_entity, concept, person, location, etc.]
[CONTEXT_END]

2. If creating multiple nodes, also provide structured node data in this format:
[NODES_START]
[{"label": "Node Name", "type": "node_type", "content": "node description", "color": "#colorcode"}]
[NODES_END]`
    }

    console.log('🤖 Using analysis prompt:', analysisPrompt.substring(0, 100) + '...')

    // Prepare image data for OpenAI API
    let imageData
    if (imageUrl) {
      // URL-based image
      imageData = {
        type: 'image_url',
        image_url: {
          url: imageUrl,
          detail: 'high',
        },
      }
    } else {
      // Base64 image - validate it's properly formatted
      if (!image.startsWith('data:image/')) {
        return createErrorResponse('Invalid image format. Expected base64 data URL.', 400)
      }

      imageData = {
        type: 'image_url',
        image_url: {
          url: image,
          detail: 'high',
        },
      }
    }

    // Prepare OpenAI API request
    const openaiRequest = {
      model: model,
      messages: [
        {
          role: 'user',
          content: [
            imageData,
            {
              type: 'text',
              text: analysisPrompt,
            },
          ],
        },
      ],
      max_tokens: maxTokens,
      temperature: 0.1,
    }

    console.log('📤 Sending request to OpenAI Vision API:', {
      model: openaiRequest.model,
      maxTokens: openaiRequest.max_tokens,
      messagesCount: openaiRequest.messages.length,
    })

    // Call OpenAI Vision API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(openaiRequest),
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json()
      console.error('❌ OpenAI API error:', errorData)
      return createErrorResponse(
        `OpenAI API error: ${errorData.error?.message || 'Unknown error'}`,
        openaiResponse.status,
      )
    }

    const openaiData = await openaiResponse.json()
    console.log('✅ OpenAI API response received:', {
      model: openaiData.model,
      usage: openaiData.usage,
      choicesCount: openaiData.choices?.length || 0,
    })

    // Extract analysis result
    const analysisResult = openaiData.choices[0]?.message?.content
    if (!analysisResult) {
      return createErrorResponse('No analysis result received from OpenAI', 500)
    }

    // Parse context and structured data if context detection was enabled
    let context = null
    let structuredNodes = null
    let cleanAnalysis = analysisResult

    if (enableContextDetection) {
      // Extract context information
      const contextMatch = analysisResult.match(/\[CONTEXT_START\](.*?)\[CONTEXT_END\]/s)
      if (contextMatch) {
        const contextText = contextMatch[1].trim()
        context = parseContextData(contextText)
        // Remove context section from main analysis
        cleanAnalysis = analysisResult.replace(/\[CONTEXT_START\].*?\[CONTEXT_END\]/s, '').trim()
      }

      // Extract structured nodes
      const nodesMatch = analysisResult.match(/\[NODES_START\](.*?)\[NODES_END\]/s)
      if (nodesMatch) {
        try {
          structuredNodes = JSON.parse(nodesMatch[1].trim())
          // Remove nodes section from main analysis
          cleanAnalysis = cleanAnalysis.replace(/\[NODES_START\].*?\[NODES_END\]/s, '').trim()
        } catch (error) {
          console.warn('Failed to parse structured nodes:', error)
        }
      }
    }

    // Prepare response
    const response = {
      success: true,
      analysis: cleanAnalysis,
      context: context,
      structuredNodes: structuredNodes,
      metadata: {
        model: openaiData.model,
        analysisType: analysisType,
        promptUsed: analysisPrompt.substring(0, 200) + '...',
        usage: openaiData.usage,
        timestamp: new Date().toISOString(),
        contextDetectionEnabled: enableContextDetection,
      },
    }

    console.log('📊 Analysis completed successfully:', {
      analysisLength: cleanAnalysis.length,
      hasContext: !!context,
      hasStructuredNodes: !!structuredNodes,
      tokensUsed: openaiData.usage?.total_tokens || 0,
    })

    return createResponse(JSON.stringify(response))
  } catch (error) {
    console.error('❌ Error in image analysis:', error)
    return createErrorResponse(`Image analysis failed: ${error.message}`, 500)
  }
}

// Health check handler
const handleHealthCheck = async () => {
  return createResponse(
    JSON.stringify({
      status: 'healthy',
      service: 'image-analysis-worker',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    }),
  )
}

// Main request handler
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const { pathname } = url

    console.log('🌍 Request received:', {
      method: request.method,
      pathname: pathname,
      origin: request.headers.get('origin'),
      timestamp: new Date().toISOString(),
    })

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      })
    }

    try {
      // Route requests
      switch (pathname) {
        case '/analyze-image':
          if (request.method === 'POST') {
            return await handleAnalyzeImage(request, env)
          }
          return createErrorResponse('Method not allowed. Use POST.', 405)

        case '/health':
          if (request.method === 'GET') {
            return await handleHealthCheck()
          }
          return createErrorResponse('Method not allowed. Use GET.', 405)

        default:
          return createErrorResponse(`Unknown endpoint: ${pathname}`, 404)
      }
    } catch (error) {
      console.error('❌ Unhandled error in worker:', error)
      return createErrorResponse(`Internal server error: ${error.message}`, 500)
    }
  },
}
