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
    general: 'Describe this image in detail. What do you see? If this appears to be a public document, list, or published material, please include all visible names, organizations, and text content.',
    detailed:
      'Provide a comprehensive analysis of this image. Include details about objects, people, setting, mood, colors, composition, and any notable features. If this appears to be a public document, directory, list, or published material (such as organizational charts, public listings, academic papers, news articles, or official documents), please extract and include all visible names, titles, organizations, and textual content as this information is publicly available.',
    objects:
      'Identify and list all objects visible in this image. Describe their locations, sizes, and relationships to each other. Include any text, names, or labels visible on objects.',
    text: 'Extract and transcribe all text visible in this image, including names, titles, organizations, and any other textual content. Preserve the original formatting and structure as much as possible. This includes extracting names from public documents, lists, directories, or published materials.',
    medical:
      'Analyze this medical image. Describe any visible anatomical structures, potential abnormalities, or clinically relevant findings. Note: This is for educational purposes only.',
    technical:
      'Provide a technical analysis of this image. Focus on technical aspects, components, measurements, or engineering details visible. Include any visible labels, names, model numbers, or textual information.',
    artistic:
      'Analyze this image from an artistic perspective. Comment on composition, color theory, style, technique, and aesthetic qualities. If this appears to be a published work, include visible artist names, titles, or attribution information.',
    public_document: 'This appears to be a public document, list, directory, or published material. Please extract all visible text including names, organizations, titles, positions, and any other information. Public information extraction is permitted and helpful for knowledge graph creation. Treat this like reading from a publicly accessible directory or organizational chart.',
    name_extraction: 'Please extract all names, organizations, titles, and positions visible in this image. This appears to be from a public source such as a directory, organizational chart, public listing, or published document where this information is meant to be publicly accessible. Be comprehensive in your extraction as this is for legitimate knowledge management purposes.',
    public_verified: 'This image contains information that appears to be from a publicly accessible source (such as a company website, organizational directory, published document, or public listing). Please extract all visible information including names, titles, organizations, and contact details. The user has indicated this is public information, so please be thorough in your extraction for knowledge graph creation purposes.',
    custom: customPrompt || 'Analyze this image.',
  }

  return prompts[analysisType] || prompts.general
}

// Collection analysis prompts
const getCollectionPrompt = (collectionType, customPrompt = '') => {
  const prompts = {
    recipe_ingredients: `
      Analyze these ingredients as a complete recipe collection:
      1. Identify each ingredient visible
      2. Estimate quantities where possible
      3. Determine what type of dish this could make
      4. Assess if ingredients are complete for the recipe
      5. Note any missing essential ingredients
      6. Provide cooking suggestions or recipe steps

      Format your response with:
      [INGREDIENTS_START]
      List each ingredient with: name, quantity, category
      [INGREDIENTS_END]

      [RECIPE_ANALYSIS_START]
      Recipe type, difficulty, estimated time, completeness assessment
      [RECIPE_ANALYSIS_END]

      [SUGGESTIONS_START]
      Missing ingredients, cooking tips, recipe improvements
      [SUGGESTIONS_END]
    `,

    packing_list: `
      Analyze these items as a packing/equipment list:
      1. Categorize each item (clothing, tools, food, etc.)
      2. Identify the likely purpose/destination (hiking, travel, work, etc.)
      3. Assess completeness for the intended purpose
      4. Note any critical missing items
      5. Suggest additions or removals

      Format your response with:
      [ITEMS_START]
      List each item with: name, category, purpose
      [ITEMS_END]

      [PURPOSE_ANALYSIS_START]
      Likely destination/activity, preparation level, completeness score
      [PURPOSE_ANALYSIS_END]

      [RECOMMENDATIONS_START]
      Missing items, suggestions, improvements
      [RECOMMENDATIONS_END]
    `,

    sequence_story: `
      Analyze these images as a sequence/story:
      1. Describe the progression through each image
      2. Identify the timeline and story arc
      3. Note key changes between images
      4. Provide overall narrative summary

      Format your response with:
      [SEQUENCE_START]
      Image-by-image progression description
      [SEQUENCE_END]

      [STORY_ARC_START]
      Beginning, middle, end, overall narrative
      [STORY_ARC_END]

      [CHANGES_START]
      Key changes, transitions, developments
      [CHANGES_END]
    `,

    product_collection: `
      Analyze these items as a product collection:
      1. Categorize products by type and function
      2. Identify brand/style consistency
      3. Assess collection completeness and theme
      4. Note quality and condition of items

      Format your response with:
      [PRODUCTS_START]
      List each product with: name, category, brand, condition
      [PRODUCTS_END]

      [COLLECTION_ANALYSIS_START]
      Theme, consistency, quality assessment, completeness
      [COLLECTION_ANALYSIS_END]

      [INSIGHTS_START]
      Collection insights, missing items, recommendations
      [INSIGHTS_END]
    `,

    custom: customPrompt || 'Analyze this collection of images as a cohesive whole.'
  }

  return prompts[collectionType] || prompts.custom
}

