// The operations in /realtime/openapi.json, pinned.
//
// This spec is not only documentation. realtime-worker is registered in graph_system_registry
// (node sysworker-realtime, tool_prefix "rt_"), and Agent-Builder (worker/openapi-tools.js) turns
// EVERY operation listed here into a chat tool, called with the signed-in user's own token:
// getMyRooms becomes rt_get_my_rooms, createMeeting becomes rt_create_meeting, and so on.
// The MCP realtime_* tools (dev-worker/realtime-service.js) are written from the same shapes.
//
// On 2026-11-13 two operations were added "as documentation" and became chat tools nobody had
// decided on. The architect then decided (D8 = B, 2026-11-15) that this spec is the one place the
// endpoints are documented, writes included, and that the chat gets them.
//
// So: adding, renaming or removing an operation changes the Agent-Builder chat's tool list on the
// next deploy. This test fails until the list below is edited ON PURPOSE. Before adding a WRITE,
// check that the handler is safe for a caller that sends only some of the fields
// (test-room-writes.mjs), and that it checks ownership (test-close-meeting.mjs).
//
// Run:  node test-openapi-surface.mjs
import assert from 'node:assert/strict'
import worker from './index.js'

const EXPECTED = {
  // read
  'GET /realtime/openapi.json': 'getRealtimeOpenApiSpec',
  'GET /realtime/recordings/academy': 'getAcademyRecordings',
  'GET /realtime/recordings': 'listRecordings',
  'GET /realtime/recordings/play-url': 'getRecordingPlayUrl',
  'GET /realtime/recordings/transcript': 'getRecordingTranscript',
  'GET /realtime/slugs': 'listSlugs',
  'GET /realtime/list-meetings': 'listMeetings',
  'GET /realtime/my-rooms': 'getMyRooms',
  'GET /realtime/open-room/status': 'getOpenRoomStatus',
  'GET /realtime/open-room/info': 'getOpenRoomInfo',
  // write (D8 = B, 2026-11-15)
  'POST /realtime/create-meeting': 'createMeeting',
  'POST /realtime/rename-room': 'renameRoom',
  'POST /realtime/toggle-waiting-room': 'toggleWaitingRoom',
  'POST /realtime/update-waiting-screen': 'updateWaitingScreen',
  'POST /realtime/open-room/toggle': 'toggleOpenRoom',
}

const res = await worker.fetch(new Request('https://api.vegvisr.org/realtime/openapi.json'), {})
assert.equal(res.status, 200)
const spec = await res.json()

const actual = {}
for (const [path, methods] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(methods)) actual[`${method.toUpperCase()} ${path}`] = op.operationId
}
assert.deepEqual(
  Object.fromEntries(Object.entries(actual).sort()),
  Object.fromEntries(Object.entries(EXPECTED).sort()),
  'The operation list of /realtime/openapi.json changed. Every operation is an Agent-Builder chat tool — read the header of this file, then update EXPECTED deliberately.',
)
console.log(`ok    ${Object.keys(actual).length} operations, exactly the expected ones`)

// Never in the spec, whatever else changes: these must not become chat tools.
for (const key of Object.keys(actual)) {
  assert.doesNotMatch(key, /\/admin\/|\/debug\/|impersonate|\/delete|close-meeting|join-token|telemetry/, `${key} must not be published`)
}
console.log('ok    no admin, debug, delete, close, join-token or telemetry operation is published')

// A write must say what it takes: an undocumented body is a tool the model has to guess at.
for (const [key, id] of Object.entries(actual)) {
  if (!key.startsWith('POST ')) continue
  const [, path] = key.split(' ')
  assert.ok(spec.paths[path].post.requestBody?.content?.['application/json']?.schema, `${id} has no request body schema`)
}
console.log('ok    every write documents its request body')
console.log('\n3 checks passed')
