export default {
  async fetch(request, env, ctx) {
    // Handle CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    try {
      const { text } = await request.json()

      if (!text) {
        return new Response(JSON.stringify({ error: 'No text provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Use Cloudflare Workers AI for Norwegian text improvement
      const prompt = `Du er en norsk språkekspert. Forbedre og korriger følgende norske tekst. Gjør teksten mer lesbar og korrekt, men behold betydningen og innholdet. Fiks grammatikk, tegnsetting og ordvalg.

Tekst som skal forbedres:
${text}

Forbedret tekst:`

      const response = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [
          {
            role: 'system',
            content:
              'Du er en norsk språkekspert som forbedrer og korrigerer norske tekster. Gi kun den forbedrede teksten som svar, ingen forklaringer.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      })

      const improvedText = response.response?.trim() || text

      return new Response(
        JSON.stringify({
          success: true,
          original_text: text,
          improved_text: improvedText,
          model: 'Cloudflare Workers AI - Llama 3.3 70B Fast',
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      )
    } catch (error) {
      console.error('Error improving Norwegian text:', error)

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to improve text',
          original_text: text || '',
          improved_text: null,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      )
    }
  },
}
