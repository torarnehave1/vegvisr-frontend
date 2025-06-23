export default {
  async fetch(request, env, ctx) {
    return new Response('Hello from a modern module worker!', {
      headers: { 'content-type': 'text/plain' },
    })
  },
}
