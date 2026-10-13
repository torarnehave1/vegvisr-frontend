export default {
  async fetch(request) {
    return new Response("Hei fra MCP", {
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
};