/**
 * Which worker answers an agent step, by the model's name — and how to ask it and read its answer.
 *
 * Until 2026-11-16 every agent step went to anthropic-worker, while compileFlow already accepted
 * model ids starting with gpt, o1…, gemini and grok. A flow with "grok-4" compiled and then failed
 * at Anthropic with an unknown-model error. Now the name picks the worker:
 *
 *   claude…            → anthropic-worker   (binding ANTHROPIC)  Anthropic message format
 *   grok…              → grok-worker        (binding GROK)       OpenAI chat format
 *   gpt…, o1…, o3… …   → openai-worker      (binding OPENAI)     OpenAI chat format
 *   gemini…            → gemini-worker      (binding GEMINI)     OpenAI chat format (its /chat)
 *   kimi…              → Cloudflare's model catalog (binding AI) OpenAI chat format
 *
 * Gemini and Kimi (2026-11-16) are reached the way Agent-Builder reaches them (worker/chat-providers.js):
 *   - gemini-worker answers with the USER's own Gemini key, so the flow owner's user id is sent.
 *     The engine knows the owner by e-mail; the id is read from config in D1 (binding DB).
 *   - Kimi is a third-party model in Cloudflare's catalog: env.AI.run("moonshotai/<model>", …)
 *     through an AI Gateway (AI_GATEWAY_ID, else "default"), paid from the account's prepaid
 *     credits. No Moonshot key. Only the model's own fields are sent: the gateway rejects others.
 *
 * A model id may carry the prefix Agent-Builder's model panel uses ("kimi/kimi-k3.1-pro",
 * "gemini/gemini-2.5-flash", "grok/…", "openai/…"); the prefix is cut before the model is asked.
 *
 * Anything else has no worker here and is refused with a message that says so, instead of being
 * sent to a provider that cannot know it.
 *
 * Every provider's answer is folded to ONE shape — { ok, text, usage: { input_tokens,
 * output_tokens }, stopReason } with stopReason "max_tokens" when the answer was cut off — so the
 * engine's cut-off check and cost cap in compile.js work the same for all of them.
 */

export const PROVIDERS = {
  anthropic: { binding: 'ANTHROPIC', url: 'https://anthropic-worker/chat', format: 'anthropic' },
  grok: { binding: 'GROK', url: 'https://grok-worker/chat', format: 'openai' },
  openai: { binding: 'OPENAI', url: 'https://openai-worker/chat', format: 'openai' },
  gemini: { binding: 'GEMINI', url: 'https://gemini-worker/chat', format: 'openai', ownerKey: true },
  kimi: { binding: 'AI', catalogAuthor: 'moonshotai', format: 'openai' },
}

/** The model families the engine reaches, for messages. */
export const MODEL_FAMILIES = 'claude…, grok…, gpt…/o…, gemini…, kimi…'

/** The model id without the prefix Agent-Builder's model panel puts before it. */
export function modelId(model) {
  return String(model || '').trim().replace(/^(openai|grok|gemini|kimi|moonshotai)\//i, '')
}

/** 'anthropic' | 'grok' | 'openai' | 'gemini' | 'kimi' | null (no worker for this model name). */
export function providerFor(model) {
  const m = modelId(model)
  if (/^claude/i.test(m)) return 'anthropic'
  if (/^grok/i.test(m)) return 'grok'
  if (/^(gpt|o\d)/i.test(m)) return 'openai'
  if (/^gemini/i.test(m)) return 'gemini'
  if (/^kimi/i.test(m)) return 'kimi'
  return null
}

/**
 * The JSON body the provider takes for one system + one user message. gemini-worker also takes
 * the owner's user id (whose Gemini key answers); Kimi takes no model field — the catalog id is
 * the first argument of env.AI.run — and nothing beside the model's own fields.
 */
export function buildModelRequest(provider, { model, system, user, maxTokens, userId }) {
  if (PROVIDERS[provider]?.format === 'anthropic') {
    return { model, system, max_tokens: maxTokens, messages: [{ role: 'user', content: user }] }
  }
  const messages = [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: user }]
  if (provider === 'kimi') return { messages, max_tokens: maxTokens }
  if (provider === 'gemini') return { userId, model, messages, max_tokens: maxTokens }
  // openai-worker forwards max_completion_tokens (what current GPT models take); grok-worker takes max_tokens.
  return provider === 'openai'
    ? { model, messages, max_completion_tokens: maxTokens }
    : { model, messages, max_tokens: maxTokens }
}

/**
 * Fold a provider's 200 answer to { ok, text, usage, stopReason }. An answer without text is a
 * failure that says WHY as far as the answer shows it — the stop reason, and what the answer held
 * instead of text. "the model returned no text" alone cost three live runs on 2026-11-16: the
 * model had spent its whole max_tokens before writing a word, and nothing said so.
 */
