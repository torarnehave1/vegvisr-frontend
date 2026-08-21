// Recovered from the DEPLOYED worker on Cloudflare, because the local source was lost.
// esbuild artefacts undone: inlined npm dependencies removed, imports restored below, and the
// name-preservation wrappers stripped. Variable names may differ from the original where
// esbuild renamed to avoid collisions, and the original comments are gone.

var injectContactFormScript = (html) => {
  if (!html || html.indexOf("data-vegvisr-contact") === -1) return html;
  if (html.indexOf("/components/contact-form.js") !== -1) return html;
  const tag = '<script src="https://api.vegvisr.org/components/contact-form.js" defer><\/script>';
  if (html.indexOf("</body>") !== -1) return html.replace("</body>", tag + "</body>");
  return html + tag;
};
// A published page is a public snapshot read from KV — identical bytes for every caller, no
// cookies or auth consulted — so any origin may READ it. Without these headers a component on
// another origin cannot fetch a site's page to discover its <link rel="icon">: the browser
// blocks the response even though the page is public to anyone with the URL (2026-08-21).
var CORS_READ_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};

// www.<host> falls back to the apex key, matching how pages are published.
var htmlKeysFor = (hostname) => {
  const keys = [`html:${hostname}`];
  if (hostname.startsWith("www.")) keys.push(`html:${hostname.replace(/^www\./, "")}`);
  return keys;
};

// These hosts have no /favicon.ico — the icon is declared ONLY in <link rel="...icon"> tags in
// the head, at an arbitrary URL (favicons.vegvisr.org/...). Parsed with HTMLRewriter, which is
// native to Workers, rather than a regex, so attribute order and quoting can't break it.
var extractIcons = async (html, hostname) => {
  const icons = [];
  const rewriter = new HTMLRewriter().on("link", {
    element(el) {
      const rel = String(el.getAttribute("rel") || "").toLowerCase();
      if (!/(^|[\s-])icon(\s|$)/.test(rel)) return;
      const href = String(el.getAttribute("href") || "").trim();
      if (!href) return;
      let abs = href;
      try {
        abs = new URL(href, `https://${hostname}/`).href;
      } catch {}
      const sizes = el.getAttribute("sizes") || null;
      const px = sizes ? Math.max(0, ...String(sizes).toLowerCase().split(/\s+/).map((s) => parseInt(s, 10) || 0)) : 0;
      icons.push({ rel, href: abs, sizes, type: el.getAttribute("type") || null, px });
    }
  });
  await rewriter.transform(new Response(html)).arrayBuffer();
  return icons;
};

// A raster icon beats apple-touch beats mask-icon (mask-icon is a monochrome SVG silhouette and
// renders as a black blob in a nav bar); within a tier the largest declared size wins.
var pickBestIcon = (icons) => {
  const rank = (i) => (i.rel.includes("mask") ? 0 : i.rel.includes("apple") ? 1 : 2);
  return [...icons].sort((a, b) => rank(b) - rank(a) || b.px - a.px)[0] || null;
};

