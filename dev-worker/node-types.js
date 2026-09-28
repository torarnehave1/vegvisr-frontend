/**
 * node-types.js — the node types this system can actually display.
 *
 * ONE list, two consumers: the openapi.json Node.type enum in index.js, and the MCP tool schema
 * in mcp/tools.js. It exists because there used to be neither — the spec carried a hand-copied
 * five-value list, the MCP schema carried a different hand-copied list, and neither contained
 * html-node. A model building an HTML page found nothing that fit and coined "html", which has
 * no renderer and displays as raw text. ChatGPT and Grok both did it, for the same reason.
 *
 * DERIVED FROM the nodeComponents map in src/components/GNewNodeRenderer.vue — the thing that
 * actually decides whether a type displays. A documented list only claims to. When the two
 * disagree the renderer is the truth, so this tracks the renderer.
 *
 * Regenerate when a renderer is added; do not hand-edit an entry in.
 * 'default' is excluded on purpose: the viewer treats it as "no type" and suppresses its badge.
 * image / link / video are kept although they have no renderer of their own — they predate this
 * list, are in use, and removing published contract values would be a breaking change.
 */

export const NODE_TYPES = [
  'REG', 'action_test', 'advertisement_manager', 'agent-config', 'agent-contract',
  'agent-run', 'app-viewer', 'audio', 'audio-portfolio-selector', 'audio-transcription',
  'background', 'bubblechart', 'button_row', 'chart', 'cloudflare-live', 'cloudflare-video',
  'company-card', 'component', 'css-node', 'data-node', 'email-brand', 'email-manager',
  'email-template', 'fulltext', 'guide-node', 'html-node', 'image', 'image-analysis',
  'imagequote', 'info', 'instagram-post', 'json-node', 'layout', 'learn-script', 'linechart',
  'link', 'map', 'markdown-image', 'menu', 'menu_creator', 'mermaid-diagram', 'network',
  'news-feed', 'password-protection', 'person-network-canvas', 'person-profile', 'piechart',
  'portfolio-image', 'realtime-video', 'slideshow', 'stripe-button', 'subscription', 'swot',
  'timeline', 'title', 'video', 'worknote', 'youtube-live', 'youtube-video'
]

const KNOWN = new Set(NODE_TYPES)

/** The type used when a caller supplies none. */
export const DEFAULT_NODE_TYPE = 'fulltext'

export function isKnownNodeType(type) {
  return KNOWN.has(String(type || ''))
}

/**
 * The type someone probably meant.
 *
 * Every wrong type seen in production is a near miss, not a wild guess: "html" for "html-node",
 * "fulltext-node" for "fulltext", "action_txt" for "action_test". So an error that just says
 * "invalid" wastes a round trip; one that names the intended type ends the problem.
 */
export function suggestNodeType(wrong) {
  const w = String(wrong || '').toLowerCase().trim()
  if (!w) return null
  if (KNOWN.has(w)) return w

  // A missing or spurious -node suffix covers the two real cases.
  for (const candidate of [`${w}-node`, w.replace(/-node$/, '')]) {
    if (KNOWN.has(candidate)) return candidate
  }
  // Then a cheap edit-distance-ish check: same start, close length (action_txt -> action_test).
  let best = null
  for (const t of NODE_TYPES) {
    if (Math.abs(t.length - w.length) > 3) continue
    const stem = w.slice(0, Math.min(5, w.length))
    if (stem.length >= 4 && t.startsWith(stem)) {
      if (!best || Math.abs(t.length - w.length) < Math.abs(best.length - w.length)) best = t
    }
  }
  return best
}
