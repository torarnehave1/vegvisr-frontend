/**
 * Every name this worker calls must exist.
 * Run: node --test dev-worker/test/no-undef.test.mjs
 *
 * WHY THIS IS A TEST AND NOT A STYLE PREFERENCE
 * --------------------------------------------
 * `expiredPage()` was called from two places in oauth/authorize.js and never written. Both call
 * sites sit behind `if (!tx)` — the transaction is missing or spent — which is not a path anyone
 * walks through when reading the flow, so it survived review and threw a ReferenceError in
 * production instead. It reached a user twice on 2026-09-30, once as Cloudflare's raw Error 1101
 * and once, after the error boundary landed, as a page saying the connection had failed. The
 * grant had actually succeeded; only the second submit hit the missing function.
 *
 * A unit test could not have caught it: these modules import `cloudflare:` builtins and will not
 * load outside the Workers runtime, which is exactly why so little of this directory is covered.
 * `no-undef` needs no runtime. It parses, resolves every identifier against the file's own
 * declarations, its imports and the declared globals, and fails on anything left over — which is
 * the entire class of bug, not just this instance of it.
 *
 * Verified by stashing the fix and re-running: it reports both call sites by line number.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { ESLint } from 'eslint'

/** The Workers runtime globals these modules legitimately use. */
const GLOBALS = Object.fromEntries(
  [
    'console', 'crypto', 'fetch', 'Response', 'Request', 'URL', 'URLSearchParams', 'Headers',
    'FormData', 'File', 'Blob', 'Date', 'JSON', 'Math', 'Number', 'String', 'Object', 'Array',
    'Set', 'Map', 'Boolean', 'Error', 'Promise', 'atob', 'btoa', 'TextDecoder', 'TextEncoder',
    'Uint8Array', 'ArrayBuffer', 'ReadableStream', 'setTimeout', 'clearTimeout', 'AbortController',
    'structuredClone', 'globalThis', 'Symbol', 'RegExp', 'parseInt', 'parseFloat', 'isNaN',
    'WebSocketPair', 'caches', 'navigator', 'performance', 'queueMicrotask', 'Intl',
  ].map((g) => [g, 'readonly']),
)

const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: {
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: GLOBALS },
    rules: { 'no-undef': 'error' },
  },
})

/** macOS writes `._name` resource forks onto some volumes; they are not source. */
const isSource = (name) => name.endsWith('.js') && !name.startsWith('._')

function sourcesIn(dir) {
  return readdirSync(new URL(`../${dir}`, import.meta.url))
    .filter(isSource)
    .map((f) => new URL(`../${dir}/${f}`, import.meta.url).pathname)
}

test('no module calls a name that does not exist', async () => {
  const files = [
    ...sourcesIn('oauth'),
    ...sourcesIn('mcp'),
    new URL('../chat-service.js', import.meta.url).pathname,
    new URL('../chat-members.js', import.meta.url).pathname,
    new URL('../images-service.js', import.meta.url).pathname,
    new URL('../graph-service.js', import.meta.url).pathname,
    new URL('../users-service.js', import.meta.url).pathname,
    new URL('../publish-service.js', import.meta.url).pathname,
    new URL('../published-domains.js', import.meta.url).pathname,
    new URL('../templates-service.js', import.meta.url).pathname,
    new URL('../node-types.js', import.meta.url).pathname,
  ]

  const results = await eslint.lintFiles(files)
  const problems = results
    .flatMap((r) => r.messages.map((m) => `${r.filePath.split('/').slice(-2).join('/')}:${m.line} ${m.message}`))
    .filter(Boolean)

  assert.deepEqual(problems, [], `undefined names:\n  ${problems.join('\n  ')}`)
})
