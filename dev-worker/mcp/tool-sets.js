/**
 * tool-sets.js — which tools a connection is OFFERED.
 *
 * WHY (owner decision 2026-11-19): every connection used to be shown all 142 tools, whatever it
 * had been granted. A person who connects to work with graphs was handed SMS, e-mail, video,
 * meeting rooms and contacts as well, and found out which ones were not hers only when the
 * assistant tried one and was refused. Two things fix that, and both are decided here.
 *
 *   1. PERMISSION. A tool is offered only when the connection holds every scope the tool needs.
 *      The scope is read from the tool's own description — "Requires the graph:write scope." —
 *      which every tool already states, and which test/tool-sets.test.mjs checks against what the
 *      tool actually refuses with. One sentence, read by people and by this file: there is no
 *      second table to drift.
 *
 *   2. TOOL SET. On the "Give access" page a person chooses "Starter" or "Everything". Starter is
 *      the fixed list below: graphs, nodes, node types, images and albums — what the editor and
 *      Garnet are about. The choice is stored on the grant (props.toolSet), beside the identity,
 *      so no tool argument can change it. To get more later, connect again and choose Everything —
 *      the same way a new permission box works.
 *
 * A tool that is not offered is not registered for that request at all: it is absent from
 * tools/list AND a call to it by name finds nothing. A list that only hid tools would be a
 * suggestion, not a limit.
 *
 * NOT A SCOPE. The scope vocabulary is frozen (oauth/scopes.js): a new scope string makes every
 * connected person authorize again. A tool set narrows what a grant shows; it grants nothing, so
 * it needs no scope and costs nobody a re-authorization. A grant made before today carries no
 * toolSet and is treated as Everything.
 *
 * No Workers-only imports, so it runs under plain Node tests.
 */

export const TOOL_SETS = ['starter', 'all']

/**
 * The Starter set, approved by the owner 2026-11-19 ("graph work, node work, the editor and
 * Garnet", then: "albums and images — important to have").
 *
 * Adding a NEW tool to the server does not add it here: a starter list that grows by itself is
 * not a starter list. Add it on purpose, in the group it belongs to.
 */
export const STARTER_TOOLS = [
  // Find and read graphs
  'list_my_graphs', 'search_graphs', 'search_text', 'graph_index', 'list_meta_areas',
  'get_graph', 'get_graph_links', 'get_graph_history', 'get_graph_version', 'search', 'fetch',
  // Make and change graphs
  'create_graph', 'update_graph_metadata', 'add_node', 'add_nodes', 'update_node', 'reorder_nodes',
  'add_edge', 'remove_edge', 'remove_node',
  // Node types
  'list_node_types', 'get_node_types', 'get_fulltext_elements', 'register_node_type',
  'set_node_type_renderer', 'approve_node_type_renderer',
  // Worlds and sharing
  'move_graph_to_world', 'share_graph_with_world', 'unshare_graph_from_world', 'list_graph_shares',
  // Delete and restore (delete_graph still needs the graph:delete box)
  'delete_graph', 'list_deleted_graphs', 'restore_graph',
  // Images and albums
  'album_list', 'get_album_images', 'search_album_images', 'tag_album_images',
  'photos_upload_from_url', 'create_node_upload', 'search_unsplash', 'search_pexels',
  'get_image_guide', 'generate_image', 'generate_image_openai', 'generate_node_image',
  'compose_node_image',
]

const STARTER = new Set(STARTER_TOOLS)

/**
 * The scopes a tool's description says it needs.
 * "Requires the graph:read scope."                         → ['graph:read']
 * "Requires the contacts:read and chat:read scopes."       → ['contacts:read', 'chat:read']
 * "Requires the user:read scope and the Superadmin role."  → ['user:read']
 * Nothing stated → [] — and the test refuses to let a tool ship like that.
 */
export function scopesNamedBy(description) {
  const m = String(description || '').match(/Requires the ((?:[a-z]+:[a-z]+)(?:(?:, | and | or )[a-z]+:[a-z]+)*) scopes?\b/)
  return m ? m[1].split(/, | and | or /) : []
}

/** The tool set of a grant. Anything but an exact 'starter' is Everything, old grants included. */
export function toolSetOf(props) {
  return props?.toolSet === 'starter' ? 'starter' : 'all'
}

/** What the "Give access" form sent → a tool set. Unknown or missing is Everything. */
export function sanitizeToolSet(picked) {
  return String(picked || '') === 'starter' ? 'starter' : 'all'
}

/** Is this tool offered to a connection with these scopes and this tool set? */
export function toolIsOffered(name, description, { scopes = [], toolSet = 'all' } = {}) {
  if (toolSet === 'starter' && !STARTER.has(name)) return false
  const held = new Set(Array.isArray(scopes) ? scopes : [])
  return scopesNamedBy(description).every((s) => held.has(s))
}

/**
 * A stand-in for the McpServer that registerTools() writes to: it passes on the tools this
 * connection is offered and drops the rest. Only registerTool is needed — it is the one method
 * the tool files call.
 */
export function offeredToolsOnly(server, { scopes = [], toolSet = 'all' } = {}) {
  return {
    registerTool(name, config, handler) {
      if (!toolIsOffered(name, config?.description, { scopes, toolSet })) return undefined
      return server.registerTool(name, config, handler)
    },
  }
}