// Comparison analysis prompts
const getComparisonPrompt = (comparisonType, customPrompt = '') => {
  const prompts = {
    spot_differences: `
      Compare these two images systematically:
      1. Examine every area for visual differences
      2. Note additions, removals, or changes
      3. Describe the location of each difference
      4. Rate the significance of each change
      5. Provide a comprehensive difference summary

      Format your response with:
      [DIFFERENCES_START]
      List each difference with: location, description, significance (high/medium/low)
      [DIFFERENCES_END]

      [SIMILARITY_SCORE_START]
      Overall similarity percentage and assessment
      [SIMILARITY_SCORE_END]

      [SUMMARY_START]
      Overall comparison summary and key findings
      [SUMMARY_END]
    `,

    before_after: `
      Analyze the transformation between these images:
      1. Describe the overall change or improvement
      2. List specific modifications made
      3. Assess the quality of the transformation
      4. Note any positive or negative aspects
      5. Suggest further improvements if applicable

      Format your response with:
      [CHANGES_START]
      Major changes, minor changes, improvements
      [CHANGES_END]

      [ASSESSMENT_START]
      Quality of transformation, positive/negative aspects
      [ASSESSMENT_END]

      [RECOMMENDATIONS_START]
      Further improvement suggestions
      [RECOMMENDATIONS_END]
    `,

    quality_comparison: `
      Compare the quality, condition, or state of objects in these images:
      1. Rate quality/condition of items in each image
      2. Identify wear, damage, or deterioration
      3. Compare overall state and functionality
      4. Provide quality scores and recommendations

      Format your response with:
      [QUALITY_SCORES_START]
      Image A quality score, Image B quality score, comparison
      [QUALITY_SCORES_END]

      [CONDITION_ANALYSIS_START]
      Detailed condition assessment, wear patterns, damage
      [CONDITION_ANALYSIS_END]

      [RECOMMENDATIONS_START]
      Maintenance suggestions, replacement needs, improvements
      [RECOMMENDATIONS_END]
    `,

    variant_analysis: `
      Compare these product/item variants:
      1. Identify different features, colors, sizes, or specifications
      2. Note design variations and functional differences
      3. Assess which variant might be better for different use cases
      4. Provide comparative analysis of pros and cons

      Format your response with:
      [VARIANTS_START]
      Feature differences, specifications, design variations
      [VARIANTS_END]

      [COMPARISON_START]
      Pros and cons of each variant, use case recommendations
      [COMPARISON_END]

      [VERDICT_START]
      Overall recommendation based on typical use cases
      [VERDICT_END]
    `,

    custom: customPrompt || 'Compare these two images and identify key differences.'
  }

  return prompts[comparisonType] || prompts.custom
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

// Parse collection analysis data
const parseCollectionData = (analysisText) => {
  const result = {
    ingredients: [],
    items: [],
    products: [],
    sequence: [],
    analysis: {},
    suggestions: [],
    cleanAnalysis: analysisText
  }

  try {
    // Parse ingredients (for recipe analysis)
    const ingredientsMatch = analysisText.match(/\[INGREDIENTS_START\](.*?)\[INGREDIENTS_END\]/s)
    if (ingredientsMatch) {
      result.ingredients = parseListSection(ingredientsMatch[1])
      result.cleanAnalysis = result.cleanAnalysis.replace(/\[INGREDIENTS_START\].*?\[INGREDIENTS_END\]/s, '').trim()
    }

    // Parse items (for packing list analysis)
    const itemsMatch = analysisText.match(/\[ITEMS_START\](.*?)\[ITEMS_END\]/s)
    if (itemsMatch) {
      result.items = parseListSection(itemsMatch[1])
      result.cleanAnalysis = result.cleanAnalysis.replace(/\[ITEMS_START\].*?\[ITEMS_END\]/s, '').trim()
    }

    // Parse products (for product collection analysis)
    const productsMatch = analysisText.match(/\[PRODUCTS_START\](.*?)\[PRODUCTS_END\]/s)
    if (productsMatch) {
      result.products = parseListSection(productsMatch[1])
      result.cleanAnalysis = result.cleanAnalysis.replace(/\[PRODUCTS_START\].*?\[PRODUCTS_END\]/s, '').trim()
    }

    // Parse sequence (for story analysis)
    const sequenceMatch = analysisText.match(/\[SEQUENCE_START\](.*?)\[SEQUENCE_END\]/s)
    if (sequenceMatch) {
      result.sequence = parseSequenceSection(sequenceMatch[1])
      result.cleanAnalysis = result.cleanAnalysis.replace(/\[SEQUENCE_START\].*?\[SEQUENCE_END\]/s, '').trim()
    }

    // Parse analysis sections
    const analysisMatches = [
      { key: 'recipe', pattern: /\[RECIPE_ANALYSIS_START\](.*?)\[RECIPE_ANALYSIS_END\]/s },
      { key: 'purpose', pattern: /\[PURPOSE_ANALYSIS_START\](.*?)\[PURPOSE_ANALYSIS_END\]/s },
      { key: 'collection', pattern: /\[COLLECTION_ANALYSIS_START\](.*?)\[COLLECTION_ANALYSIS_END\]/s },
      { key: 'story', pattern: /\[STORY_ARC_START\](.*?)\[STORY_ARC_END\]/s }
    ]

    analysisMatches.forEach(({ key, pattern }) => {
      const match = analysisText.match(pattern)
      if (match) {
        result.analysis[key] = match[1].trim()
        result.cleanAnalysis = result.cleanAnalysis.replace(pattern, '').trim()
      }
    })

    // Parse suggestions
    const suggestionsMatches = [
      /\[SUGGESTIONS_START\](.*?)\[SUGGESTIONS_END\]/s,
      /\[RECOMMENDATIONS_START\](.*?)\[RECOMMENDATIONS_END\]/s,
      /\[INSIGHTS_START\](.*?)\[INSIGHTS_END\]/s
    ]

    suggestionsMatches.forEach(pattern => {
      const match = analysisText.match(pattern)
      if (match) {
        result.suggestions = result.suggestions.concat(parseListItems(match[1]))
        result.cleanAnalysis = result.cleanAnalysis.replace(pattern, '').trim()
      }
    })

    return result
  } catch (error) {
    console.warn('Failed to parse collection data:', error)
    return { ...result, cleanAnalysis: analysisText }
  }
}

// Parse comparison analysis data
const parseComparisonData = (analysisText) => {
  const result = {
    differences: [],
    changes: [],
    qualityScores: {},
    variants: [],
    assessment: {},
    recommendations: [],
    similarityScore: null,
    cleanAnalysis: analysisText
  }

  try {
    // Parse differences
    const differencesMatch = analysisText.match(/\[DIFFERENCES_START\](.*?)\[DIFFERENCES_END\]/s)
    if (differencesMatch) {
      result.differences = parseListSection(differencesMatch[1])
      result.cleanAnalysis = result.cleanAnalysis.replace(/\[DIFFERENCES_START\].*?\[DIFFERENCES_END\]/s, '').trim()
    }

    // Parse changes
    const changesMatch = analysisText.match(/\[CHANGES_START\](.*?)\[CHANGES_END\]/s)
    if (changesMatch) {
      result.changes = parseListSection(changesMatch[1])
      result.cleanAnalysis = result.cleanAnalysis.replace(/\[CHANGES_START\].*?\[CHANGES_END\]/s, '').trim()
    }

    // Parse quality scores
    const qualityMatch = analysisText.match(/\[QUALITY_SCORES_START\](.*?)\[QUALITY_SCORES_END\]/s)
    if (qualityMatch) {
      result.qualityScores = parseQualityScores(qualityMatch[1])
      result.cleanAnalysis = result.cleanAnalysis.replace(/\[QUALITY_SCORES_START\].*?\[QUALITY_SCORES_END\]/s, '').trim()
    }

    // Parse variants
    const variantsMatch = analysisText.match(/\[VARIANTS_START\](.*?)\[VARIANTS_END\]/s)
    if (variantsMatch) {
      result.variants = parseListSection(variantsMatch[1])
      result.cleanAnalysis = result.cleanAnalysis.replace(/\[VARIANTS_START\].*?\[VARIANTS_END\]/s, '').trim()
    }

    // Parse similarity score
    const similarityMatch = analysisText.match(/\[SIMILARITY_SCORE_START\](.*?)\[SIMILARITY_SCORE_END\]/s)
    if (similarityMatch) {
      const scoreText = similarityMatch[1].trim()
      const scoreMatch = scoreText.match(/(\d+)%/)
      if (scoreMatch) {
        result.similarityScore = parseInt(scoreMatch[1])
      }
      result.cleanAnalysis = result.cleanAnalysis.replace(/\[SIMILARITY_SCORE_START\].*?\[SIMILARITY_SCORE_END\]/s, '').trim()
    }

    // Parse assessment sections
    const assessmentMatches = [
      { key: 'transformation', pattern: /\[ASSESSMENT_START\](.*?)\[ASSESSMENT_END\]/s },
      { key: 'condition', pattern: /\[CONDITION_ANALYSIS_START\](.*?)\[CONDITION_ANALYSIS_END\]/s },
      { key: 'comparison', pattern: /\[COMPARISON_START\](.*?)\[COMPARISON_END\]/s },
      { key: 'verdict', pattern: /\[VERDICT_START\](.*?)\[VERDICT_END\]/s },
      { key: 'summary', pattern: /\[SUMMARY_START\](.*?)\[SUMMARY_END\]/s }
    ]

    assessmentMatches.forEach(({ key, pattern }) => {
      const match = analysisText.match(pattern)
      if (match) {
        result.assessment[key] = match[1].trim()
        result.cleanAnalysis = result.cleanAnalysis.replace(pattern, '').trim()
      }
    })

    // Parse recommendations
    const recommendationsMatch = analysisText.match(/\[RECOMMENDATIONS_START\](.*?)\[RECOMMENDATIONS_END\]/s)
    if (recommendationsMatch) {
      result.recommendations = parseListItems(recommendationsMatch[1])
      result.cleanAnalysis = result.cleanAnalysis.replace(/\[RECOMMENDATIONS_START\].*?\[RECOMMENDATIONS_END\]/s, '').trim()
    }

    return result
  } catch (error) {
    console.warn('Failed to parse comparison data:', error)
    return { ...result, cleanAnalysis: analysisText }
  }
}

// Helper functions for parsing
const parseListSection = (text) => {
  return text.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('[') && !line.endsWith(']'))
    .map(line => {
      // Try to parse structured items like "name: value, category: value"
      if (line.includes(':')) {
        const parts = {}
        const segments = line.split(',').map(s => s.trim())
        segments.forEach(segment => {
          const [key, ...valueParts] = segment.split(':')
          if (key && valueParts.length) {
            parts[key.trim().toLowerCase()] = valueParts.join(':').trim()
          }
        })
        return Object.keys(parts).length > 0 ? parts : { description: line }
      }
      return { description: line }
    })
}

