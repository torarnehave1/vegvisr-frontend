// Recovered from the DEPLOYED worker on Cloudflare, because the local source was lost.
// esbuild artefacts undone: inlined npm dependencies removed, imports restored below, and the
// name-preservation wrappers stripped. Variable names may differ from the original where
// esbuild renamed to avoid collisions, and the original comments are gone.

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
var cachedAccessToken = null;
var cachedAccessTokenExpiryMs = 0;
var base64UrlEncode = (input) => {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
var pemToArrayBuffer = (pem) => {
  const normalized = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};
var getAccessToken = async (env) => {
  if (!env.FCM_PROJECT_ID || !env.FCM_CLIENT_EMAIL || !env.FCM_PRIVATE_KEY) {
    console.error("Missing FCM v1 credentials");
    return null;
  }
  console.log("[FCM] Using project:", env.FCM_PROJECT_ID, "service account:", env.FCM_CLIENT_EMAIL);
  const nowMs = Date.now();
  if (cachedAccessToken && nowMs < cachedAccessTokenExpiryMs - 3e4) {
    console.log("[FCM] Using cached access token");
    return cachedAccessToken;
  }
  const now = Math.floor(nowMs / 1e3);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: env.FCM_CLIENT_EMAIL,
    sub: env.FCM_CLIENT_EMAIL,
    aud: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    iat: now,
    exp: now + 55 * 60
    // 55 minutes
  };
  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const privateKeyPem = env.FCM_PRIVATE_KEY.includes("BEGIN PRIVATE KEY") ? env.FCM_PRIVATE_KEY : `-----BEGIN PRIVATE KEY-----
${env.FCM_PRIVATE_KEY}
-----END PRIVATE KEY-----`;
  const keyBuffer = pemToArrayBuffer(privateKeyPem.replace(/\\n/g, "\n"));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );
  const signedJwt = `${unsignedToken}.${base64UrlEncode(signatureBuffer)}`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt
    })
  });
  if (!tokenRes.ok) {
    console.error("FCM token exchange failed:", tokenRes.status, await tokenRes.text());
    return null;
  }
  const tokenJson = await tokenRes.json().catch(() => null);
  cachedAccessToken = tokenJson?.access_token || null;
  cachedAccessTokenExpiryMs = nowMs + (tokenJson?.expires_in ? tokenJson.expires_in * 1e3 : 55 * 60 * 1e3);
  return cachedAccessToken;
};
async function sendPushNotification(env, tokens, title, body, data = {}) {
  console.log("[FCM] sendPushNotification called with", tokens.length, "tokens");
  if (!Array.isArray(tokens) || tokens.length === 0) {
    console.log("[FCM] No tokens to send to");
    return;
  }
  const accessToken = await getAccessToken(env);
  if (!accessToken) {
    console.error("[FCM] Failed to get access token");
    return;
  }
  console.log("[FCM] Got access token, sending to", tokens.length, "devices");
  const endpoint = `https://fcm.googleapis.com/v1/projects/${env.FCM_PROJECT_ID}/messages:send`;
  const dataStrings = Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v)]));
  const sendOne = async (token) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        message: {
          token,
          notification: {
            title,
            body
          },
          data: dataStrings,
          android: { priority: "HIGH" },
          apns: {
            headers: { "apns-priority": "10" },
            payload: { aps: { sound: "default" } }
          }
        }
      })
    });
    if (!response.ok) {
      console.error("[FCM] Send error:", response.status, await response.text());
    } else {
      console.log("[FCM] Successfully sent to token:", token.substring(0, 20) + "...");
    }
  };
  await Promise.allSettled(tokens.map(sendOne));
  console.log("[FCM] Finished sending to all tokens");
}
async function getGroupMemberTokens(env, groupId, excludeUserId) {
  console.log("[FCM] Getting tokens for group:", groupId, "excluding:", excludeUserId);
  const { results } = await env.CHAT_DB.prepare(
    `SELECT dt.fcm_token
     FROM device_tokens dt
     JOIN group_members gm ON dt.user_id = gm.user_id
     WHERE gm.group_id = ? AND dt.user_id != ?`
  ).bind(groupId, excludeUserId).all();
  console.log("[FCM] Found", results.length, "tokens for other group members");
  return results.map((r) => r.fcm_token);
}
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id, x-user-phone, x-user-email, X-File-Name, Range",
  "Access-Control-Expose-Headers": "Content-Type, Content-Length, Accept-Ranges, Content-Range"
};
var jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" }
});
var errorResponse = (message, status = 400) => jsonResponse({ success: false, error: message }, status);
async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
var LINK_PREVIEW_ALLOWED_HOSTS = ["www.finn.no", "finn.no", "m.finn.no"];
function extractOgTag(html, property) {
  const match = html.match(
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, "i")
  ) || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, "i"));
  return match ? match[1] : null;
}
async function handleLinkPreview(request, env, searchParams) {
  const targetUrl = searchParams.get("url");
  if (!targetUrl) {
    return errorResponse("url required");
  }
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return errorResponse("Invalid url");
  }
  if (!LINK_PREVIEW_ALLOWED_HOSTS.includes(parsed.hostname)) {
    return errorResponse("Host not supported", 400);
  }
  const upstream = await fetch(parsed.toString(), {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; VegvisrChatBot/1.0)" },
    cf: { cacheTtl: 3600, cacheEverything: true }
  });
  if (!upstream.ok) {
    return errorResponse("Failed to fetch preview", 502);
  }
  const html = await upstream.text();
  const preview = {
    title: extractOgTag(html, "og:title"),
    description: extractOgTag(html, "og:description"),
    image: extractOgTag(html, "og:image"),
    url: extractOgTag(html, "og:url") || parsed.toString()
  };
  return jsonResponse({ success: true, preview }, 200);
}
function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function normalizeBotId(value) {
  const s = typeof value === "string" ? value.trim() : "";
  return s.startsWith("bot:") ? s.slice(4) : s;
}
async function validateUser(env, userId, phone, email) {
  if (!env.SMS_WORKER?.fetch) {
    return { ok: false, status: 500, error: "SMS worker service not configured" };
  }
  const response = await env.SMS_WORKER.fetch(
    "https://sms-gateway/api/auth/user/validate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        phone: phone || void 0,
        email: email || void 0
      })
    }
  );
  if (!response.ok) {
    const data2 = await response.json().catch(() => null);
    return {
      ok: false,
      status: response.status,
      error: data2?.error || "User validation failed"
    };
  }
  const data = await response.json().catch(() => ({}));
  return { ok: true, role: data.role || "User" };
}
async function getUserEmail(env, userId) {
  if (!env.SMS_WORKER?.fetch) return null;
  try {
    const res = await env.SMS_WORKER.fetch(
      `https://sms-gateway/api/auth/profile?user_id=${encodeURIComponent(userId)}`
    );
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.success && data.email ? String(data.email).trim() : null;
  } catch {
    return null;
  }
}
async function sendAlertEmail(env, fromEmail, toEmail, subject, html) {
  if (!env.EMAIL_WORKER?.fetch) {
    return { ok: false, error: "EMAIL_WORKER service binding not configured" };
  }
  fromEmail = (fromEmail || "").trim();
  if (!fromEmail) {
    return { ok: false, error: "No alert sender configured for this group" };
  }
  if (!env.INTERNAL_SHARED_SECRET) {
    return { ok: false, error: "INTERNAL_SHARED_SECRET not configured on this worker" };
  }
  try {
    const res = await env.EMAIL_WORKER.fetch("https://email-worker/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-auth": env.INTERNAL_SHARED_SECRET,
        "x-internal-caller": fromEmail
      },
      body: JSON.stringify({ fromEmail, toEmail, subject, html })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      return { ok: false, error: data?.error || `email-worker returned ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || "email-worker call failed" };
  }
}
async function fetchOwnerSenders(env, ownerEmail) {
  if (!env.EMAIL_WORKER?.fetch) {
    return { ok: false, error: "EMAIL_WORKER service binding not configured" };
  }
  if (!env.INTERNAL_SHARED_SECRET) {
    return { ok: false, error: "INTERNAL_SHARED_SECRET not configured on this worker" };
  }
  if (!ownerEmail) {
    return { ok: false, error: "Owner has no email on file" };
  }
  try {
    const res = await env.EMAIL_WORKER.fetch(
      `https://email-worker/email-accounts?user=${encodeURIComponent(ownerEmail)}`,
      {
        headers: {
          "x-internal-auth": env.INTERNAL_SHARED_SECRET,
          "x-internal-caller": ownerEmail
        }
      }
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      return { ok: false, error: data?.error || `email-worker returned ${res.status}` };
    }
    const senders = [];
    const seen = /* @__PURE__ */ new Set();
    for (const a of data.accounts || []) {
      for (const addr of [a.email, ...Array.isArray(a.aliases) ? a.aliases : []]) {
        const e = (addr || "").trim();
        if (e && !seen.has(e.toLowerCase())) {
          seen.add(e.toLowerCase());
          senders.push({ email: e, name: a.name || "", isDefault: !!a.isDefault && e === a.email });
        }
      }
    }
    return { ok: true, senders };
  } catch (err) {
    return { ok: false, error: err?.message || "email-worker call failed" };
  }
}
async function ensureMember(env, groupId, userId) {
  const member = await env.CHAT_DB.prepare(
    "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?"
  ).bind(groupId, userId).first();
  return !!member;
}
async function ensurePostingAllowed(env, groupId, userId) {
  if (typeof userId === "string" && userId.startsWith("bot:")) return null;
  const group = await env.CHAT_DB.prepare(
    "SELECT posting_locked, created_by FROM groups WHERE id = ?"
  ).bind(groupId).first();
  if (!group) return null;
  if (!group.posting_locked) return null;
  if (group.created_by === userId) return null;
  return { error: "Group is locked for posting \u2014 only the owner can post here", status: 403 };
}
var MAX_MEDIA_BYTES = 200 * 1024 * 1024;
var buildMediaUrl = (request, env, objectKey) => {
  if (env.PUBLIC_MEDIA_BASE_URL) {
    return `${env.PUBLIC_MEDIA_BASE_URL}?key=${encodeURIComponent(objectKey)}`;
  }
  const url = new URL(request.url);
  return `${url.origin}/media?key=${encodeURIComponent(objectKey)}`;
};
var guessExtensionFromFileName = (fileName) => {
  if (!fileName) return "";
  const lower = String(fileName).toLowerCase();
  const dotIndex = lower.lastIndexOf(".");
  if (dotIndex === -1) return "";
  const ext = lower.substring(dotIndex);
  const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".mov", ".webm", ".m4v", ".pdf"];
  return allowed.includes(ext) ? ext : "";
};
var defaultContentTypeForExtension = (ext) => {
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".mp4":
    case ".m4v":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    case ".webm":
      return "video/webm";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
};
var isSupportedMediaType = (contentType, ext) => {
  const ct = (contentType || "").toLowerCase().split(";")[0].trim();
  if (ct.startsWith("image/")) return true;
  if (ct.startsWith("video/")) return true;
  if (ct === "application/pdf") return true;
  if (ext) {
    return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".mov", ".webm", ".m4v", ".pdf"].includes(ext);
  }
  return false;
};
var handleMediaUpload = async (request, env, groupId, searchParams) => {
  const userId = (searchParams.get("user_id") || "").trim();
  const phone = (searchParams.get("phone") || "").trim();
  const email = (searchParams.get("email") || "").trim();
  if (!userId) return errorResponse("user_id required");
  if (!phone) return errorResponse("phone required");
  const auth = await validateUser(env, userId, phone, email);
  if (!auth.ok) {
    return errorResponse(auth.error, auth.status);
  }
  const isMember = await ensureMember(env, groupId, userId);
  if (!isMember) {
    return errorResponse("Not a group member", 403);
  }
  if (!env.CHAT_MEDIA) {
    return errorResponse("CHAT_MEDIA bucket not configured", 500);
  }
  const fileName = request.headers.get("X-File-Name") || "upload";
  const providedContentType = request.headers.get("Content-Type") || "";
  const ext = guessExtensionFromFileName(fileName);
  const contentType = providedContentType || defaultContentTypeForExtension(ext);
  if (!isSupportedMediaType(contentType, ext)) {
    return errorResponse("Unsupported media type. Only image/*, video/*, and application/pdf are allowed.", 400);
  }
  const contentLengthHeader = request.headers.get("Content-Length");
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : null;
  if (contentLength !== null && (!Number.isFinite(contentLength) || contentLength < 0)) {
    return errorResponse("Invalid Content-Length header", 400);
  }
  if (contentLength !== null && contentLength > MAX_MEDIA_BYTES) {
    return errorResponse(`Media too large. Max ${MAX_MEDIA_BYTES} bytes`, 413);
  }
  if (!request.body) {
    return errorResponse("Missing request body", 400);
  }
  const objectId = crypto.randomUUID();
  const ctLower = contentType.toLowerCase();
  const safeExt = ext || (ctLower === "application/pdf" ? ".pdf" : ctLower.startsWith("image/") ? ".jpg" : ctLower.startsWith("video/") ? ".mp4" : ".bin");
  const objectKey = `media/${groupId}/${objectId}${safeExt}`;
  let uploadedBytes = 0;
  const limiter = new TransformStream({
    transform(chunk, controller) {
      const size = chunk?.byteLength ?? 0;
      uploadedBytes += size;
      if (uploadedBytes > MAX_MEDIA_BYTES) {
        throw new Error("Media too large");
      }
      controller.enqueue(chunk);
    }
  });
  const streamToPut = contentLength === null ? request.body.pipeThrough(limiter) : request.body;
  try {
    await env.CHAT_MEDIA.put(objectKey, streamToPut, {
      httpMetadata: {
        contentType
      },
      customMetadata: {
        groupId: String(groupId),
        userId: String(userId),
        originalFileName: String(fileName),
        uploadedAt: String(Date.now())
      }
    });
  } catch (err) {
    const message = String(err?.message || err);
    if (message.toLowerCase().includes("too large")) {
      return errorResponse(`Media too large. Max ${MAX_MEDIA_BYTES} bytes`, 413);
    }
    throw err;
  }
  return jsonResponse({
    success: true,
    objectKey,
    mediaUrl: buildMediaUrl(request, env, objectKey),
    size: contentLength !== null ? contentLength : uploadedBytes,
    contentType
  });
};
var handleMediaFetch = async (request, env, searchParams) => {
  const objectKey = searchParams.get("key");
  if (!objectKey) {
    return errorResponse("Missing required key parameter", 400);
  }
  if (!env.CHAT_MEDIA) {
    return errorResponse("CHAT_MEDIA bucket not configured", 500);
  }
  const isHead = request.method === "HEAD";
  const meta = await env.CHAT_MEDIA.head(objectKey);
  if (!meta) {
    return errorResponse("Media not found", 404);
  }
  const totalSize = meta.size;
  const contentType = meta.httpMetadata?.contentType || "application/octet-stream";
  const rangeHeader = request.headers.get("Range");
  let responseStatus = 200;
  let offset = 0;
  let length = totalSize;
  let extraHeaders = {};
  if (rangeHeader) {
    const explicitMatch = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
    const suffixMatch = /^bytes=-(\d+)$/.exec(rangeHeader);
    let start = null;
    let end = null;
    if (explicitMatch) {
      start = Number(explicitMatch[1]);
      end = explicitMatch[2] ? Number(explicitMatch[2]) : null;
      const safeEnd = end !== null ? Math.min(end, totalSize - 1) : totalSize - 1;
      if (start >= totalSize || start < 0 || safeEnd < start) {
        return new Response(null, {
          status: 416,
          headers: {
            ...corsHeaders,
            "Content-Range": `bytes */${totalSize}`,
            "Accept-Ranges": "bytes"
          }
        });
      }
      offset = start;
      length = safeEnd - start + 1;
      responseStatus = 206;
      extraHeaders = {
        "Content-Range": `bytes ${start}-${safeEnd}/${totalSize}`,
        "Content-Length": String(length),
        "Accept-Ranges": "bytes"
      };
    } else if (suffixMatch) {
      const suffixLen = Number(suffixMatch[1]);
      if (!Number.isFinite(suffixLen) || suffixLen <= 0) {
        return new Response(null, {
          status: 416,
          headers: {
            ...corsHeaders,
            "Content-Range": `bytes */${totalSize}`,
            "Accept-Ranges": "bytes"
          }
        });
      }
      const safeLen = Math.min(suffixLen, totalSize);
      const startPos = Math.max(totalSize - safeLen, 0);
      const endPos = totalSize - 1;
      offset = startPos;
      length = endPos - startPos + 1;
      responseStatus = 206;
      extraHeaders = {
        "Content-Range": `bytes ${startPos}-${endPos}/${totalSize}`,
        "Content-Length": String(length),
        "Accept-Ranges": "bytes"
      };
    }
  }
  if (isHead) {
    return new Response(null, {
      status: responseStatus,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Length": String(responseStatus === 206 ? length : totalSize),
        "Accept-Ranges": "bytes",
        ...extraHeaders
      }
    });
  }
  const mediaObject = responseStatus === 206 ? await env.CHAT_MEDIA.get(objectKey, { range: { offset, length } }) : await env.CHAT_MEDIA.get(objectKey);
  if (!mediaObject) {
    return errorResponse("Media not found", 404);
  }
  return new Response(mediaObject.body, {
    status: responseStatus,
    headers: {
      ...corsHeaders,
      "Content-Type": contentType,
      "Content-Length": String(responseStatus === 206 ? length : totalSize),
      "Accept-Ranges": "bytes",
      ...extraHeaders
    }
  });
};
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    try {
      if (pathname === "/health") {
        return jsonResponse({
          status: "healthy",
          service: "group-chat-worker",
          database: "hallo_vegvisr_chat",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      if (pathname === "/openapi.json" && request.method === "GET") {
        const authParams = [
          { name: "user_id", in: "query", required: true, schema: { type: "string" }, description: "Authenticated user ID" },
          { name: "phone", in: "query", required: true, schema: { type: "string" }, description: "User phone number" },
          { name: "email", in: "query", required: false, schema: { type: "string" }, description: "User email" }
        ];
        const authBodyProps = {
          user_id: { type: "string", description: "Authenticated user ID" },
          phone: { type: "string", description: "User phone number" },
          email: { type: "string", description: "User email (optional)" }
        };
        const errorSchema = {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: { type: "string" }
          }
        };
        const successProp = { success: { type: "boolean", example: true } };
        const groupIdParam = { name: "groupId", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "Group ID" };
        const spec = {
          openapi: "3.0.3",
          info: {
            title: "Group Chat Worker API",
            version: "1.0.0",
            description: "D1-backed polling chat API for Hallo Vegvisr. Provides group management, messaging, media upload, polls, reactions, invite links, push notification registration, and bot management."
          },
          servers: [{ url: url.origin }],
          paths: {
            "/health": {
              get: {
                summary: "Health check",
                operationId: "getHealth",
                responses: {
                  "200": {
                    description: "Service health status",
                    content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" }, service: { type: "string" }, database: { type: "string" }, timestamp: { type: "string", format: "date-time" } } } } }
                  }
                }
              }
            },
            "/openapi.json": {
              get: {
                summary: "OpenAPI specification",
                operationId: "getOpenApiSpec",
                responses: { "200": { description: "This OpenAPI 3.0 specification", content: { "application/json": { schema: { type: "object" } } } } }
              }
            },
            "/media": {
              get: {
                summary: "Fetch uploaded media by object key",
                operationId: "getMedia",
                parameters: [
                  { name: "key", in: "query", required: true, schema: { type: "string" }, description: "R2 object key for the media file" }
                ],
                responses: {
                  "200": { description: "Media file bytes", content: { "*/*": { schema: { type: "string", format: "binary" } } } },
                  "206": { description: "Partial content (range request)" },
                  "404": { description: "Media not found", content: { "application/json": { schema: errorSchema } } }
                }
              },
              head: {
                summary: "Head request for media metadata",
                operationId: "headMedia",
                parameters: [
                  { name: "key", in: "query", required: true, schema: { type: "string" }, description: "R2 object key for the media file" }
                ],
                responses: {
                  "200": { description: "Media metadata headers only" },
                  "404": { description: "Media not found" }
                }
              }
            },
            "/groups": {
              post: {
                summary: "Create a new group",
                operationId: "createGroup",
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["name", "created_by", "phone"], properties: { name: { type: "string" }, created_by: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, graph_id: { type: "string", nullable: true } } } } }
                },
                responses: {
                  "201": { description: "Group created", content: { "application/json": { schema: { type: "object", properties: { ...successProp, group: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, created_by: { type: "string" }, graph_id: { type: "string", nullable: true }, created_at: { type: "integer" }, updated_at: { type: "integer" } } } } } } } },
                  "400": { description: "Validation error", content: { "application/json": { schema: errorSchema } } }
                }
              },
              get: {
                summary: "List groups for a user",
                operationId: "listGroups",
                parameters: [
                  ...authParams,
                  { name: "since", in: "query", required: false, schema: { type: "integer" }, description: "Only return groups updated after this timestamp (ms)" },
                  { name: "include_archived", in: "query", required: false, schema: { type: "string", enum: ["0", "1"] }, description: "Include archived groups (Superadmin only)" }
                ],
                responses: {
                  "200": { description: "List of groups", content: { "application/json": { schema: { type: "object", properties: { ...successProp, groups: { type: "array", items: { type: "object" } } } } } } },
                  "400": { description: "Validation error", content: { "application/json": { schema: errorSchema } } }
                }
              }
            },
            "/groups/{groupId}": {
              put: {
                summary: "Update group info (owner/admin only)",
                operationId: "updateGroup",
                parameters: [groupIdParam],
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["user_id", "phone"], properties: { ...authBodyProps, name: { type: "string" }, image_url: { type: "string", nullable: true }, notifications_muted: { type: "boolean" } } } } }
                },
                responses: {
                  "200": { description: "Group updated", content: { "application/json": { schema: { type: "object", properties: { ...successProp, group: { type: "object" } } } } } },
                  "403": { description: "Not owner/admin", content: { "application/json": { schema: errorSchema } } }
                }
              }
            },
            "/groups/{groupId}/archive": {
              post: {
                summary: "Archive a group (Superadmin only)",
                operationId: "archiveGroup",
                parameters: [groupIdParam],
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["user_id", "phone"], properties: authBodyProps } } }
                },
                responses: {
                  "200": { description: "Group archived", content: { "application/json": { schema: { type: "object", properties: successProp } } } },
                  "403": { description: "Not Superadmin", content: { "application/json": { schema: errorSchema } } }
                }
              }
            },
            "/groups/{groupId}/restore": {
              post: {
                summary: "Restore an archived group (Superadmin only)",
                operationId: "restoreGroup",
                parameters: [groupIdParam],
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["user_id", "phone"], properties: authBodyProps } } }
                },
                responses: {
                  "200": { description: "Group restored", content: { "application/json": { schema: { type: "object", properties: successProp } } } },
                  "403": { description: "Not Superadmin", content: { "application/json": { schema: errorSchema } } }
                }
              }
            },
            "/groups/{groupId}/join": {
              post: {
                summary: "Join a group directly",
                operationId: "joinGroup",
                parameters: [groupIdParam],
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["user_id", "phone"], properties: { ...authBodyProps, role: { type: "string", default: "member" } } } } }
                },
                responses: {
                  "200": { description: "Joined successfully", content: { "application/json": { schema: { type: "object", properties: { ...successProp, group_id: { type: "string" }, user_id: { type: "string" } } } } } },
                  "404": { description: "Group not found", content: { "application/json": { schema: errorSchema } } }
                }
              }
            },
            "/groups/{groupId}/members": {
              get: {
                summary: "List group members",
                operationId: "listGroupMembers",
                parameters: [groupIdParam, ...authParams],
                responses: {
                  "200": { description: "Member list", content: { "application/json": { schema: { type: "object", properties: { ...successProp, members: { type: "array", items: { type: "object", properties: { user_id: { type: "string" }, role: { type: "string" }, joined_at: { type: "integer" } } } } } } } } },
                  "403": { description: "Not a group member", content: { "application/json": { schema: errorSchema } } }
                }
              }
            },
            "/groups/{groupId}/members/{userId}": {
              delete: {
                summary: "Remove a member from a group (owner only)",
                operationId: "removeGroupMember",
                parameters: [
                  groupIdParam,
                  { name: "userId", in: "path", required: true, schema: { type: "string" }, description: "user_id of the member to remove" },
                  ...authParams
                ],
                responses: {
                  "200": { description: "Member removed", content: { "application/json": { schema: { type: "object", properties: { ...successProp, group_id: { type: "string" }, removed_user_id: { type: "string" } } } } } },
                  "400": { description: "Owner cannot remove themselves", content: { "application/json": { schema: errorSchema } } },
                  "403": { description: "Not the owner, or target is owner", content: { "application/json": { schema: errorSchema } } },
                  "404": { description: "User is not a member of this group", content: { "application/json": { schema: errorSchema } } }
                }
              }
            },
            "/groups/{groupId}/messages": {
              get: {
                summary: "Get messages in a group (polling or cursor-based)",
                operationId: "getGroupMessages",
                parameters: [
                  groupIdParam,
                  ...authParams,
                  { name: "after", in: "query", required: false, schema: { type: "integer", default: 0 }, description: "Return messages with id > after (forward polling)" },
                  { name: "before", in: "query", required: false, schema: { type: "integer" }, description: "Return messages with id < before (backward paging, used with latest=1)" },
                  { name: "limit", in: "query", required: false, schema: { type: "integer", default: 50, maximum: 200 }, description: "Max messages to return" },
                  { name: "latest", in: "query", required: false, schema: { type: "string", enum: ["0", "1"] }, description: "Use cursor-based paging (newest first, paginate with before)" }
                ],
                responses: {
                  "200": { description: "Messages", content: { "application/json": { schema: { type: "object", properties: { ...successProp, messages: { type: "array", items: { type: "object" } }, paging: { type: "object", properties: { has_more: { type: "boolean" }, next_before: { type: "integer", nullable: true } }, description: "Only present when latest=1" } } } } } },
                  "403": { description: "Not a group member", content: { "application/json": { schema: errorSchema } } }
                }
              },
              post: {
                summary: "Send a message to a group",
                operationId: "sendMessage",
                parameters: [groupIdParam],
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["user_id", "phone"], properties: { ...authBodyProps, body: { type: "string", description: "Message text (required for type text)" }, message_type: { type: "string", enum: ["text", "voice", "image", "video"], default: "text" }, audio_url: { type: "string", description: "Required for voice messages" }, audio_duration_ms: { type: "integer", nullable: true }, transcript_text: { type: "string", nullable: true }, transcript_lang: { type: "string", nullable: true }, transcription_status: { type: "string", nullable: true }, media_url: { type: "string", description: "Required for image/video messages" }, media_object_key: { type: "string" }, media_content_type: { type: "string", nullable: true }, media_size: { type: "integer", nullable: true }, video_thumbnail_url: { type: "string" }, video_duration_ms: { type: "number", nullable: true }, reply_to_id: { type: "integer", nullable: true, description: "Message ID being replied to" } } } } }
                },
                responses: {
                  "201": { description: "Message sent", content: { "application/json": { schema: { type: "object", properties: { ...successProp, message: { type: "object" } } } } } },
                  "400": { description: "Validation error", content: { "application/json": { schema: errorSchema } } },
                  "403": { description: "Not a group member", content: { "application/json": { schema: errorSchema } } }
                }
              }
            },
            "/groups/{groupId}/messages/{messageId}": {
              patch: {
                summary: "Update a message (transcript fields or body)",
                operationId: "updateMessage",
                parameters: [groupIdParam, { name: "messageId", in: "path", required: true, schema: { type: "integer" }, description: "Message ID" }],
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["user_id", "phone"], properties: { ...authBodyProps, body: { type: "string", nullable: true }, transcript_text: { type: "string", nullable: true }, transcript_lang: { type: "string", nullable: true }, transcription_status: { type: "string", nullable: true } } } } }
                },
                responses: {
                  "200": { description: "Message updated", content: { "application/json": { schema: { type: "object", properties: { ...successProp, message: { type: "object" } } } } } },
                  "404": { description: "Message not found", content: { "application/json": { schema: errorSchema } } }
                }
              },
              delete: {
                summary: "Delete a message (owner, group admin, or Superadmin)",
                operationId: "deleteMessage",
                parameters: [
                  groupIdParam,
                  { name: "messageId", in: "path", required: true, schema: { type: "integer" }, description: "Message ID" },
                  ...authParams
                ],
                responses: {
                  "200": { description: "Message deleted", content: { "application/json": { schema: { type: "object", properties: { ...successProp, deleted: { type: "object", properties: { id: { type: "integer" }, group_id: { type: "string" } } } } } } } },
                  "403": { description: "Not allowed", content: { "application/json": { schema: errorSchema } } },
                  "404": { description: "Message not found", content: { "application/json": { schema: errorSchema } } }
                }
              }
            },
            "/groups/{groupId}/media": {
              post: {
                summary: "Upload media (image/video) to a group",
                operationId: "uploadGroupMedia",
                parameters: [
                  groupIdParam,
                  { name: "user_id", in: "query", required: true, schema: { type: "string" } },
                  { name: "phone", in: "query", required: true, schema: { type: "string" } },
                  { name: "email", in: "query", required: false, schema: { type: "string" } }
                ],
                requestBody: {
                  required: true,
                  content: { "*/*": { schema: { type: "string", format: "binary" } } },
                  description: "Raw media bytes. Set Content-Type header and X-File-Name header."
                },
                responses: {
                  "200": { description: "Upload successful", content: { "application/json": { schema: { type: "object", properties: { ...successProp, objectKey: { type: "string" }, mediaUrl: { type: "string" }, size: { type: "integer" }, contentType: { type: "string" } } } } } },
                  "413": { description: "Media too large (max 200MB)", content: { "application/json": { schema: errorSchema } } }
                }
              }
            },
            "/groups/{groupId}/invite": {
              post: {
                summary: "Create invite link (owner/admin only)",
                operationId: "createInvite",
                parameters: [groupIdParam],
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["user_id", "phone"], properties: { ...authBodyProps, expires_in_days: { type: "integer", default: 7 } } } } }
                },
                responses: {
                  "201": { description: "Invite created", content: { "application/json": { schema: { type: "object", properties: { ...successProp, invite: { type: "object", properties: { code: { type: "string" }, group_id: { type: "string" }, invite_link: { type: "string" }, expires_at: { type: "integer" } } } } } } } },
                  "403": { description: "Not owner/admin", content: { "application/json": { schema: errorSchema } } }
                }
              }
            },
            "/invite/{code}": {
              get: {
                summary: "Get invite info (no auth required)",
                operationId: "getInviteInfo",
                parameters: [{ name: "code", in: "path", required: true, schema: { type: "string" }, description: "Invite code" }],
                responses: {
                  "200": { description: "Invite details", content: { "application/json": { schema: { type: "object", properties: { ...successProp, invite: { type: "object", properties: { code: { type: "string" }, group_id: { type: "string" }, group_name: { type: "string" }, member_count: { type: "integer" }, expires_at: { type: "integer" } } } } } } } },
                  "404": { description: "Invalid invite code", content: { "application/json": { schema: errorSchema } } },
                  "410": { description: "Invite expired", content: { "application/json": { schema: errorSchema } } }
                }
              }
            },
            "/invite/{code}/join": {
              post: {
                summary: "Join a group via invite link",
                operationId: "joinViaInvite",
                parameters: [{ name: "code", in: "path", required: true, schema: { type: "string" }, description: "Invite code" }],
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["user_id", "phone"], properties: authBodyProps } } }
                },
                responses: {
                  "200": { description: "Joined or already a member", content: { "application/json": { schema: { type: "object", properties: { ...successProp, joined: { type: "boolean" }, already_member: { type: "boolean" }, group_id: { type: "string" }, group_name: { type: "string" } } } } } },
                  "404": { description: "Invalid invite code", content: { "application/json": { schema: errorSchema } } },
                  "410": { description: "Invite expired", content: { "application/json": { schema: errorSchema } } }
                }
              }
            },
            "/register-device": {
              post: {
                summary: "Register FCM token for push notifications",
                operationId: "registerDevice",
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["user_id", "phone", "fcm_token"], properties: { ...authBodyProps, fcm_token: { type: "string", description: "Firebase Cloud Messaging device token" }, platform: { type: "string", default: "android", description: "Device platform (android/ios/web)" } } } } }
                },
                responses: {
                  "200": { description: "Device registered", content: { "application/json": { schema: { type: "object", properties: { ...successProp, message: { type: "string" } } } } } }
                }
              }
            },
            "/unregister-device": {
              post: {
                summary: "Remove FCM token",
                operationId: "unregisterDevice",
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["user_id", "phone", "fcm_token"], properties: { ...authBodyProps, fcm_token: { type: "string" } } } } }
                },
                responses: {
                  "200": { description: "Device unregistered", content: { "application/json": { schema: { type: "object", properties: { ...successProp, message: { type: "string" } } } } } }
                }
              }
            },
            "/groups/{groupId}/polls": {
              post: {
                summary: "Create a poll in a group",
                operationId: "createPoll",
                parameters: [groupIdParam],
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["user_id", "phone", "question", "options"], properties: { ...authBodyProps, question: { type: "string" }, options: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6 } } } } }
                },
                responses: {
                  "200": { description: "Poll created", content: { "application/json": { schema: { type: "object", properties: { ...successProp, poll: { type: "object", properties: { id: { type: "string" }, message_id: { type: "integer" }, group_id: { type: "string" }, question: { type: "string" }, options: { type: "array", items: { type: "string" } }, created_by: { type: "string" }, created_at: { type: "integer" }, votes: { type: "object" }, total_votes: { type: "integer" }, my_vote: { type: "integer", nullable: true } } } } } } } },
                  "403": { description: "Not a group member", content: { "application/json": { schema: errorSchema } } }
                }
              }
            },
            "/groups/{groupId}/polls/unanswered": {
              get: {
                summary: "Count unanswered polls for a user in a group",
                operationId: "getUnansweredPollCount",
                parameters: [groupIdParam, ...authParams],
                responses: {
                  "200": { description: "Unanswered poll count", content: { "application/json": { schema: { type: "object", properties: { ...successProp, group_id: { type: "string" }, unanswered_count: { type: "integer" } } } } } }
                }
              }
            },
            "/polls/{pollId}": {
              get: {
                summary: "Get poll with results",
                operationId: "getPoll",
                parameters: [
                  { name: "pollId", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "Poll ID" },
                  ...authParams
                ],
                responses: {
                  "200": { description: "Poll details with vote counts", content: { "application/json": { schema: { type: "object", properties: { ...successProp, poll: { type: "object" } } } } } },
                  "404": { description: "Poll not found", content: { "application/json": { schema: errorSchema } } }
                }
              }
            },
            "/polls/{pollId}/vote": {
              post: {
                summary: "Vote on a poll (or change vote)",
                operationId: "votePoll",
                parameters: [{ name: "pollId", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "Poll ID" }],
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["user_id", "phone", "option_index"], properties: { ...authBodyProps, option_index: { type: "integer", description: "Zero-based index of the chosen option" } } } } }
                },
                responses: {
                  "200": { description: "Vote recorded", content: { "application/json": { schema: { type: "object", properties: { ...successProp, poll_id: { type: "string" }, my_vote: { type: "integer" }, votes: { type: "object" }, total_votes: { type: "integer" } } } } } },
                  "404": { description: "Poll not found", content: { "application/json": { schema: errorSchema } } }
                }
              }
            },
            "/polls/{pollId}/close": {
              post: {
                summary: "Close a poll (creator or Superadmin)",
                operationId: "closePoll",
                parameters: [{ name: "pollId", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "Poll ID" }],
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["user_id", "phone"], properties: authBodyProps } } }
                },
                responses: {
                  "200": { description: "Poll closed", content: { "application/json": { schema: { type: "object", properties: { ...successProp, poll_id: { type: "string" }, closed: { type: "boolean" } } } } } },
                  "403": { description: "Not creator or Superadmin", content: { "application/json": { schema: errorSchema } } }
                }
              }
            },
            "/messages/{messageId}/reactions": {
              post: {
                summary: "Toggle a reaction on a message",
                operationId: "toggleReaction",
                parameters: [{ name: "messageId", in: "path", required: true, schema: { type: "integer" }, description: "Message ID" }],
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["user_id", "phone", "reaction"], properties: { ...authBodyProps, reaction: { type: "string", enum: ["thumbs_up", "heart", "smile"] } } } } }
                },
                responses: {
                  "200": { description: "Reaction toggled", content: { "application/json": { schema: { type: "object", properties: { ...successProp, message_id: { type: "integer" }, reactions: { type: "object", description: "Map of reaction to count" }, my_reactions: { type: "array", items: { type: "string" } }, toggled: { type: "string" }, added: { type: "boolean" } } } } } },
                  "404": { description: "Message not found", content: { "application/json": { schema: errorSchema } } }
                }
              }
            },
            "/groups/{groupId}/reactions": {
              get: {
                summary: "Batch-fetch reactions for multiple messages",
                operationId: "getGroupReactions",
                parameters: [
                  groupIdParam,
                  ...authParams,
                  { name: "message_ids", in: "query", required: false, schema: { type: "string" }, description: "Comma-separated message IDs (max 200)" }
                ],
                responses: {
                  "200": { description: "Reactions map", content: { "application/json": { schema: { type: "object", properties: { ...successProp, reactions: { type: "object", description: "Map of messageId to { counts: {reaction: n}, mine: [reaction] }" } } } } } }
                }
              }
            },
            "/bots": {
              post: {
                summary: "Create a bot (Superadmin only)",
                operationId: "createBot",
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["user_id", "phone", "name", "username"], properties: { ...authBodyProps, name: { type: "string" }, username: { type: "string", pattern: "^[a-z0-9_-]+$" }, system_prompt: { type: "string" }, graph_id: { type: "string", nullable: true }, avatar_url: { type: "string", nullable: true }, tools: { type: "array", items: { type: "object" }, default: [] }, model: { type: "string", default: "claude-haiku-4-5-20251001" }, max_turns: { type: "integer", default: 10 }, temperature: { type: "number", default: 0.7 } } } } }
                },
                responses: {
                  "201": { description: "Bot created", content: { "application/json": { schema: { type: "object", properties: { ...successProp, bot: { type: "object" } } } } } },
                  "403": { description: "Not Superadmin", content: { "application/json": { schema: errorSchema } } },
                  "409": { description: "Username already taken", content: { "application/json": { schema: errorSchema } } }
                }
              },
              get: {
                summary: "List all active bots",
                operationId: "listBots",
                parameters: authParams,
                responses: {
                  "200": { description: "Bot list", content: { "application/json": { schema: { type: "object", properties: { ...successProp, bots: { type: "array", items: { type: "object" } } } } } } }
                }
              }
            },
            "/bots/{botId}": {
              get: {
                summary: "Get bot details and group memberships",
                operationId: "getBot",
                parameters: [
                  { name: "botId", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "Bot ID" },
                  ...authParams
                ],
                responses: {
                  "200": { description: "Bot details", content: { "application/json": { schema: { type: "object", properties: { ...successProp, bot: { type: "object" }, groups: { type: "array", items: { type: "object" } } } } } } },
                  "404": { description: "Bot not found", content: { "application/json": { schema: errorSchema } } }
                }
              },
              put: {
                summary: "Update bot (Superadmin only)",
                operationId: "updateBot",
                parameters: [{ name: "botId", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "Bot ID" }],
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["user_id", "phone"], properties: { ...authBodyProps, name: { type: "string" }, system_prompt: { type: "string" }, graph_id: { type: "string", nullable: true }, avatar_url: { type: "string", nullable: true }, tools: { type: "array", items: { type: "object" } }, model: { type: "string" }, max_turns: { type: "integer" }, temperature: { type: "number" }, is_active: { type: "boolean" } } } } }
                },
                responses: {
                  "200": { description: "Bot updated", content: { "application/json": { schema: { type: "object", properties: { ...successProp, bot: { type: "object" } } } } } },
                  "403": { description: "Not Superadmin", content: { "application/json": { schema: errorSchema } } },
                  "404": { description: "Bot not found", content: { "application/json": { schema: errorSchema } } }
                }
              },
              delete: {
                summary: "Deactivate bot (Superadmin only)",
                operationId: "deleteBot",
                parameters: [
                  { name: "botId", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "Bot ID" },
                  ...authParams
                ],
                responses: {
                  "200": { description: "Bot deactivated", content: { "application/json": { schema: { type: "object", properties: { ...successProp, message: { type: "string" }, originalUsername: { type: "string" } } } } } },
                  "403": { description: "Not Superadmin", content: { "application/json": { schema: errorSchema } } }
                }
              }
            },
            "/groups/{groupId}/bots": {
              post: {
                summary: "Add bot to group (Superadmin only)",
                description: `Adds an existing bot to a group. CRITICAL for callers: user_id MUST be the authenticated caller's UUID from who_am_i \u2014 NEVER invent or guess a user_id (e.g., do NOT make up Clerk-style ids like "user_abc123"). bot_id MUST be the bare UUID stored in chat_bots.id \u2014 NOT the "bot:<UUID>" display form that appears in group_messages.user_id.`,
                operationId: "addBotToGroup",
                parameters: [groupIdParam],
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["user_id", "phone", "bot_id"], properties: { ...authBodyProps, bot_id: { type: "string", description: 'Bot UUID (bare, no "bot:" prefix). Get from chat_bots.id or list_group_bots.' } } } } }
                },
                responses: {
                  "201": { description: "Bot added to group", content: { "application/json": { schema: { type: "object", properties: { ...successProp, message: { type: "string" }, bot: { type: "object" } } } } } },
                  "403": { description: "Not Superadmin", content: { "application/json": { schema: errorSchema } } },
                  "404": { description: "Group or bot not found", content: { "application/json": { schema: errorSchema } } }
                }
              },
              get: {
                summary: "List bots in a group",
                operationId: "listGroupBots",
                parameters: [groupIdParam, ...authParams],
                responses: {
                  "200": { description: "Bots in group", content: { "application/json": { schema: { type: "object", properties: { ...successProp, bots: { type: "array", items: { type: "object" } } } } } } }
                }
              }
            },
            "/groups/{groupId}/bots/{botId}": {
              delete: {
                summary: "Remove bot from group (Superadmin only)",
                operationId: "removeBotFromGroup",
                parameters: [
                  groupIdParam,
                  { name: "botId", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "Bot ID" },
                  ...authParams
                ],
                responses: {
                  "200": { description: "Bot removed", content: { "application/json": { schema: { type: "object", properties: { ...successProp, message: { type: "string" } } } } } },
                  "403": { description: "Not Superadmin", content: { "application/json": { schema: errorSchema } } }
                }
              }
            },
            "/groups/{groupId}/bots/check-mention": {
              get: {
                summary: "Check if text mentions a bot in this group",
                operationId: "checkBotMention",
                parameters: [
                  groupIdParam,
                  { name: "text", in: "query", required: false, schema: { type: "string" }, description: "Message text to scan for @mentions" }
                ],
                responses: {
                  "200": { description: "Matching bots", content: { "application/json": { schema: { type: "object", properties: { ...successProp, bots: { type: "array", items: { type: "object" } } } } } } }
                }
              }
            },
            "/bot-message": {
              post: {
                summary: "Post a verbatim message AS a bot to a group",
                description: 'Posts the EXACT text you provide in `body` as a message authored by the bot in the specified group. Use this whenever the caller asks you to make a bot SAY a specific message (e.g. "tell the group X", "post Y in the group as @botname", "have @creative say Z"). DO NOT use trigger_bot_response or delegate_to_bot for that \u2014 those generate their own text from conversation context and DISCARD any verbatim text you try to pass. Prefer this tool any time the user provides the literal message content. Requires the bot to already be a member of the group; if not, call addBotToGroup first.',
                operationId: "botSendMessage",
                requestBody: {
                  required: true,
                  content: { "application/json": { schema: { type: "object", required: ["bot_id", "group_id", "body"], properties: {
                    bot_id: { type: "string", description: 'Bot UUID (bare, no "bot:" prefix). Get from list_group_bots or chat_bots.id.' },
                    group_id: { type: "string", description: "Group UUID." },
                    body: { type: "string", description: "The literal message text to post as the bot. Posted verbatim, no transformation." }
                  } } } }
                },
                responses: {
                  "201": { description: "Bot message sent", content: { "application/json": { schema: { type: "object", properties: { ...successProp, message: { type: "object" } } } } } },
                  "403": { description: "Bot not in group", content: { "application/json": { schema: errorSchema } } }
                }
              }
            }
          }
        };
        return jsonResponse(spec);
      }
      if (pathname === "/link-preview" && request.method === "GET") {
        return await handleLinkPreview(request, env, searchParams);
      }
      if (pathname === "/media" && (request.method === "GET" || request.method === "HEAD")) {
        const response = await handleMediaFetch(request, env, searchParams);
        if (request.method === "HEAD") {
          return new Response(null, { status: response.status, headers: response.headers });
        }
        return response;
      }
      if (pathname === "/groups" && request.method === "POST") {
        const body = await readJson(request);
        if (!body) {
          return errorResponse("Invalid JSON body");
        }
        const name = (body.name || "").trim();
        const createdBy = (body.created_by || "").trim();
        const phone = (body.phone || "").trim();
        const email = body.email ? String(body.email).trim() : "";
        const graphId = body.graph_id ? String(body.graph_id).trim() : null;
        if (!name) {
          return errorResponse("Group name required");
        }
        if (!createdBy) {
          return errorResponse("created_by required");
        }
        if (!phone) {
          return errorResponse("phone required");
        }
        const auth = await validateUser(env, createdBy, phone, email);
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status);
        }
        const groupId = crypto.randomUUID();
        const createdAt = Date.now();
        await env.CHAT_DB.prepare(
          `INSERT INTO groups (id, name, created_by, graph_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(groupId, name, createdBy, graphId, createdAt, createdAt).run();
        await env.CHAT_DB.prepare(
          `INSERT INTO group_members (group_id, user_id, role, joined_at)
           VALUES (?, ?, ?, ?)`
        ).bind(groupId, createdBy, "owner", createdAt).run();
        return jsonResponse({
          success: true,
          group: {
            id: groupId,
            name,
            created_by: createdBy,
            graph_id: graphId,
            created_at: createdAt,
            updated_at: createdAt
          }
        }, 201);
      }
      const updateGroupMatch = pathname.match(/^\/groups\/([^/]+)$/);
      if (updateGroupMatch && request.method === "PUT") {
        const groupId = updateGroupMatch[1];
        const body = await readJson(request);
        if (!body) {
          return errorResponse("Invalid JSON body");
        }
        const userId = (body.user_id || "").trim();
        const phone = (body.phone || "").trim();
        const email = body.email ? String(body.email).trim() : "";
        if (!userId || !phone) {
          return errorResponse("user_id and phone required");
        }
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status);
        }
        const member = await env.CHAT_DB.prepare(
          "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?"
        ).bind(groupId, userId).first();
        if (!member || member.role !== "owner" && member.role !== "admin") {
          return errorResponse("Only owner or admin can update group", 403);
        }
        const updates = [];
        const values = [];
        if (body.name !== void 0) {
          const name = String(body.name).trim();
          if (name) {
            updates.push("name = ?");
            values.push(name);
          }
        }
        if (body.image_url !== void 0) {
          const imageUrl = body.image_url ? String(body.image_url).trim() : null;
          updates.push("image_url = ?");
          values.push(imageUrl);
        }
        if (body.notifications_muted !== void 0) {
          updates.push("notifications_muted = ?");
          values.push(body.notifications_muted ? 1 : 0);
        }
        if (body.alert_sender_email !== void 0) {
          const sender = body.alert_sender_email ? String(body.alert_sender_email).trim() : null;
          updates.push("alert_sender_email = ?");
          values.push(sender);
        }
        if (body.posting_locked !== void 0) {
          updates.push("posting_locked = ?");
          values.push(body.posting_locked ? 1 : 0);
        }
        if (updates.length === 0) {
          return errorResponse("No fields to update");
        }
        updates.push("updated_at = ?");
        values.push(Date.now());
        values.push(groupId);
        await env.CHAT_DB.prepare(
          `UPDATE groups SET ${updates.join(", ")} WHERE id = ?`
        ).bind(...values).run();
        const group = await env.CHAT_DB.prepare(
          "SELECT * FROM groups WHERE id = ?"
        ).bind(groupId).first();
        return jsonResponse({ success: true, group });
      }
      if (pathname === "/groups" && request.method === "GET") {
        const userId = searchParams.get("user_id");
        const phone = searchParams.get("phone") || "";
        const email = searchParams.get("email") || "";
        if (!userId) {
          return errorResponse("user_id required");
        }
        if (!phone) {
          return errorResponse("phone required");
        }
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status);
        }
        const sinceRaw = searchParams.get("since");
        const since = sinceRaw ? Number(sinceRaw) : null;
        if (sinceRaw && (Number.isNaN(since) || since < 0)) {
          return errorResponse("Invalid since value");
        }
        const includeArchived = searchParams.get("include_archived") === "1";
        const isSuperAdmin = auth.role === "Superadmin";
        let query = `SELECT g.*, gm.role, gm.joined_at
           FROM groups g
           JOIN group_members gm ON g.id = gm.group_id
           WHERE gm.user_id = ?`;
        const params = [userId];
        if (!(includeArchived && isSuperAdmin)) {
          query += " AND (g.archived_at IS NULL OR g.archived_at = 0)";
        }
        if (since !== null) {
          query += " AND g.updated_at > ?";
          params.push(since);
        }
        query += " ORDER BY g.updated_at DESC";
        const { results } = await env.CHAT_DB.prepare(query).bind(...params).all();
        return jsonResponse({ success: true, groups: results });
      }
      const archiveMatch = pathname.match(/^\/groups\/([^/]+)\/archive$/);
      if (archiveMatch && request.method === "POST") {
        const groupId = archiveMatch[1];
        const body = await readJson(request);
        if (!body) return errorResponse("Invalid JSON body");
        const userId = (body.user_id || "").trim();
        const phone = (body.phone || "").trim();
        const email = body.email ? String(body.email).trim() : "";
        if (!userId || !phone) return errorResponse("user_id and phone required");
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) return errorResponse(auth.error, auth.status);
        if (auth.role !== "Superadmin") {
          return errorResponse("Only superadmin can archive groups", 403);
        }
        await env.CHAT_DB.prepare(
          "UPDATE groups SET archived_at = ?, archived_by = ? WHERE id = ?"
        ).bind(Date.now(), userId, groupId).run();
        return jsonResponse({ success: true });
      }
      const restoreMatch = pathname.match(/^\/groups\/([^/]+)\/restore$/);
      if (restoreMatch && request.method === "POST") {
        const groupId = restoreMatch[1];
        const body = await readJson(request);
        if (!body) return errorResponse("Invalid JSON body");
        const userId = (body.user_id || "").trim();
        const phone = (body.phone || "").trim();
        const email = body.email ? String(body.email).trim() : "";
        if (!userId || !phone) return errorResponse("user_id and phone required");
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) return errorResponse(auth.error, auth.status);
        if (auth.role !== "Superadmin") {
          return errorResponse("Only superadmin can restore groups", 403);
        }
        await env.CHAT_DB.prepare(
          "UPDATE groups SET archived_at = NULL, archived_by = NULL WHERE id = ?"
        ).bind(groupId).run();
        return jsonResponse({ success: true });
      }
      const joinMatch = pathname.match(/^\/groups\/([^/]+)\/join$/);
      if (joinMatch && request.method === "POST") {
        const groupId = joinMatch[1];
        const body = await readJson(request);
        if (!body) {
          return errorResponse("Invalid JSON body");
        }
        const userId = (body.user_id || "").trim();
        const phone = (body.phone || "").trim();
        const email = body.email ? String(body.email).trim() : "";
        const role = (body.role || "member").trim();
        if (!userId) {
          return errorResponse("user_id required");
        }
        if (!phone) {
          return errorResponse("phone required");
        }
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status);
        }
        const group = await env.CHAT_DB.prepare("SELECT id FROM groups WHERE id = ?").bind(groupId).first();
        if (!group) {
          return errorResponse("Group not found", 404);
        }
        const joinedAt = Date.now();
        await env.CHAT_DB.prepare(
          `INSERT OR IGNORE INTO group_members (group_id, user_id, role, joined_at)
           VALUES (?, ?, ?, ?)`
        ).bind(groupId, userId, role, joinedAt).run();
        await env.CHAT_DB.prepare(
          "UPDATE groups SET updated_at = ? WHERE id = ?"
        ).bind(joinedAt, groupId).run();
        return jsonResponse({ success: true, group_id: groupId, user_id: userId });
      }
      const membersMatch = pathname.match(/^\/groups\/([^/]+)\/members$/);
      if (membersMatch && request.method === "GET") {
        const groupId = membersMatch[1];
        const userId = searchParams.get("user_id");
        const phone = searchParams.get("phone") || "";
        const email = searchParams.get("email") || "";
        if (!userId) {
          return errorResponse("user_id required");
        }
        if (!phone) {
          return errorResponse("phone required");
        }
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status);
        }
        const isMember = await ensureMember(env, groupId, userId);
        if (!isMember) {
          return errorResponse("Not a group member", 403);
        }
        const { results } = await env.CHAT_DB.prepare(
          `SELECT user_id, role, joined_at, alerts_enabled
           FROM group_members
           WHERE group_id = ?
           ORDER BY joined_at ASC`
        ).bind(groupId).all();
        return jsonResponse({ success: true, members: results });
      }
      const alertsPrefMatch = pathname.match(/^\/groups\/([^/]+)\/alerts-pref$/);
      if (alertsPrefMatch && request.method === "POST") {
        const groupId = alertsPrefMatch[1];
        const body = await readJson(request);
        if (!body) {
          return errorResponse("Invalid JSON body");
        }
        const userId = (body.user_id || "").trim();
        const phone = (body.phone || "").trim();
        const email = body.email ? String(body.email).trim() : "";
        if (!userId || !phone) {
          return errorResponse("user_id and phone required");
        }
        if (body.alerts_enabled === void 0) {
          return errorResponse("alerts_enabled required");
        }
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status);
        }
        const isMember = await ensureMember(env, groupId, userId);
        if (!isMember) {
          return errorResponse("Not a group member", 403);
        }
        const enabled = body.alerts_enabled ? 1 : 0;
        await env.CHAT_DB.prepare(
          "UPDATE group_members SET alerts_enabled = ? WHERE group_id = ? AND user_id = ?"
        ).bind(enabled, groupId, userId).run();
        return jsonResponse({ success: true, alerts_enabled: enabled });
      }
      const alertMatch = pathname.match(/^\/groups\/([^/]+)\/alert$/);
      if (alertMatch && request.method === "POST") {
        const groupId = alertMatch[1];
        const body = await readJson(request);
        if (!body) {
          return errorResponse("Invalid JSON body");
        }
        const userId = (body.user_id || "").trim();
        const phone = (body.phone || "").trim();
        const email = body.email ? String(body.email).trim() : "";
        const targetUserId = (body.target_user_id || "").trim();
        if (!userId || !phone) {
          return errorResponse("user_id and phone required");
        }
        if (!targetUserId) {
          return errorResponse("target_user_id required");
        }
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status);
        }
        const requester = await env.CHAT_DB.prepare(
          "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?"
        ).bind(groupId, userId).first();
        if (!requester || requester.role !== "owner") {
          return errorResponse("Only the group owner can send alerts", 403);
        }
        const target = await env.CHAT_DB.prepare(
          "SELECT alerts_enabled FROM group_members WHERE group_id = ? AND user_id = ?"
        ).bind(groupId, targetUserId).first();
        if (!target) {
          return errorResponse("Target user is not a member of this group", 404);
        }
        if (!target.alerts_enabled) {
          return errorResponse("Target user has not enabled email alerts", 409);
        }
        const targetEmail = await getUserEmail(env, targetUserId);
        if (!targetEmail) {
          return errorResponse("Target user has no email on file", 422);
        }
        const group = await env.CHAT_DB.prepare(
          "SELECT name, alert_sender_email FROM groups WHERE id = ?"
        ).bind(groupId).first();
        const groupName = group?.name || "your group chat";
        const fromEmail = (group?.alert_sender_email || env.ALERT_FROM_EMAIL || "").trim();
        const chatUrl = `https://chat.vegvisr.org/?group=${encodeURIComponent(groupId)}`;
        const subject = `New activity in ${groupName}`;
        const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#0f172a;line-height:1.5"><p>There's new activity in <strong>${escapeHtml(groupName)}</strong>.</p><p><a href="${chatUrl}" style="display:inline-block;padding:10px 18px;background:#0284c7;color:#fff;border-radius:8px;text-decoration:none">Open the chat</a></p><p style="color:#64748b;font-size:13px">You're receiving this because you enabled email alerts for this group. Turn them off anytime in Group Info.</p></div>`;
        const sent = await sendAlertEmail(env, fromEmail, targetEmail, subject, html);
        if (!sent.ok) {
          return errorResponse(sent.error, 502);
        }
        return jsonResponse({ success: true });
      }
      const alertSendersMatch = pathname.match(/^\/groups\/([^/]+)\/alert-senders$/);
      if (alertSendersMatch && request.method === "GET") {
        const groupId = alertSendersMatch[1];
        const userId = searchParams.get("user_id");
        const phone = searchParams.get("phone") || "";
        const email = searchParams.get("email") || "";
        if (!userId) {
          return errorResponse("user_id required");
        }
        if (!phone) {
          return errorResponse("phone required");
        }
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status);
        }
        const requester = await env.CHAT_DB.prepare(
          "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?"
        ).bind(groupId, userId).first();
        if (!requester || requester.role !== "owner") {
          return errorResponse("Only the group owner can manage alert senders", 403);
        }
        const ownerEmail = email || await getUserEmail(env, userId);
        const result = await fetchOwnerSenders(env, ownerEmail);
        if (!result.ok) {
          return errorResponse(result.error, 502);
        }
        return jsonResponse({ success: true, senders: result.senders });
      }
      const removeMemberMatch = pathname.match(/^\/groups\/([^/]+)\/members\/([^/]+)$/);
      if (removeMemberMatch && request.method === "DELETE") {
        const groupId = removeMemberMatch[1];
        const targetUserId = decodeURIComponent(removeMemberMatch[2]);
        const userId = searchParams.get("user_id");
        const phone = searchParams.get("phone") || "";
        const email = searchParams.get("email") || "";
        if (!userId) {
          return errorResponse("user_id required");
        }
        if (!phone) {
          return errorResponse("phone required");
        }
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status);
        }
        const requesterMember = await env.CHAT_DB.prepare(
          "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?"
        ).bind(groupId, userId).first();
        if (!requesterMember || requesterMember.role !== "owner") {
          return errorResponse("Only the group owner can remove members", 403);
        }
        if (targetUserId === userId) {
          return errorResponse("Owner cannot remove themselves", 400);
        }
        const target = await env.CHAT_DB.prepare(
          "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?"
        ).bind(groupId, targetUserId).first();
        if (!target) {
          return errorResponse("User is not a member of this group", 404);
        }
        if (target.role === "owner") {
          return errorResponse("Cannot remove an owner", 403);
        }
        await env.CHAT_DB.prepare(
          "DELETE FROM group_members WHERE group_id = ? AND user_id = ?"
        ).bind(groupId, targetUserId).run();
        return jsonResponse({ success: true, group_id: groupId, removed_user_id: targetUserId });
      }
      const messagesMatch = pathname.match(/^\/groups\/([^/]+)\/messages$/);
      if (messagesMatch && request.method === "GET") {
        const groupId = messagesMatch[1];
        const userId = searchParams.get("user_id");
        const phone = searchParams.get("phone") || "";
        const email = searchParams.get("email") || "";
        const afterRaw = searchParams.get("after");
        const after = afterRaw ? Number(afterRaw) : 0;
        const beforeRaw = searchParams.get("before");
        const before = beforeRaw ? Number(beforeRaw) : 0;
        const limitRaw = searchParams.get("limit");
        const latestRaw = searchParams.get("latest");
        const latest = latestRaw === "1" || latestRaw === "true";
        let limit = limitRaw ? Number(limitRaw) : 50;
        if (!userId) {
          return errorResponse("user_id required");
        }
        if (!phone) {
          return errorResponse("phone required");
        }
        if (Number.isNaN(after) || after < 0) {
          return errorResponse("Invalid after value");
        }
        if (Number.isNaN(before) || before < 0) {
          return errorResponse("Invalid before value");
        }
        if (Number.isNaN(limit) || limit <= 0) {
          limit = 50;
        }
        limit = Math.min(limit, 200);
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status);
        }
        const isMember = await ensureMember(env, groupId, userId);
        if (!isMember) {
          return errorResponse("Not a group member", 403);
        }
        let results;
        if (latest) {
          const pageSize = limit;
          const fetchLimit = Math.min(pageSize + 1, 201);
          const baseSelect = `SELECT id, group_id, user_id, body, created_at,
                  message_type, audio_url, audio_duration_ms,
                  transcript_text, transcript_lang, transcription_status,
                  media_url, media_object_key, media_content_type, media_size,
                  video_thumbnail_url, video_duration_ms,
                  sender_avatar_url, reply_to_id,
                  forwarded_from_message_id, forwarded_from_user_id, forwarded_from_user_name
            FROM group_messages`;
          const where = before > 0 ? ` WHERE group_id = ? AND id < ?` : ` WHERE group_id = ?`;
          const query = `${baseSelect}${where}
            ORDER BY id DESC
            LIMIT ?`;
          const stmt = env.CHAT_DB.prepare(query);
          const data = before > 0 ? await stmt.bind(groupId, before, fetchLimit).all() : await stmt.bind(groupId, fetchLimit).all();
          const desc = data.results || [];
          const hasMore = desc.length > pageSize;
          const sliceDesc = hasMore ? desc.slice(0, pageSize) : desc;
          results = sliceDesc.reverse();
          const nextBefore = results.length > 0 ? results[0].id : null;
          return jsonResponse({
            success: true,
            messages: results,
            paging: {
              has_more: hasMore,
              next_before: nextBefore
            }
          });
        } else {
          const query = `SELECT id, group_id, user_id, body, created_at,
                  message_type, audio_url, audio_duration_ms,
                  transcript_text, transcript_lang, transcription_status,
                  media_url, media_object_key, media_content_type, media_size,
                  video_thumbnail_url, video_duration_ms,
                  sender_avatar_url, reply_to_id,
                  forwarded_from_message_id, forwarded_from_user_id, forwarded_from_user_name
           FROM group_messages
           WHERE group_id = ? AND id > ?
           ORDER BY id ASC
           LIMIT ?`;
          const data = await env.CHAT_DB.prepare(query).bind(groupId, after, limit).all();
          results = data.results || [];
        }
        return jsonResponse({ success: true, messages: results });
      }
      const mediaUploadMatch = pathname.match(/^\/groups\/([^/]+)\/media$/);
      if (mediaUploadMatch && request.method === "POST") {
        const groupId = mediaUploadMatch[1];
        return handleMediaUpload(request, env, groupId, searchParams);
      }
      if (messagesMatch && request.method === "POST") {
        const groupId = messagesMatch[1];
        const body = await readJson(request);
        if (!body) {
          return errorResponse("Invalid JSON body");
        }
        const userId = (body.user_id || "").trim();
        const phone = (body.phone || "").trim();
        const email = body.email ? String(body.email).trim() : "";
        const text = (body.body || "").trim();
        const messageType = (body.message_type || body.type || "text").trim();
        const audioUrl = body.audio_url ? String(body.audio_url).trim() : "";
        const audioDurationMs = body.audio_duration_ms ?? null;
        const transcriptText = body.transcript_text ? String(body.transcript_text) : null;
        const transcriptLang = body.transcript_lang ? String(body.transcript_lang) : null;
        const mediaUrl = body.media_url ? String(body.media_url).trim() : "";
        const mediaObjectKey = body.media_object_key ? String(body.media_object_key).trim() : "";
        const mediaContentType = body.media_content_type ? String(body.media_content_type).trim() : null;
        const mediaSize = body.media_size ?? null;
        const videoThumbnailUrl = body.video_thumbnail_url ? String(body.video_thumbnail_url).trim() : "";
        const videoDurationMs = body.video_duration_ms ?? null;
        const transcriptionStatus = body.transcription_status ? String(body.transcription_status) : messageType === "voice" ? "pending" : null;
        const replyToId = body.reply_to_id ? Number(body.reply_to_id) : null;
        if (!userId) {
          return errorResponse("user_id required");
        }
        if (!phone) {
          return errorResponse("phone required");
        }
        if (messageType === "voice") {
          if (!audioUrl) {
            return errorResponse("audio_url required for voice messages");
          }
        } else if (messageType === "image" || messageType === "video" || messageType === "pdf") {
          if (!mediaUrl) {
            return errorResponse("media_url required for image/video/pdf messages");
          }
          if (messageType === "video") {
            if (videoDurationMs !== null) {
              const n = Number(videoDurationMs);
              if (Number.isNaN(n) || n < 0) {
                return errorResponse("video_duration_ms must be a non-negative number");
              }
            }
          }
        } else if (!text) {
          return errorResponse("Message body required");
        }
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status);
        }
        const isMember = await ensureMember(env, groupId, userId);
        if (!isMember) {
          return errorResponse("Not a group member", 403);
        }
        const lockGuard = await ensurePostingAllowed(env, groupId, userId);
        if (lockGuard) {
          return errorResponse(lockGuard.error, lockGuard.status);
        }
        const createdAt = Date.now();
        const storedBody = messageType === "image" || messageType === "video" ? text || "" : text;
        const result = await env.CHAT_DB.prepare(
          `INSERT INTO group_messages (
             group_id, user_id, body, created_at,
             message_type, audio_url, audio_duration_ms,
             transcript_text, transcript_lang, transcription_status,
             media_url, media_object_key, media_content_type, media_size,
             video_thumbnail_url, video_duration_ms, reply_to_id
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          groupId,
          userId,
          storedBody,
          createdAt,
          messageType,
          audioUrl || null,
          audioDurationMs,
          transcriptText,
          transcriptLang,
          transcriptionStatus,
          mediaUrl || null,
          mediaObjectKey || null,
          mediaContentType,
          mediaSize,
          messageType === "video" ? videoThumbnailUrl || null : null,
          messageType === "video" ? videoDurationMs ?? null : null,
          replyToId
        ).run();
        await env.CHAT_DB.prepare(
          "UPDATE groups SET updated_at = ? WHERE id = ?"
        ).bind(createdAt, groupId).run();
        const botUserId = userId.startsWith("bot:") ? userId : null;
        if (!botUserId && storedBody && env.AGENT_WORKER) {
          const botMentions = storedBody.match(/@([a-z0-9_-]+)/g) || [];
          if (botMentions.length > 0) {
            const usernames = botMentions.map((m) => m.replace("@", ""));
            ctx.waitUntil((async () => {
              try {
                const placeholders = usernames.map(() => "?").join(",");
                const bots = await env.CHAT_DB.prepare(
                  `SELECT cb.* FROM group_bot_members gbm
                   JOIN chat_bots cb ON gbm.bot_id = cb.id
                   WHERE gbm.group_id = ? AND cb.username IN (${placeholders}) AND cb.is_active = 1`
                ).bind(groupId, ...usernames).all();
                if (bots.results && bots.results.length > 0) {
                  const recentMsgs = await env.CHAT_DB.prepare(
                    `SELECT id, group_id, user_id, body, created_at, message_type,
                            transcript_text, transcript_lang
                     FROM group_messages WHERE group_id = ?
                     ORDER BY id DESC LIMIT 20`
                  ).bind(groupId).all();
                  const group = await env.CHAT_DB.prepare(
                    "SELECT name FROM groups WHERE id = ?"
                  ).bind(groupId).first();
                  for (const bot of bots.results) {
                    console.log(`[Bot] Triggering @${bot.username} in group ${groupId}`);
                    const placeholderCreatedAt = Date.now();
                    const placeholderRes = await env.CHAT_DB.prepare(
                      `INSERT INTO group_messages (group_id, user_id, body, created_at, message_type, sender_avatar_url)
                       VALUES (?, ?, ?, ?, 'bot_thinking', ?)`
                    ).bind(
                      groupId,
                      `bot:${bot.id}`,
                      `${bot.name} is thinking\u2026`,
                      placeholderCreatedAt,
                      bot.avatar_url || null
                    ).run();
                    const placeholderId = placeholderRes.meta.last_row_id;
                    let agentResponse;
                    try {
                      agentResponse = await env.AGENT_WORKER.fetch("https://agent-worker/bot-respond", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          bot,
                          group_id: groupId,
                          group_name: group?.name || "Unknown",
                          trigger_message: {
                            id: result.meta.last_row_id,
                            user_id: userId,
                            body: storedBody,
                            created_at: createdAt
                          },
                          recent_messages: (recentMsgs.results || []).reverse(),
                          placeholder_id: placeholderId
                        })
                      });
                    } catch (callErr) {
                      console.error(`[Bot] @${bot.username} fetch threw:`, callErr);
                      agentResponse = null;
                    }
                    if (!agentResponse || !agentResponse.ok) {
                      console.error(`[Bot] @${bot.username} bot-respond status:`, agentResponse?.status || "no-response");
                      await env.CHAT_DB.prepare(
                        `UPDATE group_messages
                         SET body = ?, message_type = 'bot_error', created_at = ?
                         WHERE id = ?`
                      ).bind(
                        `${bot.name} couldn't reply \u2014 please try again.`,
                        Date.now(),
                        placeholderId
                      ).run();
                    }
                  }
                }
              } catch (err) {
                console.error("[Bot] Error triggering bot:", err);
              }
            })());
          }
        }
        const isSuperadmin = auth.role === "Superadmin";
        if (isSuperadmin) {
          console.log("[Push] Superadmin sending message, triggering push notifications");
          ctx.waitUntil((async () => {
            try {
              const group = await env.CHAT_DB.prepare(
                "SELECT name, notifications_muted FROM groups WHERE id = ?"
              ).bind(groupId).first();
              const groupName = group?.name || "Group Chat";
              if (group?.notifications_muted) {
                console.log("[Push] Group", groupName, "has notifications muted \u2014 skipping");
                return;
              }
              const tokens = await getGroupMemberTokens(env, groupId, userId);
              console.log("[Push] Got", tokens.length, "tokens to notify");
              if (tokens.length > 0) {
                const previewText = messageType === "voice" ? transcriptText && transcriptText.trim().isNotEmpty ? transcriptText.trim() : "\u{1F3A4} Voice message" : messageType === "image" ? "\u{1F4F7} Photo" : messageType === "video" ? "\u{1F3AC} Video" : storedBody;
                const preview = previewText.length > 50 ? previewText.substring(0, 47) + "..." : previewText;
                await sendPushNotification(
                  env,
                  tokens,
                  groupName,
                  preview,
                  {
                    group_id: groupId,
                    group_name: groupName,
                    message_id: String(result.meta.last_row_id)
                  }
                );
              }
            } catch (err) {
              console.error("[Push] Error in background task:", err);
            }
          })());
        } else {
          console.log("[Push] User role is", auth.role, "- skipping push notification");
        }
        return jsonResponse({
          success: true,
          message: {
            id: result.meta.last_row_id,
            group_id: groupId,
            user_id: userId,
            body: storedBody,
            created_at: createdAt,
            message_type: messageType,
            audio_url: audioUrl || null,
            audio_duration_ms: audioDurationMs,
            transcript_text: transcriptText,
            transcript_lang: transcriptLang,
            transcription_status: transcriptionStatus,
            media_url: mediaUrl || null,
            media_object_key: mediaObjectKey || null,
            media_content_type: mediaContentType,
            media_size: mediaSize,
            video_thumbnail_url: messageType === "video" ? videoThumbnailUrl || null : null,
            video_duration_ms: messageType === "video" ? videoDurationMs ?? null : null,
            reply_to_id: replyToId
          }
        }, 201);
      }
      const messageUpdateMatch = pathname.match(/^\/groups\/([^/]+)\/messages\/(\d+)$/);
      if (messageUpdateMatch && request.method === "PATCH") {
        const groupId = messageUpdateMatch[1];
        const messageId = Number(messageUpdateMatch[2]);
        const body = await readJson(request);
        if (!body) {
          return errorResponse("Invalid JSON body");
        }
        const userId = (body.user_id || "").trim();
        const phone = (body.phone || "").trim();
        const email = body.email ? String(body.email).trim() : "";
        const newBody = typeof body.body === "string" ? body.body.trim() : null;
        const transcriptText = body.transcript_text ? String(body.transcript_text) : null;
        const transcriptLang = body.transcript_lang ? String(body.transcript_lang) : null;
        const transcriptionStatus = body.transcription_status ? String(body.transcription_status) : null;
        if (!userId) {
          return errorResponse("user_id required");
        }
        if (!phone) {
          return errorResponse("phone required");
        }
        if (!newBody && !transcriptText && !transcriptLang && !transcriptionStatus) {
          return errorResponse("No transcript fields provided");
        }
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status);
        }
        const isMember = await ensureMember(env, groupId, userId);
        if (!isMember) {
          return errorResponse("Not a group member", 403);
        }
        const existing = await env.CHAT_DB.prepare(
          `SELECT id FROM group_messages WHERE id = ? AND group_id = ?`
        ).bind(messageId, groupId).first();
        if (!existing) {
          return errorResponse("Message not found", 404);
        }
        await env.CHAT_DB.prepare(
          `UPDATE group_messages
           SET body = COALESCE(?, body),
               transcript_text = COALESCE(?, transcript_text),
               transcript_lang = COALESCE(?, transcript_lang),
               transcription_status = COALESCE(?, transcription_status)
           WHERE id = ? AND group_id = ?`
        ).bind(newBody, transcriptText, transcriptLang, transcriptionStatus, messageId, groupId).run();
        const updated = await env.CHAT_DB.prepare(
          `SELECT id, group_id, user_id, body, created_at,
                  message_type, audio_url, audio_duration_ms,
                  transcript_text, transcript_lang, transcription_status
           FROM group_messages
           WHERE id = ?`
        ).bind(messageId).first();
        return jsonResponse({ success: true, message: updated });
      }
      if (messageUpdateMatch && request.method === "DELETE") {
        const groupId = messageUpdateMatch[1];
        const messageId = Number(messageUpdateMatch[2]);
        const userId = (searchParams.get("user_id") || "").trim();
        const phone = (searchParams.get("phone") || "").trim();
        const email = (searchParams.get("email") || "").trim();
        if (!userId) {
          return errorResponse("user_id required");
        }
        if (!phone) {
          return errorResponse("phone required");
        }
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status);
        }
        const isMember = await ensureMember(env, groupId, userId);
        if (!isMember) {
          return errorResponse("Not a group member", 403);
        }
        const existing = await env.CHAT_DB.prepare(
          `SELECT id, group_id, user_id, message_type, media_object_key
           FROM group_messages
           WHERE id = ? AND group_id = ?`
        ).bind(messageId, groupId).first();
        if (!existing) {
          return errorResponse("Message not found", 404);
        }
        let canDelete = String(existing.user_id) === String(userId);
        if (!canDelete) {
          const member = await env.CHAT_DB.prepare(
            "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?"
          ).bind(groupId, userId).first();
          const groupRole = member?.role || "";
          if (groupRole === "owner" || groupRole === "admin") {
            canDelete = true;
          }
        }
        if (!canDelete && (auth.role === "Admin" || auth.role === "Superadmin")) {
          canDelete = true;
        }
        if (!canDelete) {
          return errorResponse("Not allowed to delete this message", 403);
        }
        const objectKey = existing.media_object_key ? String(existing.media_object_key) : "";
        if (objectKey && env.CHAT_MEDIA) {
          ctx.waitUntil((async () => {
            try {
              await env.CHAT_MEDIA.delete(objectKey);
            } catch (err) {
              console.error("Failed to delete media object:", objectKey, err);
            }
          })());
        }
        await env.CHAT_DB.prepare(
          "DELETE FROM group_messages WHERE id = ? AND group_id = ?"
        ).bind(messageId, groupId).run();
        await env.CHAT_DB.prepare(
          "UPDATE groups SET updated_at = ? WHERE id = ?"
        ).bind(Date.now(), groupId).run();
        return jsonResponse({
          success: true,
          deleted: {
            id: messageId,
            group_id: groupId
          }
        });
      }
      const forwardMatch = pathname.match(/^\/groups\/([^/]+)\/messages\/(\d+)\/forward$/);
      if (forwardMatch && request.method === "POST") {
        const sourceGroupId = forwardMatch[1];
        const messageId = Number(forwardMatch[2]);
        const body = await readJson(request);
        if (!body) return errorResponse("Invalid JSON body");
        const userId = (body.user_id || "").trim();
        const phone = (body.phone || "").trim();
        const email = body.email ? String(body.email).trim() : "";
        const targetGroupId = (body.target_group_id || "").trim();
        const providedName = body.forwarded_from_user_name ? String(body.forwarded_from_user_name).trim().slice(0, 120) : null;
        if (!userId) return errorResponse("user_id required");
        if (!phone) return errorResponse("phone required");
        if (!targetGroupId) return errorResponse("target_group_id required");
        if (targetGroupId === sourceGroupId) return errorResponse("target_group_id must differ from source");
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) return errorResponse(auth.error, auth.status);
        const isMemberSource = await ensureMember(env, sourceGroupId, userId);
        if (!isMemberSource) return errorResponse("Not a member of source group", 403);
        const isMemberTarget = await ensureMember(env, targetGroupId, userId);
        if (!isMemberTarget) return errorResponse("Not a member of target group", 403);
        const source = await env.CHAT_DB.prepare(
          `SELECT id, user_id, body, message_type,
                  audio_url, audio_duration_ms,
                  transcript_text, transcript_lang, transcription_status,
                  media_url, media_object_key, media_content_type, media_size,
                  video_thumbnail_url, video_duration_ms
           FROM group_messages
           WHERE id = ? AND group_id = ?`
        ).bind(messageId, sourceGroupId).first();
        if (!source) return errorResponse("Message not found", 404);
        const createdAt = Date.now();
        const result = await env.CHAT_DB.prepare(
          `INSERT INTO group_messages (
             group_id, user_id, body, created_at, message_type,
             audio_url, audio_duration_ms,
             transcript_text, transcript_lang, transcription_status,
             media_url, media_object_key, media_content_type, media_size,
             video_thumbnail_url, video_duration_ms,
             reply_to_id,
             forwarded_from_message_id, forwarded_from_user_id, forwarded_from_user_name
           ) VALUES (?, ?, ?, ?, ?,  ?, ?,  ?, ?, ?,  ?, ?, ?, ?,  ?, ?,  ?,  ?, ?, ?)`
        ).bind(
          targetGroupId,
          userId,
          source.body,
          createdAt,
          source.message_type || "text",
          source.audio_url,
          source.audio_duration_ms,
          source.transcript_text,
          source.transcript_lang,
          source.transcription_status,
          source.media_url,
          source.media_object_key,
          source.media_content_type,
          source.media_size,
          source.video_thumbnail_url,
          source.video_duration_ms,
          null,
          source.id,
          source.user_id,
          providedName
        ).run();
        await env.CHAT_DB.prepare("UPDATE groups SET updated_at = ? WHERE id = ?").bind(createdAt, targetGroupId).run();
        const inserted = await env.CHAT_DB.prepare(
          `SELECT id, group_id, user_id, body, created_at, message_type,
                  audio_url, audio_duration_ms,
                  transcript_text, transcript_lang, transcription_status,
                  media_url, media_object_key, media_content_type, media_size,
                  video_thumbnail_url, video_duration_ms,
                  sender_avatar_url, reply_to_id,
                  forwarded_from_message_id, forwarded_from_user_id, forwarded_from_user_name
           FROM group_messages WHERE id = ?`
        ).bind(result.meta.last_row_id).first();
        return jsonResponse({ success: true, message: inserted }, 201);
      }
      const moveMatch = pathname.match(/^\/groups\/([^/]+)\/messages\/(\d+)\/move$/);
      if (moveMatch && request.method === "POST") {
        const sourceGroupId = moveMatch[1];
        const messageId = Number(moveMatch[2]);
        const body = await readJson(request);
        if (!body) return errorResponse("Invalid JSON body");
        const userId = (body.user_id || "").trim();
        const phone = (body.phone || "").trim();
        const email = body.email ? String(body.email).trim() : "";
        const targetGroupId = (body.target_group_id || "").trim();
        if (!userId) return errorResponse("user_id required");
        if (!phone) return errorResponse("phone required");
        if (!targetGroupId) return errorResponse("target_group_id required");
        if (targetGroupId === sourceGroupId) return errorResponse("target_group_id must differ from source");
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) return errorResponse(auth.error, auth.status);
        const sourceGroup = await env.CHAT_DB.prepare(
          "SELECT id, created_by FROM groups WHERE id = ?"
        ).bind(sourceGroupId).first();
        if (!sourceGroup) return errorResponse("Source group not found", 404);
        const isOwner = String(sourceGroup.created_by) === String(userId);
        const isSuperadmin = auth.role === "Superadmin";
        if (!isOwner && !isSuperadmin) {
          return errorResponse("Only the source group owner or Superadmin can move messages", 403);
        }
        const isMemberTarget = await ensureMember(env, targetGroupId, userId);
        if (!isMemberTarget) return errorResponse("Not a member of target group", 403);
        const existing = await env.CHAT_DB.prepare(
          "SELECT id FROM group_messages WHERE id = ? AND group_id = ?"
        ).bind(messageId, sourceGroupId).first();
        if (!existing) return errorResponse("Message not found", 404);
        const now = Date.now();
        await env.CHAT_DB.prepare(
          `UPDATE group_messages SET group_id = ?, reply_to_id = NULL WHERE id = ?`
        ).bind(targetGroupId, messageId).run();
        await env.CHAT_DB.prepare("UPDATE groups SET updated_at = ? WHERE id IN (?, ?)").bind(now, sourceGroupId, targetGroupId).run();
        return jsonResponse({
          success: true,
          moved: { id: messageId, from_group_id: sourceGroupId, to_group_id: targetGroupId }
        });
      }
      const pinMatch = pathname.match(/^\/groups\/([^/]+)\/pin$/);
      if (pinMatch && request.method === "POST") {
        const groupId = pinMatch[1];
        const body = await readJson(request);
        if (!body) return errorResponse("Invalid JSON body");
        const userId = (body.user_id || "").trim();
        const phone = (body.phone || "").trim();
        const email = body.email ? String(body.email).trim() : "";
        const messageId = Number(body.message_id);
        if (!userId) return errorResponse("user_id required");
        if (!phone) return errorResponse("phone required");
        if (!messageId) return errorResponse("message_id required");
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) return errorResponse(auth.error, auth.status);
        const group = await env.CHAT_DB.prepare(
          "SELECT id, created_by FROM groups WHERE id = ?"
        ).bind(groupId).first();
        if (!group) return errorResponse("Group not found", 404);
        const isOwner = String(group.created_by) === String(userId);
        const isSuperadmin = auth.role === "Superadmin";
        if (!isOwner && !isSuperadmin) {
          return errorResponse("Only the group owner or Superadmin can pin messages", 403);
        }
        const message = await env.CHAT_DB.prepare(
          "SELECT id FROM group_messages WHERE id = ? AND group_id = ?"
        ).bind(messageId, groupId).first();
        if (!message) return errorResponse("Message not found in this group", 404);
        await env.CHAT_DB.prepare(
          "UPDATE groups SET pinned_message_id = ?, updated_at = ? WHERE id = ?"
        ).bind(messageId, Date.now(), groupId).run();
        return jsonResponse({ success: true, pinned_message_id: messageId });
      }
      if (pinMatch && request.method === "DELETE") {
        const groupId = pinMatch[1];
        const userId = (searchParams.get("user_id") || "").trim();
        const phone = (searchParams.get("phone") || "").trim();
        const email = (searchParams.get("email") || "").trim();
        if (!userId) return errorResponse("user_id required");
        if (!phone) return errorResponse("phone required");
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) return errorResponse(auth.error, auth.status);
        const group = await env.CHAT_DB.prepare(
          "SELECT id, created_by FROM groups WHERE id = ?"
        ).bind(groupId).first();
        if (!group) return errorResponse("Group not found", 404);
        const isOwner = String(group.created_by) === String(userId);
        const isSuperadmin = auth.role === "Superadmin";
        if (!isOwner && !isSuperadmin) {
          return errorResponse("Only the group owner or Superadmin can unpin messages", 403);
        }
        await env.CHAT_DB.prepare(
          "UPDATE groups SET pinned_message_id = NULL, updated_at = ? WHERE id = ?"
        ).bind(Date.now(), groupId).run();
        return jsonResponse({ success: true });
      }
      if (pinMatch && request.method === "GET") {
        const groupId = pinMatch[1];
        const userId = (searchParams.get("user_id") || "").trim();
        const phone = (searchParams.get("phone") || "").trim();
        const email = (searchParams.get("email") || "").trim();
        if (!userId) return errorResponse("user_id required");
        if (!phone) return errorResponse("phone required");
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) return errorResponse(auth.error, auth.status);
        const isMember = await ensureMember(env, groupId, userId);
        if (!isMember) return errorResponse("Not a group member", 403);
        const group = await env.CHAT_DB.prepare(
          "SELECT pinned_message_id FROM groups WHERE id = ?"
        ).bind(groupId).first();
        if (!group) return errorResponse("Group not found", 404);
        if (!group.pinned_message_id) {
          return jsonResponse({ success: true, pinned: null });
        }
        const message = await env.CHAT_DB.prepare(
          `SELECT id, group_id, user_id, body, created_at, message_type,
                  audio_url, audio_duration_ms, transcript_text, transcript_lang,
                  transcription_status, media_url, media_object_key,
                  media_content_type, media_size, video_thumbnail_url,
                  video_duration_ms, sender_avatar_url
           FROM group_messages WHERE id = ?`
        ).bind(group.pinned_message_id).first();
        if (!message) {
          return jsonResponse({ success: true, pinned: null });
        }
        const ack = await env.CHAT_DB.prepare(
          "SELECT acked_at FROM group_message_acks WHERE group_id = ? AND user_id = ? AND message_id = ?"
        ).bind(groupId, userId, group.pinned_message_id).first();
        return jsonResponse({
          success: true,
          pinned: { message, acked: !!ack, acked_at: ack?.acked_at || null }
        });
      }
      const pinAckMatch = pathname.match(/^\/groups\/([^/]+)\/pin\/ack$/);
      if (pinAckMatch && request.method === "POST") {
        const groupId = pinAckMatch[1];
        const body = await readJson(request);
        if (!body) return errorResponse("Invalid JSON body");
        const userId = (body.user_id || "").trim();
        const phone = (body.phone || "").trim();
        const email = body.email ? String(body.email).trim() : "";
        if (!userId) return errorResponse("user_id required");
        if (!phone) return errorResponse("phone required");
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) return errorResponse(auth.error, auth.status);
        const isMember = await ensureMember(env, groupId, userId);
        if (!isMember) return errorResponse("Not a group member", 403);
        const group = await env.CHAT_DB.prepare(
          "SELECT pinned_message_id FROM groups WHERE id = ?"
        ).bind(groupId).first();
        if (!group?.pinned_message_id) return errorResponse("No pinned message", 404);
        await env.CHAT_DB.prepare(
          `INSERT OR IGNORE INTO group_message_acks (group_id, user_id, message_id, acked_at)
           VALUES (?, ?, ?, ?)`
        ).bind(groupId, userId, group.pinned_message_id, Date.now()).run();
        return jsonResponse({ success: true, acked_message_id: group.pinned_message_id });
      }
      const inviteMatch = pathname.match(/^\/groups\/([^/]+)\/invite$/);
      if (inviteMatch && request.method === "POST") {
        const groupId = inviteMatch[1];
        const body = await readJson(request);
        if (!body) {
          return errorResponse("Invalid JSON body");
        }
        const userId = (body.user_id || "").trim();
        const phone = (body.phone || "").trim();
        const email = body.email ? String(body.email).trim() : "";
        const expiresInDays = body.expires_in_days || 7;
        if (!userId || !phone) {
          return errorResponse("user_id and phone required");
        }
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status);
        }
        const member = await env.CHAT_DB.prepare(
          "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?"
        ).bind(groupId, userId).first();
        if (!member || member.role !== "owner" && member.role !== "admin") {
          return errorResponse("Only owner or admin can create invite links", 403);
        }
        const code = generateInviteCode();
        const createdAt = Date.now();
        const expiresAt = createdAt + expiresInDays * 24 * 60 * 60 * 1e3;
        await env.CHAT_DB.prepare(
          `INSERT INTO invite_codes (code, group_id, created_by, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(code, groupId, userId, createdAt, expiresAt).run();
        return jsonResponse({
          success: true,
          invite: {
            code,
            group_id: groupId,
            invite_link: `https://hallo.vegvisr.org/join/${code}`,
            expires_at: expiresAt
          }
        }, 201);
      }
      const inviteInfoMatch = pathname.match(/^\/invite\/([^/]+)$/);
      if (inviteInfoMatch && request.method === "GET") {
        const code = inviteInfoMatch[1];
        const invite = await env.CHAT_DB.prepare(
          `SELECT ic.*, g.name as group_name,
                  (SELECT COUNT(*) FROM group_members WHERE group_id = ic.group_id) as member_count
           FROM invite_codes ic
           JOIN groups g ON ic.group_id = g.id
           WHERE ic.code = ?`
        ).bind(code).first();
        if (!invite) {
          return errorResponse("Invalid invite code", 404);
        }
        if (Date.now() > invite.expires_at) {
          return errorResponse("Invite link has expired", 410);
        }
        return jsonResponse({
          success: true,
          invite: {
            code: invite.code,
            group_id: invite.group_id,
            group_name: invite.group_name,
            member_count: invite.member_count,
            expires_at: invite.expires_at
          }
        });
      }
      const inviteJoinMatch = pathname.match(/^\/invite\/([^/]+)\/join$/);
      if (inviteJoinMatch && request.method === "POST") {
        const code = inviteJoinMatch[1];
        const body = await readJson(request);
        if (!body) {
          return errorResponse("Invalid JSON body");
        }
        const userId = (body.user_id || "").trim();
        const phone = (body.phone || "").trim();
        const email = body.email ? String(body.email).trim() : "";
        if (!userId || !phone) {
          return errorResponse("user_id and phone required");
        }
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status);
        }
        const invite = await env.CHAT_DB.prepare(
          `SELECT ic.*, g.name as group_name
           FROM invite_codes ic
           JOIN groups g ON ic.group_id = g.id
           WHERE ic.code = ?`
        ).bind(code).first();
        if (!invite) {
          return errorResponse("Invalid invite code", 404);
        }
        if (Date.now() > invite.expires_at) {
          return errorResponse("Invite link has expired", 410);
        }
        const existingMember = await env.CHAT_DB.prepare(
          "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?"
        ).bind(invite.group_id, userId).first();
        if (existingMember) {
          return jsonResponse({
            success: true,
            already_member: true,
            group_id: invite.group_id,
            group_name: invite.group_name
          });
        }
        const joinedAt = Date.now();
        await env.CHAT_DB.prepare(
          `INSERT INTO group_members (group_id, user_id, role, joined_at)
           VALUES (?, ?, 'member', ?)`
        ).bind(invite.group_id, userId, joinedAt).run();
        await env.CHAT_DB.prepare(
          "UPDATE invite_codes SET use_count = use_count + 1 WHERE code = ?"
        ).bind(code).run();
        return jsonResponse({
          success: true,
          joined: true,
          group_id: invite.group_id,
          group_name: invite.group_name
        });
      }
      if (pathname === "/register-device" && request.method === "POST") {
        const body = await readJson(request);
        if (!body) {
          return errorResponse("Invalid JSON body");
        }
        const userId = (body.user_id || "").trim();
        const phone = (body.phone || "").trim();
        const email = body.email ? String(body.email).trim() : "";
        const fcmToken = (body.fcm_token || "").trim();
        const platform = (body.platform || "android").trim();
        if (!userId || !phone || !fcmToken) {
          return errorResponse("user_id, phone, and fcm_token required");
        }
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status);
        }
        const now = Date.now();
        await env.CHAT_DB.prepare(
          `INSERT INTO device_tokens (user_id, fcm_token, platform, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(fcm_token) DO UPDATE SET
             user_id = excluded.user_id,
             platform = excluded.platform,
             updated_at = excluded.updated_at`
        ).bind(userId, fcmToken, platform, now, now).run();
        return jsonResponse({ success: true, message: "Device registered" });
      }
      if (pathname === "/unregister-device" && request.method === "POST") {
        const body = await readJson(request);
        if (!body) {
          return errorResponse("Invalid JSON body");
        }
        const userId = (body.user_id || "").trim();
        const phone = (body.phone || "").trim();
        const email = body.email ? String(body.email).trim() : "";
        const fcmToken = (body.fcm_token || "").trim();
        if (!userId || !phone || !fcmToken) {
          return errorResponse("user_id, phone, and fcm_token required");
        }
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) {
          return errorResponse(auth.error, auth.status);
        }
        await env.CHAT_DB.prepare(
          "DELETE FROM device_tokens WHERE user_id = ? AND fcm_token = ?"
        ).bind(userId, fcmToken).run();
        return jsonResponse({ success: true, message: "Device unregistered" });
      }
      const pollCreateMatch = pathname.match(/^\/groups\/([^/]+)\/polls$/);
      if (pollCreateMatch && request.method === "POST") {
        const groupId = pollCreateMatch[1];
        const body = await readJson(request);
        if (!body) return errorResponse("Invalid JSON body");
        const userId = (body.user_id || "").trim();
        const phone = (body.phone || "").trim();
        const email = body.email ? String(body.email).trim() : "";
        const question = (body.question || "").trim();
        const options = body.options;
        if (!userId || !phone) return errorResponse("user_id and phone required");
        if (!question) return errorResponse("question required");
        if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
          return errorResponse("options must be an array of 2-6 strings");
        }
        const cleanOptions = options.map((o) => String(o).trim()).filter(Boolean);
        if (cleanOptions.length < 2) return errorResponse("At least 2 non-empty options required");
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) return errorResponse(auth.error, auth.status);
        const isMember = await ensureMember(env, groupId, userId);
        if (!isMember) return errorResponse("Not a group member", 403);
        const lockGuard = await ensurePostingAllowed(env, groupId, userId);
        if (lockGuard) return errorResponse(lockGuard.error, lockGuard.status);
        const createdAt = Date.now();
        const pollId = crypto.randomUUID();
        const msgResult = await env.CHAT_DB.prepare(
          `INSERT INTO group_messages (group_id, user_id, body, created_at, message_type)
           VALUES (?, ?, ?, ?, 'poll')`
        ).bind(groupId, userId, `poll::${pollId}::${question}`, createdAt).run();
        const messageId = msgResult.meta.last_row_id;
        await env.CHAT_DB.prepare(
          `INSERT INTO polls (id, group_id, message_id, question, options, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(pollId, groupId, messageId, question, JSON.stringify(cleanOptions), userId, createdAt).run();
        await env.CHAT_DB.prepare("UPDATE groups SET updated_at = ? WHERE id = ?").bind(createdAt, groupId).run();
        return jsonResponse({
          success: true,
          poll: {
            id: pollId,
            message_id: messageId,
            group_id: groupId,
            question,
            options: cleanOptions,
            created_by: userId,
            created_at: createdAt,
            votes: {},
            total_votes: 0,
            my_vote: null
          }
        });
      }
      const pollVoteMatch = pathname.match(/^\/polls\/([^/]+)\/vote$/);
      if (pollVoteMatch && request.method === "POST") {
        const pollId = pollVoteMatch[1];
        const body = await readJson(request);
        if (!body) return errorResponse("Invalid JSON body");
        const userId = (body.user_id || "").trim();
        const phone = (body.phone || "").trim();
        const email = body.email ? String(body.email).trim() : "";
        const optionIndex = body.option_index;
        if (!userId || !phone) return errorResponse("user_id and phone required");
        if (optionIndex === void 0 || optionIndex === null) return errorResponse("option_index required");
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) return errorResponse(auth.error, auth.status);
        const poll = await env.CHAT_DB.prepare("SELECT * FROM polls WHERE id = ?").bind(pollId).first();
        if (!poll) return errorResponse("Poll not found", 404);
        if (poll.closed_at) return errorResponse("Poll is closed");
        const options = JSON.parse(poll.options);
        const idx = Number(optionIndex);
        if (idx < 0 || idx >= options.length) return errorResponse("Invalid option_index");
        const isMember = await ensureMember(env, poll.group_id, userId);
        if (!isMember) return errorResponse("Not a group member", 403);
        await env.CHAT_DB.prepare(
          `INSERT INTO poll_votes (poll_id, user_id, option_index, voted_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (poll_id, user_id) DO UPDATE SET option_index = ?, voted_at = ?`
        ).bind(pollId, userId, idx, Date.now(), idx, Date.now()).run();
        const votes = await env.CHAT_DB.prepare(
          "SELECT option_index, COUNT(*) as cnt FROM poll_votes WHERE poll_id = ? GROUP BY option_index"
        ).bind(pollId).all();
        const voteCounts = {};
        let totalVotes = 0;
        for (const row of votes.results || []) {
          voteCounts[row.option_index] = row.cnt;
          totalVotes += row.cnt;
        }
        return jsonResponse({
          success: true,
          poll_id: pollId,
          my_vote: idx,
          votes: voteCounts,
          total_votes: totalVotes
        });
      }
      const pollGetMatch = pathname.match(/^\/polls\/([^/]+)$/);
      if (pollGetMatch && request.method === "GET") {
        const pollId = pollGetMatch[1];
        const userId = searchParams.get("user_id");
        const phone = searchParams.get("phone") || "";
        const email = searchParams.get("email") || "";
        if (!userId || !phone) return errorResponse("user_id and phone required");
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) return errorResponse(auth.error, auth.status);
        const poll = await env.CHAT_DB.prepare("SELECT * FROM polls WHERE id = ?").bind(pollId).first();
        if (!poll) return errorResponse("Poll not found", 404);
        const isMember = await ensureMember(env, poll.group_id, userId);
        if (!isMember) return errorResponse("Not a group member", 403);
        const options = JSON.parse(poll.options);
        const votes = await env.CHAT_DB.prepare(
          "SELECT option_index, COUNT(*) as cnt FROM poll_votes WHERE poll_id = ? GROUP BY option_index"
        ).bind(pollId).all();
        const voteCounts = {};
        let totalVotes = 0;
        for (const row of votes.results || []) {
          voteCounts[row.option_index] = row.cnt;
          totalVotes += row.cnt;
        }
        const myVote = await env.CHAT_DB.prepare(
          "SELECT option_index FROM poll_votes WHERE poll_id = ? AND user_id = ?"
        ).bind(pollId, userId).first();
        return jsonResponse({
          success: true,
          poll: {
            id: poll.id,
            message_id: poll.message_id,
            group_id: poll.group_id,
            question: poll.question,
            options,
            created_by: poll.created_by,
            created_at: poll.created_at,
            closed_at: poll.closed_at,
            votes: voteCounts,
            total_votes: totalVotes,
            my_vote: myVote ? myVote.option_index : null
          }
        });
      }
      const pollUnansweredMatch = pathname.match(/^\/groups\/([^/]+)\/polls\/unanswered$/);
      if (pollUnansweredMatch && request.method === "GET") {
        const groupId = pollUnansweredMatch[1];
        const userId = searchParams.get("user_id");
        const phone = searchParams.get("phone") || "";
        const email = searchParams.get("email") || "";
        if (!userId || !phone) return errorResponse("user_id and phone required");
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) return errorResponse(auth.error, auth.status);
        const isMember = await ensureMember(env, groupId, userId);
        if (!isMember) return errorResponse("Not a group member", 403);
        const result = await env.CHAT_DB.prepare(
          `SELECT COUNT(*) as count FROM polls p
           WHERE p.group_id = ? AND p.closed_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM poll_votes pv WHERE pv.poll_id = p.id AND pv.user_id = ?
           )`
        ).bind(groupId, userId).first();
        return jsonResponse({
          success: true,
          group_id: groupId,
          unanswered_count: result?.count || 0
        });
      }
      const pollCloseMatch = pathname.match(/^\/polls\/([^/]+)\/close$/);
      if (pollCloseMatch && request.method === "POST") {
        const pollId = pollCloseMatch[1];
        const body = await readJson(request);
        if (!body) return errorResponse("Invalid JSON body");
        const userId = (body.user_id || "").trim();
        const phone = (body.phone || "").trim();
        const email = body.email ? String(body.email).trim() : "";
        if (!userId || !phone) return errorResponse("user_id and phone required");
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) return errorResponse(auth.error, auth.status);
        const poll = await env.CHAT_DB.prepare("SELECT * FROM polls WHERE id = ?").bind(pollId).first();
        if (!poll) return errorResponse("Poll not found", 404);
        if (poll.closed_at) return errorResponse("Poll already closed");
        if (poll.created_by !== userId && auth.role !== "Superadmin") {
          return errorResponse("Only poll creator or Superadmin can close a poll", 403);
        }
        await env.CHAT_DB.prepare(
          "UPDATE polls SET closed_at = ? WHERE id = ?"
        ).bind(Date.now(), pollId).run();
        return jsonResponse({ success: true, poll_id: pollId, closed: true });
      }
      const VALID_REACTIONS = ["thumbs_up", "heart", "smile"];
      const reactionMatch = pathname.match(/^\/messages\/(\d+)\/reactions$/);
      if (reactionMatch && request.method === "POST") {
        const messageId = Number(reactionMatch[1]);
        const body = await readJson(request);
        if (!body) return errorResponse("Invalid JSON body");
        const userId = (body.user_id || "").trim();
        const phone = (body.phone || "").trim();
        const email = body.email ? String(body.email).trim() : "";
        const reaction = (body.reaction || "").trim();
        if (!userId || !phone) return errorResponse("user_id and phone required");
        if (!VALID_REACTIONS.includes(reaction)) {
          return errorResponse("reaction must be one of: thumbs_up, heart, smile");
        }
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) return errorResponse(auth.error, auth.status);
        const msg = await env.CHAT_DB.prepare(
          "SELECT group_id FROM group_messages WHERE id = ?"
        ).bind(messageId).first();
        if (!msg) return errorResponse("Message not found", 404);
        const isMember = await ensureMember(env, msg.group_id, userId);
        if (!isMember) return errorResponse("Not a group member", 403);
        const existing = await env.CHAT_DB.prepare(
          "SELECT 1 FROM message_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?"
        ).bind(messageId, userId, reaction).first();
        if (existing) {
          await env.CHAT_DB.prepare(
            "DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?"
          ).bind(messageId, userId, reaction).run();
        } else {
          await env.CHAT_DB.prepare(
            "INSERT INTO message_reactions (message_id, user_id, reaction, created_at) VALUES (?, ?, ?, ?)"
          ).bind(messageId, userId, reaction, Date.now()).run();
        }
        const counts = await env.CHAT_DB.prepare(
          "SELECT reaction, COUNT(*) as cnt FROM message_reactions WHERE message_id = ? GROUP BY reaction"
        ).bind(messageId).all();
        const reactionCounts = {};
        for (const r of counts.results || []) {
          reactionCounts[r.reaction] = r.cnt;
        }
        const myReactions = await env.CHAT_DB.prepare(
          "SELECT reaction FROM message_reactions WHERE message_id = ? AND user_id = ?"
        ).bind(messageId, userId).all();
        const myList = (myReactions.results || []).map((r) => r.reaction);
        return jsonResponse({
          success: true,
          message_id: messageId,
          reactions: reactionCounts,
          my_reactions: myList,
          toggled: reaction,
          added: !existing
        });
      }
      const groupReactionsMatch = pathname.match(/^\/groups\/([^/]+)\/reactions$/);
      if (groupReactionsMatch && request.method === "GET") {
        const groupId = groupReactionsMatch[1];
        const userId = searchParams.get("user_id");
        const phone = searchParams.get("phone") || "";
        const email = searchParams.get("email") || "";
        const messageIds = searchParams.get("message_ids");
        if (!userId || !phone) return errorResponse("user_id and phone required");
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) return errorResponse(auth.error, auth.status);
        const isMember = await ensureMember(env, groupId, userId);
        if (!isMember) return errorResponse("Not a group member", 403);
        if (!messageIds) return jsonResponse({ success: true, reactions: {} });
        const ids = messageIds.split(",").map(Number).filter((n) => n > 0).slice(0, 200);
        if (ids.length === 0) return jsonResponse({ success: true, reactions: {} });
        const placeholders = ids.map(() => "?").join(",");
        const allCounts = await env.CHAT_DB.prepare(
          `SELECT message_id, reaction, COUNT(*) as cnt
           FROM message_reactions WHERE message_id IN (${placeholders})
           GROUP BY message_id, reaction`
        ).bind(...ids).all();
        const myCounts = await env.CHAT_DB.prepare(
          `SELECT message_id, reaction
           FROM message_reactions WHERE message_id IN (${placeholders}) AND user_id = ?`
        ).bind(...ids, userId).all();
        const result = {};
        for (const row of allCounts.results || []) {
          if (!result[row.message_id]) result[row.message_id] = { counts: {}, mine: [] };
          result[row.message_id].counts[row.reaction] = row.cnt;
        }
        for (const row of myCounts.results || []) {
          if (!result[row.message_id]) result[row.message_id] = { counts: {}, mine: [] };
          result[row.message_id].mine.push(row.reaction);
        }
        return jsonResponse({ success: true, reactions: result });
      }
      if (pathname === "/bots" && request.method === "POST") {
        const body = await readJson(request);
        if (!body) return errorResponse("Invalid JSON body");
        const userId = (body.user_id || "").trim();
        const phone = (body.phone || "").trim();
        const email = body.email ? String(body.email).trim() : "";
        if (!userId || !phone) return errorResponse("user_id and phone required");
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) return errorResponse(auth.error, auth.status);
        if (auth.role !== "Superadmin") return errorResponse("Only Superadmin can create bots", 403);
        const botName = (body.name || "").trim();
        const username = (body.username || "").trim().toLowerCase().replace(/^@/, "");
        const systemPrompt = (body.system_prompt || "").trim();
        const graphId = (body.graph_id || "").trim() || null;
        const avatarUrl = (body.avatar_url || "").trim() || null;
        const tools = body.tools || [];
        const model = (body.model || "claude-haiku-4-5-20251001").trim();
        const maxTurns = body.max_turns || 10;
        const temperature = body.temperature ?? 0.7;
        if (!botName) return errorResponse("Bot name required");
        if (!username) return errorResponse("Bot username required");
        if (!/^[a-z0-9_-]+$/.test(username)) return errorResponse("Username must be lowercase alphanumeric with - or _");
        const botId = crypto.randomUUID();
        const now = Date.now();
        try {
          await env.CHAT_DB.prepare(
            `INSERT INTO chat_bots (id, name, username, avatar_url, system_prompt, graph_id, created_by, tools, model, max_turns, temperature, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
          ).bind(botId, botName, username, avatarUrl, systemPrompt, graphId, userId, JSON.stringify(tools), model, maxTurns, temperature, now).run();
        } catch (err) {
          if (String(err).includes("UNIQUE")) return errorResponse("Bot username already taken", 409);
          throw err;
        }
        return jsonResponse({
          success: true,
          bot: { id: botId, name: botName, username, avatar_url: avatarUrl, system_prompt: systemPrompt, graph_id: graphId, tools, model, max_turns: maxTurns, temperature, is_active: 1, created_at: now }
        }, 201);
      }
      if (pathname === "/bots" && request.method === "GET") {
        const userId = (searchParams.get("user_id") || "").trim();
        const phone = (searchParams.get("phone") || "").trim();
        const email = (searchParams.get("email") || "").trim();
        if (!userId || !phone) return errorResponse("user_id and phone required");
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) return errorResponse(auth.error, auth.status);
        const bots = await env.CHAT_DB.prepare(
          "SELECT * FROM chat_bots WHERE is_active = 1 ORDER BY created_at DESC"
        ).all();
        return jsonResponse({ success: true, bots: bots.results || [] });
      }
      const botDetailMatch = pathname.match(/^\/bots\/([^/]+)$/);
      if (botDetailMatch && request.method === "GET") {
        const botId = botDetailMatch[1];
        const userId = (searchParams.get("user_id") || "").trim();
        const phone = (searchParams.get("phone") || "").trim();
        const email = (searchParams.get("email") || "").trim();
        if (!userId || !phone) return errorResponse("user_id and phone required");
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) return errorResponse(auth.error, auth.status);
        const bot = await env.CHAT_DB.prepare("SELECT * FROM chat_bots WHERE id = ?").bind(botId).first();
        if (!bot) return errorResponse("Bot not found", 404);
        const groups = await env.CHAT_DB.prepare(
          `SELECT g.id, g.name, gbm.added_at FROM group_bot_members gbm
           JOIN groups g ON gbm.group_id = g.id
           WHERE gbm.bot_id = ?`
        ).bind(botId).all();
        return jsonResponse({ success: true, bot, groups: groups.results || [] });
      }
      if (botDetailMatch && request.method === "PUT") {
        const botId = botDetailMatch[1];
        const body = await readJson(request);
        if (!body) return errorResponse("Invalid JSON body");
        const userId = (body.user_id || "").trim();
        const phone = (body.phone || "").trim();
        const email = body.email ? String(body.email).trim() : "";
        if (!userId || !phone) return errorResponse("user_id and phone required");
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) return errorResponse(auth.error, auth.status);
        if (auth.role !== "Superadmin") return errorResponse("Only Superadmin can update bots", 403);
        const existing = await env.CHAT_DB.prepare("SELECT * FROM chat_bots WHERE id = ?").bind(botId).first();
        if (!existing) return errorResponse("Bot not found", 404);
        const name = body.name !== void 0 ? String(body.name).trim() : existing.name;
        const systemPrompt = body.system_prompt !== void 0 ? String(body.system_prompt) : existing.system_prompt;
        const graphId = body.graph_id !== void 0 ? String(body.graph_id).trim() || null : existing.graph_id;
        const avatarUrl = body.avatar_url !== void 0 ? String(body.avatar_url).trim() || null : existing.avatar_url;
        const tools = body.tools !== void 0 ? JSON.stringify(body.tools) : existing.tools;
        const model = body.model !== void 0 ? String(body.model).trim() : existing.model;
        const maxTurns = body.max_turns !== void 0 ? body.max_turns : existing.max_turns;
        const temperature = body.temperature !== void 0 ? body.temperature : existing.temperature;
        const isActive = body.is_active !== void 0 ? body.is_active ? 1 : 0 : existing.is_active;
        await env.CHAT_DB.prepare(
          `UPDATE chat_bots SET name = ?, system_prompt = ?, graph_id = ?, avatar_url = ?,
           tools = ?, model = ?, max_turns = ?, temperature = ?, is_active = ?, updated_at = ?
           WHERE id = ?`
        ).bind(name, systemPrompt, graphId, avatarUrl, tools, model, maxTurns, temperature, isActive, Date.now(), botId).run();
        const updated = await env.CHAT_DB.prepare("SELECT * FROM chat_bots WHERE id = ?").bind(botId).first();
        return jsonResponse({ success: true, bot: updated });
      }
      if (botDetailMatch && request.method === "DELETE") {
        const botId = botDetailMatch[1];
        const userId = (searchParams.get("user_id") || "").trim();
        const phone = (searchParams.get("phone") || "").trim();
        const email = (searchParams.get("email") || "").trim();
        if (!userId || !phone) return errorResponse("user_id and phone required");
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) return errorResponse(auth.error, auth.status);
        if (auth.role !== "Superadmin") return errorResponse("Only Superadmin can delete bots", 403);
        const bot = await env.CHAT_DB.prepare("SELECT username FROM chat_bots WHERE id = ?").bind(botId).first();
        const deletedUsername = bot ? `_deleted_${Date.now()}_${bot.username}` : `_deleted_${Date.now()}_${botId}`;
        await env.CHAT_DB.prepare(
          "UPDATE chat_bots SET is_active = 0, username = ?, updated_at = ? WHERE id = ?"
        ).bind(deletedUsername, Date.now(), botId).run();
        return jsonResponse({ success: true, message: "Bot deactivated", originalUsername: bot?.username });
      }
      const groupBotMatch = pathname.match(/^\/groups\/([^/]+)\/bots$/);
      if (groupBotMatch && request.method === "POST") {
        const groupId = groupBotMatch[1];
        const body = await readJson(request);
        if (!body) return errorResponse("Invalid JSON body");
        const userId = (body.user_id || "").trim();
        const phone = (body.phone || "").trim();
        const email = body.email ? String(body.email).trim() : "";
        const botId = normalizeBotId(body.bot_id);
        if (!userId || !phone) return errorResponse("user_id and phone required");
        if (!botId) return errorResponse("bot_id required");
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) return errorResponse(auth.error, auth.status);
        if (auth.role !== "Superadmin") return errorResponse("Only Superadmin can add bots to groups", 403);
        const group = await env.CHAT_DB.prepare("SELECT id, name FROM groups WHERE id = ?").bind(groupId).first();
        if (!group) return errorResponse("Group not found", 404);
        const bot = await env.CHAT_DB.prepare("SELECT id, name, username FROM chat_bots WHERE id = ? AND is_active = 1").bind(botId).first();
        if (!bot) return errorResponse("Bot not found or inactive", 404);
        const existing = await env.CHAT_DB.prepare(
          "SELECT 1 FROM group_bot_members WHERE group_id = ? AND bot_id = ?"
        ).bind(groupId, botId).first();
        if (existing) return jsonResponse({ success: true, already_member: true, message: `Bot @${bot.username} is already in this group` });
        await env.CHAT_DB.prepare(
          "INSERT INTO group_bot_members (group_id, bot_id, added_by, added_at) VALUES (?, ?, ?, ?)"
        ).bind(groupId, botId, userId, Date.now()).run();
        const botUserId = `bot:${botId}`;
        const alreadyMember = await env.CHAT_DB.prepare(
          "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?"
        ).bind(groupId, botUserId).first();
        if (!alreadyMember) {
          await env.CHAT_DB.prepare(
            `INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, 'bot', ?)`
          ).bind(groupId, botUserId, Date.now()).run();
        }
        return jsonResponse({
          success: true,
          message: `Bot @${bot.username} added to group "${group.name}"`,
          bot: { id: bot.id, name: bot.name, username: bot.username }
        }, 201);
      }
      const groupBotRemoveMatch = pathname.match(/^\/groups\/([^/]+)\/bots\/([^/]+)$/);
      if (groupBotRemoveMatch && request.method === "DELETE") {
        const groupId = groupBotRemoveMatch[1];
        const botId = normalizeBotId(groupBotRemoveMatch[2]);
        const userId = (searchParams.get("user_id") || "").trim();
        const phone = (searchParams.get("phone") || "").trim();
        const email = (searchParams.get("email") || "").trim();
        if (!userId || !phone) return errorResponse("user_id and phone required");
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) return errorResponse(auth.error, auth.status);
        if (auth.role !== "Superadmin") {
          const requesterMember = await env.CHAT_DB.prepare(
            "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?"
          ).bind(groupId, userId).first();
          if (!requesterMember || requesterMember.role !== "owner") {
            return errorResponse("Only the group owner or Superadmin can remove bots from groups", 403);
          }
        }
        await env.CHAT_DB.prepare("DELETE FROM group_bot_members WHERE group_id = ? AND bot_id = ?").bind(groupId, botId).run();
        await env.CHAT_DB.prepare("DELETE FROM group_members WHERE group_id = ? AND user_id = ?").bind(groupId, `bot:${botId}`).run();
        return jsonResponse({ success: true, message: "Bot removed from group" });
      }
      if (groupBotMatch && request.method === "GET") {
        const groupId = groupBotMatch[1];
        const userId = (searchParams.get("user_id") || "").trim();
        const phone = (searchParams.get("phone") || "").trim();
        const email = (searchParams.get("email") || "").trim();
        if (!userId || !phone) return errorResponse("user_id and phone required");
        const auth = await validateUser(env, userId, phone, email);
        if (!auth.ok) return errorResponse(auth.error, auth.status);
        const bots = await env.CHAT_DB.prepare(
          `SELECT cb.*, gbm.added_at, gbm.added_by
           FROM group_bot_members gbm
           JOIN chat_bots cb ON gbm.bot_id = cb.id
           WHERE gbm.group_id = ? AND cb.is_active = 1`
        ).bind(groupId).all();
        return jsonResponse({ success: true, bots: bots.results || [] });
      }
      if (pathname === "/bot-message" && request.method === "POST") {
        const body = await readJson(request);
        if (!body) return errorResponse("Invalid JSON body");
        const botId = normalizeBotId(body.bot_id);
        const groupId = (body.group_id || "").trim();
        const text = (body.body || "").trim();
        const placeholderId = Number(body.placeholder_id) || null;
        if (!botId || !groupId || !text) return errorResponse("bot_id, group_id, and body required");
        const membership = await env.CHAT_DB.prepare(
          "SELECT 1 FROM group_bot_members WHERE group_id = ? AND bot_id = ?"
        ).bind(groupId, botId).first();
        if (!membership) return errorResponse("Bot is not a member of this group", 403);
        const bot = await env.CHAT_DB.prepare("SELECT name, username, avatar_url FROM chat_bots WHERE id = ? AND is_active = 1").bind(botId).first();
        if (!bot) return errorResponse("Bot not found or inactive", 404);
        const botUserId = `bot:${botId}`;
        const createdAt = Date.now();
        let finalMessageId;
        if (placeholderId) {
          await env.CHAT_DB.prepare(
            `UPDATE group_messages
             SET body = ?, message_type = 'text', created_at = ?
             WHERE id = ? AND group_id = ? AND user_id = ?`
          ).bind(text, createdAt, placeholderId, groupId, botUserId).run();
          finalMessageId = placeholderId;
        } else {
          const result = await env.CHAT_DB.prepare(
            `INSERT INTO group_messages (group_id, user_id, body, created_at, message_type, sender_avatar_url)
             VALUES (?, ?, ?, ?, 'text', ?)`
          ).bind(groupId, botUserId, text, createdAt, bot.avatar_url || null).run();
          finalMessageId = result.meta.last_row_id;
        }
        await env.CHAT_DB.prepare("UPDATE groups SET updated_at = ? WHERE id = ?").bind(createdAt, groupId).run();
        return jsonResponse({
          success: true,
          message: {
            id: finalMessageId,
            group_id: groupId,
            user_id: botUserId,
            body: text,
            created_at: createdAt,
            message_type: "text",
            bot_name: bot.name,
            bot_username: bot.username,
            sender_avatar_url: bot.avatar_url || null
          }
        }, 201);
      }
      const botMentionCheck = pathname.match(/^\/groups\/([^/]+)\/bots\/check-mention$/);
      if (botMentionCheck && request.method === "GET") {
        const groupId = botMentionCheck[1];
        const text = searchParams.get("text") || "";
        const mentions = text.match(/@([a-z0-9_-]+)/g) || [];
        const usernames = mentions.map((m) => m.replace("@", ""));
        if (usernames.length === 0) return jsonResponse({ success: true, bots: [] });
        const placeholders = usernames.map(() => "?").join(",");
        const bots = await env.CHAT_DB.prepare(
          `SELECT cb.* FROM group_bot_members gbm
           JOIN chat_bots cb ON gbm.bot_id = cb.id
           WHERE gbm.group_id = ? AND cb.username IN (${placeholders}) AND cb.is_active = 1`
        ).bind(groupId, ...usernames).all();
        return jsonResponse({ success: true, bots: bots.results || [] });
      }
      return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error("Group Chat Worker Error:", error);
      return jsonResponse(
        {
          success: false,
          error: "Internal Server Error"
        },
        500
      );
    }
  }
};
export {
  index_default as default
};
