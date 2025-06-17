// index.js
var index_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }
    try {
      const url = new URL(request.url);
      const hostname = url.hostname;
      if (url.pathname === "/create-custom-domain" && request.method === "POST") {
        const { subdomain } = await request.json();
        if (!subdomain) {
          return new Response(JSON.stringify({ error: "Subdomain is required" }), {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          });
        }
        try {
          const dnsResponse = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/dns_records`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${env.CF_API_TOKEN}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                type: "CNAME",
                name: subdomain,
                content: "brand-worker.torarnehave.workers.dev",
                proxied: true
              })
            }
          );
          const dnsResult = await dnsResponse.json();
          const dnsSetup = {
            success: dnsResult.success,
            errors: dnsResult.errors
          };
          const workerResponse = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/workers/routes`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${env.CF_API_TOKEN}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                pattern: `${subdomain}.norsegong.com/*`,
                script: "brand-worker"
              })
            }
          );
          const workerResult = await workerResponse.json();
          const workerSetup = {
            success: workerResult.success,
            errors: workerResult.errors
          };
          return new Response(
            JSON.stringify({
              overallSuccess: dnsSetup.success && workerSetup.success,
              dnsSetup,
              workerSetup
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
              }
            }
          );
        } catch (error) {
          return new Response(
            JSON.stringify({
              error: error.message,
              overallSuccess: false
            }),
            {
              status: 500,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
              }
            }
          );
        }
      }
      let targetUrl;
      if (url.pathname.startsWith("/getknowgraphs") || url.pathname.startsWith("/getknowgraph") || url.pathname.startsWith("/saveknowgraph") || url.pathname.startsWith("/updateknowgraph") || url.pathname.startsWith("/deleteknowgraph") || url.pathname.startsWith("/saveGraphWithHistory")) {
        targetUrl = "https://knowledge-graph-worker.torarnehave.workers.dev" + url.pathname + url.search;
      } else if (url.pathname.startsWith("/mystmkrasave") || url.pathname.startsWith("/generate-header-image") || url.pathname.startsWith("/grok-ask") || url.pathname.startsWith("/grok-elaborate") || url.pathname.startsWith("/apply-style-template")) {
        targetUrl = "https://api.vegvisr.org" + url.pathname + url.search;
      } else {
        targetUrl = "https://www.vegvisr.org" + url.pathname + url.search;
      }
      const headers = new Headers(request.headers);
      headers.set("x-original-hostname", hostname);
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: request.body,
        redirect: "follow"
      });
      const responseClone = response.clone();
      try {
        const jsonData = await responseClone.json();
        return new Response(JSON.stringify(jsonData), {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      } catch (e) {
        return new Response(response.body, {
          status: response.status,
          headers: {
            ...Object.fromEntries(response.headers),
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: true,
          message: error.message || "Internal Server Error"
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