const parseSequenceSection = (text) => {
  return text.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('[') && !line.endsWith(']'))
    .map((line, index) => ({
      step: index + 1,
      description: line
    }))
}

const parseListItems = (text) => {
  return text.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('[') && !line.endsWith(']'))
    .map(line => line.replace(/^[-*•]\s*/, '')) // Remove bullet points
}

const parseQualityScores = (text) => {
  const scores = {}
  const lines = text.split('\n').map(line => line.trim()).filter(line => line)

  lines.forEach(line => {
    if (line.toLowerCase().includes('image a')) {
      const scoreMatch = line.match(/(\d+(?:\.\d+)?)[/\s]/)
      if (scoreMatch) scores.imageA = parseFloat(scoreMatch[1])
    } else if (line.toLowerCase().includes('image b')) {
      const scoreMatch = line.match(/(\d+(?:\.\d+)?)[/\s]/)
      if (scoreMatch) scores.imageB = parseFloat(scoreMatch[1])
    }
  })

  return scores
}

// Collection analysis handler
const handleAnalyzeCollection = async (request, env) => {
  try {
    console.log('🔍 Collection analysis request received:', {
      method: request.method,
      url: request.url,
      timestamp: new Date().toISOString(),
    })

    const requestBody = await request.json()
    const {
      images = [],
      collectionType = 'custom',
      prompt,
      model = 'gpt-4o-mini',
      maxTokens = 2048,
      enableContextDetection = false,
    } = requestBody

    console.log('📝 Collection analysis request:', {
      imageCount: images.length,
      collectionType,
      model,
      maxTokens,
      promptLength: prompt?.length || 0,
    })

    // Validate input
    if (!images || images.length === 0) {
      return createErrorResponse('Missing required parameter: images array', 400)
    }

    if (images.length > 10) {
      return createErrorResponse('Maximum 10 images allowed per collection analysis', 400)
    }

    if (!env.OPENAI_API_KEY) {
      return createErrorResponse('OpenAI API key not configured', 500)
    }

    // Prepare analysis prompt
    const analysisPrompt = prompt || getCollectionPrompt(collectionType)

    console.log('🤖 Using collection analysis prompt:', analysisPrompt.substring(0, 100) + '...')

    // Prepare images for OpenAI API
    const imageContent = images.map((imageData, index) => {
      if (typeof imageData === 'string') {
        // URL or base64 string
        const imageUrl = imageData.startsWith('data:') ? imageData : imageData
        return {
          type: 'image_url',
          image_url: {
            url: imageUrl,
            detail: 'high',
          },
        }
      } else if (imageData.url) {
        return {
          type: 'image_url',
          image_url: {
            url: imageData.url,
            detail: 'high',
          },
        }
      } else if (imageData.base64) {
        return {
          type: 'image_url',
          image_url: {
            url: imageData.base64,
            detail: 'high',
          },
        }
      }
      throw new Error(`Invalid image format at index ${index}`)
    })

    // Create content array with images and text
    const content = [
      ...imageContent,
      {
        type: 'text',
        text: analysisPrompt,
      },
    ]

    // Prepare OpenAI API request
    const openaiRequest = {
      model: model,
      messages: [
        {
          role: 'user',
          content: content,
        },
      ],
      max_tokens: maxTokens,
      temperature: 0.1,
    }

    console.log('📤 Sending collection analysis to OpenAI API:', {
      model: openaiRequest.model,
      imageCount: imageContent.length,
      maxTokens: openaiRequest.max_tokens,
    })

    // Call OpenAI API
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
    console.log('✅ Collection analysis response received:', {
      model: openaiData.model,
      usage: openaiData.usage,
      choicesCount: openaiData.choices?.length || 0,
    })

    const analysisResult = openaiData.choices[0]?.message?.content
    if (!analysisResult) {
      return createErrorResponse('No analysis result received from OpenAI', 500)
    }

    // Parse structured collection data
    const collectionData = parseCollectionData(analysisResult)

    // Prepare response
    const response = {
      success: true,
      analysis: collectionData.cleanAnalysis,
      collectionType: collectionType,
      collectionData: {
        ingredients: collectionData.ingredients,
        items: collectionData.items,
        products: collectionData.products,
        sequence: collectionData.sequence,
        analysis: collectionData.analysis,
        suggestions: collectionData.suggestions,
      },
      metadata: {
        model: openaiData.model,
        collectionType: collectionType,
        imageCount: images.length,
        usage: openaiData.usage,
        timestamp: new Date().toISOString(),
      },
    }

    console.log('📊 Collection analysis completed successfully:', {
      analysisLength: collectionData.cleanAnalysis.length,
      itemsFound: collectionData.ingredients.length + collectionData.items.length + collectionData.products.length,
      suggestionsCount: collectionData.suggestions.length,
      tokensUsed: openaiData.usage?.total_tokens || 0,
    })

    return createResponse(JSON.stringify(response))
  } catch (error) {
    console.error('❌ Error in collection analysis:', error)
    return createErrorResponse(`Collection analysis failed: ${error.message}`, 500)
  }
}

