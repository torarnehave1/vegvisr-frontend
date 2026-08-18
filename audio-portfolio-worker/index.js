// Recovered from the DEPLOYED worker on Cloudflare, because the local source was lost.
// esbuild artefacts undone: inlined npm dependencies removed, imports restored below, and the
// name-preservation wrappers stripped. Variable names may differ from the original where
// esbuild renamed to avoid collisions, and the original comments are gone.

var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Email, X-API-Token"
};
var createErrorResponse = (message, status = 400) => {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  });
};
var createSuccessResponse = (data, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  });
};
var generateRecordingId = () => {
  return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
var isSuperadminRole = (role) => {
  return (role || "").toLowerCase() === "superadmin";
};
async function validateWorkerApiToken(request, env) {
  const apiToken = request.headers.get("X-API-Token");
  if (!apiToken) return { valid: false, error: "Missing X-API-Token header" };
  if (!env.vegvisr_org) return { valid: false, error: "Auth not configured (vegvisr_org binding missing)" };
  try {
    const configUser = await env.vegvisr_org.prepare("SELECT email, user_id, Role, Systemowner FROM config WHERE emailVerificationToken = ?").bind(apiToken).first();
    if (!configUser) return { valid: false, error: "Invalid X-API-Token" };
    return {
      valid: true,
      userId: configUser.user_id,
      email: configUser.email,
      role: configUser.Role,
      isSystemOwner: configUser.Systemowner === 1
    };
  } catch (e) {
    return { valid: false, error: "Token validation error: " + e.message };
  }
}
async function resolveKv(env, userEmail) {
  if (userEmail && env.vegvisr_org) {
    try {
      const row = await env.vegvisr_org.prepare("SELECT cf_account_id, cf_api_token, cf_audio_kv_namespace_id FROM config WHERE email = ?").bind(userEmail).first();
      if (row?.cf_account_id && row?.cf_api_token && row?.cf_audio_kv_namespace_id) {
        return makeRemoteKv(row.cf_account_id, row.cf_api_token, row.cf_audio_kv_namespace_id);
      }
    } catch {
    }
  }
  return env.AUDIO_PORTFOLIO;
}
function makeRemoteKv(accountId, apiToken, namespaceId) {
  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}`;
  const authHeaders = { Authorization: `Bearer ${apiToken}` };
  return {
    async get(key) {
      const res = await fetch(`${base}/values/${encodeURIComponent(key)}`, { headers: authHeaders });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`KV get failed (${res.status}): ${await res.text()}`);
      return res.text();
    },
    async put(key, value) {
      const res = await fetch(`${base}/values/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { ...authHeaders, "Content-Type": "text/plain" },
        body: value
      });
      if (!res.ok) throw new Error(`KV put failed (${res.status}): ${await res.text()}`);
    },
    async delete(key) {
      const res = await fetch(`${base}/values/${encodeURIComponent(key)}`, { method: "DELETE", headers: authHeaders });
      if (!res.ok && res.status !== 404) throw new Error(`KV delete failed (${res.status}): ${await res.text()}`);
    },
    async list({ prefix } = {}) {
      const params = new URLSearchParams();
      if (prefix) params.set("prefix", prefix);
      const res = await fetch(`${base}/keys?${params.toString()}`, { headers: authHeaders });
      if (!res.ok) throw new Error(`KV list failed (${res.status}): ${await res.text()}`);
      const data = await res.json();
      return { keys: (data.result || []).map((k) => ({ name: k.name })), list_complete: true, cursor: void 0 };
    }
  };
}
var addRecordingToIndex = async (env, userEmail, recordingId) => {
  const kv = await resolveKv(env, userEmail);
  if (!userEmail || !recordingId) {
    throw new Error("User email and recordingId are required");
  }
  const recordingKey = `audio-recording:${userEmail}:${recordingId}`;
  const recordingData = await kv.get(recordingKey);
  if (!recordingData) {
    throw new Error("Recording not found in KV");
  }
  const recording = JSON.parse(recordingData);
  const indexKey = `audio-index:${userEmail}`;
  const userIndexRaw = await kv.get(indexKey);
  let userIndex = userIndexRaw ? JSON.parse(userIndexRaw) : null;
  if (!userIndex) {
    userIndex = {
      userEmail,
      totalRecordings: 1,
      totalDuration: recording.duration || 0,
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
      recordingIds: [recordingId]
    };
  } else {
    if (!Array.isArray(userIndex.recordingIds)) {
      userIndex.recordingIds = [];
    }
    if (!userIndex.recordingIds.includes(recordingId)) {
      userIndex.recordingIds.push(recordingId);
      userIndex.totalRecordings = userIndex.recordingIds.length;
      userIndex.totalDuration = (userIndex.totalDuration || 0) + (recording.duration || 0);
      userIndex.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
    }
  }
  await kv.put(indexKey, JSON.stringify(userIndex));
  return { success: true, index: userIndex };
};
var saveRecordingToPortfolio = async (env, recordingData) => {
  try {
    const recordingId = recordingData.recordingId || generateRecordingId();
    const userEmail = recordingData.userEmail;
    if (!userEmail) {
      throw new Error("User email is required");
    }
    const kv = await resolveKv(env, userEmail);
    const recordingMetadata = {
      // Core Identifiers
      userEmail,
      recordingId,
      // File Information
      fileName: recordingData.fileName || "unknown.wav",
      displayName: recordingData.displayName || recordingData.fileName || "Untitled Recording",
      r2Key: recordingData.r2Key || null,
      r2Url: recordingData.r2Url || null,
      fileSize: recordingData.fileSize || 0,
      duration: recordingData.duration || 0,
      // Transcription Data - Support both regular and Norwegian transcription formats
      transcriptionText: recordingData.transcriptionText || "",
      transcriptionExcerpt: recordingData.transcriptionText ? recordingData.transcriptionText.substring(0, 200) + (recordingData.transcriptionText.length > 200 ? "..." : "") : "",
      // Norwegian Transcription Data (if available)
      norwegianTranscription: recordingData.norwegianTranscription || null,
      // Organization
      tags: recordingData.tags || [],
      category: recordingData.category || "general",
      // Metadata
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      // Publication State (NEW)
      publicationState: recordingData.publicationState || "draft",
      // 'draft' or 'published'
      publishedAt: recordingData.publicationState === "published" ? (/* @__PURE__ */ new Date()).toISOString() : null,
      // Technical Details
      audioFormat: recordingData.audioFormat || "wav",
      sampleRate: recordingData.sampleRate || 16e3,
      channels: recordingData.channels || 1,
      // AI Processing Info
      aiService: recordingData.aiService || "openai",
      aiModel: recordingData.aiModel || "whisper-1",
      processingTime: recordingData.processingTime || 0,
      // Norwegian Transcription Specific Fields
      transcriptionContext: recordingData.transcriptionContext || null,
      transcriptionServer: recordingData.transcriptionServer || null,
      textImprovement: recordingData.textImprovement || null,
      cloudflareAiAvailable: recordingData.cloudflareAiAvailable || false
    };
    const recordingKey = `audio-recording:${userEmail}:${recordingId}`;
    await kv.put(recordingKey, JSON.stringify(recordingMetadata));
    const indexKey = `audio-index:${userEmail}`;
    let userIndex = await kv.get(indexKey);
    if (userIndex) {
      userIndex = JSON.parse(userIndex);
      if (!userIndex.recordingIds.includes(recordingId)) {
        userIndex.recordingIds.push(recordingId);
        userIndex.totalRecordings = userIndex.recordingIds.length;
        userIndex.totalDuration += recordingMetadata.duration;
        userIndex.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
      }
    } else {
      userIndex = {
        userEmail,
        totalRecordings: 1,
        totalDuration: recordingMetadata.duration,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
        recordingIds: [recordingId]
      };
    }
    await kv.put(indexKey, JSON.stringify(userIndex));
    return { success: true, recordingId, recordingMetadata };
  } catch (error) {
    console.error("Error saving recording to portfolio:", error);
    throw error;
  }
};
var getUserRecordings = async (env, userEmail, limit = 50, offset = 0, userRole = "user") => {
  try {
    if (!userEmail) {
      throw new Error("User email is required");
    }
    const kv = await resolveKv(env, userEmail);
    const indexKey = `audio-index:${userEmail}`;
    const userIndex = await kv.get(indexKey);
    if (!userIndex) {
      return { recordings: [], total: 0, userStats: null };
    }
    const index = JSON.parse(userIndex);
    const recordingIds = index.recordingIds.slice(offset, offset + limit);
    const recordings = [];
    for (const recordingId of recordingIds) {
      const recordingKey = `audio-recording:${userEmail}:${recordingId}`;
      const recordingData = await kv.get(recordingKey);
      if (recordingData) {
        recordings.push(JSON.parse(recordingData));
      }
    }
    recordings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return {
      recordings,
      total: recordings.length,
      // Total after filtering
      userStats: {
        totalRecordings: index.totalRecordings,
        totalDuration: index.totalDuration,
        lastUpdated: index.lastUpdated
      }
    };
  } catch (error) {
    console.error("Error getting user recordings:", error);
    throw error;
  }
};
var searchRecordings = async (env, userEmail, query, limit = 50) => {
  try {
    if (!userEmail) {
      throw new Error("User email is required");
    }
    if (!query || query.trim().length === 0) {
      return getUserRecordings(env, userEmail, limit, 0);
    }
    const kv = await resolveKv(env, userEmail);
    const indexKey = `audio-index:${userEmail}`;
    const userIndex = await kv.get(indexKey);
    if (!userIndex) {
      return { recordings: [], total: 0, userStats: null };
    }
    const index = JSON.parse(userIndex);
    const searchQuery = query.toLowerCase().trim();
    const matchedRecordings = [];
    for (const recordingId of index.recordingIds) {
      const recordingKey = `audio-recording:${userEmail}:${recordingId}`;
      const recordingData = await kv.get(recordingKey);
      if (recordingData) {
        const recording = JSON.parse(recordingData);
        const searchableTexts = [
          recording.transcriptionText,
          recording.fileName,
          recording.displayName,
          recording.tags.join(" "),
          recording.category
        ];
        if (recording.norwegianTranscription) {
          searchableTexts.push(recording.norwegianTranscription.raw_text || "");
          searchableTexts.push(recording.norwegianTranscription.improved_text || "");
        }
        const searchableText = searchableTexts.join(" ").toLowerCase();
        if (searchableText.includes(searchQuery)) {
          matchedRecordings.push(recording);
        }
      }
    }
    matchedRecordings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return {
      recordings: matchedRecordings.slice(0, limit),
      total: matchedRecordings.length,
      query,
      userStats: {
        totalRecordings: index.totalRecordings,
        totalDuration: index.totalDuration,
        lastUpdated: index.lastUpdated
      }
    };
  } catch (error) {
    console.error("Error searching recordings:", error);
    throw error;
  }
};
var deleteRecording = async (env, userEmail, recordingId) => {
  try {
    if (!userEmail || !recordingId) {
      throw new Error("User email and recording ID are required");
    }
    const kv = await resolveKv(env, userEmail);
    const recordingKey = `audio-recording:${userEmail}:${recordingId}`;
    const recordingData = await kv.get(recordingKey);
    if (!recordingData) {
      throw new Error("Recording not found");
    }
    const recording = JSON.parse(recordingData);
    await kv.delete(recordingKey);
    const indexKey = `audio-index:${userEmail}`;
    let userIndex = await kv.get(indexKey);
    if (userIndex) {
      userIndex = JSON.parse(userIndex);
      userIndex.recordingIds = userIndex.recordingIds.filter((id) => id !== recordingId);
      userIndex.totalRecordings = userIndex.recordingIds.length;
      userIndex.totalDuration -= recording.duration;
      userIndex.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
      await kv.put(indexKey, JSON.stringify(userIndex));
    }
    return { success: true, deletedRecording: recording };
  } catch (error) {
    console.error("Error deleting recording:", error);
    throw error;
  }
};
var updateRecording = async (env, userEmail, recordingId, updates) => {
  try {
    if (!userEmail || !recordingId) {
      throw new Error("User email and recording ID are required");
    }
    const kv = await resolveKv(env, userEmail);
    const recordingKey = `audio-recording:${userEmail}:${recordingId}`;
    const recordingData = await kv.get(recordingKey);
    if (!recordingData) {
      throw new Error("Recording not found");
    }
    const recording = JSON.parse(recordingData);
    const allowedUpdates = [
      "displayName",
      "tags",
      "category",
      "publicationState",
      "publishedAt",
      "speakerTimeline",
      "numSpeakers",
      "speakerNames",
      "diarization",
      "conversationAnalysis",
      "transcriptionText",
      "transcriptionExcerpt"
    ];
    allowedUpdates.forEach((field) => {
      if (updates[field] !== void 0) {
        recording[field] = updates[field];
      }
    });
    recording.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await kv.put(recordingKey, JSON.stringify(recording));
    return { success: true, updatedRecording: recording };
  } catch (error) {
    console.error("Error updating recording:", error);
    throw error;
  }
};
var listPublicRecordings = async (env, tag, limit = 50, cursor = null) => {
  try {
    const normalizedTag = tag ? String(tag).toLowerCase().trim() : null;
    const recordings = [];
    let listCursor = cursor || void 0;
    let listComplete = false;
    while (!listComplete && recordings.length < limit) {
      const page = await env.AUDIO_PORTFOLIO.list({
        prefix: "audio-recording:",
        cursor: listCursor,
        limit: 100
      });
      listCursor = page.cursor;
      listComplete = page.list_complete;
      for (const key of page.keys) {
        if (recordings.length >= limit) break;
        const recordingData = await env.AUDIO_PORTFOLIO.get(key.name);
        if (!recordingData) continue;
        const recording = JSON.parse(recordingData);
        if (recording.publicationState !== "published") continue;
        if (normalizedTag) {
          const tags = (recording.tags || recording.metadata?.tags || []).map(
            (t) => String(t).toLowerCase().trim()
          );
          if (!tags.includes(normalizedTag)) continue;
        }
        recordings.push(recording);
      }
    }
    return {
      recordings,
      total: recordings.length,
      cursor: listComplete ? null : listCursor
    };
  } catch (error) {
    console.error("Error listing public recordings:", error);
    throw error;
  }
};
var listAllRecordings = async (env, limit = 50, cursor = null, ownerEmail = null) => {
  try {
    const normalizedOwner = ownerEmail ? String(ownerEmail).toLowerCase().trim() : null;
    const recordings = [];
    let listCursor = cursor || void 0;
    let listComplete = false;
    while (!listComplete && recordings.length < limit) {
      const page = await env.AUDIO_PORTFOLIO.list({
        prefix: "audio-recording:",
        cursor: listCursor,
        limit: 100
      });
      listCursor = page.cursor;
      listComplete = page.list_complete;
      for (const key of page.keys) {
        if (recordings.length >= limit) break;
        const recordingData = await env.AUDIO_PORTFOLIO.get(key.name);
        if (!recordingData) continue;
        const recording = JSON.parse(recordingData);
        const keyParts = key.name.split(":");
        const keyEmail = keyParts.length >= 3 ? keyParts[1] : null;
        const recordingEmail = recording.userEmail || recording.ownerEmail || keyEmail;
        if (normalizedOwner && recordingEmail?.toLowerCase() !== normalizedOwner) continue;
        if (!recording.userEmail && recordingEmail) {
          recording.userEmail = recordingEmail;
        }
        recordings.push(recording);
      }
    }
    recordings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return {
      recordings,
      total: recordings.length,
      cursor: listComplete ? null : listCursor
    };
  } catch (error) {
    console.error("Error listing all recordings:", error);
    throw error;
  }
};
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    console.log("\u{1F3B5} Audio Portfolio Worker Request:", {
      method: request.method,
      pathname,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          "Access-Control-Max-Age": "86400"
        }
      });
    }
    if (pathname === "/" || pathname === "/health") {
      return createSuccessResponse({
        service: "audio-portfolio-worker",
        status: "healthy",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        version: "1.1.0",
        features: ["norwegian-transcription-support"],
        kvBinding: env.AUDIO_PORTFOLIO ? "connected" : "missing"
      });
    }
    if (pathname === "/admin/users" && request.method === "GET") {
      try {
        const auth = await validateWorkerApiToken(request, env);
        if (!auth.valid) return createErrorResponse(auth.error, 401);
        if (!auth.isSystemOwner) return createErrorResponse("System Owner access required", 403);
        const rows = await env.vegvisr_org.prepare("SELECT email, user_id, Role, Systemowner, display_name FROM config ORDER BY Systemowner DESC, Role DESC, email ASC").all();
        const users = (rows.results || []).map((r) => ({
          email: r.email,
          userId: r.user_id,
          role: r.Role,
          displayName: r.display_name || null,
          isSystemOwner: r.Systemowner === 1
        }));
        return createSuccessResponse({ success: true, users, total: users.length });
      } catch (e) {
        console.error("Error in /admin/users:", e);
        return createErrorResponse(e.message, 500);
      }
    }
    if (pathname === "/admin/impersonate" && request.method === "POST") {
      try {
        const auth = await validateWorkerApiToken(request, env);
        if (!auth.valid) return createErrorResponse(auth.error, 401);
        if (!auth.isSystemOwner) return createErrorResponse("System Owner access required", 403);
        const body = await request.json().catch(() => ({}));
        const targetEmail = (body?.email || "").trim();
        if (!targetEmail) return createErrorResponse("email is required", 400);
        if (targetEmail === auth.email) return createErrorResponse("Cannot impersonate yourself", 400);
        const target = await env.vegvisr_org.prepare("SELECT email, user_id, Role, Systemowner, display_name, emailVerificationToken FROM config WHERE email = ?").bind(targetEmail).first();
        if (!target) return createErrorResponse("User not found", 404);
        if (!target.emailVerificationToken) {
          return createErrorResponse("Target user has no auth token (never logged in via magic link). Send them a magic link first.", 400);
        }
        console.log(`[impersonate] systemowner=${auth.email} took over account=${target.email} (role=${target.Role})`);
        return createSuccessResponse({
          success: true,
          impersonatedBy: auth.email,
          user: {
            email: target.email,
            user_id: target.user_id,
            role: target.Role,
            displayName: target.display_name || null,
            emailVerificationToken: target.emailVerificationToken,
            isSystemOwner: target.Systemowner === 1
          }
        });
      } catch (e) {
        console.error("Error in /admin/impersonate:", e);
        return createErrorResponse(e.message, 500);
      }
    }
    if (pathname === "/openapi.json" && request.method === "GET") {
      const spec = {
        openapi: "3.0.3",
        info: {
          title: "Audio Portfolio Worker API",
          description: "Manages audio recording portfolios with metadata, transcriptions, publication state, and context templates. Backed by Cloudflare KV.",
          version: "1.1.0"
        },
        paths: {
          "/health": {
            get: {
              summary: "Health check",
              description: "Returns service status, version, and KV binding status.",
              operationId: "healthCheck",
              responses: {
                "200": {
                  description: "Service health information",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          service: { type: "string", example: "audio-portfolio-worker" },
                          status: { type: "string", example: "healthy" },
                          timestamp: { type: "string", format: "date-time" },
                          version: { type: "string", example: "1.1.0" },
                          features: { type: "array", items: { type: "string" } },
                          kvBinding: { type: "string", enum: ["connected", "missing"] }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "/openapi.json": {
            get: {
              summary: "OpenAPI specification",
              description: "Returns this OpenAPI 3.0 specification.",
              operationId: "getOpenApiSpec",
              responses: {
                "200": {
                  description: "OpenAPI 3.0 JSON specification",
                  content: { "application/json": { schema: { type: "object" } } }
                }
              }
            }
          },
          "/save-recording": {
            post: {
              summary: "Save recording metadata",
              description: "Saves recording metadata to the portfolio and updates the user index.",
              operationId: "saveRecording",
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/SaveRecordingRequest" }
                  }
                }
              },
              responses: {
                "200": {
                  description: "Recording saved successfully",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          success: { type: "boolean" },
                          recordingId: { type: "string" },
                          recordingMetadata: { $ref: "#/components/schemas/RecordingMetadata" }
                        }
                      }
                    }
                  }
                },
                "400": { $ref: "#/components/responses/BadRequest" },
                "500": { $ref: "#/components/responses/InternalError" }
              }
            }
          },
          "/list-recordings": {
            get: {
              summary: "List user recordings",
              description: "Returns recordings for a user. Superadmin role returns all recordings across users. Regular users only see published recordings.",
              operationId: "listRecordings",
              parameters: [
                { name: "userEmail", in: "query", required: true, schema: { type: "string" }, description: "Email of the user whose recordings to list" },
                { name: "limit", in: "query", schema: { type: "integer", default: 50 }, description: "Maximum number of recordings to return" },
                { name: "offset", in: "query", schema: { type: "integer", default: 0 }, description: "Number of recordings to skip (non-superadmin only)" },
                { name: "userRole", in: "query", schema: { type: "string", default: "user" }, description: 'User role. "superadmin" returns all recordings across users.' },
                { name: "ownerEmail", in: "query", schema: { type: "string" }, description: "Filter by owner email (superadmin only)" },
                { name: "cursor", in: "query", schema: { type: "string" }, description: "Pagination cursor (superadmin only)" }
              ],
              responses: {
                "200": {
                  description: "List of recordings",
                  content: {
                    "application/json": {
                      schema: { $ref: "#/components/schemas/RecordingListResponse" }
                    }
                  }
                },
                "400": { $ref: "#/components/responses/BadRequest" },
                "500": { $ref: "#/components/responses/InternalError" }
              }
            }
          },
          "/search-recordings": {
            get: {
              summary: "Search recordings",
              description: "Searches recordings by text content across transcription, file name, display name, tags, category, and Norwegian transcription data.",
              operationId: "searchRecordings",
              parameters: [
                { name: "userEmail", in: "query", required: true, schema: { type: "string" }, description: "Email of the user whose recordings to search" },
                { name: "query", in: "query", required: true, schema: { type: "string" }, description: "Search query string" },
                { name: "limit", in: "query", schema: { type: "integer", default: 50 }, description: "Maximum number of results" }
              ],
              responses: {
                "200": {
                  description: "Search results",
                  content: {
                    "application/json": {
                      schema: {
                        allOf: [
                          { $ref: "#/components/schemas/RecordingListResponse" },
                          { type: "object", properties: { query: { type: "string" } } }
                        ]
                      }
                    }
                  }
                },
                "400": { $ref: "#/components/responses/BadRequest" },
                "500": { $ref: "#/components/responses/InternalError" }
              }
            }
          },
          "/list-recordings-public": {
            get: {
              summary: "List public recordings",
              description: "Lists published recordings across all users, optionally filtered by tag.",
              operationId: "listPublicRecordings",
              parameters: [
                { name: "tag", in: "query", schema: { type: "string" }, description: "Filter by tag (case-insensitive)" },
                { name: "limit", in: "query", schema: { type: "integer", default: 50 }, description: "Maximum number of recordings" },
                { name: "cursor", in: "query", schema: { type: "string" }, description: "Pagination cursor" }
              ],
              responses: {
                "200": {
                  description: "List of public recordings",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          recordings: { type: "array", items: { $ref: "#/components/schemas/RecordingMetadata" } },
                          total: { type: "integer" },
                          cursor: { type: "string", nullable: true }
                        }
                      }
                    }
                  }
                },
                "500": { $ref: "#/components/responses/InternalError" }
              }
            }
          },
          "/delete-recording": {
            delete: {
              summary: "Delete a recording",
              description: "Deletes a recording and updates the user index.",
              operationId: "deleteRecording",
              parameters: [
                { name: "userEmail", in: "query", required: true, schema: { type: "string" }, description: "Owner email" },
                { name: "recordingId", in: "query", required: true, schema: { type: "string" }, description: "Recording ID to delete" }
              ],
              responses: {
                "200": {
                  description: "Recording deleted",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          success: { type: "boolean" },
                          deletedRecording: { $ref: "#/components/schemas/RecordingMetadata" }
                        }
                      }
                    }
                  }
                },
                "400": { $ref: "#/components/responses/BadRequest" },
                "500": { $ref: "#/components/responses/InternalError" }
              }
            }
          },
          "/update-recording": {
            put: {
              summary: "Update recording metadata (PUT)",
              description: "Updates recording metadata using query params for identification and JSON body for updates.",
              operationId: "updateRecordingPut",
              parameters: [
                { name: "userEmail", in: "query", required: true, schema: { type: "string" }, description: "Owner email" },
                { name: "recordingId", in: "query", required: true, schema: { type: "string" }, description: "Recording ID" }
              ],
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/UpdateRecordingFields" }
                  }
                }
              },
              responses: {
                "200": {
                  description: "Recording updated",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          success: { type: "boolean" },
                          updatedRecording: { $ref: "#/components/schemas/RecordingMetadata" }
                        }
                      }
                    }
                  }
                },
                "400": { $ref: "#/components/responses/BadRequest" },
                "500": { $ref: "#/components/responses/InternalError" }
              }
            },
            post: {
              summary: "Update recording metadata (POST)",
              description: "Updates recording metadata using JSON body for identification and updates. Supports X-User-Email header.",
              operationId: "updateRecordingPost",
              parameters: [
                { name: "X-User-Email", in: "header", schema: { type: "string" }, description: "User email (alternative to body.userEmail)" }
              ],
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        userEmail: { type: "string" },
                        id: { type: "string", description: "Recording ID (alternative: recordingId)" },
                        recordingId: { type: "string" },
                        updates: { $ref: "#/components/schemas/UpdateRecordingFields" }
                      }
                    }
                  }
                }
              },
              responses: {
                "200": {
                  description: "Recording updated",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          success: { type: "boolean" },
                          updatedRecording: { $ref: "#/components/schemas/RecordingMetadata" }
                        }
                      }
                    }
                  }
                },
                "400": { $ref: "#/components/responses/BadRequest" },
                "500": { $ref: "#/components/responses/InternalError" }
              }
            }
          },
          "/update-publication-state": {
            post: {
              summary: "Update publication state (superadmin only)",
              description: "Changes a recording publication state between draft and published. Requires superadmin role.",
              operationId: "updatePublicationState",
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      required: ["userEmail", "recordingId", "publicationState", "requestingUserRole"],
                      properties: {
                        userEmail: { type: "string" },
                        recordingId: { type: "string" },
                        publicationState: { type: "string", enum: ["draft", "published"] },
                        requestingUserRole: { type: "string", description: 'Must be "superadmin"' }
                      }
                    }
                  }
                }
              },
              responses: {
                "200": {
                  description: "Publication state updated",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          success: { type: "boolean" },
                          updatedRecording: { $ref: "#/components/schemas/RecordingMetadata" }
                        }
                      }
                    }
                  }
                },
                "400": { $ref: "#/components/responses/BadRequest" },
                "403": { description: "Forbidden - superadmin role required", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                "500": { $ref: "#/components/responses/InternalError" }
              }
            }
          },
          "/repair-index": {
            post: {
              summary: "Repair user index (superadmin only)",
              description: "Adds a recording to the user index if it is missing. Admin maintenance endpoint.",
              operationId: "repairIndex",
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      required: ["userEmail", "recordingId", "requestingUserRole"],
                      properties: {
                        userEmail: { type: "string" },
                        recordingId: { type: "string" },
                        requestingUserRole: { type: "string", description: 'Must be "superadmin"' }
                      }
                    }
                  }
                }
              },
              responses: {
                "200": {
                  description: "Index repaired",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          success: { type: "boolean" },
                          index: { $ref: "#/components/schemas/UserIndex" }
                        }
                      }
                    }
                  }
                },
                "400": { $ref: "#/components/responses/BadRequest" },
                "403": { description: "Forbidden - superadmin role required", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
                "500": { $ref: "#/components/responses/InternalError" }
              }
            }
          },
          "/context-templates": {
            get: {
              summary: "Get context templates",
              description: "Returns saved context templates for a user.",
              operationId: "getContextTemplates",
              parameters: [
                { name: "userEmail", in: "query", required: true, schema: { type: "string" }, description: "User email" }
              ],
              responses: {
                "200": {
                  description: "User context templates",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          templates: { type: "array", items: { $ref: "#/components/schemas/ContextTemplate" } }
                        }
                      }
                    }
                  }
                },
                "400": { $ref: "#/components/responses/BadRequest" }
              }
            },
            post: {
              summary: "Create context template",
              description: "Saves a new context template for a user.",
              operationId: "createContextTemplate",
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      required: ["userEmail", "name", "context"],
                      properties: {
                        userEmail: { type: "string" },
                        name: { type: "string" },
                        context: { type: "string" }
                      }
                    }
                  }
                }
              },
              responses: {
                "200": {
                  description: "Template created",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          template: { $ref: "#/components/schemas/ContextTemplate" },
                          allTemplates: {
                            type: "object",
                            properties: {
                              templates: { type: "array", items: { $ref: "#/components/schemas/ContextTemplate" } }
                            }
                          }
                        }
                      }
                    }
                  }
                },
                "400": { $ref: "#/components/responses/BadRequest" }
              }
            },
            put: {
              summary: "Update template last used",
              description: "Updates the lastUsed timestamp of a context template.",
              operationId: "updateContextTemplateUsage",
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      required: ["userEmail", "templateId"],
                      properties: {
                        userEmail: { type: "string" },
                        templateId: { type: "string" }
                      }
                    }
                  }
                }
              },
              responses: {
                "200": {
                  description: "Template usage updated",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          template: { $ref: "#/components/schemas/ContextTemplate" },
                          allTemplates: {
                            type: "object",
                            properties: {
                              templates: { type: "array", items: { $ref: "#/components/schemas/ContextTemplate" } }
                            }
                          }
                        }
                      }
                    }
                  }
                },
                "400": { $ref: "#/components/responses/BadRequest" },
                "404": { description: "No templates found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
              }
            },
            delete: {
              summary: "Delete context template",
              description: "Deletes a context template by ID.",
              operationId: "deleteContextTemplate",
              parameters: [
                { name: "userEmail", in: "query", required: true, schema: { type: "string" }, description: "User email" },
                { name: "templateId", in: "query", required: true, schema: { type: "string" }, description: "Template ID to delete" }
              ],
              responses: {
                "200": {
                  description: "Template deleted",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          deleted: { type: "string" },
                          allTemplates: {
                            type: "object",
                            properties: {
                              templates: { type: "array", items: { $ref: "#/components/schemas/ContextTemplate" } }
                            }
                          }
                        }
                      }
                    }
                  }
                },
                "400": { $ref: "#/components/responses/BadRequest" },
                "404": { description: "No templates found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } }
              }
            }
          }
        },
        components: {
          schemas: {
            ErrorResponse: {
              type: "object",
              properties: {
                error: { type: "string" }
              }
            },
            SaveRecordingRequest: {
              type: "object",
              required: ["userEmail"],
              properties: {
                userEmail: { type: "string", description: "Owner email address" },
                recordingId: { type: "string", description: "Optional custom ID; auto-generated if omitted" },
                fileName: { type: "string", default: "unknown.wav" },
                displayName: { type: "string" },
                r2Key: { type: "string", nullable: true },
                r2Url: { type: "string", nullable: true },
                fileSize: { type: "integer", default: 0 },
                duration: { type: "number", default: 0 },
                transcriptionText: { type: "string" },
                norwegianTranscription: {
                  type: "object",
                  nullable: true,
                  properties: {
                    raw_text: { type: "string" },
                    improved_text: { type: "string" }
                  }
                },
                tags: { type: "array", items: { type: "string" }, default: [] },
                category: { type: "string", default: "general" },
                publicationState: { type: "string", enum: ["draft", "published"], default: "draft" },
                audioFormat: { type: "string", default: "wav" },
                sampleRate: { type: "integer", default: 16e3 },
                channels: { type: "integer", default: 1 },
                aiService: { type: "string", default: "openai" },
                aiModel: { type: "string", default: "whisper-1" },
                processingTime: { type: "number", default: 0 },
                transcriptionContext: { type: "string", nullable: true },
                transcriptionServer: { type: "string", nullable: true },
                textImprovement: { type: "string", nullable: true },
                cloudflareAiAvailable: { type: "boolean", default: false }
              }
            },
            RecordingMetadata: {
              type: "object",
              properties: {
                userEmail: { type: "string" },
                recordingId: { type: "string" },
                fileName: { type: "string" },
                displayName: { type: "string" },
                r2Key: { type: "string", nullable: true },
                r2Url: { type: "string", nullable: true },
                fileSize: { type: "integer" },
                duration: { type: "number" },
                transcriptionText: { type: "string" },
                transcriptionExcerpt: { type: "string" },
                norwegianTranscription: { type: "object", nullable: true },
                tags: { type: "array", items: { type: "string" } },
                category: { type: "string" },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
                publicationState: { type: "string", enum: ["draft", "published"] },
                publishedAt: { type: "string", format: "date-time", nullable: true },
                audioFormat: { type: "string" },
                sampleRate: { type: "integer" },
                channels: { type: "integer" },
                aiService: { type: "string" },
                aiModel: { type: "string" },
                processingTime: { type: "number" },
                transcriptionContext: { type: "string", nullable: true },
                transcriptionServer: { type: "string", nullable: true },
                textImprovement: { type: "string", nullable: true },
                cloudflareAiAvailable: { type: "boolean" },
                speakerTimeline: { type: "array", nullable: true, items: { type: "object" } },
                numSpeakers: { type: "integer", nullable: true },
                speakerNames: { type: "object", nullable: true },
                diarization: { type: "object", nullable: true },
                conversationAnalysis: { type: "object", nullable: true }
              }
            },
            UpdateRecordingFields: {
              type: "object",
              description: "Updatable recording fields",
              properties: {
                displayName: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
                category: { type: "string" },
                publicationState: { type: "string", enum: ["draft", "published"] },
                publishedAt: { type: "string", format: "date-time", nullable: true },
                speakerTimeline: { type: "array", items: { type: "object" } },
                numSpeakers: { type: "integer" },
                speakerNames: { type: "object" },
                diarization: { type: "object" },
                conversationAnalysis: { type: "object" }
              }
            },
            UserIndex: {
              type: "object",
              properties: {
                userEmail: { type: "string" },
                totalRecordings: { type: "integer" },
                totalDuration: { type: "number" },
                lastUpdated: { type: "string", format: "date-time" },
                recordingIds: { type: "array", items: { type: "string" } }
              }
            },
            RecordingListResponse: {
              type: "object",
              properties: {
                recordings: { type: "array", items: { $ref: "#/components/schemas/RecordingMetadata" } },
                total: { type: "integer" },
                cursor: { type: "string", nullable: true },
                userStats: {
                  type: "object",
                  nullable: true,
                  properties: {
                    totalRecordings: { type: "integer" },
                    totalDuration: { type: "number" },
                    lastUpdated: { type: "string", format: "date-time" }
                  }
                }
              }
            },
            ContextTemplate: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                context: { type: "string" },
                createdAt: { type: "string", format: "date-time" },
                lastUsed: { type: "string", format: "date-time" }
              }
            }
          },
          responses: {
            BadRequest: {
              description: "Bad request",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
            },
            InternalError: {
              description: "Internal server error",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } }
            }
          }
        }
      };
      return new Response(JSON.stringify(spec, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
    if (!env.AUDIO_PORTFOLIO) {
      return createErrorResponse("KV binding AUDIO_PORTFOLIO not configured", 500);
    }
    try {
      if (pathname === "/save-recording" && request.method === "POST") {
        const recordingData = await request.json();
        console.log("\u{1F4BE} Saving recording data:", {
          userEmail: recordingData.userEmail,
          fileName: recordingData.fileName,
          category: recordingData.category,
          hasNorwegianTranscription: !!recordingData.norwegianTranscription,
          hasImprovedText: !!recordingData.norwegianTranscription?.improved_text
        });
        const result = await saveRecordingToPortfolio(env, recordingData);
        return createSuccessResponse(result);
      }
      if (pathname === "/list-recordings" && request.method === "GET") {
        const userEmail = url.searchParams.get("userEmail");
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        let userRole = "user";
        if (userEmail && env.vegvisr_org) {
          try {
            const row = await env.vegvisr_org.prepare("SELECT Role FROM config WHERE email = ?").bind(userEmail).first();
            if (row?.Role) userRole = row.Role;
          } catch {
          }
        }
        if (isSuperadminRole(userRole)) {
          const ownerEmail = url.searchParams.get("ownerEmail");
          const cursor = url.searchParams.get("cursor");
          const result2 = await listAllRecordings(env, limit, cursor, ownerEmail);
          return createSuccessResponse(result2);
        }
        const result = await getUserRecordings(env, userEmail, limit, offset, userRole);
        return createSuccessResponse(result);
      }
      if (pathname === "/search-recordings" && request.method === "GET") {
        const userEmail = url.searchParams.get("userEmail");
        const query = url.searchParams.get("query");
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const result = await searchRecordings(env, userEmail, query, limit);
        return createSuccessResponse(result);
      }
      if (pathname === "/list-recordings-public" && request.method === "GET") {
        const tag = url.searchParams.get("tag");
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const cursor = url.searchParams.get("cursor");
        const result = await listPublicRecordings(env, tag, limit, cursor);
        return createSuccessResponse(result);
      }
      if (pathname === "/delete-recording" && request.method === "DELETE") {
        const userEmail = url.searchParams.get("userEmail");
        const recordingId = url.searchParams.get("recordingId");
        const result = await deleteRecording(env, userEmail, recordingId);
        return createSuccessResponse(result);
      }
      if (pathname === "/update-recording" && (request.method === "PUT" || request.method === "POST")) {
        let userEmail, recordingId, updates;
        if (request.method === "PUT") {
          userEmail = url.searchParams.get("userEmail");
          recordingId = url.searchParams.get("recordingId");
          updates = await request.json();
        } else {
          const body = await request.json();
          userEmail = request.headers.get("X-User-Email") || body.userEmail;
          recordingId = body.id || body.recordingId;
          updates = body.updates || body;
        }
        console.log("\u{1F4DD} Updating recording:", {
          userEmail,
          recordingId,
          updates: Object.keys(updates),
          hasSpeakerTimeline: !!updates.speakerTimeline
        });
        const result = await updateRecording(env, userEmail, recordingId, updates);
        return createSuccessResponse(result);
      }
      if (pathname === "/update-publication-state" && request.method === "POST") {
        const body = await request.json();
        const { userEmail, recordingId, publicationState } = body;
        const authPublish = await validateWorkerApiToken(request, env);
        if (!authPublish.valid) return createErrorResponse(authPublish.error, 401);
        if (!isSuperadminRole(authPublish.role)) {
          return createErrorResponse("Only superadmin can change publication state", 403);
        }
        if (!["draft", "published"].includes(publicationState)) {
          return createErrorResponse('Invalid publication state. Must be "draft" or "published"', 400);
        }
        const updates = {
          publicationState,
          publishedAt: publicationState === "published" ? (/* @__PURE__ */ new Date()).toISOString() : null
        };
        const result = await updateRecording(env, userEmail, recordingId, updates);
        return createSuccessResponse(result);
      }
      if (pathname === "/repair-index" && request.method === "POST") {
        const body = await request.json();
        const { userEmail, recordingId } = body;
        const authRepair = await validateWorkerApiToken(request, env);
        if (!authRepair.valid) return createErrorResponse(authRepair.error, 401);
        if (!isSuperadminRole(authRepair.role)) {
          return createErrorResponse("Only Superadmin can repair indexes", 403);
        }
        const result = await addRecordingToIndex(env, userEmail, recordingId);
        return createSuccessResponse(result);
      }
      if (pathname === "/generate-summary" && request.method === "POST") {
        try {
          const body = await request.json();
          const userEmail = String(body.userEmail || "").trim();
          const recordingId = String(body.recordingId || "").trim();
          if (!userEmail || !recordingId) return createErrorResponse("userEmail and recordingId are required", 400);
          if (!env.WHISPER_WORKER) return createErrorResponse("WHISPER_WORKER service binding not configured", 500);
          if (!env.ANTHROPIC) return createErrorResponse("ANTHROPIC service binding not configured", 500);
          const kv = await resolveKv(env, userEmail);
          const recordingKey = `audio-recording:${userEmail}:${recordingId}`;
          const recordingRaw = await kv.get(recordingKey);
          if (!recordingRaw) return createErrorResponse("Recording not found", 404);
          const recording = JSON.parse(recordingRaw);
          if (!recording.r2Url) return createErrorResponse("Recording has no playable URL to transcribe", 400);
          let transcript = String(recording.transcriptionText || "").trim();
          let transcriptSource = "cached";
          if (!transcript) {
            transcriptSource = "whisper";
            const whisperRes = await env.WHISPER_WORKER.fetch(
              new Request(`https://whisper.vegvisr.org/transcribe?url=${encodeURIComponent(recording.r2Url)}&service=openai&model=whisper-1`, {
                method: "GET"
              })
            );
            const whisperData = await whisperRes.json().catch(() => ({}));
            if (!whisperRes.ok) {
              return createErrorResponse(`Transcription failed: ${whisperData?.error || whisperRes.status}`, 502);
            }
            transcript = String(whisperData.text || whisperData.transcription?.text || "").trim();
            if (!transcript) return createErrorResponse("Transcription returned no text", 502);
          }
          const MAX_TRANSCRIPT = 12e3;
          const clipped = transcript.length > MAX_TRANSCRIPT ? transcript.slice(0, MAX_TRANSCRIPT) : transcript;
          const system = 'You label audio recordings for a searchable portfolio. Given a transcript, respond with ONLY a raw JSON object \u2014 no markdown, no code fences, no prose. Shape exactly: {"summary": string (2-3 sentences, max 400 chars), "keywords": string[] (3-7 short lowercase keywords/tags), "category": string (one or two words, e.g. "Podcast", "Interview", "Meeting")}.';
          const userMsg = (recording.displayName ? `Title: ${recording.displayName}

` : "") + `Transcript:
${clipped}`;
          const aiResp = await env.ANTHROPIC.fetch("https://anthropic.vegvisr.org/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: userEmail,
              model: "claude-haiku-4-5-20251001",
              max_tokens: 500,
              temperature: 0.3,
              system,
              messages: [{ role: "user", content: userMsg }]
            })
          });
          const aiData = await aiResp.json().catch(() => ({}));
          if (!aiResp.ok) return createErrorResponse(`AI summary failed: ${aiData?.error || aiResp.status}`, 502);
          const textBlock = (aiData?.content || []).find((b) => b?.type === "text");
          let raw = String(textBlock?.text || "").trim();
          raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch {
          }
          const summary = parsed?.summary ? String(parsed.summary).trim().slice(0, 400) : raw.slice(0, 400);
          const keywords = Array.isArray(parsed?.keywords) ? parsed.keywords.map((k) => String(k).trim().toLowerCase()).filter(Boolean).slice(0, 10) : [];
          const category = parsed?.category ? String(parsed.category).trim().slice(0, 100) : recording.category;
          const updateResult = await updateRecording(env, userEmail, recordingId, {
            transcriptionText: transcript,
            transcriptionExcerpt: summary,
            tags: keywords.length ? keywords : recording.tags,
            category
          });
          return createSuccessResponse({
            success: true,
            transcriptSource,
            summary,
            keywords,
            category,
            recording: updateResult.updatedRecording
          });
        } catch (e) {
          console.error("Error in /generate-summary:", e);
          return createErrorResponse(e.message, 500);
        }
      }
      if (pathname === "/context-templates" && request.method === "GET") {
        const userEmail = url.searchParams.get("userEmail");
        if (!userEmail) {
          return createErrorResponse("User email is required", 400);
        }
        const templatesKey = `context-templates:${userEmail}`;
        const templatesData = await env.AUDIO_PORTFOLIO.get(templatesKey);
        const templates = templatesData ? JSON.parse(templatesData) : { templates: [] };
        return createSuccessResponse(templates);
      }
      if (pathname === "/context-templates" && request.method === "POST") {
        const body = await request.json();
        const { userEmail, name, context } = body;
        if (!userEmail || !name || !context) {
          return createErrorResponse("User email, name, and context are required", 400);
        }
        const templatesKey = `context-templates:${userEmail}`;
        const templatesData = await env.AUDIO_PORTFOLIO.get(templatesKey);
        const templates = templatesData ? JSON.parse(templatesData) : { templates: [] };
        const newTemplate = {
          id: `template_${Date.now()}`,
          name,
          context,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          lastUsed: (/* @__PURE__ */ new Date()).toISOString()
        };
        templates.templates.push(newTemplate);
        await env.AUDIO_PORTFOLIO.put(templatesKey, JSON.stringify(templates));
        return createSuccessResponse({ template: newTemplate, allTemplates: templates });
      }
      if (pathname === "/context-templates" && request.method === "DELETE") {
        const userEmail = url.searchParams.get("userEmail");
        const templateId = url.searchParams.get("templateId");
        if (!userEmail || !templateId) {
          return createErrorResponse("User email and template ID are required", 400);
        }
        const templatesKey = `context-templates:${userEmail}`;
        const templatesData = await env.AUDIO_PORTFOLIO.get(templatesKey);
        if (!templatesData) {
          return createErrorResponse("No templates found", 404);
        }
        const templates = JSON.parse(templatesData);
        templates.templates = templates.templates.filter((t) => t.id !== templateId);
        await env.AUDIO_PORTFOLIO.put(templatesKey, JSON.stringify(templates));
        return createSuccessResponse({ deleted: templateId, allTemplates: templates });
      }
      if (pathname === "/context-templates" && request.method === "PUT") {
        const body = await request.json();
        const { userEmail, templateId } = body;
        if (!userEmail || !templateId) {
          return createErrorResponse("User email and template ID are required", 400);
        }
        const templatesKey = `context-templates:${userEmail}`;
        const templatesData = await env.AUDIO_PORTFOLIO.get(templatesKey);
        if (!templatesData) {
          return createErrorResponse("No templates found", 404);
        }
        const templates = JSON.parse(templatesData);
        const template = templates.templates.find((t) => t.id === templateId);
        if (template) {
          template.lastUsed = (/* @__PURE__ */ new Date()).toISOString();
          await env.AUDIO_PORTFOLIO.put(templatesKey, JSON.stringify(templates));
        }
        return createSuccessResponse({ template, allTemplates: templates });
      }
      return createErrorResponse("Endpoint not found", 404);
    } catch (error) {
      console.error("Audio Portfolio Worker Error:", error);
      return createErrorResponse(error.message || "Internal server error", 500);
    }
  }
};
export {
  index_default as default
};
