// Recovered from the DEPLOYED worker on Cloudflare, because the local source was lost.
//
// Background: worker dirs were gitignored 2025-12-11 and untracked 2026-08-02 (3cd3dae) on the
// rationale that they were "deployed via wrangler, not git". A later `git clean -fdx` removed the
// working copies, and git restored the last COMMITTED state — 2026-05-28, 1192 lines. Everything
// written between then and the 2026-07-05 deploy existed only in production: 11 endpoints and
// ~1000 lines. This file is that production code, recovered from the deployed bundle.
//
// esbuild artefacts undone: the two helper declarations at the top of the bundle removed, and the
// esbuild name-preservation wrappers unwrapped back to plain expressions. Variable names may
// differ from the original where esbuild renamed to avoid collisions, and the original comments
// are gone — esbuild strips them, and no commit holds them.
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Token, X-File-Name"
};
var PROJECT_PREFIX = "vemotion:project:";
var COMP_PREFIX = "vemotion:comp:";
var COMP_VER_PREFIX = "vemotion:compver:";
var RENDER_PREFIX = "vemotion:render:";
var TEMPLATE_PREFIX = "vemotion:template:";
var json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", ...headers }
});
var error = (message, status = 400, extra = {}) => json({ error: message, ...extra }, status);
var getProjectKey = (id) => `${PROJECT_PREFIX}${id}`;
var getCompKey = (id) => `${COMP_PREFIX}${id}`;
var getCompVersionPrefix = (id) => `${COMP_VER_PREFIX}${id}:`;
var getCompVersionKey = (id, version) => `${COMP_VER_PREFIX}${id}:${version}`;
var getTemplateKey = (id) => `${TEMPLATE_PREFIX}${id}`;
var getRenderKey = (id) => `${RENDER_PREFIX}${id}`;
var normalizeTags = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((e) => typeof e === "string" ? e.trim() : "").filter(Boolean);
};
var normalizeAssets = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((asset, index) => {
    if (typeof asset === "string") return { id: `asset-${index + 1}`, src: asset, type: "image" };
    if (!asset || typeof asset !== "object") return null;
    const src = typeof asset.src === "string" ? asset.src.trim() : "";
    if (!src) return null;
    return {
      id: typeof asset.id === "string" && asset.id.trim() ? asset.id.trim() : `asset-${index + 1}`,
      src,
      type: typeof asset.type === "string" && asset.type.trim() ? asset.type.trim() : "image",
      label: typeof asset.label === "string" ? asset.label.trim() : null,
      role: typeof asset.role === "string" ? asset.role.trim() : null,
      tags: normalizeTags(asset.tags)
    };
  }).filter(Boolean);
};
var normalizeObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
async function validateAuth(request, env) {
  const apiToken = request.headers.get("X-API-Token");
  if (!apiToken) return { valid: false, error: "Missing X-API-Token header" };
  try {
    const row = await env.vegvisr_org.prepare("SELECT user_id, Role, email, cf_account_id, cf_r2_bucket, data FROM config WHERE emailVerificationToken = ?").bind(apiToken).first();
    if (!row) return { valid: false, error: "Invalid authentication token" };
    let extraData = {};
    try {
      extraData = row.data ? JSON.parse(row.data) : {};
    } catch {
      extraData = {};
    }
    return {
      valid: true,
      authToken: apiToken,
      userId: row.user_id,
      email: row.email || null,
      role: row.Role || null,
      cfAccountId: row.cf_account_id || null,
      cfR2Bucket: row.cf_r2_bucket || null,
      data: extraData
    };
  } catch (err) {
    console.error("Auth error", err);
    return { valid: false, error: "Authentication error" };
  }
}
async function readProject(env, projectId) {
  const raw = await env.VEMOTION_PROJECTS.get(getProjectKey(projectId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function assertOwner(record, auth) {
  if (!record) throw Object.assign(new Error("Not found"), { status: 404 });
  const owner = record.userId || record.userEmail;
  const caller = auth?.userId || auth?.email;
  if (!caller || owner !== caller && record.userEmail !== auth?.email) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
}
function projectSummary(p) {
  return {
    projectId: p.projectId,
    title: p.title,
    description: p.description || "",
    compositionId: p.compositionId || p.templateId || "VEmotionIntro",
    templateId: p.templateId || "custom",
    status: p.status || "draft",
    version: p.version || 1,
    updatedAt: p.updatedAt,
    createdAt: p.createdAt,
    assetCount: Array.isArray(p.assets) ? p.assets.length : 0
  };
}
function buildProjectRecord(input, auth, env, existing = null) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const projectId = existing?.projectId || (typeof input.projectId === "string" && input.projectId.trim() ? input.projectId.trim() : crypto.randomUUID());
  const compositionId = (typeof input.compositionId === "string" && input.compositionId.trim() ? input.compositionId.trim() : null) || (typeof input.templateId === "string" && input.templateId.trim() ? input.templateId.trim() : null) || existing?.compositionId || existing?.templateId || "VEmotionIntro";
  const accountId = auth?.data?.vemotion?.accountId || auth?.cfAccountId || env.CF_ACCOUNT_ID || env.VEMOTION_DEFAULT_ACCOUNT_ID || null;
  const bucketName = auth?.data?.vemotion?.r2Bucket || auth?.cfR2Bucket || env.VEMOTION_ASSETS_BUCKET_NAME || null;
  return {
    projectId,
    userId: auth.userId,
    userEmail: auth.email,
    compositionId,
    templateId: typeof input.templateId === "string" && input.templateId.trim() ? input.templateId.trim() : existing?.templateId || compositionId,
    title: typeof input.title === "string" && input.title.trim() ? input.title.trim() : existing?.title || "Untitled VEmotion Project",
    description: typeof input.description === "string" ? input.description.trim() : existing?.description || "",
    status: typeof input.status === "string" && input.status.trim() ? input.status.trim() : existing?.status || "draft",
    assets: input.assets !== void 0 ? normalizeAssets(input.assets) : existing?.assets || [],
    props: input.props !== void 0 ? normalizeObject(input.props) : existing?.props || {},
    scenes: input.scenes !== void 0 ? Array.isArray(input.scenes) ? input.scenes : [] : existing?.scenes || [],
    notes: typeof input.notes === "string" ? input.notes.trim() : existing?.notes || "",
    accountId,
    bucketName,
    storage: {
      mode: "bootstrap-account",
      kvNamespace: env.VEMOTION_PROJECTS_NAMESPACE_ID || null,
      assetsPrefix: `users/${auth.userId}/projects/${projectId}/assets/`,
      rendersPrefix: `users/${auth.userId}/projects/${projectId}/renders/`
    },
    render: existing?.render || null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    version: existing ? Number(existing.version || 1) + 1 : 1
  };
}
async function putProject(env, project) {
  await env.VEMOTION_PROJECTS.put(getProjectKey(project.projectId), JSON.stringify(project), {
    metadata: {
      userId: project.userId,
      userEmail: project.userEmail,
      title: project.title,
      status: project.status,
      compositionId: project.compositionId,
      updatedAt: project.updatedAt
    }
  });
}
async function handleCreateProject(request, env, auth) {
  const input = await request.json();
  const project = buildProjectRecord(input, auth, env);
  await putProject(env, project);
  return json({ ok: true, message: "VEmotion project created", project, summary: projectSummary(project) }, 201);
}
async function handleUpdateProject(request, env, auth) {
  const input = await request.json();
  const projectId = typeof input.projectId === "string" ? input.projectId.trim() : "";
  if (!projectId) return error("projectId is required", 400);
  const existing = await readProject(env, projectId);
  if (!existing) return error("Project not found", 404);
  assertOwner(existing, auth);
  const project = buildProjectRecord(input, auth, env, existing);
  await putProject(env, project);
  return json({ ok: true, message: "VEmotion project updated", project, summary: projectSummary(project) });
}
async function handleGetProject(url, env, auth) {
  const projectId = url.searchParams.get("id") || "";
  if (!projectId) return error("id is required", 400);
  const project = await readProject(env, projectId);
  if (!project) return error("Project not found", 404);
  assertOwner(project, auth);
  return json({ ok: true, project, summary: projectSummary(project) });
}
async function handleListProjects(url, env, auth) {
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 20), 1), 100);
  const cursor = url.searchParams.get("cursor") || void 0;
  const list = await env.VEMOTION_PROJECTS.list({ prefix: PROJECT_PREFIX, limit, cursor });
  const projects = [];
  for (const item of list.keys) {
    const record = await readProject(env, item.name.slice(PROJECT_PREFIX.length));
    if (!record || record.userId !== auth.userId) continue;
    projects.push(projectSummary(record));
  }
  projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return json({ ok: true, projects, count: projects.length, cursor: list.cursor || null, truncated: Boolean(list.cursor) });
}
async function handleDeleteProject(url, env, auth) {
  const projectId = url.searchParams.get("id") || "";
  if (!projectId) return error("id is required", 400);
  const existing = await readProject(env, projectId);
  if (!existing) return error("Project not found", 404);
  assertOwner(existing, auth);
  await env.VEMOTION_PROJECTS.delete(getProjectKey(projectId));
  return json({ ok: true, message: "Project deleted", projectId });
}
async function handleSaveImagePrompt(request, env, auth) {
  const input = await request.json().catch(() => ({}));
  const finalPrompt = typeof input.finalPrompt === "string" ? input.finalPrompt.trim() : "";
  if (!finalPrompt) return error("finalPrompt is required", 400);
  const id = globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `vip_${Date.now()}_${Math.round(Math.random() * 1e9)}`;
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  const subject = typeof input.subject === "string" ? input.subject : "";
  const resultUrl = typeof input.resultUrl === "string" ? input.resultUrl : "";
  const settings = input.settings != null ? JSON.stringify(input.settings) : null;
  await env.vegvisr_org.prepare("INSERT INTO vemotion_image_prompts (id, user_id, user_email, subject, final_prompt, settings, result_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(id, auth.userId, auth.email || null, subject, finalPrompt, settings, resultUrl, createdAt).run();
  return json({ ok: true, item: { id, subject, finalPrompt, settings: input.settings ?? null, resultUrl, createdAt } }, 201);
}
async function handleListImagePrompts(url, env, auth) {
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 200);
  const res = await env.vegvisr_org.prepare("SELECT id, subject, final_prompt, settings, result_url, created_at FROM vemotion_image_prompts WHERE user_id = ? ORDER BY created_at DESC LIMIT ?").bind(auth.userId, limit).all();
  const items = (res.results || []).map((r) => ({
    id: r.id,
    subject: r.subject || "",
    finalPrompt: r.final_prompt || "",
    settings: r.settings ? (() => {
      try {
        return JSON.parse(r.settings);
      } catch {
        return null;
      }
    })() : null,
    resultUrl: r.result_url || "",
    createdAt: r.created_at
  }));
  return json({ ok: true, items, count: items.length });
}
async function handleDeleteImagePrompt(url, env, auth) {
  const id = url.searchParams.get("id") || "";
  if (!id) return error("id is required", 400);
  await env.vegvisr_org.prepare("DELETE FROM vemotion_image_prompts WHERE id = ? AND user_id = ?").bind(id, auth.userId).run();
  return json({ ok: true, message: "Prompt deleted", id });
}
async function readComp(env, compId) {
  const raw = await env.VEMOTION_PROJECTS.get(getCompKey(compId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function listCompVersions(env, compId, limit = 30) {
  const prefix = getCompVersionPrefix(compId);
  const list = await env.VEMOTION_PROJECTS.list({ prefix, limit: Math.max(limit, 1) * 4 });
  const versions = [];
  for (const item of list.keys) {
    const raw = await env.VEMOTION_PROJECTS.get(item.name);
    if (!raw) continue;
    try {
      versions.push(JSON.parse(raw));
    } catch {
      continue;
    }
  }
  versions.sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
  return versions.slice(0, limit);
}
async function trimCompVersions(env, compId, keep = 30) {
  const prefix = getCompVersionPrefix(compId);
  const list = await env.VEMOTION_PROJECTS.list({ prefix, limit: 500 });
  const keys = list.keys.map((item) => {
    const version = Number(item.name.slice(prefix.length));
    return Number.isFinite(version) ? { name: item.name, version } : null;
  }).filter(Boolean).sort((a, b) => b.version - a.version);
  const stale = keys.slice(keep);
  await Promise.all(stale.map((item) => env.VEMOTION_PROJECTS.delete(item.name)));
}
function compSummary(c) {
  return {
    id: c.id,
    name: c.name,
    duration: c.composition?.duration,
    fps: c.composition?.fps,
    width: c.composition?.width,
    height: c.composition?.height,
    layerCount: Array.isArray(c.composition?.layers) ? c.composition.layers.length : 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    version: c.version || 1,
    // Inline meta in the list summary so portfolio clients don't need to
    // N+1-fetch each composition just to read its tags/category/area.
    // Pass through whatever's stored under composition.meta (may be undefined).
    meta: c.composition?.meta && typeof c.composition.meta === "object" ? c.composition.meta : void 0
  };
}
function metaBytes(obj) {
  return new TextEncoder().encode(JSON.stringify(obj)).length;
}
function compMetadata(record) {
  const base = { userId: record.userId, name: record.name, updatedAt: record.updatedAt };
  const summary = compSummary(record);
  const full = { ...base, summary };
  if (metaBytes(full) <= 1024) return full;
  if (summary.meta?.description) {
    const trimmed = { ...summary, meta: { ...summary.meta, description: void 0 } };
    const candidate = { ...base, summary: trimmed };
    if (metaBytes(candidate) <= 1024) return candidate;
  }
  return base;
}
function templateSummary(t) {
  return {
    templateId: t.templateId,
    sourceCompId: t.sourceCompId,
    name: t.name,
    authorEmail: t.userEmail || null,
    authorName: t.authorName || null,
    duration: t.composition?.duration,
    fps: t.composition?.fps,
    width: t.composition?.width,
    height: t.composition?.height,
    layerCount: Array.isArray(t.composition?.layers) ? t.composition.layers.length : 0,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    // Inline meta so the templates grid gets tags/category/area without an
    // N+1 fetch — same rationale as compSummary.
    meta: t.composition?.meta && typeof t.composition.meta === "object" ? t.composition.meta : void 0
  };
}
var REFIT_UNIFORM_SCALABLE_PROPS = [
  "fontSize",
  "strokeWidth",
  "titleFontSize",
  "bodyFontSize",
  "padding",
  "gap",
  "borderRadius"
];
function refitComposition(composition, targetWidth, targetHeight, mode) {
  const oldW = composition.width;
  const oldH = composition.height;
  if (oldW <= 0 || oldH <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    return composition;
  }
  let sx;
  let sy;
  let offsetX;
  let offsetY;
  if (mode === "stretch") {
    sx = targetWidth / oldW;
    sy = targetHeight / oldH;
    offsetX = 0;
    offsetY = 0;
  } else {
    const ratioX = targetWidth / oldW;
    const ratioY = targetHeight / oldH;
    const s = mode === "fit" ? Math.min(ratioX, ratioY) : Math.max(ratioX, ratioY);
    sx = s;
    sy = s;
    offsetX = (targetWidth - oldW * s) / 2;
    offsetY = (targetHeight - oldH * s) / 2;
  }
  const fontScale = Math.min(sx, sy);
  const layers = Array.isArray(composition.layers) ? composition.layers : [];
  return {
    ...composition,
    width: targetWidth,
    height: targetHeight,
    layers: layers.map((layer) => refitLayer(layer, sx, sy, offsetX, offsetY, fontScale))
  };
}
function refitLayer(layer, sx, sy, ox, oy, fontScale) {
  const nextProperties = { ...layer.properties || {} };
  for (const key of REFIT_UNIFORM_SCALABLE_PROPS) {
    const v = nextProperties[key];
    if (typeof v === "number") {
      nextProperties[key] = v * fontScale;
    }
  }
  const next = {
    ...layer,
    position: {
      x: (layer.position?.x ?? 0) * sx + ox,
      y: (layer.position?.y ?? 0) * sy + oy
    },
    size: {
      width: (layer.size?.width ?? 0) * sx,
      height: (layer.size?.height ?? 0) * sy
    },
    properties: nextProperties
  };
  if (layer.animation) next.animation = refitAnimation(layer.animation, sx, sy);
  if (Array.isArray(layer.animations)) next.animations = layer.animations.map((a) => refitAnimation(a, sx, sy));
  return next;
}
function refitAnimation(anim, sx, sy) {
  if (!anim || typeof anim !== "object") return anim;
  if (anim.kind === "mask-wipe") return anim;
  if (anim.property !== "offsetX" && anim.property !== "offsetY") return anim;
  const factor = anim.property === "offsetX" ? sx : sy;
  const keyframes = Array.isArray(anim.keyframes) ? anim.keyframes : [];
  return {
    ...anim,
    keyframes: keyframes.map((k) => ({
      ...k,
      value: typeof k.value === "number" ? k.value * factor : k.value
    }))
  };
}
async function handleListCompositions(url, env, auth) {
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 200);
  const cursor = url.searchParams.get("cursor") || void 0;
  const list = await env.VEMOTION_PROJECTS.list({ prefix: COMP_PREFIX, limit, cursor });
  const results = await Promise.all(list.keys.map(async (item) => {
    const md = item.metadata;
    if (md && md.userId && md.userId !== auth.userId) return null;
    if (md && md.summary && md.userId === auth.userId) return md.summary;
    const record = await readComp(env, item.name.slice(COMP_PREFIX.length));
    if (!record || record.userId !== auth.userId) return null;
    try {
      await env.VEMOTION_PROJECTS.put(item.name, JSON.stringify(record), { metadata: compMetadata(record) });
    } catch {
    }
    return compSummary(record);
  }));
  const compositions = results.filter(Boolean);
  compositions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return json({ ok: true, compositions, count: compositions.length, cursor: list.cursor || null, truncated: Boolean(list.cursor) });
}
async function handleGetComposition(url, env, auth) {
  const id = url.searchParams.get("id") || "";
  if (!id) return error("id is required", 400);
  const record = await readComp(env, id);
  if (!record) return error("Composition not found", 404);
  assertOwner(record, auth);
  return json({ ok: true, ...record });
}
async function handleGetCompositionHistory(url, env, auth) {
  const id = url.searchParams.get("id") || "";
  if (!id) return error("id is required", 400);
  const record = await readComp(env, id);
  if (!record) return error("Composition not found", 404);
  assertOwner(record, auth);
  const history = await listCompVersions(env, id, 30);
  return json({
    ok: true,
    id,
    history: history.map((entry) => ({
      id: entry.id,
      name: entry.name,
      version: entry.version || 1,
      updatedAt: entry.updatedAt,
      createdAt: entry.createdAt,
      duration: entry.composition?.duration,
      fps: entry.composition?.fps,
      width: entry.composition?.width,
      height: entry.composition?.height,
      layerCount: Array.isArray(entry.composition?.layers) ? entry.composition.layers.length : 0
    }))
  });
}
async function handleGetCompositionVersion(url, env, auth) {
  const id = url.searchParams.get("id") || "";
  const versionParam = url.searchParams.get("v") || "";
  if (!id) return error("id is required", 400);
  const version = Number(versionParam);
  if (!Number.isFinite(version) || version < 1) return error("v must be a positive integer", 400);
  const current = await readComp(env, id);
  if (!current) return error("Composition not found", 404);
  assertOwner(current, auth);
  const raw = await env.VEMOTION_PROJECTS.get(getCompVersionKey(id, version));
  if (!raw) return error("Version not found", 404);
  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    return error("Version data corrupted", 500);
  }
  return json({
    ok: true,
    id,
    version: record.version || version,
    name: record.name,
    composition: record.composition,
    updatedAt: record.updatedAt,
    createdAt: record.createdAt
  });
}
async function handleSaveComposition(request, env, auth) {
  const input = await request.json();
  const { name, composition } = input;
  if (!name || !composition) return error("name and composition are required", 400);
  if (!composition.duration || !composition.fps || !composition.width || !composition.height) {
    return error("composition must include duration, fps, width, height", 400);
  }
  if (!Array.isArray(composition.layers)) return error("composition.layers must be an array", 400);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const id = typeof input.id === "string" && input.id.trim() ? input.id.trim() : `comp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const existing = await readComp(env, id);
  if (existing) assertOwner(existing, auth);
  const trimmedName = String(name).trim();
  const changed = !existing || existing.name !== trimmedName || JSON.stringify(existing.composition) !== JSON.stringify(composition);
  if (!changed) {
    return json({ ok: true, id, summary: compSummary(existing), version: existing.version || 1, unchanged: true });
  }
  const record = {
    id,
    userId: auth.userId,
    userEmail: auth.email,
    name: trimmedName,
    composition,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    version: existing ? Number(existing.version || 1) + 1 : 1
  };
  await env.VEMOTION_PROJECTS.put(getCompKey(id), JSON.stringify(record), {
    metadata: compMetadata(record)
  });
  await env.VEMOTION_PROJECTS.put(getCompVersionKey(id, record.version), JSON.stringify(record), {
    metadata: { userId: record.userId, name: record.name, updatedAt: record.updatedAt, version: record.version }
  });
  await trimCompVersions(env, id, 30);
  return json({ ok: true, id, summary: compSummary(record), version: record.version }, existing ? 200 : 201);
}
async function handleDeleteComposition(url, env, auth) {
  const id = url.searchParams.get("id") || "";
  if (!id) return error("id is required", 400);
  const record = await readComp(env, id);
  if (!record) return error("Composition not found", 404);
  assertOwner(record, auth);
  await env.VEMOTION_PROJECTS.delete(getCompKey(id));
  return json({ ok: true, message: "Composition deleted", id });
}
async function readTemplate(env, templateId) {
  const raw = await env.VEMOTION_PROJECTS.get(getTemplateKey(templateId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function handlePublishTemplate(request, env, auth) {
  const input = await request.json().catch(() => ({}));
  const compositionId = typeof input.compositionId === "string" ? input.compositionId.trim() : "";
  if (!compositionId) return error("compositionId is required", 400);
  const source = await readComp(env, compositionId);
  if (!source) return error("Composition not found", 404);
  assertOwner(source, auth);
  const snapshot = JSON.parse(JSON.stringify(source.composition));
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const requestedName = typeof input.name === "string" && input.name.trim() ? input.name.trim() : source.name;
  const templateId = `tmpl_${compositionId}`;
  const existing = await readTemplate(env, templateId);
  const record = {
    templateId,
    sourceCompId: compositionId,
    userId: auth.userId,
    userEmail: auth.email,
    authorName: auth.data && typeof auth.data.displayName === "string" ? auth.data.displayName : null,
    name: requestedName,
    composition: snapshot,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  await env.VEMOTION_PROJECTS.put(getTemplateKey(templateId), JSON.stringify(record), {
    metadata: { userId: record.userId, name: record.name, sourceCompId: compositionId, updatedAt: now }
  });
  return json({ ok: true, templateId, summary: templateSummary(record), republished: Boolean(existing) }, existing ? 200 : 201);
}
async function handleListTemplates(url, env, auth) {
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 200);
  const cursor = url.searchParams.get("cursor") || void 0;
  const list = await env.VEMOTION_PROJECTS.list({ prefix: TEMPLATE_PREFIX, limit, cursor });
  const templates = [];
  for (const item of list.keys) {
    const record = await readTemplate(env, item.name.slice(TEMPLATE_PREFIX.length));
    if (!record) continue;
    templates.push({ ...templateSummary(record), isMine: record.userId === auth.userId });
  }
  templates.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return json({ ok: true, templates, count: templates.length, cursor: list.cursor || null, truncated: Boolean(list.cursor) });
}
async function handleGetTemplate(url, env, auth) {
  const id = url.searchParams.get("id") || "";
  if (!id) return error("id is required", 400);
  const record = await readTemplate(env, id);
  if (!record) return error("Template not found", 404);
  return json({ ok: true, ...record, isMine: record.userId === auth.userId });
}
async function handleDeleteTemplate(url, env, auth) {
  const id = url.searchParams.get("id") || "";
  if (!id) return error("id is required", 400);
  const record = await readTemplate(env, id);
  if (!record) return error("Template not found", 404);
  assertOwner(record, auth);
  await env.VEMOTION_PROJECTS.delete(getTemplateKey(id));
  return json({ ok: true, message: "Template unpublished", templateId: id });
}
async function handleRefitComposition(request, env, auth) {
  const input = await request.json();
  const { compositionId, composition: inlineComp, targetWidth, targetHeight, mode, name } = input;
  if (compositionId && inlineComp) {
    return error("Provide exactly one of compositionId or composition, not both", 400);
  }
  if (!compositionId && !inlineComp) {
    return error("Provide exactly one of compositionId or composition", 400);
  }
  if (!Number.isFinite(Number(targetWidth)) || Number(targetWidth) <= 0) {
    return error("targetWidth must be a positive number", 400);
  }
  if (!Number.isFinite(Number(targetHeight)) || Number(targetHeight) <= 0) {
    return error("targetHeight must be a positive number", 400);
  }
  if (mode !== "fit" && mode !== "fill" && mode !== "stretch") {
    return error('mode must be "fit", "fill", or "stretch"', 400);
  }
  let composition;
  if (compositionId) {
    const record2 = await readComp(env, compositionId);
    if (!record2) return error("Composition not found", 404);
    assertOwner(record2, auth);
    composition = record2.composition;
  } else {
    if (!inlineComp || typeof inlineComp !== "object") {
      return error("composition must be an object", 400);
    }
    if (!inlineComp.width || !inlineComp.height) {
      return error("composition must include width and height", 400);
    }
    if (!Array.isArray(inlineComp.layers)) {
      return error("composition.layers must be an array", 400);
    }
    composition = inlineComp;
  }
  const refitted = refitComposition(composition, Number(targetWidth), Number(targetHeight), mode);
  if (typeof name !== "string" || !name.trim()) {
    return json({ ok: true, composition: refitted });
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const id = `comp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const trimmedName = name.trim();
  const record = {
    id,
    userId: auth.userId,
    userEmail: auth.email,
    name: trimmedName,
    composition: refitted,
    createdAt: now,
    updatedAt: now,
    version: 1
  };
  await env.VEMOTION_PROJECTS.put(getCompKey(id), JSON.stringify(record), {
    metadata: compMetadata(record)
  });
  await env.VEMOTION_PROJECTS.put(getCompVersionKey(id, record.version), JSON.stringify(record), {
    metadata: { userId: record.userId, name: record.name, updatedAt: record.updatedAt, version: record.version }
  });
  return json({ ok: true, id, summary: compSummary(record), version: record.version }, 201);
}
async function handleQueueRender(request, env, auth) {
  const input = await request.json();
  let composition = input.composition || null;
  let compName = input.name || "Render";
  if (!composition && input.compositionId) {
    const saved = await readComp(env, input.compositionId);
    if (!saved) return error("Composition not found", 404);
    assertOwner(saved, auth);
    composition = saved.composition;
    compName = saved.name;
  }
  if (!composition) return error("Provide composition or compositionId", 400);
  const jobId = `render_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const job = {
    jobId,
    userId: auth.userId,
    userEmail: auth.email,
    status: "queued",
    name: compName,
    composition,
    createdAt: now,
    updatedAt: now,
    outputUrl: null,
    error: null,
    progress: 0
  };
  await env.VEMOTION_PROJECTS.put(getRenderKey(jobId), JSON.stringify(job), {
    expirationTtl: 86400,
    // 24 h TTL on render jobs
    metadata: { userId: job.userId, status: job.status, createdAt: job.createdAt }
  });
  return json({
    ok: true,
    jobId,
    status: "queued",
    message: "Render job queued. Poll GET /vemotion/render?id=<jobId> for status."
  }, 202);
}
async function handleGetRender(url, env, auth) {
  const jobId = url.searchParams.get("id") || "";
  if (!jobId) return error("id is required", 400);
  const raw = await env.VEMOTION_PROJECTS.get(getRenderKey(jobId));
  if (!raw) return error("Render job not found", 404);
  let job;
  try {
    job = JSON.parse(raw);
  } catch {
    return error("Corrupt job record", 500);
  }
  assertOwner(job, auth);
  return json({
    ok: true,
    jobId: job.jobId,
    status: job.status,
    name: job.name,
    progress: job.progress,
    outputUrl: job.outputUrl,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  });
}
async function handleListRenders(url, env, auth) {
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 20), 1), 100);
  const cursor = url.searchParams.get("cursor") || void 0;
  const list = await env.VEMOTION_PROJECTS.list({ prefix: RENDER_PREFIX, limit, cursor });
  const jobs = [];
  for (const item of list.keys) {
    const raw = await env.VEMOTION_PROJECTS.get(item.name);
    if (!raw) continue;
    try {
      const job = JSON.parse(raw);
      if (job.userId !== auth.userId) continue;
      jobs.push({ jobId: job.jobId, status: job.status, name: job.name, progress: job.progress, outputUrl: job.outputUrl, createdAt: job.createdAt, updatedAt: job.updatedAt });
    } catch {
      continue;
    }
  }
  jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return json({ ok: true, jobs, count: jobs.length, cursor: list.cursor || null, truncated: Boolean(list.cursor) });
}
function buildAssistSystemPrompt(composition) {
  const schemaSection = [
    "You are an editing assistant for VEmotion compositions. A composition is a JSON object with this shape:",
    "",
    "  {",
    '    "duration": number (seconds),',
    '    "fps": number,',
    '    "width": number (pixels),',
    '    "height": number (pixels),',
    '    "fontFamily"?: string,',
    '    "groups"?: [{ "id": string, "name": string, "collapsed"?: bool, "visible"?: bool }],',
    '    "layers": [ Layer, ... ],',
    '    "meta"?: { "description"?: string, "tags"?: string[], "category"?: string, "metaArea"?: string }',
    "  }",
    "",
    "Layer shape:",
    "  {",
    '    "id": string,',
    '    "type": "text" | "shape" | "image" | "video" | "kg-shape" | "card" | "math-shape" | "audio" | "path",',
    '    "groupId"?: string,',
    '    "position": { "x": number, "y": number },',
    '    "size": { "width": number, "height": number },',
    '    "visible"?: boolean,',
    '    "startTime"?: number (seconds, default 0),',
    '    "layerDuration"?: number (seconds; omit for "until composition end"),',
    '    "animation"?: Animation,',
    '    "animations"?: Animation[],',
    '    "properties": { ...layer-type-specific }',
    "  }",
    "",
    "Animation shape:",
    '  { "kind"?: "layer" | "char-stagger" | "mask-wipe",',
    '    "property"?: string,             // layer property to animate (e.g. "opacity", "offsetX")',
    '    "keyframes": [{ "time": number, "value": any }],',
    '    "easing"?: "linear" | "easeInOut" | "easeIn" | "easeOut",',
    '    "stagger"?: number,              // required when kind = "char-stagger"',
    '    "direction"?: "ltr"|"rtl"|"ttb"|"btt"|"radial"  // required when kind = "mask-wipe"',
    "  }",
    "",
    "MotionScene (inside properties.motionScenes on layers that move along time-windowed paths):",
    '  { "start": number, "end": number,',
    '    "xFormula"?: string,             // returns absolute canvas X; vocab: t, p, x0, y0, w, h, sin, cos, pi',
    '    "yFormula"?: string,             // returns absolute canvas Y',
    '    "scaleFormula"?: string,         // returns scale (1 = native size); when present, overrides static scale',
    '    "pathLayerId"?: string           // sample position from a type:"path" layer over [start,end]',
    "  }",
    "",
    'For path layers, properties.anchors is [{ "x": n, "y": n, "in"?: {x,y}, "out"?: {x,y} }] where in/out are relative offsets; missing in+out = corner anchor.'
  ].join("\n");
  const rulesSection = [
    "How to respond:",
    "1. If the user is asking a question, debugging, or asking for an explanation, reply in normal prose. No JSON block.",
    '2. If the user wants a change made to the composition, reply with: a one or two sentence summary of what you changed, then a fenced JSON block containing the FULL updated composition. The JSON block MUST start with three backticks followed by "json" on its own line, and end with three backticks on its own line.',
    "3. ALWAYS return the FULL composition object inside the JSON block \u2014 not a patch, not a diff, not just the changed layers. The frontend replaces the entire textarea contents with the contents of your JSON block.",
    "4. Preserve every field on the existing composition unless the user explicitly asked to remove it. If you do not know what a field does, leave it untouched. Do not invent fields outside the schema above.",
    "5. Keep numeric units consistent: positions and sizes are pixels relative to the composition canvas (top-left origin); times are seconds.",
    "6. Layer ids must remain unique. When adding a new layer, generate a short id that does not collide with existing ids.",
    '7. If a request is ambiguous (e.g. "make it bigger" without saying which layer), ask one short clarifying question in prose instead of guessing.'
  ].join("\n");
  let currentSection = "";
  if (composition && typeof composition === "object") {
    try {
      const serialized = JSON.stringify(composition);
      currentSection = "\n\nCurrent composition (this is what the user is editing right now):\n```json\n" + JSON.stringify(composition, null, 2) + "\n```\n\nWhen you produce a fenced JSON block in your response, base it on THIS composition \u2014 copy fields you are not changing verbatim, and only modify what the user asked for. Length of the current composition serialized: " + serialized.length + " chars.";
    } catch {
      currentSection = "\n\n(Current composition was provided but could not be serialized \u2014 proceed using only what the user describes.)";
    }
  }
  return schemaSection + "\n\n" + rulesSection + currentSection;
}
async function handleAssist(request, env, auth) {
  let body;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body", 400);
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return error("messages array is required and must be non-empty", 400);
  }
  for (const m of body.messages) {
    if (!m || typeof m !== "object" || typeof m.role !== "string" || typeof m.content !== "string") {
      return error('Each message must be an object with string fields "role" and "content"', 400);
    }
    if (m.role !== "user" && m.role !== "assistant") {
      return error('Message role must be "user" or "assistant" (system message is supplied server-side)', 400);
    }
  }
  const composition = body.composition && typeof body.composition === "object" && !Array.isArray(body.composition) ? body.composition : null;
  const systemPrompt = buildAssistSystemPrompt(composition);
  try {
    const upstream = env.ANTHROPIC_WORKER ? await env.ANTHROPIC_WORKER.fetch("https://anthropic.vegvisr.org/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: systemPrompt,
        messages: body.messages
      })
    }) : await fetch("https://anthropic.vegvisr.org/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: systemPrompt,
        messages: body.messages
      })
    });
    let data = null;
    try {
      data = await upstream.json();
    } catch {
      data = null;
    }
    if (!upstream.ok) {
      const upstreamMsg = data && (data.error?.message || data.error) || "Upstream model service error";
      return json(
        { ok: false, error: typeof upstreamMsg === "string" ? upstreamMsg : "Upstream model service error", upstreamStatus: upstream.status },
        upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502
      );
    }
    const textBlocks = Array.isArray(data?.content) ? data.content.filter((b) => b && b.type === "text").map((b) => typeof b.text === "string" ? b.text : "") : [];
    const content = textBlocks.join("\n").trim();
    return json({
      ok: true,
      message: { role: "assistant", content },
      model: data?.model || "claude-sonnet-4-6",
      usage: data?.usage || null
    });
  } catch (err) {
    console.error("vemotion/assist upstream error", err);
    return error("Failed to reach upstream model service", 502);
  }
}
function buildOpenApiSpec(baseUrl) {
  const server = baseUrl ? [{ url: baseUrl }] : [{ url: "https://api.vegvisr.org/vemotion" }];
  return {
    openapi: "3.1.0",
    info: {
      title: "VEmotion Worker API",
      version: "1.0.0",
      description: "CRUD API for VEmotion compositions, projects, and render jobs. All protected endpoints require X-API-Token."
    },
    servers: server,
    components: {
      securitySchemes: {
        ApiToken: { type: "apiKey", in: "header", name: "X-API-Token" }
      },
      schemas: {
        Error: {
          type: "object",
          properties: { error: { type: "string" } }
        },
        Layer: {
          type: "object",
          required: ["id", "type", "position", "size", "properties"],
          properties: {
            id: { type: "string" },
            type: { type: "string", enum: ["text", "shape", "image", "video", "kg-shape", "card"] },
            position: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] },
            size: { type: "object", properties: { width: { type: "number" }, height: { type: "number" } }, required: ["width", "height"] },
            startTime: { type: "number", description: "Layer start time in seconds" },
            layerDuration: { type: "number", description: "Layer duration in seconds" },
            animation: {
              type: "object",
              properties: {
                property: { type: "string", enum: ["opacity", "offsetX", "offsetY"] },
                keyframes: {
                  type: "array",
                  items: { type: "object", properties: { time: { type: "number" }, value: { type: "number" } }, required: ["time", "value"] }
                }
              }
            },
            properties: { type: "object", additionalProperties: true, description: "Layer-type-specific properties. For card layers see CardProperties schema." }
          }
        },
        Composition: {
          type: "object",
          required: ["duration", "fps", "width", "height", "layers"],
          properties: {
            duration: { type: "number", description: "Total duration in seconds" },
            fps: { type: "number", description: "Frames per second" },
            width: { type: "number", description: "Canvas width in pixels" },
            height: { type: "number", description: "Canvas height in pixels" },
            fontFamily: { type: "string", description: "Composition-level default font (e.g. Inter, Poppins, Caveat). Individual layers may override via properties.fontFamily." },
            layers: { type: "array", items: { "$ref": "#/components/schemas/Layer" } },
            meta: {
              type: "object",
              description: "Optional prose metadata. Lets an author (often an AI agent) bake intent + context into the composition so a future agent reading the JSON does not need an out-of-band explanation. Preserved round-trip through save/load.",
              properties: {
                description: { type: "string", description: "One paragraph explaining what the composition depicts and animates. See AGENT_BRIEF.md \xA716." }
              }
            }
          }
        },
        CardProperties: {
          type: "object",
          description: "Properties for a card layer (type: card). Snapshotted from vemotion-cards KG graph.",
          properties: {
            title: { type: "string", description: "Card headline text" },
            body: { type: "string", description: "Card body / description text" },
            backgroundColor: { type: "string", description: "Hex background colour" },
            padding: { type: "number", description: "Inner padding in pixels (default 24)" },
            borderRadius: { type: "number", description: "Corner radius in pixels (default 12)" },
            titleFontSize: { type: "number" },
            titleColor: { type: "string" },
            titleFontWeight: { type: "string", default: "700" },
            bodyFontSize: { type: "number" },
            bodyColor: { type: "string" },
            gap: { type: "number", description: "Gap between title and body in pixels (default 12)" },
            kgNodeId: { type: "string", description: "Source node id in vemotion-cards graph" },
            kgGraphId: { type: "string", default: "vemotion-cards" }
          }
        },
        CompositionSummary: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            duration: { type: "number" },
            fps: { type: "number" },
            width: { type: "number" },
            height: { type: "number" },
            layerCount: { type: "integer" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            version: { type: "integer" },
            meta: {
              type: "object",
              description: "Inlined composition meta (description / tags / category / metaArea). Inlined here to save the portfolio client from N+1-fetching every composition individually. See AGENT_BRIEF.md \xA716.",
              properties: {
                description: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
                category: { type: "string" },
                metaArea: { type: "string" }
              }
            }
          }
        },
        TemplateSummary: {
          type: "object",
          properties: {
            templateId: { type: "string" },
            sourceCompId: { type: "string", description: "The composition this template was snapshotted from" },
            name: { type: "string" },
            authorEmail: { type: "string", nullable: true },
            authorName: { type: "string", nullable: true },
            duration: { type: "number" },
            fps: { type: "number" },
            width: { type: "number" },
            height: { type: "number" },
            layerCount: { type: "integer" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            isMine: { type: "boolean", description: "True when the authenticated caller is the template author (present in list/get responses)" },
            meta: {
              type: "object",
              description: "Inlined snapshot composition meta (description / tags / category / metaArea).",
              properties: {
                description: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
                category: { type: "string" },
                metaArea: { type: "string" }
              }
            }
          }
        },
        ProjectSummary: {
          type: "object",
          properties: {
            projectId: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            compositionId: { type: "string" },
            status: { type: "string", enum: ["draft", "published", "archived"] },
            version: { type: "integer" },
            updatedAt: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            assetCount: { type: "integer" }
          }
        },
        RenderJob: {
          type: "object",
          properties: {
            jobId: { type: "string" },
            status: { type: "string", enum: ["queued", "processing", "done", "failed"] },
            name: { type: "string" },
            progress: { type: "number", minimum: 0, maximum: 100 },
            outputUrl: { type: "string", nullable: true },
            error: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" }
          }
        }
      }
    },
    security: [{ ApiToken: [] }],
    paths: {
      "/health": {
        get: {
          operationId: "healthCheck",
          summary: "Health check",
          security: [],
          responses: {
            200: { description: "Worker is healthy", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" }, worker: { type: "string" } } } } } }
          }
        }
      },
      "/openapi.json": {
        get: {
          operationId: "getOpenApiSpec",
          summary: "OpenAPI spec for this worker",
          security: [],
          responses: { 200: { description: "OpenAPI 3.1 specification" } }
        }
      },
      // ── Compositions ──────────────────────────────────────────────────────
      "/vemotion/compositions": {
        get: {
          operationId: "listCompositions",
          summary: "List all compositions for the authenticated user",
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
            { name: "cursor", in: "query", schema: { type: "string" } }
          ],
          responses: {
            200: {
              description: "List of composition summaries",
              content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, compositions: { type: "array", items: { "$ref": "#/components/schemas/CompositionSummary" } }, count: { type: "integer" } } } } }
            }
          }
        }
      },
      "/vemotion/composition": {
        get: {
          operationId: "getComposition",
          summary: "Get a single composition by id",
          parameters: [{ name: "id", in: "query", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "Full composition record", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, id: { type: "string" }, name: { type: "string" }, composition: { "$ref": "#/components/schemas/Composition" }, version: { type: "integer" } } } } } },
            404: { description: "Not found", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } }
          }
        },
        delete: {
          operationId: "deleteComposition",
          summary: "Delete a composition",
          parameters: [{ name: "id", in: "query", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "Deleted", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, id: { type: "string" } } } } } },
            404: { description: "Not found" }
          }
        }
      },
      "/vemotion/composition/save": {
        post: {
          operationId: "saveComposition",
          summary: "Create or update a composition. If id is omitted a new one is generated.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "composition"],
                  properties: {
                    id: { type: "string", description: "Omit to create new; provide to update" },
                    name: { type: "string" },
                    composition: { "$ref": "#/components/schemas/Composition" }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: "Updated" },
            201: { description: "Created" }
          }
        }
      },
      "/vemotion/composition/refit": {
        post: {
          operationId: "refitComposition",
          summary: "Refit (reformat) a composition for a new canvas size.",
          description: "Pure transformation that scales every layer to suit a new target canvas size. Provide EXACTLY ONE of compositionId (refit a saved composition; owner check applies) or composition (refit an inline body). If name is provided, the result is saved as a NEW composition row (HTTP 201) and the source is not modified. If name is omitted, the refit composition body is returned inline (HTTP 200) with no DB write. Algorithm matches the canonical spec in the Vemotion app brief (docs/AGENT_BRIEF.md \xA712). KNOWN LIMITATION: math-shape and motionScenes formulas with hard-coded pixel constants do not auto-scale; only x0/y0/w/h references adapt.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["targetWidth", "targetHeight", "mode"],
                  properties: {
                    compositionId: { type: "string", description: "Refit a saved composition. Mutually exclusive with composition." },
                    composition: { "$ref": "#/components/schemas/Composition", description: "Refit an inline composition body. Mutually exclusive with compositionId." },
                    targetWidth: { type: "integer", minimum: 1, description: "New canvas width in pixels." },
                    targetHeight: { type: "integer", minimum: 1, description: "New canvas height in pixels." },
                    mode: { type: "string", enum: ["fit", "fill", "stretch"], description: "fit = letterbox, fill = cover (default), stretch = independent xy scale." },
                    name: { type: "string", description: "Optional. If provided, the refit composition is saved as a NEW row under this name and the response includes id+summary+version. If omitted, the composition is returned inline without persisting." }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: "Refit completed inline (no name was provided, nothing saved).",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      composition: { "$ref": "#/components/schemas/Composition" }
                    }
                  }
                }
              }
            },
            201: {
              description: "Refit completed and saved as a new composition.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      id: { type: "string" },
                      summary: { "$ref": "#/components/schemas/CompositionSummary" },
                      version: { type: "integer" }
                    }
                  }
                }
              }
            },
            400: { description: "Missing or invalid input", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } },
            403: { description: "Forbidden \u2014 compositionId belongs to a different user", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } },
            404: { description: "compositionId not found", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } }
          }
        }
      },
      "/vemotion/composition/history": {
        get: {
          operationId: "getCompositionHistory",
          summary: "List the latest 30 versions of a composition",
          parameters: [{ name: "id", in: "query", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "Composition version history" },
            404: { description: "Not found", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } }
          }
        }
      },
      "/vemotion/composition/version": {
        get: {
          operationId: "getCompositionVersion",
          summary: "Fetch the FULL composition body at a specific historical version.",
          description: "Use after /vemotion/composition/history to actually load a past version (history returns summaries only). Caller must own the composition.",
          parameters: [
            { name: "id", in: "query", required: true, schema: { type: "string" } },
            { name: "v", in: "query", required: true, schema: { type: "integer", minimum: 1 }, description: "Version number (1-based, ascending)." }
          ],
          responses: {
            200: {
              description: "Full historical composition record",
              content: { "application/json": { schema: { type: "object", properties: {
                ok: { type: "boolean" },
                id: { type: "string" },
                version: { type: "integer" },
                name: { type: "string" },
                composition: { "$ref": "#/components/schemas/Composition" },
                updatedAt: { type: "string", format: "date-time" },
                createdAt: { type: "string", format: "date-time" }
              } } } }
            },
            400: { description: "Missing or invalid params", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } },
            404: { description: "Composition or version not found", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } }
          }
        }
      },
      // ── Templates ─────────────────────────────────────────────────────────
      "/vemotion/template/publish": {
        post: {
          operationId: "publishTemplate",
          summary: "Publish a composition as a template (frozen snapshot). Re-publishing the same composition refreshes its existing template.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["compositionId"], properties: { compositionId: { type: "string", description: "Id of a composition the caller owns" }, name: { type: "string", description: "Optional display name; defaults to the composition name" } } } } }
          },
          responses: {
            201: { description: "Template published", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, templateId: { type: "string" }, summary: { "$ref": "#/components/schemas/TemplateSummary" }, republished: { type: "boolean" } } } } } },
            200: { description: "Existing template refreshed" },
            403: { description: "Caller does not own the composition" },
            404: { description: "Composition not found" }
          }
        }
      },
      "/vemotion/templates": {
        get: {
          operationId: "listTemplates",
          summary: "List all published templates (cross-user; any authenticated caller).",
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
            { name: "cursor", in: "query", schema: { type: "string" } }
          ],
          responses: {
            200: { description: "Template list", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, templates: { type: "array", items: { "$ref": "#/components/schemas/TemplateSummary" } }, count: { type: "integer" }, cursor: { type: "string", nullable: true } } } } } }
          }
        }
      },
      "/vemotion/template": {
        get: {
          operationId: "getTemplate",
          summary: "Fetch a published template by id, including the full frozen composition. Any authenticated caller.",
          parameters: [{ name: "id", in: "query", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "Full template record", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, templateId: { type: "string" }, sourceCompId: { type: "string" }, name: { type: "string" }, composition: { "$ref": "#/components/schemas/Composition" }, isMine: { type: "boolean" } } } } } },
            404: { description: "Not found", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } }
          }
        },
        delete: {
          operationId: "deleteTemplate",
          summary: "Unpublish a template (author only).",
          parameters: [{ name: "id", in: "query", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "Template unpublished" },
            403: { description: "Caller is not the template author" },
            404: { description: "Not found" }
          }
        }
      },
      // ── Projects ──────────────────────────────────────────────────────────
      "/vemotion/projects": {
        get: {
          operationId: "listProjects",
          summary: "List VEmotion projects for the authenticated user",
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
            { name: "cursor", in: "query", schema: { type: "string" } }
          ],
          responses: {
            200: { description: "Project list", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, projects: { type: "array", items: { "$ref": "#/components/schemas/ProjectSummary" } }, count: { type: "integer" } } } } } }
          }
        }
      },
      "/vemotion/project": {
        get: {
          operationId: "getProject",
          summary: "Get a single VEmotion project by id",
          parameters: [{ name: "id", in: "query", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "Full project record" },
            404: { description: "Not found" }
          }
        },
        delete: {
          operationId: "deleteProject",
          summary: "Delete a VEmotion project",
          parameters: [{ name: "id", in: "query", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "Deleted" },
            404: { description: "Not found" }
          }
        }
      },
      "/vemotion/project/create": {
        post: {
          operationId: "createProject",
          summary: "Create a new VEmotion project",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    compositionId: { type: "string" },
                    status: { type: "string", enum: ["draft", "published", "archived"] },
                    assets: { type: "array" },
                    props: { type: "object" },
                    scenes: { type: "array" },
                    notes: { type: "string" }
                  }
                }
              }
            }
          },
          responses: { 201: { description: "Created" } }
        }
      },
      "/vemotion/project/update": {
        post: {
          operationId: "updateProject",
          summary: "Update an existing VEmotion project",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["projectId"],
                  properties: {
                    projectId: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                    status: { type: "string" },
                    assets: { type: "array" },
                    props: { type: "object" },
                    scenes: { type: "array" },
                    notes: { type: "string" }
                  }
                }
              }
            }
          },
          responses: { 200: { description: "Updated" } }
        }
      },
      // ── Renders ───────────────────────────────────────────────────────────
      "/vemotion/renders": {
        get: {
          operationId: "listRenders",
          summary: "List render jobs for the authenticated user",
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
            { name: "cursor", in: "query", schema: { type: "string" } }
          ],
          responses: {
            200: { description: "Render job list", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, jobs: { type: "array", items: { "$ref": "#/components/schemas/RenderJob" } }, count: { type: "integer" } } } } } }
          }
        }
      },
      "/vemotion/render": {
        get: {
          operationId: "getRender",
          summary: "Poll a render job status",
          parameters: [{ name: "id", in: "query", required: true, schema: { type: "string" } }],
          responses: {
            200: { description: "Render job", content: { "application/json": { schema: { "$ref": "#/components/schemas/RenderJob" } } } },
            404: { description: "Not found" }
          }
        },
        post: {
          operationId: "queueRender",
          summary: "Queue a render job. Provide either an inline composition or a saved compositionId.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    compositionId: { type: "string", description: "ID of a saved composition to render" },
                    name: { type: "string", description: "Human-readable job name" },
                    composition: { "$ref": "#/components/schemas/Composition", description: "Inline composition (alternative to compositionId)" }
                  }
                }
              }
            }
          },
          responses: {
            202: { description: "Queued", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, jobId: { type: "string" }, status: { type: "string" }, message: { type: "string" } } } } } }
          }
        }
      },
      "/vemotion/assist": {
        post: {
          operationId: "assist",
          summary: "AI editing assistant for the composition JSON modal.",
          description: "Proxy to anthropic.vegvisr.org/chat with a system prompt seeded by the VEmotion composition schema. Caller passes the visible chat history in `messages` (roles: user / assistant) and the current composition in `composition`. The assistant replies in prose for questions / clarifications, or with a fenced ```json``` block containing the FULL updated composition for change requests. The frontend extracts that block and pastes it into the JSON textarea; the existing save path validates + autosaves it.",
          security: [{ ApiToken: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["messages"],
                  properties: {
                    messages: {
                      type: "array",
                      minItems: 1,
                      description: "Visible chat history. The server prepends its own system message; do not include a system role here.",
                      items: {
                        type: "object",
                        required: ["role", "content"],
                        properties: {
                          role: { type: "string", enum: ["user", "assistant"] },
                          content: { type: "string" }
                        }
                      }
                    },
                    composition: {
                      "$ref": "#/components/schemas/Composition",
                      description: "Current composition (the assistant uses this as the source of truth to copy unchanged fields from)."
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: "Assistant reply.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      message: {
                        type: "object",
                        properties: {
                          role: { type: "string", enum: ["assistant"] },
                          content: { type: "string" }
                        }
                      },
                      model: { type: "string" },
                      usage: { type: "object", additionalProperties: true }
                    }
                  }
                }
              }
            },
            400: { description: "Invalid request", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } },
            401: { description: "Missing or invalid X-API-Token", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } },
            502: { description: "Upstream model service error", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } }
          }
        }
      }
    }
  };
}
async function handleVideoUpload(request, env, auth) {
  if (!env.VEMOTION_VIDEO) return error("Video storage not configured", 500);
  const rawName = decodeURIComponent(request.headers.get("X-File-Name") || "video");
  const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^_+/, "").slice(-100) || "video";
  const contentType = request.headers.get("Content-Type") || "video/mp4";
  if (!request.body) return error("Empty request body", 400);
  const ts = Date.now();
  const key = `users/${auth.userId}/videos/${ts}-${safeName}`;
  await env.VEMOTION_VIDEO.put(key, request.body, { httpMetadata: { contentType } });
  const origin = `https://${new URL(request.url).hostname}`;
  const url = `${origin}/vemotion/video?key=${encodeURIComponent(key)}`;
  return json({ url, key, contentType });
}
async function handleVideoServe(request, env) {
  if (!env.VEMOTION_VIDEO) return error("Video storage not configured", 500);
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";
  if (!key) return error("Missing key", 400);
  const head = await env.VEMOTION_VIDEO.head(key);
  if (!head) return error("Not found", 404);
  const size = head.size;
  const contentType = head.httpMetadata?.contentType || "video/mp4";
  const baseHeaders = {
    ...corsHeaders,
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000"
  };
  if (request.method === "HEAD") {
    return new Response(null, { status: 200, headers: { ...baseHeaders, "Content-Length": String(size) } });
  }
  const rangeHeader = request.headers.get("Range");
  const m = rangeHeader && /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  if (m) {
    let start = m[1] === "" ? void 0 : parseInt(m[1], 10);
    let end = m[2] === "" ? void 0 : parseInt(m[2], 10);
    if (start === void 0 && end !== void 0) {
      start = Math.max(0, size - end);
      end = size - 1;
    } else {
      if (start === void 0) start = 0;
      if (end === void 0 || end >= size) end = size - 1;
    }
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
      return new Response("Range Not Satisfiable", {
        status: 416,
        headers: { ...corsHeaders, "Content-Range": `bytes */${size}` }
      });
    }
    const length = end - start + 1;
    const ranged = await env.VEMOTION_VIDEO.get(key, { range: { offset: start, length } });
    if (!ranged) return error("Not found", 404);
    return new Response(ranged.body, {
      status: 206,
      headers: { ...baseHeaders, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(length) }
    });
  }
  const obj = await env.VEMOTION_VIDEO.get(key);
  if (!obj) return error("Not found", 404);
  return new Response(obj.body, { status: 200, headers: { ...baseHeaders, "Content-Length": String(size) } });
}
var GEMMA_MODEL = "@cf/google/gemma-4-26b-a4b-it";
function summarizeComposition(c) {
  const layers = Array.isArray(c.layers) ? c.layers : [];
  const lines = layers.slice(0, 80).map((l) => {
    const p = l && l.properties || {};
    const bits = [l && l.type];
    if (l && typeof l.name === "string" && l.name.trim()) bits.push(`name="${l.name.trim()}"`);
    if (typeof p.text === "string" && p.text.trim()) bits.push(`text="${p.text.trim().slice(0, 80)}"`);
    else if (typeof p.name === "string" && p.name.trim()) bits.push(`asset="${p.name.trim()}"`);
    return "- " + bits.filter(Boolean).join(" ");
  });
  return [
    `Name: ${c.name || "(untitled)"}`,
    `Canvas: ${c.width}x${c.height}, ${c.fps}fps, ${c.duration}s`,
    `Layers (${layers.length}):`,
    lines.join("\n")
  ].join("\n");
}
function parseMetaJson(raw) {
  let s = String(raw || "").replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
async function handleSuggestMeta(request, env) {
  if (!env.AI) return error("AI binding not configured", 500);
  let body;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body", 400);
  }
  const composition = body.composition && typeof body.composition === "object" && !Array.isArray(body.composition) ? body.composition : null;
  if (!composition) return error("composition is required", 400);
  const system = 'You generate concise metadata for a short video composition made in a tool called Vemotion. Given the summary, respond with ONLY a JSON object (no markdown, no commentary) with keys: "description" (1-2 plain sentences describing the video), "category" (one short category, e.g. "Education", "Promo", "Design"), "tags" (array of 3-7 short lowercase tags), "metaArea" (one short theme/area label). Base everything on the summary; do not invent specifics.';
  let resp;
  try {
    resp = await env.AI.run(GEMMA_MODEL, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: summarizeComposition(composition) }
      ],
      // Gemma is a reasoning model — it spends tokens reasoning before the
      // answer, so a low cap returns empty content. Give it room.
      max_tokens: 4096
    });
  } catch (e) {
    return error("AI request failed: " + (e && e.message ? e.message : "unknown"), 502);
  }
  const choice = resp && resp.choices && resp.choices[0] && resp.choices[0].message || {};
  const raw = (choice.content || resp && resp.response || "").toString().trim();
  const parsed = parseMetaJson(raw);
  if (!parsed) return error("AI returned unparseable output", 502, { raw: String(raw).slice(0, 500) });
  return json({
    description: typeof parsed.description === "string" ? parsed.description.trim() : "",
    category: typeof parsed.category === "string" ? parsed.category.trim() : "",
    tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t) => typeof t === "string").map((t) => t.trim()).filter(Boolean) : [],
    metaArea: typeof parsed.metaArea === "string" ? parsed.metaArea.trim() : ""
  });
}
var STRUCT_LABELS = "ABCDEFGHIJ";
var STRUCT_COLORS = ["#00e5ff", "#00cce0", "#00b4c4", "#009cb0", "#0086a0", "#00707e", "#005a68"];
function structNum(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function structClampInt(v, lo, hi, d) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
}
function structIcosahedron() {
  const phi = (1 + Math.sqrt(5)) / 2, L = Math.sqrt(1 + phi * phi);
  const raw = [[0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi], [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0], [phi, 0, 1], [-phi, 0, 1], [phi, 0, -1], [-phi, 0, -1]];
  return {
    verts: raw.map(([x, y, z]) => [x / L, y / L, z / L]),
    faces: [[0, 1, 8], [0, 8, 4], [0, 4, 5], [0, 5, 9], [0, 9, 1], [1, 6, 8], [8, 6, 10], [8, 10, 4], [4, 10, 2], [4, 2, 5], [5, 2, 11], [5, 11, 9], [9, 11, 7], [9, 7, 1], [1, 7, 6], [3, 6, 7], [3, 7, 11], [3, 11, 2], [3, 2, 10], [3, 10, 6]]
  };
}
function structSubdivide(v1, v2, v3, freq) {
  const pts = {};
  for (let i = 0; i <= freq; i++) for (let j = 0; j <= freq - i; j++) {
    const k = freq - i - j;
    const x = i * v1[0] + j * v2[0] + k * v3[0], y = i * v1[1] + j * v2[1] + k * v3[1], z = i * v1[2] + j * v2[2] + k * v3[2];
    const n = Math.sqrt(x * x + y * y + z * z);
    pts[`${i},${j}`] = [x / n, y / n, z / n];
  }
  const faces = [];
  for (let i = 0; i < freq; i++) for (let j = 0; j < freq - i; j++) {
    const a = pts[`${i},${j}`], b = pts[`${i + 1},${j}`], c = pts[`${i},${j + 1}`];
    faces.push([a, b, c]);
    const d = pts[`${i + 1},${j + 1}`];
    if (d) faces.push([b, d, c]);
  }
  return faces;
}
function structRnd5(v) {
  return [Math.round(v[0] * 1e5) / 1e5, Math.round(v[1] * 1e5) / 1e5, Math.round(v[2] * 1e5) / 1e5];
}
function structEdgeKey(a, b) {
  const s1 = structRnd5(a).join(","), s2 = structRnd5(b).join(",");
  return s1 < s2 ? s1 + "|" + s2 : s2 + "|" + s1;
}
function structDist3(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}
function buildSpinningDomeComposition(params) {
  const frequency = structClampInt(params.frequency, 1, 5, 3);
  const diameterMeters = Math.max(0.5, Math.min(500, structNum(params.diameterMeters, 8)));
  const width = structClampInt(params.width, 320, 4096, 1280);
  const height = structClampInt(params.height, 320, 4096, 720);
  const fps = structClampInt(params.fps, 1, 60, 30);
  const orbitSeconds = Math.max(2, Math.min(60, structNum(params.orbitSeconds, 8)));
  const elevDeg = Math.max(5, Math.min(80, structNum(params.elevationDeg, 20)));
  const domeRadiusM = diameterMeters / 2;
  const CX = Math.round(width * 0.5);
  const CY = Math.round(height * 0.6);
  const R = Math.round(Math.min(width * 0.4, height * 0.42));
  const mmPerPx = domeRadiusM * 1e3 / R;
  const alpha = elevDeg * Math.PI / 180;
  const sinA = Math.sin(alpha), cosA = Math.cos(alpha);
  const W = 2 * Math.PI / orbitSeconds;
  const f = (n) => (Math.round(n * 1e4) / 1e4).toString();
  const { verts, faces } = structIcosahedron();
  let tris = [];
  for (const fc of faces) tris = tris.concat(structSubdivide(verts[fc[0]], verts[fc[1]], verts[fc[2]], frequency));
  const dome = tris.filter(([a, b, c]) => a[2] >= -0.02 && b[2] >= -0.02 && c[2] >= -0.02);
  const edgeMap = {};
  for (const [a, b, c] of dome) for (const [p, q] of [[a, b], [b, c], [a, c]]) {
    const k = structEdgeKey(p, q);
    if (!(k in edgeMap)) edgeMap[k] = [p, q];
  }
  const edges = Object.values(edgeMap);
  const layers = [];
  const L = (o) => layers.push(o);
  L({ id: "bg", type: "shape", position: { x: 0, y: 0 }, size: { width, height }, properties: { shape: "rect", color: "#050a16" }, startTime: 0 });
  edges.forEach(([A, B], i) => {
    const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2];
    const zN = Math.max(0, (A[2] + B[2]) / 2);
    const col = `#${Math.round(zN * 40).toString(16).padStart(2, "0")}${Math.min(255, Math.round(150 + zN * 95)).toString(16).padStart(2, "0")}f0`;
    const vx = `(${f(A[0])}+p*${f(dx)})`, vy = `(${f(A[1])}+p*${f(dy)})`, vz = `(${f(A[2])}+p*${f(dz)})`;
    L({
      id: `e-${i}`,
      type: "math-shape",
      position: { x: 0, y: 0 },
      size: { width, height },
      properties: {
        mathKind: "parametric",
        stroke: col,
        strokeWidth: 1,
        fill: null,
        samples: 2,
        tStart: 0,
        tEnd: 1,
        closePath: false,
        xFormula: `${f(CX)} + ${f(R)}*(${vx}*cos(time*${f(W)}) - ${vy}*sin(time*${f(W)}))`,
        yFormula: `${f(CY)} - ${f(R)}*((${vx}*sin(time*${f(W)}) + ${vy}*cos(time*${f(W)}))*${f(sinA)} + ${vz}*${f(cosA)})`
      },
      startTime: 0,
      animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.6, value: 0.8 }] }]
    });
  });
  L({ id: "apex", type: "shape", position: { x: CX - 5, y: Math.round(CY - R * cosA) - 5 }, size: { width: 10, height: 10 }, properties: { shape: "circle", color: "#ffffff" }, startTime: 0.4, animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.5, value: 1 }] }] });
  L({ id: "llabel", type: "text", position: { x: 30, y: Math.round(height - height * 0.1) }, size: { width: width - 60, height: 24 }, properties: { text: `GEODESIC DOME ${frequency}V \u2014 3D ORBIT \xB7 \xD8 ${Math.round(diameterMeters * 1e3)} mm \xB7 ${orbitSeconds}s/rev`, fontSize: 13, color: "#cfe8ff", fontWeight: "600", align: "left" }, startTime: 0.8, animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.6, value: 1 }] }] });
  const duration = Math.ceil(orbitSeconds + 0.5);
  const composition = { width, height, duration, fps, fontFamily: "Inter", meta: { scale: { mmPerPx: Math.round(mmPerPx * 1e4) / 1e4 } }, layers };
  const summary = { structureType: "geodesic-dome", mode: "spin", frequency, diameterMeters, orbitSeconds, triangles: dome.length, edges: edges.length, layerCount: layers.length, duration };
  return { composition, summary, defaultName: `Geodesic Dome ${frequency}V \u2014 3D Orbit ${diameterMeters}m` };
}
function buildGeodesicDomeComposition(params) {
  if (params && (params.spin === true || params.orbit === true)) return buildSpinningDomeComposition(params);
  const frequency = structClampInt(params.frequency, 1, 8, 4);
  const diameterMeters = Math.max(0.5, Math.min(500, structNum(params.diameterMeters, 8)));
  const width = structClampInt(params.width, 320, 4096, 1280);
  const height = structClampInt(params.height, 320, 4096, 720);
  const fps = structClampInt(params.fps, 1, 60, 30);
  const animationStyle = ["triangle-by-triangle", "band", "all-at-once"].includes(params.animationStyle) ? params.animationStyle : "triangle-by-triangle";
  const splitView = params.splitView !== false;
  const showDimensions = params.showDimensions !== false && splitView;
  const triDelay = Math.max(0.01, Math.min(0.5, structNum(params.triangleDelay, 0.09)));
  const domeRadiusM = diameterMeters / 2;
  const { verts, faces } = structIcosahedron();
  let allTris = [];
  for (const f of faces) allTris = allTris.concat(structSubdivide(verts[f[0]], verts[f[1]], verts[f[2]], frequency));
  const domeTris = allTris.filter(([a, b, c]) => a[2] >= -0.02 && b[2] >= -0.02 && c[2] >= -0.02);
  const edgeLenMm = {};
  for (const [a, b, c] of domeTris) for (const [p, q] of [[a, b], [b, c], [a, c]]) {
    const k = structEdgeKey(p, q);
    if (!(k in edgeLenMm)) edgeLenMm[k] = structDist3(p, q) * domeRadiusM * 1e3;
  }
  const TOL = 5;
  const rawLens = Array.from(new Set(Object.values(edgeLenMm).map((l) => Math.round(l)))).sort((x, y) => x - y);
  const clusters = [];
  for (const l of rawLens) if (!clusters.length || Math.abs(l - clusters[clusters.length - 1]) > TOL) clusters.push(l);
  const typeOf = (l) => {
    for (let i = 0; i < clusters.length; i++) if (Math.abs(l - clusters[i]) <= TOL * 2) return STRUCT_LABELS[i];
    return "?";
  };
  const edgeType = {};
  for (const k in edgeLenMm) edgeType[k] = typeOf(edgeLenMm[k]);
  const bandOf = (t) => Math.round((t[0][2] + t[1][2] + t[2][2]) / 3 * 10) / 10;
  const bands = {};
  for (const t of domeTris) {
    const b = bandOf(t);
    (bands[b] = bands[b] || []).push(t);
  }
  const bandKeys = Object.keys(bands).map(Number).sort((x, y) => x - y);
  const domeAreaW = splitView ? Math.round(width * 0.6) : width;
  const CX = splitView ? Math.round(width * 0.297) : Math.round(width * 0.5);
  const R = Math.round(Math.min(domeAreaW * 0.46, height * 0.47));
  const CY = Math.round(height * 0.82);
  const mmPerPx = domeRadiusM * 1e3 / R;
  const PX = Math.round(width * 0.615);
  const PANEL_W = width - PX - 10;
  const proj = (v) => [CX + v[0] * R, CY - v[2] * R, v[1]];
  const anchor = (v) => {
    const p = proj(v);
    return { x: Math.round(p[0] * 10) / 10, y: Math.round(p[1] * 10) / 10 };
  };
  const hex2 = (n) => n.toString(16).padStart(2, "0");
  const layers = [];
  layers.push({ id: "bg", type: "shape", position: { x: 0, y: 0 }, size: { width, height }, properties: { shape: "rect", color: "#060c17" }, startTime: 0 });
  if (splitView) {
    layers.push({ id: "panel-bg", type: "shape", position: { x: PX - 18, y: 0 }, size: { width: width - (PX - 18), height }, properties: { shape: "rect", color: "#07101f" }, startTime: 0, animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.4, value: 1 }] }] });
    layers.push({ id: "div", type: "math-shape", position: { x: PX - 20, y: 20 }, size: { width: 2, height: height - 40 }, properties: { mathKind: "parametric", stroke: "#1a3a5a", strokeWidth: 1, fill: null, samples: 2, tStart: 0, tEnd: 1, xFormula: "x0", yFormula: "y0+t*h", closePath: false }, startTime: 0, animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.5, value: 0.8 }] }] });
  }
  layers.push({ id: "dome-outline", type: "math-shape", position: { x: CX - R, y: CY - R }, size: { width: R * 2, height: R * 2 }, properties: { mathKind: "parametric", stroke: "#0e4060", strokeWidth: 1.5, fill: null, samples: 120, tStart: 0, tEnd: Math.PI, xFormula: "x0+w/2+w/2*cos(t)", yFormula: "y0+h/2+h/2*sin(t)", closePath: false }, startTime: 0, animations: [{ property: "drawProgress", keyframes: [{ time: 0, value: 0 }, { time: 1, value: 1 }], easing: "easeOut" }] });
  layers.push({ id: "ground", type: "math-shape", position: { x: CX - R - 10, y: CY }, size: { width: R * 2 + 20, height: 2 }, properties: { mathKind: "parametric", stroke: "#1a4060", strokeWidth: 1.5, fill: null, samples: 2, tStart: 0, tEnd: 1, xFormula: "x0+t*w", yFormula: "y0", closePath: false }, startTime: 0, animations: [{ property: "drawProgress", keyframes: [{ time: 0, value: 0 }, { time: 0.6, value: 1 }] }] });
  if (showDimensions) {
    layers.push({ id: "diam-line", type: "math-shape", position: { x: CX - R, y: CY + 18 }, size: { width: R * 2, height: 1 }, properties: { mathKind: "parametric", stroke: "#1a5070", strokeWidth: 1, fill: null, samples: 2, tStart: 0, tEnd: 1, xFormula: "x0+t*w", yFormula: "y0", closePath: false }, startTime: 0.2, animations: [{ property: "drawProgress", keyframes: [{ time: 0, value: 0 }, { time: 0.5, value: 1 }] }, { property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.3, value: 0.5 }] }] });
    layers.push({ id: "diam-txt", type: "text", position: { x: CX - 90, y: CY + 26 }, size: { width: 180, height: 20 }, properties: { text: `\xD8 ${Math.round(diameterMeters * 1e3)} mm`, fontSize: 11, color: "#2a6a8a", fontWeight: "400", align: "center" }, startTime: 0.5, animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.3, value: 1 }] }] });
  }
  let tCursor = 0.8;
  const bandStart = {};
  for (let bi = 0; bi < bandKeys.length; bi++) {
    const band = bandKeys[bi];
    const tris = bands[band].slice().sort((t1, t2) => Math.atan2((t1[0][0] + t1[1][0] + t1[2][0]) / 3, (t1[0][1] + t1[1][1] + t1[2][1]) / 3) - Math.atan2((t2[0][0] + t2[1][0] + t2[2][0]) / 3, (t2[0][1] + t2[1][1] + t2[2][1]) / 3));
    bandStart[band] = tCursor;
    const zNorm = band / bandKeys[bandKeys.length - 1];
    for (let ti = 0; ti < tris.length; ti++) {
      const [a, b, c] = tris[ti];
      const avgDepth = (proj(a)[2] + proj(b)[2] + proj(c)[2]) / 3;
      const isFront = avgDepth >= 0;
      const color = isFront ? `#${hex2(Math.round(zNorm * 60))}${hex2(Math.min(255, Math.round(155 + zNorm * 100)))}${hex2(Math.min(255, Math.round(185 + zNorm * 70)))}` : "#091e2e";
      let startTime;
      if (animationStyle === "all-at-once") startTime = 0.8;
      else if (animationStyle === "band") startTime = bandStart[band];
      else startTime = tCursor;
      layers.push({
        id: `tri-${bi}-${ti}`,
        type: "path",
        position: { x: 0, y: 0 },
        size: { width, height },
        properties: { anchors: [anchor(a), anchor(b), anchor(c)], strokeColor: color, strokeWidth: isFront ? 1.3 : 0.5, closed: true, showInPreview: true, showLabels: showDimensions && isFront },
        startTime: Math.round(startTime * 1e3) / 1e3,
        animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.14, value: isFront ? 0.9 : 0.2 }], easing: "easeOut" }]
      });
      if (animationStyle === "triangle-by-triangle") tCursor += triDelay;
    }
    if (animationStyle === "triangle-by-triangle") tCursor += 0.15;
    else if (animationStyle === "band") tCursor = bandStart[band] + 0.6;
  }
  const buildDone = animationStyle === "all-at-once" ? 2 : tCursor;
  if (showDimensions) {
    layers.push({ id: "pt", type: "text", position: { x: PX, y: 22 }, size: { width: PANEL_W, height: 34 }, properties: { text: "STRUT DIMENSIONS", fontSize: 17, color: "#00c8e0", fontWeight: "700", align: "left" }, startTime: 0.3, animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.4, value: 1 }] }] });
    layers.push({ id: "psub", type: "text", position: { x: PX, y: 54 }, size: { width: PANEL_W, height: 22 }, properties: { text: `${frequency}V Ico \xB7 \xD8 ${Math.round(diameterMeters * 1e3)} mm \xB7 H ${Math.round(domeRadiusM * 1e3)} mm`, fontSize: 11, color: "#2a6a7a", fontWeight: "400", align: "left" }, startTime: 0.4, animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.3, value: 1 }] }] });
    layers.push({ id: "sth", type: "text", position: { x: PX, y: 82 }, size: { width: PANEL_W, height: 20 }, properties: { text: "TYPE   LENGTH (mm)   LENGTH (m)  COUNT", fontSize: 11, color: "#1a5a70", fontWeight: "700", align: "left" }, startTime: 0.5, animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.3, value: 1 }] }] });
    for (let i = 0; i < clusters.length; i++) {
      const cnt = Object.values(edgeType).filter((t) => t === STRUCT_LABELS[i]).length;
      const rowY = 108 + i * 30, color = STRUCT_COLORS[i % STRUCT_COLORS.length];
      layers.push({ id: `st-badge-${i}`, type: "shape", position: { x: PX, y: rowY + 2 }, size: { width: 20, height: 20 }, properties: { shape: "rect", color }, startTime: 0.55 + i * 0.1, animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.2, value: 0.2 }] }] });
      layers.push({ id: `st-lbl-${i}`, type: "text", position: { x: PX + 2, y: rowY + 3 }, size: { width: 18, height: 18 }, properties: { text: STRUCT_LABELS[i], fontSize: 11, color, fontWeight: "800", align: "center" }, startTime: 0.55 + i * 0.1, animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.2, value: 1 }] }] });
      layers.push({ id: `st-val-${i}`, type: "text", position: { x: PX + 26, y: rowY + 3 }, size: { width: PANEL_W - 26, height: 20 }, properties: { text: `${String(clusters[i]).padStart(6)} mm       ${(clusters[i] / 1e3).toFixed(4)} m     ${String(cnt).padStart(3)}`, fontSize: 12, color, fontWeight: "500", align: "left" }, startTime: 0.55 + i * 0.1, animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.25, value: 1 }] }] });
    }
    const bandHdrY = 108 + clusters.length * 30 + 18;
    layers.push({ id: "bh", type: "text", position: { x: PX, y: bandHdrY }, size: { width: PANEL_W, height: 20 }, properties: { text: "BAND   HEIGHT (mm)   TRIS   TYPES", fontSize: 11, color: "#1a5a70", fontWeight: "700", align: "left" }, startTime: 0.9, animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.3, value: 1 }] }] });
    for (let bi = 0; bi < bandKeys.length; bi++) {
      const band = bandKeys[bi], tris = bands[band];
      const types = /* @__PURE__ */ new Set();
      for (const [a, b, c] of tris) for (const [p, q] of [[a, b], [b, c], [a, c]]) types.add(edgeType[structEdgeKey(p, q)]);
      const rowY = bandHdrY + 22 + bi * 22;
      const rowTxt = `  ${String(bi + 1).padStart(2)}.  ${String(Math.round(band * domeRadiusM * 1e3)).padStart(5)} mm   ${String(tris.length).padStart(3)}    ${[...types].sort().join(" ")}`;
      layers.push({ id: `brow-hl-${bi}`, type: "shape", position: { x: PX - 4, y: rowY - 2 }, size: { width: PANEL_W + 4, height: 20 }, properties: { shape: "rect", color: "#0a2535" }, startTime: Math.round(bandStart[band] * 1e3) / 1e3, animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.05, value: 0.9 }, { time: 0.5, value: 0.2 }] }] });
      layers.push({ id: `brow-${bi}`, type: "text", position: { x: PX, y: rowY }, size: { width: PANEL_W, height: 20 }, properties: { text: rowTxt, fontSize: 11, color: "#5aaabb", fontWeight: "400", align: "left" }, startTime: Math.round((bandStart[band] + 0.08) * 1e3) / 1e3, animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.15, value: 1 }] }] });
    }
  }
  layers.push({ id: "llabel", type: "text", position: { x: 30, y: Math.round(height - height * 0.14) }, size: { width: splitView ? Math.round(width * 0.55) : width - 60, height: 28 }, properties: { text: `GEODESIC DOME \u2014 ${frequency}V ICO  \xB7  \xD8 ${Math.round(diameterMeters * 1e3)} mm  \xB7  H ${Math.round(domeRadiusM * 1e3)} mm`, fontSize: 13, color: "#ffffff", fontWeight: "600", align: "left" }, startTime: Math.round(buildDone * 1e3) / 1e3, animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.5, value: 1 }] }] });
  const duration = Math.ceil(buildDone + 2);
  const composition = { width, height, duration, fps, fontFamily: "Inter", meta: { scale: { mmPerPx: Math.round(mmPerPx * 1e4) / 1e4 } }, layers };
  const summary = {
    structureType: "geodesic-dome",
    frequency,
    diameterMeters,
    triangles: domeTris.length,
    layerCount: layers.length,
    duration,
    animationStyle,
    splitView,
    strutTypes: clusters.map((cl, i) => ({ label: STRUCT_LABELS[i], mm: cl, count: Object.values(edgeType).filter((t) => t === STRUCT_LABELS[i]).length })),
    mmPerPx: Math.round(mmPerPx * 1e4) / 1e4
  };
  return { composition, summary, defaultName: `Geodesic Dome ${frequency}V \u2014 ${diameterMeters}m` };
}
function buildVastuMandalaComposition(params) {
  const gridN = structClampInt(params.gridN, 4, 9, 8);
  const sideMeters = Math.max(1, Math.min(200, structNum(params.sideMeters, 9)));
  const width = structClampInt(params.width, 320, 4096, 1280);
  const height = structClampInt(params.height, 320, 4096, 720);
  const fps = structClampInt(params.fps, 1, 60, 30);
  const showEnclosures = params.showEnclosures !== false;
  const showDiagonals = params.showDiagonals !== false;
  const showDimensions = params.showDimensions !== false;
  const splitView = params.splitView !== false;
  const GRID_NAMES = { 8: "Manduka (64 padas)", 9: "Paramasayika (81 padas)" };
  const gridName = GRID_NAMES[gridN] || `${gridN}\xD7${gridN} (${gridN * gridN} padas)`;
  const domeAreaW = splitView ? Math.round(width * 0.6) : width;
  const CX = splitView ? Math.round(width * 0.3) : Math.round(width * 0.5);
  const CY = Math.round(height * 0.52);
  const S = Math.round(Math.min(domeAreaW * 0.8, height * 0.8));
  const left = CX - S / 2, top = CY - S / 2, right = CX + S / 2, bottom = CY + S / 2;
  const pada = S / gridN;
  const sideMm = sideMeters * 1e3;
  const mmPerPx = sideMm / S;
  const padaMm = sideMm / gridN;
  const PX = Math.round(width * 0.615);
  const PANEL_W = width - PX - 10;
  const bK = gridN % 2 === 0 ? 2 : 3;
  const bStart = (gridN - bK) / 2;
  const bx0 = left + bStart * pada, by0 = top + bStart * pada;
  const bx1 = left + (bStart + bK) * pada, by1 = top + (bStart + bK) * pada;
  const layers = [];
  const L = (o) => layers.push(o);
  const line = (id, x0, y0, x1, y1, color, w, t0, dur) => L({
    id,
    type: "math-shape",
    position: { x: x0, y: y0 },
    size: { width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) },
    properties: { mathKind: "parametric", stroke: color, strokeWidth: w, fill: null, samples: 2, tStart: 0, tEnd: 1, xFormula: `x0 + t*w`, yFormula: `y0 + t*h`, closePath: false },
    startTime: Math.round(t0 * 1e3) / 1e3,
    animations: [{ property: "drawProgress", keyframes: [{ time: 0, value: 0 }, { time: dur, value: 1 }], easing: "easeOut" }]
  });
  const sq = (id, x0, y0, x1, y1, color, w, t0, op) => L({
    id,
    type: "path",
    position: { x: 0, y: 0 },
    size: { width, height },
    properties: { anchors: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], strokeColor: color, strokeWidth: w, closed: true, showInPreview: true, showLabels: false },
    startTime: Math.round(t0 * 1e3) / 1e3,
    animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.4, value: op }], easing: "easeOut" }]
  });
  L({ id: "bg", type: "shape", position: { x: 0, y: 0 }, size: { width, height }, properties: { shape: "rect", color: "#0a0710" }, startTime: 0 });
  if (splitView) {
    L({ id: "panel-bg", type: "shape", position: { x: PX - 18, y: 0 }, size: { width: width - (PX - 18), height }, properties: { shape: "rect", color: "#120a1c" }, startTime: 0, animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.4, value: 1 }] }] });
    L({ id: "div", type: "math-shape", position: { x: PX - 20, y: 20 }, size: { width: 2, height: height - 40 }, properties: { mathKind: "parametric", stroke: "#3a2a4a", strokeWidth: 1, fill: null, samples: 2, tStart: 0, tEnd: 1, xFormula: "x0", yFormula: "y0+t*h", closePath: false }, startTime: 0, animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.5, value: 0.8 }] }] });
  }
  let t = 0.4;
  for (let i = 0; i <= gridN; i++) {
    const edge = i === 0 || i === gridN;
    const col = edge ? "#c9a24b" : "#5a4a2a";
    const w = edge ? 2 : 1;
    line(`gv-${i}`, left + i * pada, top, left + i * pada, bottom, col, w, t, 0.5);
    t += 0.03;
    line(`gh-${i}`, left, top + i * pada, right, top + i * pada, col, w, t, 0.5);
    t += 0.03;
  }
  if (showDiagonals) {
    line("diag1", left, top, right, bottom, "#8a6a3a", 1, t, 0.7);
    t += 0.05;
    line("diag2", left, bottom, right, top, "#8a6a3a", 1, t, 0.7);
    t += 0.05;
  }
  const ZONE_NAMES = ["Pai\u015B\u0101cika", "M\u0101nu\u1E63a", "Daivika"];
  if (showEnclosures) {
    for (let r = 1; r < bStart; r++) {
      sq(`belt-${r}`, left + r * pada, top + r * pada, right - r * pada, bottom - r * pada, "#b06adf", 1.5, t, 0.75);
      t += 0.25;
    }
  }
  const bt = t + 0.2;
  L({ id: "brahma-fill", type: "shape", position: { x: Math.round(bx0), y: Math.round(by0) }, size: { width: Math.round(bx1 - bx0), height: Math.round(by1 - by0) }, properties: { shape: "rect", color: "#f2c14e" }, startTime: Math.round(bt * 1e3) / 1e3, animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.5, value: 0.28 }] }] });
  sq("brahma-outline", bx0, by0, bx1, by1, "#ffd76a", 2.2, bt, 1);
  L({ id: "brahma-label", type: "text", position: { x: Math.round(bx0 - 40), y: Math.round((by0 + by1) / 2 - 10) }, size: { width: Math.round(bx1 - bx0 + 80), height: 20 }, properties: { text: "GARBHAGRIHA", fontSize: 12, color: "#ffe9a8", fontWeight: "700", align: "center" }, startTime: Math.round((bt + 0.3) * 1e3) / 1e3, animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.4, value: 1 }] }] });
  if (showDimensions) {
    const card = (id, txt, x, y) => L({ id, type: "text", position: { x, y }, size: { width: 40, height: 18 }, properties: { text: txt, fontSize: 12, color: "#7a6a9a", fontWeight: "600", align: "center" }, startTime: 0.5, animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.4, value: 1 }] }] });
    card("c-n", "N", CX - 20, top - 24);
    card("c-s", "S", CX - 20, bottom + 6);
    card("c-e", "E", right + 8, CY - 9);
    card("c-w", "W", left - 30, CY - 9);
  }
  const buildDone = bt + 0.8;
  if (showDimensions && splitView) {
    const txt = (id, y, s, c, fw, str) => L({ id, type: "text", position: { x: PX, y }, size: { width: PANEL_W, height: s + 6 }, properties: { text: str, fontSize: s, color: c, fontWeight: fw, align: "left" }, startTime: 0.4, animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.4, value: 1 }] }] });
    txt("pt", 22, 17, "#d9a6ff", "700", "VASTU PURUSHA MANDALA");
    txt("psub", 50, 11, "#6a5a8a", "400", gridName);
    txt("h1", 84, 11, "#5a4a70", "700", "GRID");
    txt("r1", 104, 12, "#b89ad0", "400", `  ${gridN} \xD7 ${gridN} = ${gridN * gridN} padas`);
    txt("r2", 124, 12, "#b89ad0", "400", `  Side       ${Math.round(sideMm)} mm  (${sideMeters} m)`);
    txt("r3", 144, 12, "#b89ad0", "400", `  1 pada     ${Math.round(padaMm)} mm`);
    txt("h2", 176, 11, "#5a4a70", "700", "BRAHMASTHANA (sanctum)");
    txt("r4", 196, 12, "#f2c14e", "500", `  ${bK} \xD7 ${bK} = ${bK * bK} padas`);
    txt("r5", 216, 12, "#f2c14e", "500", `  ${Math.round(bK * padaMm)} \xD7 ${Math.round(bK * padaMm)} mm`);
    txt("h3", 248, 11, "#5a4a70", "700", "CONCENTRIC ZONES (outer \u2192 in)");
    let zy = 268;
    const zones = [];
    for (let r = 1; r < bStart; r++) zones.push(ZONE_NAMES[r - 1] || `zone ${r}`);
    zones.push("Brahma (center)");
    zones.forEach((z, i) => {
      txt(`z-${i}`, zy, 12, "#b06adf", "400", `  ${i + 1}. ${z}`);
      zy += 20;
    });
  }
  L({ id: "llabel", type: "text", position: { x: 30, y: Math.round(height - height * 0.1) }, size: { width: splitView ? Math.round(width * 0.55) : width - 60, height: 24 }, properties: { text: `VASTU PURUSHA MANDALA \u2014 ${gridName} \xB7 \xD8 ${sideMeters} m`, fontSize: 13, color: "#ffffff", fontWeight: "600", align: "left" }, startTime: Math.round(buildDone * 1e3) / 1e3, animations: [{ property: "opacity", keyframes: [{ time: 0, value: 0 }, { time: 0.5, value: 1 }] }] });
  const duration = Math.ceil(buildDone + 2);
  const composition = { width, height, duration, fps, fontFamily: "Inter", meta: { scale: { mmPerPx: Math.round(mmPerPx * 1e4) / 1e4 } }, layers };
  const summary = { structureType: "vastu-mandala", gridN, sideMeters, padas: gridN * gridN, brahmasthanaPadas: bK * bK, padaMm: Math.round(padaMm), layerCount: layers.length, duration, mmPerPx: Math.round(mmPerPx * 1e4) / 1e4 };
  return { composition, summary, defaultName: `Vastu Purusha Mandala ${gridN}\xD7${gridN} \u2014 ${sideMeters}m` };
}
var CAROUSEL_BRAND_DEFAULTS = {
  colors: {
    bg: "#FAF5E9",
    // cream page background (light slides)
    bgAlt: "#EDE2C4",
    // warm sand (pronunciation slide)
    card: "#F0E6CB",
    // sand boxes on light slides
    ink: "#2B2320",
    // near-black text on light
    body: "#4A4238",
    // softer body text on light
    accent: "#B85C2A",
    // burnt orange
    dark: "#17131F",
    // dark-slide background
    light: "#F5EFE2",
    // headline text on dark
    lightBody: "#C9C2B2",
    // body text on dark
    muted: "#8F897B"
    // byline / footers on dark
  },
  fonts: { serif: "Playfair Display", sans: "Poppins", devanagari: "Noto Sans Devanagari" },
  byline: "Tor Arne H\xE5ve",
  handle: "@tor.arne.have",
  site: "ponemer.vegvisr.org"
};
function buildCarouselComposition(params) {
  const W = 1080, H = 1350, fps = typeof params.fps === "number" ? params.fps : 30;
  const slides = Array.isArray(params.slides) ? params.slides : [];
  if (slides.length === 0) throw new Error("params.slides must be a non-empty array");
  if (slides.length > 10) throw new Error("Instagram carousels max out at 10 slides");
  const b = params.brand && typeof params.brand === "object" ? params.brand : {};
  const colors = { ...CAROUSEL_BRAND_DEFAULTS.colors, ...b.colors || {} };
  const fonts = { ...CAROUSEL_BRAND_DEFAULTS.fonts, ...b.fonts || {} };
  const byline = typeof b.byline === "string" ? b.byline : CAROUSEL_BRAND_DEFAULTS.byline;
  const handle = typeof b.handle === "string" ? b.handle : CAROUSEL_BRAND_DEFAULTS.handle;
  const site = typeof b.site === "string" ? b.site : CAROUSEL_BRAND_DEFAULTS.site;
  const layers = [];
  const win = (k) => ({ startTime: k, layerDuration: 1 });
  const text = (id, k, x, y, w, h, str, size, color, opts = {}) => layers.push({
    id: `s${k}-${id}`,
    type: "text",
    position: { x, y },
    size: { width: w, height: h },
    ...win(k),
    properties: { text: str, fontSize: size, color, shadow: false, fontWeight: "600", ...opts }
  });
  const rect = (id, k, x, y, w, h, color, opts = {}) => layers.push({
    id: `s${k}-${id}`,
    type: "shape",
    position: { x, y },
    size: { width: w, height: h },
    ...win(k),
    properties: { shape: "rect", color, ...opts }
  });
  const footer = (k, color, align = "left") => text("site", k, 90, 1230, W - 180, 50, site, 30, color, { align, fontFamily: fonts.sans, fontWeight: "500" });
  slides.forEach((s, k) => {
    const t = typeof s.template === "string" ? s.template : "statement";
    if (t === "cover" || t === "outro") {
      rect("bg", k, 0, 0, W, H, colors.dark);
      if (s.kicker) text("kicker", k, 90, 250, W - 180, 60, String(s.kicker).toUpperCase(), 34, colors.accent, { align: "center", fontFamily: fonts.sans, fontWeight: "700" });
      if (s.devanagari) text("dev", k, 90, 360, W - 180, 150, s.devanagari, 96, colors.light, { align: "center", fontFamily: fonts.devanagari });
      if (s.heading) text("title", k, 90, 530, W - 180, 240, s.heading, t === "cover" ? 120 : 92, colors.light, { align: "center", fontFamily: fonts.serif });
      if (s.body) text("body", k, 140, 790, W - 280, 240, s.body, 42, colors.lightBody, { align: "center", fontFamily: fonts.sans, fontWeight: "400" });
      text("handle", k, 90, 1060, W - 180, 64, t === "cover" ? `${byline} \xB7 ${handle}` : handle, t === "cover" ? 34 : 52, t === "cover" ? colors.muted : colors.accent, { align: "center", fontFamily: fonts.sans, fontWeight: t === "cover" ? "400" : "700" });
      text("site2", k, 90, 1140, W - 180, 54, site, t === "cover" ? 32 : 42, t === "cover" ? colors.accent : colors.light, { align: "center", fontFamily: fonts.sans, fontWeight: "500" });
    } else if (t === "statement") {
      rect("bg", k, 0, 0, W, H, colors.bg);
      if (s.kicker) text("kicker", k, 90, 130, W - 180, 55, String(s.kicker).toUpperCase(), 34, colors.accent, { fontFamily: fonts.sans, fontWeight: "700" });
      if (s.heading) text("heading", k, 90, 220, W - 180, 430, s.heading, 62, colors.ink, { fontFamily: fonts.sans, fontWeight: "700", lineHeight: 1.35 });
      if (s.body) text("body", k, 90, 690, W - 180, 380, s.body, 42, colors.body, { fontFamily: fonts.sans, fontWeight: "400", lineHeight: 1.45 });
      footer(k, colors.accent);
    } else if (t === "word-parts") {
      rect("bg", k, 0, 0, W, H, colors.bg);
      if (s.heading) text("heading", k, 90, 100, W - 180, 130, s.heading, 84, colors.ink, { fontFamily: fonts.serif });
      const items = Array.isArray(s.items) ? s.items.slice(0, 4) : [];
      items.forEach((it, i) => {
        const boxY = 290 + i * 215;
        rect(`card${i}`, k, 90, boxY, W - 180, 185, colors.card, { borderRadius: 10 });
        if (it && it.term) text(`term${i}`, k, 135, boxY + 28, W - 270, 55, it.term, 42, colors.accent, { fontFamily: fonts.sans, fontWeight: "700" });
        if (it && it.gloss) text(`gloss${i}`, k, 135, boxY + 98, W - 270, 55, it.gloss, 40, colors.ink, { fontFamily: fonts.sans, fontWeight: "400" });
      });
      if (s.body) text("body", k, 90, 290 + items.length * 215 + 10, W - 180, 130, s.body, 42, colors.ink, { fontFamily: fonts.sans, fontWeight: "400", lineHeight: 1.4 });
      footer(k, colors.accent);
    } else if (t === "pronunciation") {
      rect("bg", k, 0, 0, W, H, colors.bgAlt);
      if (s.devanagari) text("dev", k, 90, 300, W - 180, 280, s.devanagari, 170, colors.ink, { align: "center", fontFamily: fonts.devanagari, fontWeight: "700" });
      if (s.latin) text("latin", k, 90, 640, W - 180, 90, s.latin, 64, colors.accent, { align: "center", fontFamily: fonts.sans, fontWeight: "600" });
      if (s.phonetic) text("phon", k, 90, 770, W - 180, 66, s.phonetic, 46, colors.ink, { align: "center", fontFamily: fonts.sans, fontWeight: "500" });
      if (s.note) text("note", k, 140, 870, W - 280, 60, s.note, 32, colors.body, { align: "center", fontFamily: fonts.sans, fontWeight: "400" });
      footer(k, colors.accent, "center");
    } else if (t === "ritual") {
      rect("bg", k, 0, 0, W, H, colors.dark);
      if (s.heading) text("heading", k, 90, 250, W - 180, 320, s.heading, 96, colors.light, { fontFamily: fonts.serif, lineHeight: 1.3 });
      if (s.body) text("body", k, 90, 640, W - 180, 320, s.body, 44, colors.lightBody, { fontFamily: fonts.sans, fontWeight: "400", lineHeight: 1.45 });
      if (s.note) text("note", k, 90, 990, W - 180, 170, s.note, 36, colors.accent, { fontFamily: fonts.sans, fontWeight: "400", lineHeight: 1.4 });
      footer(k, colors.muted);
    } else {
      throw new Error(`Unknown slide template "${t}". Known: cover, statement, word-parts, pronunciation, ritual, outro`);
    }
  });
  const fileBase = String(params.name || "carousel").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "carousel";
  const composition = {
    width: W,
    height: H,
    duration: slides.length,
    fps,
    fontFamily: fonts.sans,
    meta: {
      description: typeof params.description === "string" ? params.description : `Instagram carousel (${slides.length} slides). Each slide = one second; export via "Export slides (PNG set)" in the editor.`,
      category: "Carousels",
      carousel: { slideTimes: slides.map((_, k) => k + 0.5), fileBase }
    },
    layers
  };
  const summary = {
    structureType: "carousel",
    slides: slides.length,
    templates: slides.map((s) => s.template || "statement"),
    width: W,
    height: H,
    layerCount: layers.length,
    slideTimes: composition.meta.carousel.slideTimes
  };
  return { composition, summary, defaultName: typeof params.name === "string" && params.name.trim() ? params.name.trim() : `Instagram carousel (${slides.length} slides)` };
}
var STRUCTURE_GENERATORS = {
  "geodesic-dome": buildGeodesicDomeComposition,
  "vastu-mandala": buildVastuMandalaComposition,
  "carousel": buildCarouselComposition
};
async function handleGenerateStructure(request, env, auth) {
  let body;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body", 400);
  }
  const structureType = typeof body.structureType === "string" && body.structureType.trim() ? body.structureType.trim() : "geodesic-dome";
  const generator = STRUCTURE_GENERATORS[structureType];
  if (!generator) return error(`Unknown structureType "${structureType}". Known: ${Object.keys(STRUCTURE_GENERATORS).join(", ")}`, 400);
  let built;
  try {
    built = generator(body.params && typeof body.params === "object" && !Array.isArray(body.params) ? body.params : {});
  } catch (e) {
    return error("Generator failed: " + (e && e.message ? e.message : "unknown"), 500);
  }
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : built.defaultName;
  const savePayload = { name, composition: built.composition };
  if (typeof body.compositionId === "string" && body.compositionId.trim()) savePayload.id = body.compositionId.trim();
  const saveReq = new Request("https://vemotion-worker/vemotion/composition/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(savePayload)
  });
  const saveRes = await handleSaveComposition(saveReq, env, auth);
  let saved;
  try {
    saved = await saveRes.json();
  } catch {
    return error("Save failed", 502);
  }
  if (!saved || !saved.ok) return json(saved || { ok: false, error: "Save failed" }, saveRes.status || 500);
  return json({
    ok: true,
    id: saved.id,
    editorUrl: `https://vemotion.vegvisr.org/?compositionId=${saved.id}`,
    structureType,
    version: saved.version,
    summary: built.summary
  }, saveRes.status);
}
var index_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    try {
      const url = new URL(request.url);
      const { pathname, method } = { pathname: url.pathname, method: request.method };
      if ((pathname === "/vemotion/health" || pathname === "/health") && method === "GET") {
        return json({
          status: "healthy",
          worker: "vemotion-worker",
          version: "1.0.0",
          bindings: { kv: !!env.VEMOTION_PROJECTS, r2assets: !!env.VEMOTION_ASSETS, r2renders: !!env.VEMOTION_RENDERS, r2video: !!env.VEMOTION_VIDEO, ai: !!env.AI, d1: !!env.vegvisr_org }
        });
      }
      if ((pathname === "/vemotion/openapi.json" || pathname === "/openapi.json") && method === "GET") {
        const origin = request.headers.get("origin") || `https://${new URL(request.url).hostname}`;
        return json(buildOpenApiSpec(origin));
      }
      if (pathname === "/vemotion/video" && (method === "GET" || method === "HEAD"))
        return await handleVideoServe(request, env);
      const auth = await validateAuth(request, env);
      if (!auth.valid) return error(auth.error || "Unauthorized", 401);
      if (pathname === "/vemotion/compositions" && method === "GET")
        return await handleListCompositions(url, env, auth);
      if (pathname === "/vemotion/composition" && method === "GET")
        return await handleGetComposition(url, env, auth);
      if (pathname === "/vemotion/composition/history" && method === "GET")
        return await handleGetCompositionHistory(url, env, auth);
      if (pathname === "/vemotion/composition/version" && method === "GET")
        return await handleGetCompositionVersion(url, env, auth);
      if (pathname === "/vemotion/composition/save" && method === "POST")
        return await handleSaveComposition(request, env, auth);
      if (pathname === "/vemotion/composition/refit" && method === "POST")
        return await handleRefitComposition(request, env, auth);
      if (pathname === "/vemotion/composition" && method === "DELETE")
        return await handleDeleteComposition(url, env, auth);
      if (pathname === "/vemotion/generate/structure" && method === "POST")
        return await handleGenerateStructure(request, env, auth);
      if (pathname === "/vemotion/template/publish" && method === "POST")
        return await handlePublishTemplate(request, env, auth);
      if (pathname === "/vemotion/templates" && method === "GET")
        return await handleListTemplates(url, env, auth);
      if (pathname === "/vemotion/template" && method === "GET")
        return await handleGetTemplate(url, env, auth);
      if (pathname === "/vemotion/template" && method === "DELETE")
        return await handleDeleteTemplate(url, env, auth);
      if (pathname === "/vemotion/projects" && method === "GET")
        return await handleListProjects(url, env, auth);
      if (pathname === "/vemotion/project" && method === "GET")
        return await handleGetProject(url, env, auth);
      if (pathname === "/vemotion/project" && method === "DELETE")
        return await handleDeleteProject(url, env, auth);
      if (pathname === "/vemotion/project/create" && method === "POST")
        return await handleCreateProject(request, env, auth);
      if (pathname === "/vemotion/project/update" && method === "POST")
        return await handleUpdateProject(request, env, auth);
      if (pathname === "/vemotion/renders" && method === "GET")
        return await handleListRenders(url, env, auth);
      if (pathname === "/vemotion/render" && method === "GET")
        return await handleGetRender(url, env, auth);
      if (pathname === "/vemotion/render" && method === "POST")
        return await handleQueueRender(request, env, auth);
      if (pathname === "/vemotion/video/upload" && method === "POST")
        return await handleVideoUpload(request, env, auth);
      if (pathname === "/vemotion/image-prompt" && method === "POST")
        return await handleSaveImagePrompt(request, env, auth);
      if (pathname === "/vemotion/image-prompts" && method === "GET")
        return await handleListImagePrompts(url, env, auth);
      if (pathname === "/vemotion/image-prompt" && method === "DELETE")
        return await handleDeleteImagePrompt(url, env, auth);
      if (pathname === "/vemotion/suggest-meta" && method === "POST")
        return await handleSuggestMeta(request, env);
      if (pathname === "/vemotion/assist" && method === "POST")
        return await handleAssist(request, env, auth);
      return error("Not found", 404, { pathname });
    } catch (err) {
      console.error("vemotion-worker error", err);
      return error(err.message || "Internal server error", err.status || 500);
    }
  }
};
export {
  index_default as default
};