// Comparison analysis handler
const handleAnalyzeComparison = async (request, env) => {
  try {
    console.log('🔍 Comparison analysis request received:', {
      method: request.method,
      url: request.url,
      timestamp: new Date().toISOString(),
    })

    const requestBody = await request.json()
    const {
      imageA,
      imageB,
      comparisonType = 'spot_differences',
      prompt,
      model = 'gpt-4o-mini',
      maxTokens = 2048,
    } = requestBody

    console.log('📝 Comparison analysis request:', {
      hasImageA: !!imageA,
      hasImageB: !!imageB,
      comparisonType,
      model,
      maxTokens,
      promptLength: prompt?.length || 0,
    })

    // Validate input
    if (!imageA || !imageB) {
      return createErrorResponse('Missing required parameters: imageA and imageB', 400)
    }

    if (!env.OPENAI_API_KEY) {
      return createErrorResponse('OpenAI API key not configured', 500)
    }

    // Prepare analysis prompt
    const analysisPrompt = prompt || getComparisonPrompt(comparisonType)

    console.log('🤖 Using comparison analysis prompt:', analysisPrompt.substring(0, 100) + '...')

    // Prepare images for OpenAI API
    const prepareImage = (imageData) => {
      if (typeof imageData === 'string') {
        return {
          type: 'image_url',
          image_url: {
            url: imageData,
            detail: 'high',
          },
        }
      } else if (imageData.url) {
        return {
          type: 'image_url',
          image_url: {
            url: imageData.url,
            detail: 'high',
          },
        }
      } else if (imageData.base64) {
        return {
          type: 'image_url',
          image_url: {
            url: imageData.base64,
            detail: 'high',
          },
        }
      }
      throw new Error('Invalid image format')
    }

    const imageAContent = prepareImage(imageA)
    const imageBContent = prepareImage(imageB)

    // Create content array
    const content = [
      {
        type: 'text',
        text: 'Image A (Reference/Before):',
      },
      imageAContent,
      {
        type: 'text',
        text: 'Image B (Comparison/After):',
      },
      imageBContent,
      {
        type: 'text',
        text: analysisPrompt,
      },
    ]

    // Prepare OpenAI API request
    const openaiRequest = {
      model: model,
      messages: [
        {
          role: 'user',
          content: content,
        },
      ],
      max_tokens: maxTokens,
      temperature: 0.1,
    }

    console.log('📤 Sending comparison analysis to OpenAI API:', {
      model: openaiRequest.model,
      comparisonType: comparisonType,
      maxTokens: openaiRequest.max_tokens,
    })

    // Call OpenAI API
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
    console.log('✅ Comparison analysis response received:', {
      model: openaiData.model,
      usage: openaiData.usage,
      choicesCount: openaiData.choices?.length || 0,
    })

    const analysisResult = openaiData.choices[0]?.message?.content
    if (!analysisResult) {
      return createErrorResponse('No analysis result received from OpenAI', 500)
    }

    // Parse structured comparison data
    const comparisonData = parseComparisonData(analysisResult)

    // Prepare response
    const response = {
      success: true,
      analysis: comparisonData.cleanAnalysis,
      comparisonType: comparisonType,
      comparisonData: {
        differences: comparisonData.differences,
        changes: comparisonData.changes,
        qualityScores: comparisonData.qualityScores,
        variants: comparisonData.variants,
        assessment: comparisonData.assessment,
        recommendations: comparisonData.recommendations,
        similarityScore: comparisonData.similarityScore,
      },
      metadata: {
        model: openaiData.model,
        comparisonType: comparisonType,
        usage: openaiData.usage,
        timestamp: new Date().toISOString(),
      },
    }

    console.log('📊 Comparison analysis completed successfully:', {
      analysisLength: comparisonData.cleanAnalysis.length,
      differencesFound: comparisonData.differences.length,
      changesFound: comparisonData.changes.length,
      similarityScore: comparisonData.similarityScore,
      tokensUsed: openaiData.usage?.total_tokens || 0,
    })

    return createResponse(JSON.stringify(response))
  } catch (error) {
    console.error('❌ Error in comparison analysis:', error)
    return createErrorResponse(`Comparison analysis failed: ${error.message}`, 500)
  }
}
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
      model = 'gpt-5-mini',
      maxTokens = 1024,
      verbosity = 'medium',
      reasoningEffort = 'medium',
      enableContextDetection = false,
      requestedOutputs = {},
    } = requestBody

    console.log('📝 Analysis request:', {
      hasImage: !!image,
      hasImageUrl: !!imageUrl,
      analysisType,
      model,
      maxTokens,
      verbosity,
      reasoningEffort,
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

    // Add context about legitimate public information extraction
    if (analysisType === 'public_document' || analysisType === 'name_extraction' || analysisType === 'text' || analysisType === 'public_verified') {
      const verifiedText = analysisType === 'public_verified'
        ? 'The user has confirmed this information is from a publicly accessible source and has verified its public nature.'
        : 'This appears to be from a public or published source.';

      analysisPrompt = `You are analyzing what appears to be a public document, list, directory, or published material for the purpose of creating a knowledge graph. This is legitimate information extraction from what appears to be publicly available sources.

Context for analysis:
- ${verifiedText}
- The user is requesting extraction of visible information for knowledge management
- Names and organizational information in public documents are meant to be accessible
- This is similar to reading information from a business directory, organizational chart, or published document
- The purpose is educational/informational knowledge graph creation

${analysisPrompt}

Instructions: Please extract all visible text, names, organizations, titles, and other information as this appears to be from a public source where such information is intended to be accessible. Treat this like reading from a public directory, organizational website, or published document where the information is meant to be shared.

If you're uncertain about extracting specific information, please err on the side of being helpful while noting your uncertainty. Remember that this is for legitimate knowledge graph creation from what appears to be publicly available information.`
    }

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

    // Prepare OpenAI API request - use Chat Completions API for all models
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
    const apiEndpoint = 'https://api.openai.com/v1/chat/completions'

    console.log('📤 Sending request to OpenAI API:', {
      model: openaiRequest.model,
      endpoint: apiEndpoint,
      maxTokens: openaiRequest.max_tokens,
    })

    // Call OpenAI API
    const openaiResponse = await fetch(apiEndpoint, {
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

    // Extract analysis result from Chat Completions API
    let analysisResult = openaiData.choices[0]?.message?.content
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

        case '/analyze-collection':
          if (request.method === 'POST') {
            return await handleAnalyzeCollection(request, env)
          }
          return createErrorResponse('Method not allowed. Use POST.', 405)

        case '/compare-images':
          if (request.method === 'POST') {
            return await handleAnalyzeComparison(request, env)
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
