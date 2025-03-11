// backend/index.js
export default {
  async fetch(request) {
    const { searchParams } = new URL(request.url)
    const prompt = searchParams.get('prompt') || 'Hello from Worker!'

    // (Optional) Call external API like OpenAI here if needed.
    // For now, we'll just return the prompt as part of a JSON response.

    return new Response(JSON.stringify({ message: prompt }), {
      headers: { 'Content-Type': 'application/json' },
    })
  },
}