var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    console.log(`\u{1F310} Brand worker handling request: ${url.pathname} for ${url.hostname}`);
    const jsonResponse = (payload, status = 200) => {
      return new Response(JSON.stringify(payload), {
        status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Publish-Token"
        }
      });
    };
    if (url.pathname === "/create-custom-domain") {
      if (request.method === "OPTIONS") return jsonResponse({ ok: true });
      if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
      const DOMAIN_ZONE_MAPPING = {
        "norsegong.com": "e577205b812b49d012af046535369808",
        "xyzvibe.com": "602067f0cf860426a35860a8ab179a47",
        "vegvisr.org": "9178eccd3a7e3d71d8ae09defb09422a",
        "slowyou.training": "1417691852abd0e8220f60184b7f4eca",
        "vegr.ai": "1a3cb7e191ea291725a639ecef07e93b",
        "alivenesslab.org": "4dc34fae60abef723cb8ae9ace5475f0"
      };
      const PROTECTED_SUBDOMAINS = {
        "vegvisr.org": ["api", "www", "admin", "mail", "blog", "knowledge", "auth", "brand", "dash", "dev", "test", "staging", "cdn", "static"],
        "norsegong.com": ["www", "api", "mail", "admin", "blog", "cdn", "static"],
        "xyzvibe.com": ["www", "api", "mail", "admin", "blog", "cdn", "static"],
        "slowyou.training": ["www", "api", "mail", "admin", "blog", "cdn", "static"]
      };
      let body = null;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
      }
      const subdomain = String(body?.subdomain || "").trim().toLowerCase();
      const rootDomain = String(body?.rootDomain || "norsegong.com").trim().toLowerCase();
      const zoneId = String(body?.zoneId || "").trim();
      if (!subdomain) {
        return jsonResponse({ error: 'Subdomain is required (e.g., "torarne" for torarne.xyzvibe.com)' }, 400);
      }
      const protectedList = PROTECTED_SUBDOMAINS[rootDomain];
      if (protectedList && protectedList.includes(subdomain)) {
        return jsonResponse({
          error: `Subdomain '${subdomain}' is protected and cannot be created. Protected subdomains: ${protectedList.join(", ")}`,
          protectedSubdomain: true
        }, 403);
      }
      const targetZoneId = zoneId || DOMAIN_ZONE_MAPPING[rootDomain];
      if (!targetZoneId) {
        return jsonResponse({
          error: `No Zone ID found for domain: ${subdomain}.${rootDomain}. Supported domains: ${Object.keys(DOMAIN_ZONE_MAPPING).join(", ")}`
        }, 400);
      }
      if (!env.CF_API_TOKEN) {
        return jsonResponse({ error: "CF_API_TOKEN not configured", overallSuccess: false }, 500);
      }
      const targetDomain = `${subdomain}.${rootDomain}`;
      const cfHeaders = { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" };
      const dnsRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${targetZoneId}/dns_records`, {
        method: "POST",
        headers: cfHeaders,
        body: JSON.stringify({ type: "CNAME", name: targetDomain, content: "brand-worker.torarnehave.workers.dev", proxied: true })
      });
      const dnsResult = await dnsRes.json();
      const dnsSetup = { success: dnsResult.success, errors: dnsResult.errors, result: dnsResult.result };
      const routeRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${targetZoneId}/workers/routes`, {
        method: "POST",
        headers: cfHeaders,
        body: JSON.stringify({ pattern: `${targetDomain}/*`, script: "brand-worker" })
      });
      const routeResult = await routeRes.json();
      const workerSetup = { success: routeResult.success, errors: routeResult.errors, result: routeResult.result };
      return jsonResponse({
        overallSuccess: Boolean(dnsSetup.success && workerSetup.success),
        domain: targetDomain,
        zoneId: targetZoneId,
        dnsSetup,
        workerSetup
      });
    }
    if (url.pathname === "/__contact/send-otp" || url.pathname === "/__contact/submit") {
      if (request.method === "OPTIONS") return jsonResponse({ ok: true });
      if (request.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
      if (!env.CONTACT_KV) return jsonResponse({ ok: false, error: "CONTACT_KV binding missing" }, 500);
      const KV = env.CONTACT_KV;
      const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
      const hour = Math.floor(Date.now() / 36e5);
      const sha256hex = async (s) => {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
        return [...new Uint8Array(buf)].map((b2) => b2.toString(16).padStart(2, "0")).join("");
      };
      const normNoPhone = (raw) => {
        let p = String(raw || "").replace(/[\s\-()]/g, "");
        if (p.startsWith("0047")) p = "+47" + p.slice(4);
        else if (p.startsWith("47") && p.length === 10) p = "+47" + p.slice(2);
        else if (/^\d{8}$/.test(p)) p = "+47" + p;
        return /^\+47\d{8}$/.test(p) ? p : null;
      };
      const incr = async (key, ttl) => {
        const n = (parseInt(await KV.get("c:" + key), 10) || 0) + 1;
        await KV.put("c:" + key, String(n), { expirationTtl: ttl });
        return n;
      };
      let b = null;
      try {
        b = await request.json();
      } catch {
        return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
      }
      if (b.hp) return jsonResponse({ ok: true });
      const elapsed = Date.now() - Number(b.t || 0);
      if (!b.t || elapsed < 2e3 || elapsed > 36e5) {
        return jsonResponse({ ok: false, error: "Pr\xF8v igjen." }, 429);
      }
      if (await incr(`g:${hour}`, 3600) > 200) {
        return jsonResponse({ ok: false, error: "For mange henvendelser akkurat n\xE5. Pr\xF8v igjen senere." }, 429);
      }
      if (await incr(`ip:${clientIp}:${hour}`, 3600) > 6) {
        return jsonResponse({ ok: false, error: "For mange fors\xF8k. Pr\xF8v igjen om en time." }, 429);
      }
      const phone = normNoPhone(b.phone);
      if (!phone) return jsonResponse({ ok: false, error: "Oppgi et gyldig norsk mobilnummer." }, 400);
      if (url.pathname === "/__contact/send-otp") {
        if (await incr(`otpcap:${phone}:${hour}`, 3600) > 3) {
          return jsonResponse({ ok: false, error: "For mange kodeforesp\xF8rsler p\xE5 dette nummeret. Pr\xF8v igjen senere." }, 429);
        }
        const code2 = String(1e5 + crypto.getRandomValues(new Uint32Array(1))[0] % 9e5);
        await KV.put(
          "c:otp:" + phone,
          JSON.stringify({ h: await sha256hex(code2), exp: Date.now() + 5 * 6e4, tries: 0 }),
          { expirationTtl: 360 }
        );
        const smsReq = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: phone, message: `Din VEGR.AI-verifiseringskode: ${code2}`, sender: "VEGR.AI" })
        };
        const sms = env.SMS_GATEWAY ? await env.SMS_GATEWAY.fetch("https://sms-gateway/api/sms", smsReq) : await fetch("https://sms-gateway.torarnehave.workers.dev/api/sms", smsReq);
        if (!sms.ok) return jsonResponse({ ok: false, error: "Kunne ikke sende SMS. Sjekk nummeret." }, 502);
        return jsonResponse({ ok: true, sent: true });
      }
      const name = String(b.name || "").trim().slice(0, 120);
      const email = String(b.email || "").trim().slice(0, 160);
      const message = String(b.message || "").trim().slice(0, 4e3);
      const code = String(b.code || "").trim();
      if (!name || !message) return jsonResponse({ ok: false, error: "Fyll ut navn og melding." }, 400);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return jsonResponse({ ok: false, error: "Oppgi en gyldig e-post." }, 400);
      if ((message.match(/https?:\/\//g) || []).length > 2) {
        return jsonResponse({ ok: false, error: "For mange lenker i meldingen." }, 400);
      }
      const rawOtp = await KV.get("c:otp:" + phone);
      if (!rawOtp) return jsonResponse({ ok: false, error: "Ingen aktiv kode. Be om en ny." }, 400);
      const otp = JSON.parse(rawOtp);
      if (Date.now() > otp.exp) {
        await KV.delete("c:otp:" + phone);
        return jsonResponse({ ok: false, error: "Koden er utl\xF8pt. Be om en ny." }, 400);
      }
      if (otp.tries >= 5) {
        await KV.delete("c:otp:" + phone);
        return jsonResponse({ ok: false, error: "For mange fors\xF8k. Be om en ny kode." }, 429);
      }
      if (await sha256hex(code) !== otp.h) {
        otp.tries++;
        await KV.put("c:otp:" + phone, JSON.stringify(otp), { expirationTtl: 360 });
        return jsonResponse({ ok: false, error: "Feil kode." }, 400);
      }
      await KV.delete("c:otp:" + phone);
      const dk = "c:dedup:" + await sha256hex(name + "|" + email + "|" + message);
      if (await KV.get(dk)) return jsonResponse({ ok: true, dedup: true });
      await KV.put(dk, "1", { expirationTtl: 600 });
      let botId = env.CONTACT_BOT_ID;
      let groupId = env.CONTACT_GROUP_ID;
      const rGraphId = String(b.graphId || "").trim();
      const rNodeId = String(b.nodeId || "").trim();
      if (rGraphId && rNodeId) {
        const rawRoute = await KV.get("c:route:" + rGraphId + ":" + rNodeId);
        if (rawRoute) {
          try {
            const route = JSON.parse(rawRoute);
            if (route.group_id && route.bot_id) {
              groupId = route.group_id;
              botId = route.bot_id;
            }
          } catch {
          }
        }
      }
      if (!botId || !groupId) {
        return jsonResponse({ ok: false, error: "Kontaktmottak er ikke konfigurert enn\xE5." }, 503);
      }
      // The submitting PAGE, not this worker. The contact component posts to the absolute
      // endpoint, so url.hostname is always brand-worker.torarnehave.workers.dev and every
      // domain's enquiries looked identical — useless once several sites share one group.
      // Origin is set by the browser on a cross-origin POST and cannot be spoofed by page JS;
      // Referer is the fallback, url.hostname the last resort. Treated as untrusted input:
      // hostname only, charset-restricted, length-capped.
      const senderHost = (() => {
        for (const h of [request.headers.get("Origin"), request.headers.get("Referer")]) {
          if (!h) continue;
          try {
            const n = new URL(h).hostname;
            if (/^[a-z0-9.-]{1,80}$/i.test(n)) return n;
          } catch {}
        }
        return url.hostname;
      })();
      const bodyText = `\u{1F4E9} Ny henvendelse \u2014 ${senderHost}
Navn: ${name}
E-post: ${email}
Telefon: ${phone} (verifisert)

${message}`;
      const botReq = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, group_id: groupId, body: bodyText })
      };
      // MUST go through the binding, exactly like the SMS gateway above. A plain fetch to
      // our own workers.dev hostname from inside a Worker gets an edge error rather than the
      // app's response, so post.ok is false and this returned 502 while the same call from
      // curl returned 201 (L37).
      const post = env.CHAT_WORKER
        ? await env.CHAT_WORKER.fetch("https://group-chat-worker/bot-message", botReq)
        : await fetch("https://group-chat-worker.torarnehave.workers.dev/bot-message", botReq);
      if (!post.ok) return jsonResponse({ ok: false, error: "Kunne ikke levere meldingen. Pr\xF8v igjen." }, 502);
      return jsonResponse({ ok: true });
    }
    const verifyPublishToken = async (token, secret) => {
      try {
        const [headerB64, payloadB64, sigB64] = String(token || "").split(".");
        if (!headerB64 || !payloadB64 || !sigB64) return null;
        const data = `${headerB64}.${payloadB64}`;
        const key = await crypto.subtle.importKey(
          "raw",
          new TextEncoder().encode(secret),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["verify"]
        );
        const b64ToBytes = (s) => {
          const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - s.length % 4) % 4));
          const out = new Uint8Array(b.length);
          for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
          return out;
        };
        const ok = await crypto.subtle.verify("HMAC", key, b64ToBytes(sigB64), new TextEncoder().encode(data));
        if (!ok) return null;
        const claims = JSON.parse(new TextDecoder().decode(b64ToBytes(payloadB64)));
        if (!claims || claims.exp && Math.floor(Date.now() / 1e3) > Number(claims.exp)) return null;
        return claims;
      } catch {
        return null;
      }
    };
    if (url.pathname === "/__contact/route") {
      if (request.method === "OPTIONS") return jsonResponse({ ok: true });
      if (request.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
      if (!env.CONTACT_KV) return jsonResponse({ ok: false, error: "CONTACT_KV binding missing" }, 500);
      if (!env.HTML_PUBLISH_SECRET) return jsonResponse({ ok: false, error: "HTML_PUBLISH_SECRET not configured" }, 500);
      let body = null;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
      }
      const graphId = String(body?.graphId || "").trim();
      const nodeId = String(body?.nodeId || "").trim();
      const groupId = String(body?.group_id || "").trim();
      const botId = String(body?.bot_id || "").trim();
      if (!graphId || !nodeId || !groupId || !botId) {
        return jsonResponse({ ok: false, error: "Missing graphId, nodeId, group_id or bot_id" }, 400);
      }
      const claims = await verifyPublishToken(body?.token, env.HTML_PUBLISH_SECRET);
      if (!claims || !Array.isArray(claims.scope) || !claims.scope.includes("contact-route")) {
        return jsonResponse({ ok: false, error: "Invalid or missing route token" }, 401);
      }
      if (claims.graphId !== graphId || claims.nodeId !== nodeId) {
        return jsonResponse({ ok: false, error: "Route token is not scoped to this node" }, 403);
      }
      await env.CONTACT_KV.put(
        "c:route:" + graphId + ":" + nodeId,
        JSON.stringify({ group_id: groupId, bot_id: botId, updatedBy: claims.uid || null, updatedAt: Date.now() })
      );
      return jsonResponse({ ok: true });
    }
    if (url.pathname === "/__html/publish") {
      if (request.method === "OPTIONS") {
        return jsonResponse({ ok: true });
      }
      if (request.method !== "POST") {
        return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
      }
      if (!env.HTML_PAGES) {
        return jsonResponse({ ok: false, error: "HTML_PAGES binding missing" }, 500);
      }
      if (!env.HTML_PUBLISH_SECRET) {
        return jsonResponse({ ok: false, error: "HTML_PUBLISH_SECRET not configured" }, 500);
      }
      let payload = null;
      try {
        payload = await request.json();
      } catch {
        return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
      }
      const claims = await verifyPublishToken(request.headers.get("X-Publish-Token"), env.HTML_PUBLISH_SECRET);
      if (!claims) {
        return jsonResponse({ ok: false, error: "Invalid or missing publish token" }, 401);
      }
      const claimHost = String(claims.hostname || "").trim().toLowerCase();
      const bodyHost = String(payload?.hostname || "").trim().toLowerCase();
      if (!claimHost || claimHost !== bodyHost) {
        return jsonResponse({ ok: false, error: "Publish token is not scoped to this hostname" }, 403);
      }
      const hostname = String(payload?.hostname || "").trim().toLowerCase();
      const html = String(payload?.html || "");
      const overwrite = Boolean(payload?.overwrite);
      if (!hostname || !html) {
        return jsonResponse({ ok: false, error: "hostname and html are required" }, 400);
      }
      const key = `html:${hostname}`;
      const existing = await env.HTML_PAGES.get(key);
      if (existing && !overwrite) {
        return jsonResponse(
          { ok: false, error: "Content already exists", exists: true, hostname },
          409
        );
      }
      let graphId = String(payload?.graphId || "");
      let nodeId = String(payload?.nodeId || "");
      if (!graphId) {
        const graphMatch = html.match(/const\s+GRAPH_ID\s*=\s*['"]([^'"]+)['"]/);
        if (graphMatch) graphId = graphMatch[1];
      }
      if (!nodeId) {
        const nodeMatch = html.match(/const\s+NODE_ID\s*=\s*['"]([^'"]+)['"]/);
        if (nodeMatch) nodeId = nodeMatch[1];
      }
      await env.HTML_PAGES.put(key, html, {
        metadata: { graphId, nodeId, publishedAt: (/* @__PURE__ */ new Date()).toISOString(), publishedBy: claims.uid || null }
      });
      return jsonResponse({ ok: true, hostname });
    }
    if (url.pathname === "/__html/check") {
      if (request.method === "OPTIONS") {
        return jsonResponse({ ok: true });
      }
      if (request.method !== "GET") {
        return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
      }
      if (!env.HTML_PAGES) {
        return jsonResponse({ ok: false, error: "HTML_PAGES binding missing" }, 500);
      }
      const hostname = String(url.searchParams.get("hostname") || "").trim().toLowerCase();
      if (!hostname) {
        return jsonResponse({ ok: false, error: "hostname is required" }, 400);
      }
      const { value: existing, metadata } = await env.HTML_PAGES.getWithMetadata(
        `html:${hostname}`
      );
      return jsonResponse({
        ok: true,
        hostname,
        exists: Boolean(existing),
        metadata: metadata || null
      });
    }
    // Reading the icon without downloading and parsing the whole page: the caller asks this
    // worker, which already holds the published HTML, and gets back JSON. Must sit ABOVE the
    // page-serving block below, which answers every other path with the page itself.
    if (url.pathname === "/__favicon") {
      if (request.method === "OPTIONS") return jsonResponse({ ok: true });
      if (request.method !== "GET") return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
      if (!env.HTML_PAGES) return jsonResponse({ ok: false, error: "HTML_PAGES binding missing" }, 500);
      const host = String(url.searchParams.get("hostname") || url.hostname).trim().toLowerCase();
      if (!/^[a-z0-9.-]{1,253}$/.test(host)) {
        return jsonResponse({ ok: false, error: "Invalid hostname" }, 400);
      }
      let page = null;
      for (const key of htmlKeysFor(host)) {
        page = await env.HTML_PAGES.get(key);
        if (page) break;
      }
      if (!page) {
        return jsonResponse({ ok: false, error: "No published page for this hostname", hostname: host }, 404);
      }
      const icons = await extractIcons(page, host);
      const best = pickBestIcon(icons);
      return jsonResponse({
        ok: true,
        hostname: host,
        favicon: best ? best.href : null,
        icons: icons.map(({ px, ...rest }) => rest)
      });
    }
    if (env.HTML_PAGES && url.pathname !== "/branding.json") {
      for (const key of htmlKeysFor(url.hostname)) {
        const html = await env.HTML_PAGES.get(key);
        if (html) {
          if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: CORS_READ_HEADERS });
          }
          return new Response(injectContactFormScript(html), {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
              ...CORS_READ_HEADERS
            }
          });
        }
      }
    }
    try {
      let targetUrl;
      if (url.pathname.startsWith("/getknowgraphs") || url.pathname.startsWith("/getknowgraph") || url.pathname.startsWith("/saveknowgraph") || url.pathname.startsWith("/updateknowgraph") || url.pathname.startsWith("/deleteknowgraph") || url.pathname.startsWith("/saveGraphWithHistory")) {
        targetUrl = "https://knowledge-graph-worker.torarnehave.workers.dev" + url.pathname + url.search;
      } else if (url.pathname.startsWith("/mystmkrasave") || url.pathname.startsWith("/generate-header-image") || url.pathname.startsWith("/grok-ask") || url.pathname.startsWith("/grok-elaborate") || url.pathname.startsWith("/apply-style-template")) {
        targetUrl = "https://api.vegvisr.org" + url.pathname + url.search;
      } else {
        targetUrl = "https://www.vegvisr.org" + url.pathname + url.search;
      }
      const headers = new Headers(request.headers);
      headers.set("x-original-hostname", url.hostname);
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
      } catch (jsonError) {
        console.log("Response is not JSON, returning as-is:", jsonError.message);
        const responseHeaders = Object.fromEntries(response.headers);
        delete responseHeaders["access-control-allow-origin"];
        return new Response(response.body, {
          status: response.status,
          headers: {
            ...responseHeaders,
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