export function parseModelResponse(provider, data, maxTokens = null) {
  const d = data && typeof data === 'object' ? data : {}
  let text = ''
  let stopReason = null
  let usage = null
  let held = []

  if (PROVIDERS[provider]?.format === 'anthropic') {
    const content = Array.isArray(d.content) ? d.content : []
    text = content.filter((c) => c?.type === 'text').map((c) => c.text).join('\n').trim()
    held = [...new Set(content.map((c) => c?.type).filter(Boolean))]
    stopReason = d.stop_reason || null
    usage = d.usage || null
  } else {
    const choice = Array.isArray(d.choices) ? d.choices[0] : null
    const c = choice?.message?.content
    text = (typeof c === 'string' ? c : Array.isArray(c) ? c.map((p) => p?.text || '').join('\n') : '').trim()
    if (choice?.message?.tool_calls?.length) held.push('tool_calls')
    if (choice?.message?.refusal) held.push('refusal')
    // Kimi always reasons; an answer can hold its reasoning and no text when the budget ran out.
    if (choice?.message?.reasoning_content) held.push('reasoning')
    const fr = choice?.finish_reason || null
    stopReason = fr === 'length' ? 'max_tokens' : fr
    usage = d.usage
      ? { input_tokens: Number(d.usage.prompt_tokens || 0), output_tokens: Number(d.usage.completion_tokens || 0) }
      : null
  }

  if (text) return { ok: true, text, usage, stopReason }

  const why = []
  if (stopReason) why.push(`stop reason ${stopReason}`)
  if (usage?.output_tokens != null) why.push(`${usage.output_tokens} tokens out${maxTokens ? ` of maxTokens ${maxTokens}` : ''}`)
  if (held.length) why.push(`the answer held only: ${held.join(', ')}`)
  const hint = stopReason === 'max_tokens'
    ? ' — the model used up maxTokens before writing its answer; raise metadata.maxTokens on this step'
    : ''
  return {
    ok: false,
    error: `the model returned no text${why.length ? ` (${why.join('; ')})` : ''}${hint}`,
    usage,
    stopReason,
  }
}

/**
 * Ask one model. `env` holds the service bindings; returns { ok, text, usage, stopReason } or
 * { ok: false, error }. Never throws.
 */
export async function askModel(env, { model, system, user, maxTokens, ownerEmail }) {
  const provider = providerFor(model)
  if (!provider) {
    return { ok: false, error: `no model worker for "${model}" — the flow engine reaches ${MODEL_FAMILIES} models` }
  }
  const p = PROVIDERS[provider]
  const id = modelId(model)

  // Kimi: Cloudflare's model catalog through the AI binding, not a worker of ours.
  if (p.catalogAuthor) {
    const ai = env?.AI
    if (typeof ai?.run !== 'function') {
      return { ok: false, error: `no connection to Cloudflare's model catalog (the Workers AI binding AI is missing on flows-worker)` }
    }
    const catalogId = `${p.catalogAuthor}/${id}`
    try {
      const data = await ai.run(
        catalogId,
        buildModelRequest(provider, { system, user, maxTokens }),
        { gateway: { id: env.AI_GATEWAY_ID || 'default' } },
      )
      if (!data || typeof data !== 'object' || !Array.isArray(data.choices)) {
        return { ok: false, error: `${catalogId} answered in an unexpected format: ${JSON.stringify(data ?? null).slice(0, 300)}` }
      }
      return parseModelResponse(provider, data, maxTokens)
    } catch (e) {
      return { ok: false, error: `could not reach the model (Cloudflare model catalog, ${catalogId}): ${e?.message || e}` }
    }
  }

  const svc = env?.[p.binding]
  if (!svc?.fetch) {
    return { ok: false, error: `no connection to the ${provider} worker (service binding ${p.binding} is missing on flows-worker)` }
  }
  // Gemini answers with the flow owner's own key: the owner's user id goes with the question.
  let userId
  if (p.ownerKey) {
    const found = await ownerUserId(env, ownerEmail)
    if (!found.ok) return { ok: false, error: found.error }
    userId = found.userId
  }
  try {
    const res = await svc.fetch(p.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildModelRequest(provider, { model: id, system, user, maxTokens, userId })),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(data.error || data).slice(0, 300)}` }
    return parseModelResponse(provider, data, maxTokens)
  } catch (e) {
    return { ok: false, error: `could not reach the model: ${e.message}` }
  }
}

/**
 * The flow owner's user id (config.user_id in D1), which gemini-worker needs to find the owner's
 * own Gemini key. { ok, userId } or { ok: false, error } — never throws, never guesses an id.
 */
export async function ownerUserId(env, ownerEmail) {
  const email = String(ownerEmail || '').trim().toLowerCase()
  if (!email) return { ok: false, error: 'a gemini model answers with the flow owner\'s own Gemini key, and this run has no owner e-mail' }
  if (!env?.DB?.prepare) return { ok: false, error: 'a gemini model needs the owner\'s user id, and the database binding DB is missing on flows-worker' }
  try {
    const row = await env.DB.prepare('SELECT user_id FROM config WHERE LOWER(email) = ?1 LIMIT 1').bind(email).first()
    if (!row?.user_id) return { ok: false, error: `a gemini model answers with the flow owner's own Gemini key, and no user was found for ${email}` }
    return { ok: true, userId: String(row.user_id) }
  } catch (e) {
    return { ok: false, error: `could not read the flow owner's user id: ${e?.message || e}` }
  }
}

/** True when at least one model connection is bound — otherwise agent steps cannot run at all. */
export function hasModelConnection(env) {
  return Object.values(PROVIDERS).some((p) => {
    const b = env?.[p.binding]
    return p.catalogAuthor ? typeof b?.run === 'function' : typeof b?.fetch === 'function'
  })
}
