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
 *
 * Anything else has no worker here (gemini-worker speaks a third format, not wired yet) and is
 * refused with a message that says so, instead of being sent to a provider that cannot know it.
 *
 * Every provider's answer is folded to ONE shape — { ok, text, usage: { input_tokens,
 * output_tokens }, stopReason } with stopReason "max_tokens" when the answer was cut off — so the
 * engine's cut-off check and cost cap in compile.js work the same for all of them.
 */

export const PROVIDERS = {
  anthropic: { binding: 'ANTHROPIC', url: 'https://anthropic-worker/chat', format: 'anthropic' },
  grok: { binding: 'GROK', url: 'https://grok-worker/chat', format: 'openai' },
  openai: { binding: 'OPENAI', url: 'https://openai-worker/chat', format: 'openai' },
}

/** 'anthropic' | 'grok' | 'openai' | null (no worker for this model name). */
export function providerFor(model) {
  const m = String(model || '').trim()
  if (/^claude/i.test(m)) return 'anthropic'
  if (/^grok/i.test(m)) return 'grok'
  if (/^(gpt|o\d)/i.test(m)) return 'openai'
  return null
}

/** The JSON body the provider's /chat takes for one system + one user message. */
export function buildModelRequest(provider, { model, system, user, maxTokens }) {
  if (PROVIDERS[provider]?.format === 'anthropic') {
    return { model, system, max_tokens: maxTokens, messages: [{ role: 'user', content: user }] }
  }
  const messages = [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: user }]
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
export async function askModel(env, { model, system, user, maxTokens }) {
  const provider = providerFor(model)
  if (!provider) {
    return { ok: false, error: `no model worker for "${model}" — the flow engine reaches claude…, grok… and gpt…/o… models` }
  }
  const p = PROVIDERS[provider]
  const svc = env?.[p.binding]
  if (!svc?.fetch) {
    return { ok: false, error: `no connection to the ${provider} worker (service binding ${p.binding} is missing on flows-worker)` }
  }
  try {
    const res = await svc.fetch(p.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildModelRequest(provider, { model, system, user, maxTokens })),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(data.error || data).slice(0, 300)}` }
    return parseModelResponse(provider, data, maxTokens)
  } catch (e) {
    return { ok: false, error: `could not reach the model: ${e.message}` }
  }
}

/** True when at least one model worker is bound — otherwise agent steps cannot run at all. */
export function hasModelConnection(env) {
  return Object.values(PROVIDERS).some((p) => typeof env?.[p.binding]?.fetch === 'function')
}
