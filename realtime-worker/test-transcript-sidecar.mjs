// Transcript sidecars: the key derivation and the listing partition, tested against the REAL
// functions in index.js (extracted, not copied — a copy is a second contract that rots).
//
// Why this exists: before 2026-09-12 the Transcribe button in the Real-Time app saved nothing at
// all — the text lived in React state and a reload lost it. Transcripts are now stored as
// `<recordingKey>.transcript.json` in whichever account owns the recording. Two things must never
// break: a sidecar must never be listed as if it were a recording (it has no playable video), and
// the recording it belongs to must be recoverable from the sidecar key.
//
// Run: node realtime-worker/test-transcript-sidecar.mjs   (exit 0 = pass)

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const src = fs.readFileSync(path.join(dir, 'index.js'), 'utf8')

const parts = {}
for (const part of src.split(/\n(?=(?:async\s+)?function\s)/)) {
  const nm = part.match(/^(?:async\s+)?function\s+(\w+)\s*\(/)
  if (nm) parts[nm[1]] = part
}
const need = ['transcriptKeyFor', 'isTranscriptKey', 'recordingKeyFromTranscriptKey', 'partitionTranscriptKeys']
for (const n of need) {
  if (!parts[n]) { console.error(`FAIL: function ${n} not found in index.js`); process.exit(1) }
}
const suffix = src.match(/const TRANSCRIPT_SUFFIX = '([^']+)'/)
if (!suffix) { console.error('FAIL: TRANSCRIPT_SUFFIX not found'); process.exit(1) }
const api = new Function(`const TRANSCRIPT_SUFFIX = '${suffix[1]}'\n${need.map(n => parts[n]).join('\n')}\nreturn { ${need.join(', ')} }`)()

let failed = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `\n      ${detail}`}`)
  if (!ok) failed += 1
}

const rec = 'recordings/bbb42d2b-7466-49e2-b272-9779c33703ff_1789113670260.mp4'
const side = api.transcriptKeyFor(rec)

check('the sidecar sits beside the recording', side === `${rec}.transcript.json`, side)
check('a sidecar key is recognised', api.isTranscriptKey(side) && !api.isTranscriptKey(rec))
check('the recording is recoverable from the sidecar', api.recordingKeyFromTranscriptKey(side) === rec)
check('a recording key passes through unchanged', api.recordingKeyFromTranscriptKey(rec) === rec)

const listing = [
  'recordings/',
  rec,
  side,
  'recordings/other_1789000000000.mp4',
  'recordings/nested/deep_1789000000001.webm',
]
const { recordings, transcripts } = api.partitionTranscriptKeys(listing)
check('sidecars are never listed as recordings', !recordings.includes(side), JSON.stringify(recordings))
check('every real key survives the partition', recordings.length === 4 && recordings.includes(rec))
check('the recording with a transcript is flagged', transcripts.has(rec) && transcripts.size === 1)
check('a recording without a transcript is not flagged', !transcripts.has('recordings/other_1789000000000.mp4'))
check('an empty listing is safe', api.partitionTranscriptKeys([]).recordings.length === 0 && api.partitionTranscriptKeys(undefined).transcripts.size === 0)

// The endpoint must be wired with both methods and must refuse a sidecar key as its input.
check('the route accepts GET and POST', /pathname === '\/realtime\/recordings\/transcript' && \(request\.method === 'POST' \|\| request\.method === 'GET'\)/.test(src))
check('a sidecar key is refused as the recording key', /key must be the recording, not its transcript sidecar/.test(src))
check('RealtimeKit-only recordings are refused with a reason', /has no storage bucket \(RealtimeKit cloud only\)/.test(src))
check('the write confirms the recording exists first', /Recording not found in your R2 bucket/.test(src))
check('the legacy bucket reuses the ownership gate', (src.match(/canReadSharedRecording\(key, auth, eff, env\)/g) || []).length >= 4)

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll transcript-sidecar checks passed.')
process.exit(failed ? 1 : 0)
