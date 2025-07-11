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
      const { text, context } = await request.json()

      if (!text) {
        return new Response(JSON.stringify({ error: 'No text provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Use Cloudflare Workers AI for Norwegian text improvement with bilingual awareness
      const contextInfo = context
        ? `\n\nKONTEKST: ${context}\nBruk denne konteksten til å forstå hvilke faguttrykk og termer som er relevante for denne teksten.\n`
        : ''

      const prompt = `Du er en ekspert på norsk språk og forstår at nordmenn ofte blander engelske faguttrykk inn i norsk tale, spesielt innen profesjonelle felt som terapi, psykologi, teknologi og forskning.${contextInfo}

OPPGAVE: Forbedre følgende norske tekst som kommer fra tale-til-tekst. Teksten kan inneholde:
- Feilhørte engelske ord (som "tromer-leasa" som egentlig er "trauma-release")
- Engelske faguttrykk som skal beholdes
- Norsk grammatikk som trenger korreksjon
- Manglende tegnsetting og struktur

REGLER:
1. Korriger feilhørte engelske ord til riktige engelske termer
2. Behold engelske faguttrykk som er korrekte (knowledge elements, somatic therapy, trauma release, biosynthesis, workshop reflection notes, etc.)
3. Forbedre norsk grammatikk og setningsstruktur
4. Legg til korrekt tegnsetting
5. Gjør teksten mer lesbar, men behold all innhold og mening
6. Hvis du er usikker på et engelsk faguttrykk, behold det som det er
7. Bruk kontekstinformasjonen (hvis gitt) til å forstå fagområdet og relevante termer

Tekst som skal forbedres:
${text}

Forbedret tekst:`

      const response = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [
          {
            role: 'system',
            content:
              'Du er en norsk språkekspert som forstår tospråklig norsk-engelsk tale. Du forbedrer norske tekster som inneholder engelske faguttrykk. Korriger feilhørte engelske ord, men behold korrekte engelske termer. Gi kun den forbedrede teksten som svar, ingen forklaringer.',
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
          context_used: !!context,
          context_preview: context
            ? context.substring(0, 100) + (context.length > 100 ? '...' : '')
            : null,
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
          context_used: !!context,
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
