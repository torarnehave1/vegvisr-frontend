// Recovered from the DEPLOYED worker on Cloudflare, because the local source was lost.
// esbuild bundling undone: inlined npm dependencies removed, imports restored below, and the
// `__name(fn, "fn")` helpers esbuild adds after each function declaration stripped.
// Variable names may differ from the original where esbuild renamed to avoid collisions
// (env2, error3, account2 …), and original comments are gone. The logic is what production runs.

import PostalMime from 'postal-mime'

function addCorsHeaders(response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, X-API-Token, x-user-role, x-user-email, x-user-id, Accept"
  );
  response.headers.set("Access-Control-Max-Age", "600");
  return response;
}
function renderTemplate(template, variables) {
  let renderedSubject = template.subject;
  let renderedBody = template.body;
  for (const [key, value] of Object.entries(variables)) {
    const singleBracePlaceholder = `{${key}}`;
    const doubleBracePlaceholder = `{{${key}}}`;
    renderedSubject = renderedSubject.replace(
      new RegExp(singleBracePlaceholder.replace(/[{}]/g, "\\$&"), "g"),
      value
    );
    renderedSubject = renderedSubject.replace(
      new RegExp(doubleBracePlaceholder.replace(/[{}]/g, "\\$&"), "g"),
      value
    );
    renderedBody = renderedBody.replace(
      new RegExp(singleBracePlaceholder.replace(/[{}]/g, "\\$&"), "g"),
      value
    );
    renderedBody = renderedBody.replace(
      new RegExp(doubleBracePlaceholder.replace(/[{}]/g, "\\$&"), "g"),
      value
    );
  }
  return {
    subject: renderedSubject,
    body: renderedBody
  };
}
function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
async function loadUserSettings(env2, userEmail2) {
  const row = await env2.vegvisr_org.prepare("SELECT data FROM config WHERE email = ?").bind(userEmail2).first();
  if (!row?.data)
    return {};
  try {
    return JSON.parse(row.data);
  } catch {
    return {};
  }
}
async function saveUserSettings(env2, userEmail2, data2) {
  const dataJson = JSON.stringify(data2);
  await env2.vegvisr_org.prepare(
    `INSERT INTO config (email, data) VALUES (?, ?)
       ON CONFLICT(email) DO UPDATE SET data = ?`
  ).bind(userEmail2, dataJson, dataJson).run();
}
var MAGIC_LINK_TABLE = "login_magic_links";
var MAGIC_LINK_EXPIRY_MINUTES = 30;
var MAGIC_LINK_BASE = "https://www.vegvisr.org/login";
var MAGIC_LINK_COOKIE_NAME = "vegvisr_token";
function isValidEmail(email) {
  return typeof email === "string" && /.+@.+\..+/.test(email);
}
async function resolveCaller(request, env2) {
  const internalAuth = request.headers.get("x-internal-auth") || "";
  const internalCaller = request.headers.get("x-internal-caller") || "";
  if (internalAuth) {
    if (!env2.INTERNAL_SHARED_SECRET) {
      return { ok: false, status: 500, error: "INTERNAL_SHARED_SECRET not configured on this worker" };
    }
    if (internalAuth !== env2.INTERNAL_SHARED_SECRET) {
      return { ok: false, status: 401, error: "invalid x-internal-auth" };
    }
    if (!internalCaller || !isValidEmail(internalCaller)) {
      return { ok: false, status: 400, error: "x-internal-caller missing or not a valid email" };
    }
    return { ok: true, email: internalCaller.toLowerCase(), mode: "internal" };
  }
  const apiToken = request.headers.get("x-api-token") || "";
  if (apiToken) {
    try {
      const row = await env2.vegvisr_org.prepare("SELECT email, Role FROM config WHERE emailVerificationToken = ?").bind(apiToken).first();
      if (row?.email) {
        return { ok: true, email: String(row.email).toLowerCase(), role: row.Role || null, mode: "apitoken" };
      }
      return { ok: false, status: 401, error: "invalid X-API-Token" };
    } catch (err) {
      return { ok: false, status: 502, error: `token lookup error: ${err.message}` };
    }
  }
  const cookie = request.headers.get("cookie") || "";
  const authorization = request.headers.get("authorization") || "";
  if (!cookie && !authorization) {
    return { ok: false, status: 401, error: "authentication required (no cookie or Authorization header)" };
  }
  try {
    const upstream = await fetch("https://auth.vegvisr.org/auth/openauth/session", {
      method: "GET",
      headers: {
        ...cookie ? { cookie } : {},
        ...authorization ? { authorization } : {}
      }
    });
    if (!upstream.ok) {
      return { ok: false, status: 401, error: `session check failed (${upstream.status})` };
    }
    const data2 = await upstream.json().catch(() => null);
    if (!data2?.success || !data2?.subject?.email) {
      return { ok: false, status: 401, error: "invalid session" };
    }
    return { ok: true, email: String(data2.subject.email).toLowerCase(), role: data2.subject.role || null, mode: "session" };
  } catch (err) {
    return { ok: false, status: 502, error: `session lookup error: ${err.message}` };
  }
}
async function requireOwnership(request, env2, claimedUserEmail) {
  const caller = await resolveCaller(request, env2);
  if (!caller.ok)
    return caller;
  const claimed = (claimedUserEmail || "").toLowerCase().trim();
  const isSuper = (caller.role || "").toLowerCase() === "superadmin";
  if (claimed && caller.email !== claimed && !isSuper) {
    return { ok: false, status: 403, error: `caller ${caller.email} cannot act on behalf of ${claimed}` };
  }
  return { ok: true, email: caller.email, role: caller.role || null, mode: caller.mode };
}
function authFailResponse(authResult) {
  return addCorsHeaders(
    new Response(
      JSON.stringify({ success: false, error: authResult.error || "unauthorized" }),
      { status: authResult.status || 401, headers: { "Content-Type": "application/json" } }
    )
  );
}
async function cfRoutingApi(env2, method, path = "", body = void 0) {
  const token = env2.CF_EMAIL_ROUTING_TOKEN;
  const accountId2 = env2.CF_ACCOUNT_ID;
  if (!token)
    return { ok: false, status: 500, error: "CF_EMAIL_ROUTING_TOKEN not configured on this worker" };
  if (!accountId2)
    return { ok: false, status: 500, error: "CF_ACCOUNT_ID not configured on this worker" };
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId2}/email/routing/addresses${path}`;
  const init = {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  };
  if (body !== void 0)
    init.body = JSON.stringify(body);
  let res, data2;
  try {
    res = await fetch(url, init);
  } catch (err) {
    return { ok: false, status: 502, error: `CF API fetch failed: ${err.message}` };
  }
  try {
    data2 = await res.json();
  } catch {
    data2 = null;
  }
  if (!res.ok || !data2?.success) {
    const firstErr = data2?.errors?.[0];
    return {
      ok: false,
      status: res.status,
      error: firstErr?.message || `CF API error (HTTP ${res.status})`,
      cfErrors: data2?.errors || []
    };
  }
  return { ok: true, status: res.status, result: data2.result, resultInfo: data2.result_info };
}
function buildMagicLink(token, redirectUrl = null, env2 = {}) {
  const base = redirectUrl || env2.MAGIC_LINK_BASE || MAGIC_LINK_BASE;
  try {
    const url = new URL(base);
    url.searchParams.set("magic", token);
    return url.toString();
  } catch {
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}magic=${encodeURIComponent(token)}`;
  }
}
async function ensureMagicLinkTable(env2) {
  await env2.vegvisr_org.prepare(
    `CREATE TABLE IF NOT EXISTS ${MAGIC_LINK_TABLE} (
        token TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        used_at TEXT,
        redirect_url TEXT
      )`
  ).run();
}
async function storeMagicLink(env2, email, token, expiresAt, redirectUrl) {
  await env2.vegvisr_org.prepare(
    `INSERT INTO ${MAGIC_LINK_TABLE} (token, email, created_at, expires_at, used, redirect_url)
       VALUES (?1, ?2, ?3, ?4, 0, ?5)`
  ).bind(token, email, (/* @__PURE__ */ new Date()).toISOString(), expiresAt, redirectUrl || null).run();
}
async function getMagicLink(env2, token) {
  return env2.vegvisr_org.prepare(`SELECT * FROM ${MAGIC_LINK_TABLE} WHERE token = ?1`).bind(token).first();
}
async function markMagicLinkUsed(env2, token) {
  await env2.vegvisr_org.prepare(`UPDATE ${MAGIC_LINK_TABLE} SET used = 1, used_at = ?1 WHERE token = ?2`).bind((/* @__PURE__ */ new Date()).toISOString(), token).run();
}
async function resolveWorldEmailTemplate(env2, domain2, purpose, preferredLangs = ["no", "en"]) {
  if (!domain2 || !env2.KNOWLEDGE_GRAPH_WORKER)
    return null;
  try {
    const emailMarker = `EMAIL-${String(domain2).toLowerCase()}`;
    const sr = await env2.KNOWLEDGE_GRAPH_WORKER.fetch(
      `https://knowledge-graph-worker/getknowgraphsummaries?metaArea=${encodeURIComponent(emailMarker)}&limit=10`,
      { headers: { "x-user-role": "Superadmin" } }
    );
    if (!sr.ok)
      return null;
    const summaries = await sr.json().catch(() => ({}));
    const found = (summaries.results || summaries.graphs || [])[0];
    if (!found || !found.id)
      return null;
    const res = await env2.KNOWLEDGE_GRAPH_WORKER.fetch(
      `https://knowledge-graph-worker/getknowgraph?id=${encodeURIComponent(found.id)}`
    );
    if (!res.ok)
      return null;
    const graph = await res.json().catch(() => null);
    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
    if (!nodes.length)
      return null;
    const brandNode = nodes.find((n) => (n.type || "").toLowerCase() === "email-brand");
    const brand = brandNode && brandNode.metadata || {};
    const candidates = nodes.filter(
      (n) => (n.type || "").toLowerCase() === "email-template" && String(n.metadata?.purpose || "").toLowerCase() === purpose
    );
    if (!candidates.length)
      return null;
    let chosen = null;
    for (const lang of preferredLangs) {
      chosen = candidates.find((n) => String(n.metadata?.language || "").toLowerCase() === lang);
      if (chosen)
        break;
    }
    if (!chosen)
      chosen = candidates[0];
    const subject = chosen.metadata?.subject || "";
    const body = (chosen.info || "").replace(/[ \t]*<!--\s*edit:[a-z0-9-]+:(?:start|end)\s*-->[ \t]*\n?/gi, "");
    if (!subject || !body.trim())
      return null;
    return { subject, body, brand };
  } catch (e) {
    console.error("[resolveWorldEmailTemplate] error (falling back to default):", e?.message);
    return null;
  }
}
async function sendMagicLinkEmail(env2, toEmail, magicLink, sender = null) {
  const smtpUser = sender?.smtpUser || env2.MAGIC_SMTP_USER || "torarnehave@gmail.com";
  const fromEmail = sender?.fromEmail || env2.MAGIC_SMTP_FROM || smtpUser;
  const rawAppPassword = sender?.appPassword || env2.MAGIC_SMTP_APP_PASSWORD || env2.TAHGMAIL;
  if (!rawAppPassword) {
    throw new Error("TAHGMAIL app password is not configured");
  }
  const appPassword2 = rawAppPassword.replace(/\s+/g, "");
  if (!appPassword2) {
    throw new Error("Magic link app password resolved to an empty value after sanitization");
  }
  if (!env2.SLOWYOU_API_TOKEN) {
    throw new Error("SLOWYOU_API_TOKEN is not configured");
  }
  let meetingId = null;
  try {
    const parsedUrl = new URL(magicLink);
    meetingId = parsedUrl.searchParams.get("meetingId");
  } catch {
  }
  let subject, html;
  if (meetingId) {
    subject = "You have been invited to a Vegvisr meeting";
    html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111; max-width: 480px; margin: 0 auto;">
        <div style="background: #0f172a; padding: 24px 32px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px; letter-spacing: -0.5px;">\u{1F4F9} Meeting Invitation</h1>
        </div>
        <div style="background: #f8fafc; padding: 28px 32px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="font-size: 16px; margin-top: 0;">You have been invited to join a live meeting on <strong>Vegvisr Realtime</strong>.</p>
          <div style="background: #e0f2fe; border-left: 4px solid #0284c7; border-radius: 4px; padding: 12px 16px; margin: 20px 0;">
            <p style="margin: 0; color: #0369a1; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Meeting ID</p>
            <p style="margin: 4px 0 0; color: #0c4a6e; font-size: 18px; font-family: monospace; font-weight: bold; letter-spacing: 1px;">${meetingId}</p>
          </div>
          <p style="color: #475569;">Click the button below to join. You may be held in the waiting room until the host lets you in. This link expires in <strong>${MAGIC_LINK_EXPIRY_MINUTES} minutes</strong>.</p>
          <p style="text-align: center; margin: 28px 0;">
            <a href="${magicLink}" style="background:#0284c7;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;display:inline-block;font-size:16px;font-weight:600;">Join Meeting</a>
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #94a3b8; margin-bottom: 0;">If you did not expect this invitation, you can safely ignore this email.</p>
          <p style="font-size: 12px; color: #94a3b8; margin-top: 6px;">Link: <a href="${magicLink}" style="color:#0284c7;">${magicLink}</a></p>
        </div>
      </div>
    `;
  } else {
    subject = "Your Vegvisr login link";
    html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
        <h2>Sign in to Vegvisr</h2>
        <p>Click the button below to finish signing in. This link expires in ${MAGIC_LINK_EXPIRY_MINUTES} minutes.</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${magicLink}" style="background:#2563eb;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Continue to Vegvisr</a>
        </p>
        <p>If you did not request this, you can ignore this email.</p>
        <p style="font-size: 12px; color: #555;">Link: ${magicLink}</p>
      </div>
    `;
  }
  if (sender?.domain) {
    const purpose = meetingId ? "meeting" : "login";
    const tmpl = await resolveWorldEmailTemplate(env2, sender.domain, purpose);
    if (tmpl) {
      const vars = {
        magicLink,
        expiryMinutes: String(MAGIC_LINK_EXPIRY_MINUTES),
        meetingId: meetingId || "",
        brandName: tmpl.brand.name || "",
        brandLogo: tmpl.brand.logo || "",
        brandAccent: tmpl.brand.accent || "",
        brandFromName: tmpl.brand.fromName || "",
        brandFooter: tmpl.brand.footer || ""
      };
      const rendered = renderTemplate({ subject: tmpl.subject, body: tmpl.body }, vars);
      subject = rendered.subject;
      html = rendered.body;
    }
  }
  const senderAccountType = (sender?.accountType || "gmail").toLowerCase();
  const cfAccountId = sender?.cfAccountId || null;
  if (senderAccountType === "cf-email-service" && cfAccountId) {
    const cfResp = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/email/sending/send`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${appPassword2}` },
        body: JSON.stringify({ from: fromEmail, to: toEmail, subject, html })
      }
    );
    const cfText = await cfResp.text();
    let cfJson;
    try {
      cfJson = JSON.parse(cfText);
    } catch {
      cfJson = { raw: cfText };
    }
    if (!cfResp.ok || cfJson.success === false) {
      const em = Array.isArray(cfJson.errors) && cfJson.errors.length ? cfJson.errors.map((e) => e.message || JSON.stringify(e)).join("; ") : cfJson.raw || cfText;
      throw new Error(`Failed to send magic link email via Cloudflare Email Service: ${em}`);
    }
    return;
  }
  const slowyouUrl = env2.SLOWYOU_SEND_EMAIL_URL || "https://slowyou.io/api/send-email-custom-credentials";
  const basicAuth = btoa(`${smtpUser}:${appPassword2}`);
  const response = await fetch(slowyouUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Token": env2.SLOWYOU_API_TOKEN,
      Authorization: `Basic ${basicAuth}`
    },
    body: JSON.stringify({
      senderEmail: smtpUser,
      authEmail: smtpUser,
      fromEmail,
      toEmail,
      subject,
      body: html
    })
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Failed to send magic link email: ${response.status} ${responseText}`);
  }
}
function domainCandidates(host) {
  const parts = String(host || "").toLowerCase().split(".").filter(Boolean);
  const out = [];
  for (let i = 0; i < parts.length - 1; i++)
    out.push(parts.slice(i).join("."));
  return out;
}
async function resolveWhiteLabelSender(env2, redirectUrl) {
  if (!redirectUrl)
    return null;
  let host;
  try {
    host = new URL(redirectUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!host || host.endsWith("vegvisr.org"))
    return null;
  let founderEmail = null;
  let matchedDomain = null;
  for (const cand of domainCandidates(host)) {
    const row = await env2.vegvisr_org.prepare("SELECT founder_email FROM world_founders WHERE domain = ?").bind(cand).first();
    if (row?.founder_email) {
      founderEmail = row.founder_email;
      matchedDomain = cand;
      break;
    }
  }
  if (!founderEmail)
    return null;
  const data2 = await loadUserSettings(env2, founderEmail);
  const settings = data2.settings || {};
  const accounts2 = Array.isArray(settings.emailAccounts) ? settings.emailAccounts : [];
  const passwords2 = settings.emailAccountPasswords || {};
  const account2 = accounts2.find((a) => a.email && a.email.toLowerCase().endsWith("@" + matchedDomain) && passwords2[a.id]) || accounts2.find((a) => a.isDefault && passwords2[a.id]) || accounts2.find((a) => passwords2[a.id]);
  if (!account2)
    return null;
  const appPassword2 = passwords2[account2.id];
  if (!appPassword2)
    return null;
  return {
    smtpUser: account2.email,
    appPassword: appPassword2,
    fromEmail: account2.email,
    founderEmail,
    domain: matchedDomain,
    // Sender backend: 'gmail' → slowyou Gmail SMTP; 'cf-email-service' → Cloudflare Email Service
    // REST (the "appPassword" is then a CF API token, and cfAccountId is required).
    accountType: (account2.accountType || "gmail").toLowerCase(),
    cfAccountId: account2.cfAccountId || null
  };
}
async function isLoginAllowed(env2, redirectUrl, targetEmail) {
  let host = "";
  try {
    host = redirectUrl ? new URL(redirectUrl).hostname.toLowerCase() : "";
  } catch {
    host = "";
  }
  if (!host || host.endsWith("vegvisr.org"))
    return true;
  const email = (targetEmail || "").toLowerCase().trim();
  if (!email)
    return false;
  try {
    const so = await env2.vegvisr_org.prepare("SELECT 1 FROM system_owners WHERE lower(email) = ?").bind(email).first();
    if (so)
      return true;
  } catch (err) {
    console.warn("system_owners check failed:", err);
  }
  for (const cand of domainCandidates(host)) {
    try {
      const f = await env2.vegvisr_org.prepare("SELECT 1 FROM world_founders WHERE domain = ? AND lower(founder_email) = ?").bind(cand, email).first();
      if (f)
        return true;
    } catch (err) {
      console.warn("world_founders check failed:", err);
    }
  }
  return false;
}
function generateInvitationToken() {
  return crypto.randomUUID();
}
function generateSlowyouLink(email, role, callbackUrl) {
  const baseUrl = "https://slowyou.io/api/reg-user-vegvisr";
  const params = new URLSearchParams({
    email,
    role: role || "subscriber",
    callback: callbackUrl
  });
  return `${baseUrl}?${params.toString()}`;
}
var email_worker_default = {
  // Inbound email handler (Cloudflare Email Routing)
  async email(message, env2) {
    const defaultStoreUrl = env2.VEMAIL_STORE_URL || "https://vemail-store-worker.post-e91.workers.dev";
    let storeUrl = defaultStoreUrl;
    try {
      const recipientAddr = message.to;
      const rows = await env2.vegvisr_org.prepare("SELECT data FROM config").all();
      for (const row of rows.results || []) {
        try {
          const parsed = JSON.parse(row.data);
          const accounts2 = parsed?.settings?.emailAccounts || [];
          for (const acct of accounts2) {
            const emails = [acct.email, ...acct.aliases || []];
            if (emails.some((e) => e && e.toLowerCase() === recipientAddr.toLowerCase())) {
              if (acct.storeUrl) {
                storeUrl = acct.storeUrl;
                break;
              }
            }
          }
        } catch {
        }
        if (storeUrl !== defaultStoreUrl)
          break;
      }
    } catch (err) {
      console.error("[email-worker email()] Store URL lookup failed, using default:", err);
    }
    try {
      function uint8ToBase64(bytes) {
        const CHUNK = 8192;
        let binary = "";
        for (let i = 0; i < bytes.length; i += CHUNK) {
          const chunk = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
          binary += String.fromCharCode.apply(null, chunk);
        }
        return btoa(binary);
      }
      const rawBytes = await new Response(message.raw).arrayBuffer();
      const rawUint8 = new Uint8Array(rawBytes);
      const parser = new PostalMime();
      const parsed = await parser.parse(rawUint8);
      const recipientEmail = message.to;
      const fromAddress = parsed.from?.address || message.from;
      const fromName = parsed.from?.name || "";
      const toAddress = parsed.to?.[0]?.address || recipientEmail;
      const subject = parsed.subject || "(no subject)";
      const textBody = parsed.text || "";
      let htmlBody = parsed.html || "";
      if (!htmlBody && textBody) {
        htmlBody = `<pre style="white-space:pre-wrap;word-break:break-word;font-family:inherit">${textBody.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`;
      }
      const snippet = textBody.slice(0, 200);
      const attachments = (parsed.attachments || []).map((att) => {
        const bytes = new Uint8Array(att.content);
        return {
          filename: att.filename || "attachment",
          mimeType: att.mimeType || "application/octet-stream",
          sizeBytes: bytes.length,
          contentBase64: uint8ToBase64(bytes)
        };
      });
      const rawEmailBase64 = uint8ToBase64(rawUint8);
      const receivedAt = parsed.date ? new Date(parsed.date).toISOString() : void 0;
      const storeRes = await fetch(`${storeUrl}/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: recipientEmail,
          folder: "inbox",
          fromAddress,
          fromName,
          toAddress,
          subject,
          snippet,
          bodyHtml: htmlBody,
          bodyText: textBody || void 0,
          rawEmail: rawEmailBase64,
          messageId: parsed.messageId || null,
          receivedAt,
          attachments: attachments.length > 0 ? attachments : void 0
        })
      });
      if (!storeRes.ok) {
        const errText = await storeRes.text();
        console.error("[email-worker email()] Store error:", storeRes.status, errText);
      } else {
        console.log(`[email-worker email()] Stored inbound email from ${fromAddress} to ${recipientEmail}: ${subject}`);
      }
    } catch (err) {
      console.error("[email-worker email()] Failed to process inbound email:", err);
    }
  },
  async fetch(request, env2) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (method === "OPTIONS") {
      return addCorsHeaders(new Response(null, { status: 204 }));
    }
    try {
      if (path === "/health" && method === "GET") {
        return addCorsHeaders(
          new Response(
            JSON.stringify({
              status: "healthy",
              worker: "email-worker",
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" }
            }
          )
        );
      }
      if (path === "/openapi.json" && method === "GET") {
        const spec = {
          openapi: "3.0.3",
          info: {
            title: "Email Worker API",
            version: "1.0.0",
            description: "Cloudflare Worker for email sending, template management, magic-link auth, Gmail sync, and email account management."
          },
          paths: {
            "/health": {
              get: {
                summary: "Health check",
                description: "Returns the health status of the email worker.",
                responses: {
                  "200": {
                    description: "Worker is healthy",
                    content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", example: "healthy" }, worker: { type: "string", example: "email-worker" }, timestamp: { type: "string", format: "date-time" } } } } }
                  }
                }
              }
            },
            "/openapi.json": {
              get: {
                summary: "OpenAPI specification",
                description: "Returns this OpenAPI 3.0 JSON specification.",
                responses: {
                  "200": {
                    description: "OpenAPI spec",
                    content: { "application/json": { schema: { type: "object" } } }
                  }
                }
              }
            },
            "/render-template": {
              post: {
                summary: "Render an email template",
                description: "Renders an email template by ID with the supplied variables.",
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["templateId"], properties: { templateId: { type: "string", description: "ID of the template in email_templates table" }, variables: { type: "object", additionalProperties: { type: "string" }, description: "Key-value pairs to substitute in the template" } } } } }
                },
                responses: {
                  "200": { description: "Rendered template", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, template: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, type: { type: "string" }, language: { type: "string" }, subject: { type: "string" }, body: { type: "string" } } } } } } } },
                  "400": { description: "Missing templateId" },
                  "404": { description: "Template not found" },
                  "500": { description: "Rendering error" }
                }
              }
            },
            "/generate-invitation": {
              post: {
                summary: "Generate a room invitation",
                description: "Creates an invitation token, stores it in D1, and returns a slowyou.io registration link.",
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["recipientEmail", "roomId", "inviterName", "inviterUserId"], properties: { recipientEmail: { type: "string", format: "email" }, roomId: { type: "string" }, inviterName: { type: "string" }, inviterUserId: { type: "string" }, invitationMessage: { type: "string" } } } } }
                },
                responses: {
                  "200": { description: "Invitation created", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, invitationToken: { type: "string" }, slowyouLink: { type: "string" }, callbackUrl: { type: "string" }, expiresAt: { type: "string", format: "date-time" } } } } } },
                  "400": { description: "Missing required fields" },
                  "500": { description: "Server error" }
                }
              }
            },
            "/generate-slowyou-link": {
              post: {
                summary: "Generate a slowyou.io registration link",
                description: "Builds a slowyou.io link for the given email, role, and callback URL.",
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["email", "callbackUrl"], properties: { email: { type: "string", format: "email" }, role: { type: "string", default: "subscriber" }, callbackUrl: { type: "string", format: "uri" } } } } }
                },
                responses: {
                  "200": { description: "Link generated", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, slowyouLink: { type: "string" }, email: { type: "string" }, role: { type: "string" } } } } } },
                  "400": { description: "Missing email or callbackUrl" },
                  "500": { description: "Server error" }
                }
              }
            },
            "/send-gmail-email": {
              post: {
                summary: "Send email via Gmail SMTP",
                description: "Sends an email through slowyou.io using user-provided Gmail app password. Supports direct credentials or D1 account lookup.",
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", properties: { senderEmail: { type: "string", format: "email" }, authEmail: { type: "string", format: "email", description: "SMTP auth email (defaults to senderEmail)" }, fromEmail: { type: "string", format: "email", description: "Display From address" }, appPassword: { type: "string", description: "Gmail app password" }, toEmail: { type: "string", format: "email" }, subject: { type: "string" }, html: { type: "string", description: "HTML body" }, userEmail: { type: "string", format: "email", description: "Alternative: look up credentials by user" }, accountId: { type: "string", description: "Alternative: account ID to resolve credentials" } } } } }
                },
                responses: {
                  "200": { description: "Email sent", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, result: { type: "object" } } } } } },
                  "400": { description: "Missing required fields or no app password" },
                  "404": { description: "Account not found" },
                  "500": { description: "Server error" }
                }
              }
            },
            "/send-email": {
              post: {
                summary: "Send email via domain SMTP",
                description: "Sends email through Postfix SMTP relay at smtp.vegvisr.org via slowyou.io. Resolves per-user SMTP credentials from D1.",
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", properties: { fromEmail: { type: "string", format: "email" }, toEmail: { type: "string", format: "email" }, subject: { type: "string" }, html: { type: "string", description: "HTML body (required if no text)" }, text: { type: "string", description: "Plain text body (required if no html)" }, userEmail: { type: "string", format: "email", description: "Alternative: resolve fromEmail from account" }, accountId: { type: "string", description: "Alternative: account ID to resolve" } } } } }
                },
                responses: {
                  "200": { description: "Email sent", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, result: { type: "object" } } } } } },
                  "400": { description: "Missing required fields" },
                  "404": { description: "Account not found" },
                  "500": { description: "Server error" }
                }
              }
            },
            "/login/magic/send": {
              post: {
                summary: "Send magic login link",
                description: "Generates a magic-link token, stores it in D1, and emails the link to the user.",
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["email"], properties: { email: { type: "string", format: "email" }, redirectUrl: { type: "string", format: "uri", description: "URL to redirect after verification" } } } } }
                },
                responses: {
                  "200": { description: "Magic link sent", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, email: { type: "string" }, expiresAt: { type: "string", format: "date-time" } } } } } },
                  "400": { description: "Invalid email" },
                  "500": { description: "Server error" }
                }
              }
            },
            "/login/magic/verify": {
              post: {
                summary: "Verify magic login token (POST)",
                description: "Consumes a magic-link token and returns the authenticated email. Sets an HttpOnly cookie on vegvisr.org domains.",
                requestBody: {
                  required: false,
                  content: { "application/json": { schema: { type: "object", properties: { token: { type: "string", description: "Magic-link token (also accepted as query param)" } } } } }
                },
                parameters: [{ name: "token", in: "query", schema: { type: "string" }, description: "Magic-link token" }],
                responses: {
                  "200": { description: "Token verified", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, email: { type: "string" }, expiresAt: { type: "string" }, redirectUrl: { type: "string", nullable: true } } } } } },
                  "400": { description: "Token missing" },
                  "404": { description: "Token not found" },
                  "410": { description: "Token already used or expired" },
                  "500": { description: "Server error" }
                }
              },
              get: {
                summary: "Verify magic login token (GET)",
                description: "Same as POST but token is passed as a query parameter.",
                parameters: [{ name: "token", in: "query", required: true, schema: { type: "string" }, description: "Magic-link token" }],
                responses: {
                  "200": { description: "Token verified" },
                  "400": { description: "Token missing" },
                  "404": { description: "Token not found" },
                  "410": { description: "Token already used or expired" },
                  "500": { description: "Server error" }
                }
              }
            },
            "/templates": {
              get: {
                summary: "List active email templates",
                description: "Returns active email templates, optionally filtered by language and type.",
                parameters: [
                  { name: "language", in: "query", schema: { type: "string", default: "en" }, description: "Language code filter" },
                  { name: "type", in: "query", schema: { type: "string" }, description: "Template type filter" }
                ],
                responses: {
                  "200": { description: "List of templates", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, templates: { type: "array", items: { type: "object" } } } } } } },
                  "500": { description: "Server error" }
                }
              }
            },
            "/templates/{id}": {
              get: {
                summary: "Get a specific active template",
                description: "Returns a single active email template by ID.",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Template ID" }],
                responses: {
                  "200": { description: "Template found", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, template: { type: "object" } } } } } },
                  "404": { description: "Template not found" },
                  "500": { description: "Server error" }
                }
              }
            },
            "/test-main-worker": {
              get: {
                summary: "Test main worker binding",
                description: "Calls the main worker via service binding to verify connectivity.",
                responses: {
                  "200": { description: "Main worker response", content: { "application/json": { schema: { type: "object", properties: { message: { type: "string" }, mainWorkerResponse: { type: "string" } } } } } },
                  "500": { description: "Binding call failed" }
                }
              }
            },
            "/render-and-send-template": {
              post: {
                summary: "Render and send a template email",
                description: "Renders an email template with variables and sends it to the specified recipient.",
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["templateId", "toEmail"], properties: { templateId: { type: "string" }, toEmail: { type: "string", format: "email" }, variables: { type: "object", additionalProperties: { type: "string" } }, domain: { type: "string", default: "vegvisr.org" } } } } }
                },
                responses: {
                  "200": { description: "Template rendered and sent", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, message: { type: "string" }, template: { type: "object" }, email: { type: "object" }, rendered: { type: "object" } } } } } },
                  "400": { description: "Missing templateId or toEmail" },
                  "404": { description: "Template not found" },
                  "500": { description: "Rendering error" }
                }
              }
            },
            "/graph-templates": {
              get: {
                summary: "List graph templates",
                description: "Returns available graph templates from the graphTemplates table.",
                responses: {
                  "200": { description: "List of graph templates", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, templates: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, variables: { type: "string" } } } } } } } } },
                  "500": { description: "Server error" }
                }
              }
            },
            "/email-templates": {
              get: {
                summary: "List all email templates",
                description: "Returns all email templates (active and inactive) from the email_templates table.",
                responses: {
                  "200": { description: "List of email templates", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, templates: { type: "array", items: { type: "object" } } } } } } },
                  "500": { description: "Server error" }
                }
              },
              post: {
                summary: "Create a new email template",
                description: "Creates a new email template in the email_templates table.",
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["template_name", "subject", "body"], properties: { id: { type: "string", description: "Optional ID (auto-generated if omitted)" }, template_name: { type: "string" }, template_type: { type: "string", default: "general" }, language_code: { type: "string", default: "en" }, subject: { type: "string" }, body: { type: "string" }, variables: { type: "string", default: "[]", description: "JSON array of variable names" }, is_default: { type: "integer", default: 0 }, created_by: { type: "string", default: "email_manager" }, is_active: { type: "integer", default: 1 } } } } }
                },
                responses: {
                  "201": { description: "Template created", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, message: { type: "string" }, templateId: { type: "string" }, meta: { type: "object" } } } } } },
                  "400": { description: "Missing required fields" },
                  "500": { description: "Server error" }
                }
              }
            },
            "/email-templates/{id}": {
              get: {
                summary: "Get a single email template",
                description: "Returns a single email template by ID (active or inactive).",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                responses: {
                  "200": { description: "Template found", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, template: { type: "object" } } } } } },
                  "404": { description: "Template not found" },
                  "500": { description: "Server error" }
                }
              },
              put: {
                summary: "Update an email template",
                description: "Updates all fields of an email template by ID.",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", properties: { template_name: { type: "string" }, template_type: { type: "string" }, language_code: { type: "string" }, subject: { type: "string" }, body: { type: "string" }, variables: { type: "string" }, is_active: { type: "integer" } } } } }
                },
                responses: {
                  "200": { description: "Template updated", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, message: { type: "string" }, meta: { type: "object" } } } } } },
                  "404": { description: "Template not found" },
                  "500": { description: "Server error" }
                }
              },
              delete: {
                summary: "Delete an email template",
                description: "Permanently deletes an email template by ID.",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                responses: {
                  "200": { description: "Template deleted", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, message: { type: "string" }, meta: { type: "object" } } } } } },
                  "404": { description: "Template not found" },
                  "500": { description: "Server error" }
                }
              }
            },
            "/email-accounts": {
              get: {
                summary: "List email accounts for a user",
                description: "Returns email account metadata (no passwords) for the specified user.",
                parameters: [{ name: "user", in: "query", required: true, schema: { type: "string", format: "email" }, description: "User email address" }],
                responses: {
                  "200": { description: "Account list", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, accounts: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, email: { type: "string" }, aliases: { type: "array", items: { type: "string" } }, isDefault: { type: "boolean" }, hasPassword: { type: "boolean" }, storeUrl: { type: "string" } } } } } } } } },
                  "400": { description: "Invalid user email" },
                  "500": { description: "Server error" }
                }
              },
              post: {
                summary: "Create or update an email account",
                description: "Saves or updates an email account for a user, with optional app password stored server-side.",
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["userEmail", "account"], properties: { userEmail: { type: "string", format: "email" }, account: { type: "object", required: ["id", "email"], properties: { id: { type: "string" }, name: { type: "string" }, email: { type: "string", format: "email" }, aliases: { type: "array", items: { type: "string" } }, isDefault: { type: "boolean" }, storeUrl: { type: "string" }, accountType: { type: "string", default: "gmail" } } }, appPassword: { type: "string", description: "Gmail app password (stored server-side, never returned)" } } } } }
                },
                responses: {
                  "200": { description: "Account saved", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, account: { type: "object" } } } } } },
                  "400": { description: "Missing required fields" },
                  "500": { description: "Server error" }
                }
              },
              delete: {
                summary: "Delete an email account",
                description: "Removes an email account and its stored password for a user.",
                parameters: [
                  { name: "user", in: "query", required: true, schema: { type: "string", format: "email" }, description: "User email" },
                  { name: "id", in: "query", required: true, schema: { type: "string" }, description: "Account ID to delete" }
                ],
                responses: {
                  "200": { description: "Account deleted", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" } } } } } },
                  "400": { description: "Missing user or id" },
                  "500": { description: "Server error" }
                }
              }
            },
            "/email-accounts/sync": {
              put: {
                summary: "Bulk sync email account metadata",
                description: "Replaces all email account metadata for a user (no passwords affected).",
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["userEmail", "accounts"], properties: { userEmail: { type: "string", format: "email" }, accounts: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, email: { type: "string" }, aliases: { type: "array", items: { type: "string" } }, isDefault: { type: "boolean" }, hasPassword: { type: "boolean" }, storeUrl: { type: "string" } } } } } } } }
                },
                responses: {
                  "200": { description: "Sync complete", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" } } } } } },
                  "400": { description: "Missing userEmail or accounts" },
                  "500": { description: "Server error" }
                }
              }
            },
            "/gmail/sync-now": {
              post: {
                summary: "Trigger manual Gmail sync",
                description: "Manually triggers a Gmail inbox sync for the specified user. Fetches unread emails and stores them via vemail-store-worker.",
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["userEmail"], properties: { userEmail: { type: "string", format: "email" } } } } }
                },
                responses: {
                  "200": { description: "Sync completed", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, message: { type: "string" } } } } } },
                  "400": { description: "Missing userEmail" },
                  "500": { description: "Sync error" }
                }
              }
            }
          }
        };
        return addCorsHeaders(
          new Response(JSON.stringify(spec, null, 2), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        );
      }
      if (path === "/render-template" && method === "POST") {
        try {
          const body = await request.json();
          const { templateId, variables } = body;
          if (!templateId) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: "templateId is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              })
            );
          }
          const template = await env2.vegvisr_org.prepare("SELECT * FROM email_templates WHERE id = ? AND is_active = 1").bind(templateId).first();
          if (!template) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: "Template not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" }
              })
            );
          }
          const rendered = renderTemplate(template, variables || {});
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                template: {
                  id: template.id,
                  name: template.template_name,
                  type: template.template_type,
                  language: template.language_code,
                  subject: rendered.subject,
                  body: rendered.body
                }
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        } catch (error3) {
          console.error("Template rendering error:", error3);
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: "Template rendering failed", details: error3.message }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            )
          );
        }
      }
      if (path === "/generate-invitation" && method === "POST") {
        try {
          const body = await request.json();
          const { recipientEmail, roomId, inviterName, inviterUserId, invitationMessage } = body;
          if (!recipientEmail || !roomId || !inviterName || !inviterUserId) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: "recipientEmail, roomId, inviterName, and inviterUserId are required"
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          const invitationToken = generateInvitationToken();
          const expiresAt = /* @__PURE__ */ new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);
          try {
            await env2.vegvisr_org.prepare(
              `
                INSERT INTO invitation_tokens
                (id, recipient_email, room_id, inviter_name, inviter_user_id, invitation_message, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `
            ).bind(
              invitationToken,
              recipientEmail,
              roomId,
              inviterName,
              inviterUserId,
              invitationMessage || "",
              expiresAt.toISOString()
            ).run();
          } catch (dbError) {
            console.error("Database error in invitation generation:", dbError);
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: "Database error",
                  details: dbError.message || "Failed to store invitation token",
                  code: "DB_ERROR"
                }),
                { status: 500, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          const callbackUrl = `https://www.vegvisr.org/join-room?invitation=${invitationToken}`;
          const slowyouLink = generateSlowyouLink(recipientEmail, "subscriber", callbackUrl);
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                invitationToken,
                slowyouLink,
                callbackUrl,
                expiresAt: expiresAt.toISOString()
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        } catch (error3) {
          console.error("Invitation generation error:", error3);
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: "Invitation generation failed", details: error3.message }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            )
          );
        }
      }
      if (path === "/generate-slowyou-link" && method === "POST") {
        try {
          const body = await request.json();
          const { email, role, callbackUrl } = body;
          if (!email || !callbackUrl) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: "email and callbackUrl are required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              })
            );
          }
          const slowyouLink = generateSlowyouLink(email, role, callbackUrl);
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                slowyouLink,
                email,
                role: role || "subscriber"
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        } catch (error3) {
          console.error("Slowyou link generation error:", error3);
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: "Link generation failed", details: error3.message }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            )
          );
        }
      }
      if (path === "/send-gmail-email" && method === "POST") {
        try {
          const body = await request.json();
          let { senderEmail, authEmail, fromEmail, appPassword: appPassword2, toEmail, subject, html } = body || {};
          const { userEmail: userEmail2, accountId: accountId2 } = body || {};
          if (userEmail2 && accountId2 && !appPassword2) {
            const data2 = await loadUserSettings(env2, userEmail2);
            const settings = data2.settings || {};
            const accounts2 = Array.isArray(settings.emailAccounts) ? settings.emailAccounts : [];
            const passwords2 = settings.emailAccountPasswords || {};
            const account2 = accounts2.find((a) => a.id === accountId2);
            if (!account2) {
              return addCorsHeaders(
                new Response(
                  JSON.stringify({ success: false, error: "Account not found" }),
                  { status: 404, headers: { "Content-Type": "application/json" } }
                )
              );
            }
            appPassword2 = passwords2[accountId2];
            if (!appPassword2) {
              return addCorsHeaders(
                new Response(
                  JSON.stringify({ success: false, error: "No app password stored for this account" }),
                  { status: 400, headers: { "Content-Type": "application/json" } }
                )
              );
            }
            authEmail = account2.email;
            senderEmail = account2.email;
            if (!fromEmail)
              fromEmail = account2.email;
          }
          const smtpUser = authEmail || senderEmail;
          console.log("[email-worker /send-gmail-email] incoming", {
            senderEmail,
            authEmail,
            fromEmail,
            toEmail,
            subject,
            appPasswordLength: appPassword2 ? appPassword2.length : 0
          });
          if (!smtpUser || !appPassword2 || !toEmail || !subject || !html) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "senderEmail (or authEmail), appPassword, toEmail, subject, and html are required. Alternatively provide userEmail + accountId."
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          if (!env2.SLOWYOU_API_TOKEN) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ success: false, error: "SLOWYOU_API_TOKEN not configured" }),
                { status: 500, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          const slowyouUrl = env2.SLOWYOU_SEND_EMAIL_URL || "https://slowyou.io/api/send-email-custom-credentials";
          const basicAuth = btoa(`${smtpUser}:${appPassword2}`);
          const slowyouResponse = await fetch(slowyouUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-Token": env2.SLOWYOU_API_TOKEN,
              Authorization: `Basic ${basicAuth}`
            },
            body: JSON.stringify({
              senderEmail: smtpUser,
              authEmail: smtpUser,
              fromEmail: fromEmail || senderEmail,
              toEmail,
              subject,
              body: html
            })
          });
          console.log("[email-worker /send-gmail-email] forwarded to slowyou", {
            senderEmail: smtpUser,
            authEmail: smtpUser,
            fromEmail: fromEmail || smtpUser,
            toEmail,
            subject,
            htmlLength: html ? html.length : 0
          });
          const responseText = await slowyouResponse.text();
          if (!slowyouResponse.ok) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "Failed to send email via slowyou.io",
                  status: slowyouResponse.status,
                  details: responseText
                }),
                { status: slowyouResponse.status, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          let parsed;
          try {
            parsed = JSON.parse(responseText);
          } catch {
            parsed = { raw: responseText };
          }
          const storeUrl = env2.VEMAIL_STORE_URL || "https://vemail-store-worker.post-e91.workers.dev";
          try {
            const snippet = html ? html.replace(/<[^>]*>/g, "").slice(0, 200) : "";
            await fetch(`${storeUrl}/emails`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userEmail: userEmail2 || smtpUser,
                folder: "sent",
                fromAddress: fromEmail || smtpUser,
                fromName: "",
                toAddress: toEmail,
                subject,
                snippet,
                bodyHtml: html,
                read: 1
              })
            });
          } catch (storeErr) {
            console.error("[email-worker] Failed to store sent copy:", storeErr);
          }
          if (userEmail2 && accountId2) {
            try {
              const vdata = await loadUserSettings(env2, userEmail2);
              if (!vdata.settings)
                vdata.settings = {};
              if (!vdata.settings.emailAccountVerifiedAt)
                vdata.settings.emailAccountVerifiedAt = {};
              vdata.settings.emailAccountVerifiedAt[accountId2] = (/* @__PURE__ */ new Date()).toISOString();
              await saveUserSettings(env2, userEmail2, vdata);
            } catch (vErr) {
              console.error("[email-worker] Failed to stamp verifiedAt:", vErr);
            }
          }
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                result: parsed
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        } catch (error3) {
          console.error("\u274C Error sending Gmail email via slowyou:", error3);
          return addCorsHeaders(
            new Response(
              JSON.stringify({ success: false, error: "Internal error", details: error3.message }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            )
          );
        }
      }
      if (path === "/send-cf-email" && method === "POST") {
        try {
          const body = await request.json();
          let { fromEmail, toEmail, subject, html, text, cfAccountId, token } = body || {};
          const { userEmail: userEmail2, accountId: accountId2 } = body || {};
          if (userEmail2 && accountId2 && (!token || !cfAccountId || !fromEmail)) {
            const data2 = await loadUserSettings(env2, userEmail2);
            const settings = data2.settings || {};
            const accounts2 = Array.isArray(settings.emailAccounts) ? settings.emailAccounts : [];
            const passwords2 = settings.emailAccountPasswords || {};
            const account2 = accounts2.find((a) => a.id === accountId2);
            if (!account2) {
              return addCorsHeaders(
                new Response(
                  JSON.stringify({ success: false, error: "Account not found" }),
                  { status: 404, headers: { "Content-Type": "application/json" } }
                )
              );
            }
            if (!token)
              token = passwords2[accountId2];
            if (!cfAccountId)
              cfAccountId = account2.cfAccountId;
            if (!fromEmail)
              fromEmail = account2.email;
          }
          const claimedOwner = (userEmail2 || fromEmail || "").trim();
          if (!claimedOwner) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ success: false, error: "userEmail or fromEmail required to determine ownership" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          const auth = await requireOwnership(request, env2, claimedOwner);
          if (!auth.ok)
            return authFailResponse(auth);
          if (!fromEmail || !toEmail || !subject || !html && !text || !cfAccountId || !token) {
            return addCorsHeaders(
              new Response(JSON.stringify({
                success: false,
                error: "fromEmail, toEmail, subject, html (or text), cfAccountId, and token are required (or provide userEmail + accountId that resolve to a cf-email-service account with a stored token)."
              }), { status: 400, headers: { "Content-Type": "application/json" } })
            );
          }
          console.log("[email-worker /send-cf-email] sending via Cloudflare Email Service REST", {
            cfAccountId,
            fromEmail,
            toEmail,
            subject,
            htmlLength: html ? html.length : 0
          });
          const cfResp = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/email/sending/send`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ from: fromEmail, to: toEmail, subject, html: html || void 0, text: text || void 0 })
            }
          );
          const cfText = await cfResp.text();
          let cfJson;
          try {
            cfJson = JSON.parse(cfText);
          } catch {
            cfJson = { raw: cfText };
          }
          if (!cfResp.ok || cfJson.success === false) {
            const errMsg = Array.isArray(cfJson.errors) && cfJson.errors.length ? cfJson.errors.map((e) => e.message || JSON.stringify(e)).join("; ") : cfJson.raw || cfText;
            console.error("[email-worker /send-cf-email] CF Email Service error", { status: cfResp.status, errMsg });
            return addCorsHeaders(
              new Response(
                JSON.stringify({ success: false, error: `Cloudflare Email Service rejected the send: ${errMsg}` }),
                { status: cfResp.status === 200 ? 400 : cfResp.status, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          const messageId = cfJson?.result?.message_id || null;
          const storeUrl = env2.VEMAIL_STORE_URL || "https://vemail-store-worker.post-e91.workers.dev";
          try {
            const snippet = html ? html.replace(/<[^>]*>/g, "").slice(0, 200) : (text || "").slice(0, 200);
            await fetch(`${storeUrl}/emails`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userEmail: userEmail2 || fromEmail,
                folder: "sent",
                fromAddress: fromEmail,
                fromName: "",
                toAddress: toEmail,
                subject,
                snippet,
                bodyHtml: html || void 0,
                read: 1
              })
            });
          } catch (storeErr) {
            console.error("[email-worker /send-cf-email] Failed to store sent copy:", storeErr);
          }
          if (userEmail2 && accountId2) {
            try {
              const vdata = await loadUserSettings(env2, userEmail2);
              if (!vdata.settings)
                vdata.settings = {};
              if (!vdata.settings.emailAccountVerifiedAt)
                vdata.settings.emailAccountVerifiedAt = {};
              vdata.settings.emailAccountVerifiedAt[accountId2] = (/* @__PURE__ */ new Date()).toISOString();
              await saveUserSettings(env2, userEmail2, vdata);
            } catch (vErr) {
              console.error("[email-worker /send-cf-email] Failed to stamp verifiedAt:", vErr);
            }
          }
          return addCorsHeaders(
            new Response(
              JSON.stringify({ success: true, result: { messageId } }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        } catch (error3) {
          console.error("\u274C Error sending via Cloudflare Email Service REST:", error3);
          return addCorsHeaders(
            new Response(
              JSON.stringify({ success: false, error: "Internal error", details: error3.message }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            )
          );
        }
      }
      if (path === "/send-email" && method === "POST") {
        try {
          const body = await request.json();
          let { fromEmail, toEmail, subject, html, text } = body || {};
          const { userEmail: userEmail2, accountId: accountId2 } = body || {};
          const claimedOwner = (userEmail2 || fromEmail || "").trim();
          if (!claimedOwner) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ success: false, error: "userEmail or fromEmail required to determine ownership" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          const auth = await requireOwnership(request, env2, claimedOwner);
          if (!auth.ok)
            return authFailResponse(auth);
          if (userEmail2 && accountId2) {
            const data2 = await loadUserSettings(env2, userEmail2);
            const settings = data2.settings || {};
            const accounts2 = Array.isArray(settings.emailAccounts) ? settings.emailAccounts : [];
            const account2 = accounts2.find((a) => a.id === accountId2);
            if (!account2) {
              return addCorsHeaders(
                new Response(
                  JSON.stringify({ success: false, error: "Account not found" }),
                  { status: 404, headers: { "Content-Type": "application/json" } }
                )
              );
            }
            fromEmail = fromEmail || account2.email;
          }
          if (!fromEmail || !toEmail || !subject || !html && !text) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: "fromEmail, toEmail, subject, and html (or text) are required. Alternatively provide userEmail + accountId."
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          if (!env2.EMAIL) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: 'env.EMAIL binding not configured. Add `[[send_email]] name = "EMAIL"` to wrangler.toml and redeploy.'
                }),
                { status: 500, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          console.log("[email-worker /send-email] sending via Cloudflare Email Service", {
            fromEmail,
            toEmail,
            subject,
            htmlLength: html ? html.length : 0
          });
          let sendResult;
          try {
            sendResult = await env2.EMAIL.send({
              from: fromEmail,
              to: toEmail,
              subject,
              html: html || void 0,
              text: text || void 0
            });
          } catch (sendErr) {
            const code = sendErr?.code || "";
            const status = code === "E_SENDER_NOT_VERIFIED" ? 400 : code === "E_TOO_MANY_RECIPIENTS" || code === "E_CONTENT_TOO_LARGE" ? 400 : code === "E_RECIPIENT_SUPPRESSED" ? 400 : code === "E_RATE_LIMIT_EXCEEDED" || code === "E_DAILY_LIMIT_EXCEEDED" ? 429 : 500;
            console.error("[email-worker /send-email] CF Email Service error", {
              code,
              message: sendErr?.message
            });
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  success: false,
                  error: `Cloudflare Email Service rejected the send: ${sendErr?.message || "unknown error"}`,
                  code: code || null
                }),
                { status, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          const parsed = { messageId: sendResult?.messageId || null };
          const storeUrl = env2.VEMAIL_STORE_URL || "https://vemail-store-worker.post-e91.workers.dev";
          try {
            const snippet = html ? html.replace(/<[^>]*>/g, "").slice(0, 200) : (text || "").slice(0, 200);
            await fetch(`${storeUrl}/emails`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userEmail: userEmail2 || fromEmail,
                folder: "sent",
                fromAddress: fromEmail,
                fromName: "",
                toAddress: toEmail,
                subject,
                snippet,
                bodyHtml: html || void 0,
                bodyText: text || void 0,
                read: 1
              })
            });
          } catch (storeErr) {
            console.error("[email-worker] Failed to store sent copy:", storeErr);
          }
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                result: parsed
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        } catch (error3) {
          console.error("[email-worker /send-email] error:", error3);
          return addCorsHeaders(
            new Response(
              JSON.stringify({ success: false, error: "Internal error", details: error3.message }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            )
          );
        }
      }
      if (path === "/login/magic/send" && method === "POST") {
        try {
          const body = await request.json();
          const targetEmail = body?.email;
          const redirectUrl = body?.redirectUrl;
          if (!isValidEmail(targetEmail)) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ success: false, error: "A valid email is required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          if (!await isLoginAllowed(env2, redirectUrl, targetEmail)) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ success: false, error: "This space is invite-only \u2014 your email is not on the access list." }),
                { status: 403, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          await ensureMagicLinkTable(env2);
          const token = crypto.randomUUID();
          const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1e3).toISOString();
          await storeMagicLink(env2, targetEmail, token, expiresAt, redirectUrl);
          const magicLink = buildMagicLink(token, redirectUrl, env2);
          let sender = null;
          try {
            sender = await resolveWhiteLabelSender(env2, redirectUrl);
          } catch (err) {
            console.warn("White-label sender resolution failed; using default sender:", err);
          }
          await sendMagicLinkEmail(env2, targetEmail, magicLink, sender);
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                email: targetEmail,
                expiresAt,
                whiteLabel: !!sender,
                from: sender?.fromEmail || env2.MAGIC_SMTP_FROM || env2.MAGIC_SMTP_USER || null
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        } catch (error3) {
          console.error("Magic link send error:", error3);
          return addCorsHeaders(
            new Response(
              JSON.stringify({ success: false, error: error3.message || "Failed to send magic link" }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            )
          );
        }
      }
      if (path === "/login/magic/verify" && (method === "POST" || method === "GET")) {
        try {
          let token = url.searchParams.get("token");
          if (method === "POST") {
            try {
              const body = await request.json();
              token = body?.token || token;
            } catch (err) {
              console.warn("Failed to parse magic verify body:", err);
            }
          }
          if (!token) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ success: false, error: "Token is required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          await ensureMagicLinkTable(env2);
          const record = await getMagicLink(env2, token);
          if (!record) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ success: false, error: "Token not found" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          const now = Date.now();
          const expires = Date.parse(record.expires_at);
          if (Number(record.used) === 1) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ success: false, error: "Token already used" }),
                { status: 410, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          if (Number.isFinite(expires) && expires < now) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({ success: false, error: "Token expired" }),
                { status: 410, headers: { "Content-Type": "application/json" } }
              )
            );
          }
          await markMagicLinkUsed(env2, token);
          const headers = new Headers({ "Content-Type": "application/json" });
          try {
            const requestHost = url.hostname || "";
            const cookieDomain = requestHost.endsWith("vegvisr.org") ? env2.MAGIC_LINK_COOKIE_DOMAIN || ".vegvisr.org" : null;
            if (cookieDomain) {
              const maxAge = MAGIC_LINK_EXPIRY_MINUTES * 60;
              const cookie = [
                `${MAGIC_LINK_COOKIE_NAME}=${encodeURIComponent(token)}`,
                `Domain=${cookieDomain}`,
                "Path=/",
                `Max-Age=${maxAge}`,
                "SameSite=Lax",
                "Secure",
                "HttpOnly"
              ].join("; ");
              headers.set("Set-Cookie", cookie);
            }
          } catch (err) {
            console.warn("Failed to set magic link cookie:", err);
          }
          let apiToken = null;
          try {
            const crow = await env2.vegvisr_org.prepare("SELECT emailVerificationToken FROM config WHERE email = ?").bind(record.email).first();
            apiToken = crow?.emailVerificationToken || null;
          } catch (err) {
            console.warn("Failed to resolve apiToken:", err);
          }
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                email: record.email,
                expiresAt: record.expires_at,
                redirectUrl: record.redirect_url || null,
                ...apiToken ? { apiToken } : {}
              }),
              { status: 200, headers }
            )
          );
        } catch (error3) {
          console.error("Magic link verify error:", error3);
          return addCorsHeaders(
            new Response(
              JSON.stringify({ success: false, error: error3.message || "Verification failed" }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            )
          );
        }
      }
      if (path === "/templates" && method === "GET") {
        try {
          const language = url.searchParams.get("language") || "en";
          const type = url.searchParams.get("type");
          let query = "SELECT * FROM email_templates WHERE is_active = 1";
          const params = [];
          if (language) {
            query += " AND language_code = ?";
            params.push(language);
          }
          if (type) {
            query += " AND template_type = ?";
            params.push(type);
          }
          query += " ORDER BY template_name";
          const templates = await env2.vegvisr_org.prepare(query).bind(...params).all();
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                templates: templates.results
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        } catch (error3) {
          console.error("Template listing error:", error3);
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: "Failed to list templates", details: error3.message }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            )
          );
        }
      }
      if (path.startsWith("/templates/") && method === "GET") {
        try {
          const templateId = path.split("/")[2];
          const template = await env2.vegvisr_org.prepare("SELECT * FROM email_templates WHERE id = ? AND is_active = 1").bind(templateId).first();
          if (!template) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: "Template not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" }
              })
            );
          }
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                template
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        } catch (error3) {
          console.error("Template retrieval error:", error3);
          return addCorsHeaders(
            new Response(
              JSON.stringify({ error: "Failed to retrieve template", details: error3.message }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            )
          );
        }
      }
      if (path === "/test-main-worker" && method === "GET") {
        try {
          const mainWorkerResponse = await env2.MAIN_WORKER.fetch(
            "https://vegvisr-frontend.torarnehave.workers.dev/sve2?email=test@example.com"
          );
          const mainWorkerData = await mainWorkerResponse.text();
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                message: "Successfully called main-worker",
                mainWorkerResponse: mainWorkerData
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        } catch (error3) {
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: "Failed to call main-worker",
                details: error3.message
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        }
      }
      if (path === "/render-and-send-template" && method === "POST") {
        try {
          const body = await request.json();
          const { templateId, toEmail, variables, domain: domain2 } = body;
          console.log(`\u{1F4E7} Rendering template ${templateId} for ${toEmail}`);
          if (!templateId || !toEmail) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: "templateId and toEmail are required"
                }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          const template = await env2.vegvisr_org.prepare("SELECT * FROM email_templates WHERE id = ? AND is_active = 1").bind(templateId).first();
          if (!template) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: `Template '${templateId}' not found in email_templates`
                }),
                {
                  status: 404,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          const rendered = renderTemplate(template, variables || {});
          console.log(`\u2705 Template rendered successfully: ${rendered.subject}`);
          console.log(`\u{1F4EC} Sending email to ${toEmail}:`);
          console.log(`Subject: ${rendered.subject}`);
          console.log(`Domain: ${domain2 || "vegvisr.org"}`);
          const emailResult = {
            messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            status: "sent",
            recipient: toEmail,
            subject: rendered.subject,
            sentAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: "Template rendered and email sent successfully",
                template: {
                  id: templateId,
                  name: template.name,
                  subject: rendered.subject
                },
                email: emailResult,
                rendered: {
                  subject: rendered.subject,
                  html: rendered.html,
                  text: rendered.text
                }
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        } catch (error3) {
          console.error("\u274C Graph template rendering error:", error3);
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: "Template rendering failed",
                details: error3.message
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        }
      }
      if (path === "/graph-templates" && method === "GET") {
        try {
          const templates = await env2.vegvisr_org.prepare(
            "SELECT id, name, description, variables FROM graphTemplates ORDER BY created_at DESC"
          ).all();
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                templates: templates.results || []
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        } catch (error3) {
          console.error("\u274C Error fetching graph templates:", error3);
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: "Failed to fetch templates"
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        }
      }
      if (path === "/email-templates" && method === "GET") {
        try {
          const templates = await env2.vegvisr_org.prepare(
            "SELECT id, template_name, template_type, language_code, subject, body, variables, is_active, created_at, updated_at FROM email_templates ORDER BY created_at DESC"
          ).all();
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                templates: templates.results || []
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        } catch (error3) {
          console.error("\u274C Error fetching email templates:", error3);
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: "Failed to fetch email templates",
                details: error3.message
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        }
      }
      if (path.startsWith("/email-templates/") && method === "GET") {
        try {
          const templateId = path.split("/")[2];
          const template = await env2.vegvisr_org.prepare("SELECT * FROM email_templates WHERE id = ?").bind(templateId).first();
          if (!template) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: "Template not found"
                }),
                {
                  status: 404,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                template
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        } catch (error3) {
          console.error("\u274C Error fetching email template:", error3);
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: "Failed to fetch email template",
                details: error3.message
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        }
      }
      if (path === "/email-templates" && method === "POST") {
        try {
          const templateData = await request.json();
          const templateId = templateData.id || `template_${Date.now()}`;
          if (!templateData.template_name || !templateData.subject || !templateData.body) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: "Missing required fields: template_name, subject, body"
                }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          const result = await env2.vegvisr_org.prepare(`
              INSERT INTO email_templates (
                id, template_name, template_type, language_code,
                subject, body, variables, is_default, created_by, is_active
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
            templateId,
            templateData.template_name,
            templateData.template_type || "general",
            templateData.language_code || "en",
            templateData.subject,
            templateData.body,
            templateData.variables || "[]",
            templateData.is_default || 0,
            templateData.created_by || "email_manager",
            templateData.is_active || 1
          ).run();
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: "Email template created successfully",
                templateId,
                meta: result.meta
              }),
              {
                status: 201,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        } catch (error3) {
          console.error("\u274C Error creating email template:", error3);
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: "Failed to create email template",
                details: error3.message
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        }
      }
      if (path.startsWith("/email-templates/") && method === "PUT") {
        try {
          const templateId = path.split("/")[2];
          const templateData = await request.json();
          const result = await env2.vegvisr_org.prepare(`
              UPDATE email_templates
              SET template_name = ?, template_type = ?, language_code = ?,
                  subject = ?, body = ?, variables = ?, is_active = ?,
                  updated_at = datetime('now')
              WHERE id = ?
            `).bind(
            templateData.template_name,
            templateData.template_type,
            templateData.language_code,
            templateData.subject,
            templateData.body,
            templateData.variables,
            templateData.is_active,
            templateId
          ).run();
          if (result.changes === 0) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: "Template not found"
                }),
                {
                  status: 404,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: "Email template updated successfully",
                meta: result.meta
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        } catch (error3) {
          console.error("\u274C Error updating email template:", error3);
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: "Failed to update email template",
                details: error3.message
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        }
      }
      if (path.startsWith("/email-templates/") && method === "DELETE") {
        try {
          const templateId = path.split("/")[2];
          const result = await env2.vegvisr_org.prepare("DELETE FROM email_templates WHERE id = ?").bind(templateId).run();
          if (result.changes === 0) {
            return addCorsHeaders(
              new Response(
                JSON.stringify({
                  error: "Template not found"
                }),
                {
                  status: 404,
                  headers: { "Content-Type": "application/json" }
                }
              )
            );
          }
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                success: true,
                message: "Email template deleted successfully",
                meta: result.meta
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        } catch (error3) {
          console.error("\u274C Error deleting email template:", error3);
          return addCorsHeaders(
            new Response(
              JSON.stringify({
                error: "Failed to delete email template",
                details: error3.message
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" }
              }
            )
          );
        }
      }
      if (path === "/email-accounts" && method === "GET") {
        try {
          const userEmail2 = url.searchParams.get("user");
          if (!userEmail2 || !isValidEmail(userEmail2)) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: "Valid user email is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              })
            );
          }
          const auth = await requireOwnership(request, env2, userEmail2);
          if (!auth.ok)
            return authFailResponse(auth);
          const data2 = await loadUserSettings(env2, userEmail2);
          const settings = data2.settings || {};
          const accounts2 = Array.isArray(settings.emailAccounts) ? settings.emailAccounts : [];
          const safe = accounts2.map((a) => ({
            id: a.id,
            name: a.name || "",
            email: a.email || "",
            aliases: Array.isArray(a.aliases) ? a.aliases : [],
            isDefault: !!a.isDefault,
            hasPassword: !!a.hasPassword,
            storeUrl: a.storeUrl || "",
            accountType: a.accountType || "gmail"
          }));
          return addCorsHeaders(
            new Response(JSON.stringify({ success: true, accounts: safe }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            })
          );
        } catch (error3) {
          console.error("Error GET /email-accounts:", error3);
          return addCorsHeaders(
            new Response(JSON.stringify({ error: error3.message }), {
              status: 500,
              headers: { "Content-Type": "application/json" }
            })
          );
        }
      }
      if (path === "/email-accounts" && method === "POST") {
        try {
          const body = await request.json();
          const { userEmail: userEmail2, account: account2, appPassword: appPassword2 } = body;
          if (!userEmail2 || !isValidEmail(userEmail2)) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: "Valid userEmail is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              })
            );
          }
          const auth = await requireOwnership(request, env2, userEmail2);
          if (!auth.ok)
            return authFailResponse(auth);
          if (!account2?.id || !account2?.email) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: "account.id and account.email are required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              })
            );
          }
          const data2 = await loadUserSettings(env2, userEmail2);
          if (!data2.settings)
            data2.settings = {};
          if (!Array.isArray(data2.settings.emailAccounts))
            data2.settings.emailAccounts = [];
          if (!data2.settings.emailAccountPasswords)
            data2.settings.emailAccountPasswords = {};
          let hasPassword = !!account2.hasPassword;
          if (appPassword2) {
            data2.settings.emailAccountPasswords[account2.id] = appPassword2;
            hasPassword = true;
          }
          const entry = {
            id: account2.id,
            name: account2.name || "",
            email: account2.email,
            aliases: Array.isArray(account2.aliases) ? account2.aliases : [],
            isDefault: !!account2.isDefault,
            hasPassword,
            storeUrl: account2.storeUrl || "",
            accountType: account2.accountType || "gmail",
            // Cloudflare account id that owns the sending domain — required by the
            // cf-email-service accountType (REST send via /accounts/{id}/email/sending/send).
            cfAccountId: account2.cfAccountId || ""
          };
          const idx = data2.settings.emailAccounts.findIndex((a) => a.id === account2.id);
          if (idx >= 0) {
            data2.settings.emailAccounts[idx] = entry;
          } else {
            data2.settings.emailAccounts.push(entry);
          }
          await saveUserSettings(env2, userEmail2, data2);
          return addCorsHeaders(
            new Response(JSON.stringify({ success: true, account: entry }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            })
          );
        } catch (error3) {
          console.error("Error POST /email-accounts:", error3);
          return addCorsHeaders(
            new Response(JSON.stringify({ error: error3.message }), {
              status: 500,
              headers: { "Content-Type": "application/json" }
            })
          );
        }
      }
      if (path === "/email-accounts" && method === "DELETE") {
        try {
          const userEmail2 = url.searchParams.get("user");
          const accountId2 = url.searchParams.get("id");
          if (!userEmail2 || !accountId2) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: "user and id params are required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              })
            );
          }
          const auth = await requireOwnership(request, env2, userEmail2);
          if (!auth.ok)
            return authFailResponse(auth);
          const data2 = await loadUserSettings(env2, userEmail2);
          if (!data2.settings)
            data2.settings = {};
          const accounts2 = Array.isArray(data2.settings.emailAccounts) ? data2.settings.emailAccounts : [];
          data2.settings.emailAccounts = accounts2.filter((a) => a.id !== accountId2);
          if (data2.settings.emailAccountPasswords) {
            delete data2.settings.emailAccountPasswords[accountId2];
          }
          if (data2.settings.emailAccounts.length > 0 && !data2.settings.emailAccounts.some((a) => a.isDefault)) {
            data2.settings.emailAccounts[0].isDefault = true;
          }
          await saveUserSettings(env2, userEmail2, data2);
          return addCorsHeaders(
            new Response(JSON.stringify({ success: true }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            })
          );
        } catch (error3) {
          console.error("Error DELETE /email-accounts:", error3);
          return addCorsHeaders(
            new Response(JSON.stringify({ error: error3.message }), {
              status: 500,
              headers: { "Content-Type": "application/json" }
            })
          );
        }
      }
      if (path === "/email-accounts/sync" && method === "PUT") {
        try {
          const body = await request.json();
          const { userEmail: userEmail2, accounts: accounts2 } = body;
          if (!userEmail2 || !Array.isArray(accounts2)) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: "userEmail and accounts[] are required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              })
            );
          }
          const auth = await requireOwnership(request, env2, userEmail2);
          if (!auth.ok)
            return authFailResponse(auth);
          const data2 = await loadUserSettings(env2, userEmail2);
          if (!data2.settings)
            data2.settings = {};
          data2.settings.emailAccounts = accounts2.map((a) => ({
            id: a.id,
            name: a.name || "",
            email: a.email || "",
            aliases: Array.isArray(a.aliases) ? a.aliases : [],
            isDefault: !!a.isDefault,
            hasPassword: !!a.hasPassword,
            storeUrl: a.storeUrl || "",
            accountType: a.accountType || "gmail"
          }));
          await saveUserSettings(env2, userEmail2, data2);
          return addCorsHeaders(
            new Response(JSON.stringify({ success: true }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            })
          );
        } catch (error3) {
          if (!appPassword) {
            const accountEmail = normalizeEmail(account.email);
            const accountAliases = Array.isArray(account.aliases) ? account.aliases.map(normalizeEmail).filter(Boolean) : [];
            const migratedEntry = Object.entries(passwords).find(([storedId]) => {
              const storedAccount = accounts.find((candidate) => candidate.id === storedId);
              if (!storedAccount)
                return false;
              const storedEmail = normalizeEmail(storedAccount.email);
              if (storedEmail && storedEmail === accountEmail)
                return true;
              const storedAliases = Array.isArray(storedAccount.aliases) ? storedAccount.aliases.map(normalizeEmail).filter(Boolean) : [];
              return accountAliases.some((alias) => storedAliases.includes(alias));
            });
            if (migratedEntry) {
              const [storedId, migratedPassword] = migratedEntry;
              appPassword = migratedPassword;
              passwords[accountId] = migratedPassword;
              if (storedId !== accountId) {
                delete passwords[storedId];
              }
              await saveUserSettings(env2, userEmail, data);
            }
          }
          console.error("Error PUT /email-accounts/sync:", error3);
          return addCorsHeaders(
            new Response(JSON.stringify({ error: error3.message }), {
              status: 500,
              headers: { "Content-Type": "application/json" }
            })
          );
        }
      }
      if (path === "/email-destinations" && method === "POST") {
        try {
          const body = await request.json().catch(() => ({}));
          const email = typeof body?.email === "string" ? body.email.trim() : "";
          if (!email || !isValidEmail(email)) {
            return addCorsHeaders(new Response(
              JSON.stringify({ success: false, error: "A valid email is required" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            ));
          }
          const auth = await requireOwnership(request, env2, null);
          if (!auth.ok)
            return authFailResponse(auth);
          const cf = await cfRoutingApi(env2, "POST", "", { email });
          if (!cf.ok) {
            return addCorsHeaders(new Response(
              JSON.stringify({ success: false, error: cf.error, cfErrors: cf.cfErrors || [] }),
              { status: cf.status >= 400 ? cf.status : 502, headers: { "Content-Type": "application/json" } }
            ));
          }
          return addCorsHeaders(new Response(
            JSON.stringify({
              success: true,
              address: cf.result,
              message: `Destination ${email} created. Cloudflare has sent a verification email to ${email}. The address will become usable once they click the link.`
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          ));
        } catch (error3) {
          console.error("Error POST /email-destinations:", error3);
          return addCorsHeaders(new Response(
            JSON.stringify({ success: false, error: error3.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          ));
        }
      }
      if (path === "/email-destinations" && method === "GET") {
        try {
          const auth = await requireOwnership(request, env2, null);
          if (!auth.ok)
            return authFailResponse(auth);
          const filterEmail = (url.searchParams.get("email") || "").trim().toLowerCase();
          const cf = await cfRoutingApi(env2, "GET", "?per_page=50");
          if (!cf.ok) {
            return addCorsHeaders(new Response(
              JSON.stringify({ success: false, error: cf.error, cfErrors: cf.cfErrors || [] }),
              { status: cf.status >= 400 ? cf.status : 502, headers: { "Content-Type": "application/json" } }
            ));
          }
          let addresses = Array.isArray(cf.result) ? cf.result : [];
          if (filterEmail) {
            addresses = addresses.filter((a) => (a?.email || "").toLowerCase() === filterEmail);
          }
          return addCorsHeaders(new Response(
            JSON.stringify({ success: true, addresses, resultInfo: cf.resultInfo || null }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          ));
        } catch (error3) {
          console.error("Error GET /email-destinations:", error3);
          return addCorsHeaders(new Response(
            JSON.stringify({ success: false, error: error3.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          ));
        }
      }
      if (path === "/email-destinations" && method === "DELETE") {
        try {
          const auth = await requireOwnership(request, env2, null);
          if (!auth.ok)
            return authFailResponse(auth);
          let id = (url.searchParams.get("id") || "").trim();
          const email = (url.searchParams.get("email") || "").trim().toLowerCase();
          if (!id && !email) {
            return addCorsHeaders(new Response(
              JSON.stringify({ success: false, error: "id or email query param is required" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            ));
          }
          if (!id) {
            const list = await cfRoutingApi(env2, "GET", "?per_page=50");
            if (!list.ok) {
              return addCorsHeaders(new Response(
                JSON.stringify({ success: false, error: list.error, cfErrors: list.cfErrors || [] }),
                { status: list.status >= 400 ? list.status : 502, headers: { "Content-Type": "application/json" } }
              ));
            }
            const match = (list.result || []).find((a) => (a?.email || "").toLowerCase() === email);
            if (!match) {
              return addCorsHeaders(new Response(
                JSON.stringify({ success: false, error: `destination not found: ${email}` }),
                { status: 404, headers: { "Content-Type": "application/json" } }
              ));
            }
            id = match.tag || match.id;
          }
          const cf = await cfRoutingApi(env2, "DELETE", `/${encodeURIComponent(id)}`);
          if (!cf.ok) {
            return addCorsHeaders(new Response(
              JSON.stringify({ success: false, error: cf.error, cfErrors: cf.cfErrors || [] }),
              { status: cf.status >= 400 ? cf.status : 502, headers: { "Content-Type": "application/json" } }
            ));
          }
          return addCorsHeaders(new Response(
            JSON.stringify({ success: true, deleted: cf.result }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          ));
        } catch (error3) {
          console.error("Error DELETE /email-destinations:", error3);
          return addCorsHeaders(new Response(
            JSON.stringify({ success: false, error: error3.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          ));
        }
      }
      if (path === "/gmail/sync-now" && method === "POST") {
        try {
          const body = await request.json();
          const { userEmail: userEmail2 } = body;
          if (!userEmail2) {
            return addCorsHeaders(
              new Response(JSON.stringify({ error: "userEmail is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              })
            );
          }
          console.log(`[Gmail Sync] Manual sync triggered for ${userEmail2}`);
          await syncGmailForUser(userEmail2, env2);
          return addCorsHeaders(
            new Response(JSON.stringify({
              success: true,
              message: "Gmail sync completed successfully"
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            })
          );
        } catch (error3) {
          console.error("[Gmail Sync] Manual sync error:", error3);
          return addCorsHeaders(
            new Response(JSON.stringify({
              error: error3.message || "Gmail sync failed"
            }), {
              status: 500,
              headers: { "Content-Type": "application/json" }
            })
          );
        }
      }
      return addCorsHeaders(
        new Response(
          JSON.stringify({
            error: "Endpoint not found",
            availableEndpoints: [
              "/health",
              "/openapi.json",
              "/test-main-worker",
              "/render-template (POST)",
              "/render-and-send-template (POST)",
              "/graph-templates (GET)",
              "/generate-invitation (POST)",
              "/generate-slowyou-link (POST)",
              "/send-gmail-email (POST)",
              "/send-email (POST)",
              "/login/magic/send (POST)",
              "/login/magic/verify (POST, GET)",
              "/templates (GET)",
              "/templates/{id} (GET)",
              "/email-templates (GET, POST)",
              "/email-templates/{id} (GET, PUT, DELETE)",
              "/email-accounts (GET, POST, DELETE)",
              "/email-accounts/sync (PUT)",
              "/gmail/sync-now (POST)"
            ]
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" }
          }
        )
      );
    } catch (error3) {
      console.error("Email worker error:", error3);
      return addCorsHeaders(
        new Response(
          JSON.stringify({
            error: "Internal server error",
            details: error3.message
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" }
          }
        )
      );
    }
  },
  // Scheduled handler for Gmail inbox sync (runs every 5 minutes)
  async scheduled(event, env2, ctx) {
    console.log("[Gmail Sync] Starting scheduled sync at", (/* @__PURE__ */ new Date()).toISOString());
    try {
      const testUsers = ["torarnehave@gmail.com"];
      for (const userEmail2 of testUsers) {
        try {
          await syncGmailForUser(userEmail2, env2);
        } catch (error3) {
          console.error(`[Gmail Sync] Error syncing for ${userEmail2}:`, error3);
        }
      }
      console.log("[Gmail Sync] Completed scheduled sync");
    } catch (error3) {
      console.error("[Gmail Sync] Scheduled sync error:", error3);
    }
  }
};
function decodeGmailBodyData(encoded) {
  if (!encoded || typeof encoded !== "string")
    return "";
  try {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}
function isAttachmentPart(part) {
  if (!part)
    return false;
  if (part.filename)
    return true;
  const headers = Array.isArray(part.headers) ? part.headers : [];
  const disposition = headers.find((h) => h?.name?.toLowerCase() === "content-disposition")?.value || "";
  return disposition.toLowerCase().includes("attachment");
}
function extractGmailBodies(payload) {
  let bodyHtml = "";
  let bodyText = "";
  function walk(part) {
    if (!part || isAttachmentPart(part))
      return;
    const mimeType = (part.mimeType || "").toLowerCase();
    const data2 = part.body?.data;
    if (data2) {
      const decoded = decodeGmailBodyData(data2);
      if (decoded) {
        if (mimeType === "text/html" && decoded.length > bodyHtml.length) {
          bodyHtml = decoded;
        } else if (mimeType === "text/plain" && decoded.length > bodyText.length) {
          bodyText = decoded;
        }
      }
    }
    if (Array.isArray(part.parts)) {
      for (const child of part.parts) {
        walk(child);
      }
    }
  }
  walk(payload);
  return { bodyHtml, bodyText };
}
async function syncGmailForUser(userEmail2, env2) {
  console.log(`[Gmail Sync] Syncing for user: ${userEmail2}`);
  const nowTs = Math.floor(Date.now() / 1e3);
  const userSettings = await loadUserSettings(env2, userEmail2);
  if (!userSettings.settings)
    userSettings.settings = {};
  if (!userSettings.settings.gmailSyncState)
    userSettings.settings.gmailSyncState = {};
  const savedSyncState = userSettings.settings.gmailSyncState[userEmail2] || {};
  const hasPriorSync = Number.isFinite(savedSyncState.lastAfterTs);
  const afterTs = hasPriorSync ? Math.max(0, Number(savedSyncState.lastAfterTs) - 120) : nowTs - 120;
  const credsRes = await env2.AUTH_WORKER.fetch("https://auth.vegvisr.org/gmail/get-credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_email: userEmail2 })
  });
  if (!credsRes.ok) {
    console.log(`[Gmail Sync] No credentials for ${userEmail2}`);
    return;
  }
  const credsData = await credsRes.json();
  if (!credsData.success || !credsData.access_token) {
    console.log(`[Gmail Sync] Invalid credentials for ${userEmail2}`);
    return;
  }
  const accessToken = credsData.access_token;
  const gmailQuery = `is:unread after:${afterTs}`;
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(gmailQuery)}&maxResults=10`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );
  if (!listRes.ok) {
    console.error(`[Gmail Sync] Gmail API error: ${listRes.status}`);
    return;
  }
  const listData = await listRes.json();
  if (!listData.messages || listData.messages.length === 0) {
    console.log(`[Gmail Sync] No new messages for ${userEmail2}`);
    userSettings.settings.gmailSyncState[userEmail2] = {
      lastAfterTs: nowTs,
      lastSyncAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await saveUserSettings(env2, userEmail2, userSettings);
    return;
  }
  console.log(`[Gmail Sync] Found ${listData.messages.length} unread messages for ${userEmail2}`);
  let maxSeenTs = afterTs;
  for (const msg of listData.messages) {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );
      if (!msgRes.ok) {
        console.error(`[Gmail Sync] Failed to fetch message ${msg.id}`);
        continue;
      }
      const message = await msgRes.json();
      const internalDateMs = Number(message.internalDate || 0);
      if (Number.isFinite(internalDateMs) && internalDateMs > 0) {
        const internalTs = Math.floor(internalDateMs / 1e3);
        if (internalTs > maxSeenTs)
          maxSeenTs = internalTs;
      }
      const headers = message.payload.headers;
      const subject = headers.find((h) => h.name === "Subject")?.value || "(no subject)";
      const from = headers.find((h) => h.name === "From")?.value || "unknown";
      const to = headers.find((h) => h.name === "To")?.value || "unknown";
      const date = headers.find((h) => h.name === "Date")?.value || (/* @__PURE__ */ new Date()).toISOString();
      const { bodyHtml, bodyText } = extractGmailBodies(message.payload);
      const gmailAccount = userSettings.settings?.emailAccounts?.find((a) => a.email === userEmail2);
      const storeUrl = gmailAccount?.storeUrl || env2.VEMAIL_STORE_URL;
      const storeRes = await fetch(`${storeUrl}/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: userEmail2,
          folder: "inbox",
          fromAddress: from,
          toAddress: to,
          subject,
          snippet: message.snippet || "",
          bodyHtml: bodyHtml || bodyText,
          bodyText,
          messageId: message.id,
          receivedAt: date,
          read: 0
        })
      });
      if (storeRes.ok) {
        console.log(`[Gmail Sync] Stored message ${msg.id} for ${userEmail2}`);
        await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/modify`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              removeLabelIds: ["UNREAD"]
            })
          }
        );
      } else {
        console.error(`[Gmail Sync] Failed to store message ${msg.id}`);
      }
    } catch (error3) {
      console.error(`[Gmail Sync] Error processing message ${msg.id}:`, error3);
    }
  }
  userSettings.settings.gmailSyncState[userEmail2] = {
    lastAfterTs: Math.max(nowTs, maxSeenTs),
    lastSyncAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await saveUserSettings(env2, userEmail2, userSettings);
}
export {
  email_worker_default as default
};
