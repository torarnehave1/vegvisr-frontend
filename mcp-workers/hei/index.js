const manifest = {
  tools: [
    {
      name: "si_hei",
      description: "Hilser på et navn og svarer 'Hei <navn>, fra MCP'",
      method: "POST",
      path: "/si-hei",
      input: {
        navn: { type: "string", description: "Navnet som skal hilses på", required: true }
      }
    }
  ]
};

const text = (body, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/mcp-manifest") {
      return Response.json(manifest);
    }

    if (request.method === "POST" && url.pathname === "/si-hei") {
      let data;
      try {
        data = await request.json();
      } catch {
        return text("Ugyldig JSON", 400);
      }
      const navn = typeof data?.navn === "string" ? data.navn.trim() : "";
      if (!navn) return text("Mangler navn", 400);
      return text(`Hei ${navn}, fra MCP`);
    }

    return text("Hei fra MCP");
  }
};