import { Hono } from 'hono'

const app = new Hono()

// Middleware for CORS
app.use('*', async (c, next) => {
  await next()
  c.res.headers.set('Access-Control-Allow-Origin', '*')
  c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type')
})

// Handle OPTIONS preflight
app.options('*', (c) => {
  return c.text('', 204)
})

// Endpoint: /summary
app.get('/summary', async (c) => {
  const prompt = `Create a summary of this text: How older adults can reduce their risk of dementia by 60% with this one simple trick:

A new study published in the journal Neurology found that older adults who engaged in regular physical activity were 60% less likely to develop dementia than those who did not. The study followed over 1,600 adults with an average age of 79 for an average of 5 years. The participants were asked to report their physical activity levels, which included walking, swimming, and other forms of exercise. The researchers found that those who engaged in physical activity at least three times a week were significantly less likely to develop dementia than those who did not. The study also found that the protective effect of physical activity was independent of other factors such as age.

The researchers believe that physical activity may help reduce the risk of dementia by improving blood flow to the brain, reducing inflammation, and promoting the growth of new brain cells. They also note that physical activity has been shown to improve mood, sleep, and overall quality of life, which may also contribute to a lower risk of dementia. The researchers recommend that older adults engage in regular physical activity to reduce their risk of dementia and maintain their cognitive health.`

  const apiKey = c.env.OPENAI_API_KEY

  if (!apiKey) {
    console.error('OPENAI_API_KEY is not set in environment variables')
    return c.text('Internal Server Error: API key missing', 500)
  }

  try {
    const response = await fetch('https://api.openai.com/v1/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-davinci-003', // Try 'gpt-3.5-turbo' if this fails
        prompt: prompt,
        max_tokens: 50,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`OpenAI API error: ${response.status} - ${errorText}`)
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const summary = data.choices[0].text.trim()

    return c.json({ summary: summary })
  } catch (error) {
    console.error('Error in /summary:', error)
    return c.text(`Internal Server Error: ${error.message}`, 500)
  }
})

// Catch-all route
app.all('*', (c) => {
  return c.text('Not Found', 404)
})

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx)
  },
}
