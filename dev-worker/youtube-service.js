/**
 * youtube-service.js — the transcript of a YouTube video, from the MCP surface.
 *
 * ONE IMPLEMENTATION (decided 2026-11-14)
 * ---------------------------------------
 * The transcript is fetched by api-worker's existing endpoint,
 *   GET https://api.vegvisr.org/youtube-transcript-io/<videoId>
 * which is what the Transcript Processor in the frontend (useTranscriptProcessor.js) calls. That
 * endpoint holds the youtube-transcript.io token; this module holds no secret and adds no second
 * integration. It only reads the answer and tidies it for a model:
 *
 *   - the video id is taken from any YouTube URL shape the frontend accepts (src/utils/youtube.js)
 *   - the segments of one track become one text, cut at maxChars with an offset to read on
 *   - the metadata comes from the same microformat fields the frontend reads
 *   - `node` is the youtube-video node the frontend's createYouTubeNode() builds, so a graph made
 *     through MCP shows the video the same way as one made in the Transcript Processor
 *
 * What it does NOT do: turn the transcript into a graph. The frontend sends the text to
 * grok-worker for that; over MCP the assistant in the conversation reads the text and builds the
 * graph with create_graph / add_node (architect's decision A, 2026-11-14).
 */

import { ERR, statusForCode } from './graph-service.js'

export const TRANSCRIPT_ENDPOINT = 'https://api.vegvisr.org/youtube-transcript-io/'
export const DEFAULT_MAX_CHARS = 50000
export const MIN_MAX_CHARS = 1000
export const MAX_MAX_CHARS = 200000
const FETCH_TIMEOUT_MS = 25000

function fail(code, message, extra = {}) {
  return { ok: false, code, status: statusForCode(code), message, ...extra }
}

// The same shapes as src/utils/youtube.js, which is the list the app accepts.
const VIDEO_ID_PATTERNS = [
  /(?:youtube\.com\/watch\?v=)([^&\n?#/]+)/,
  /(?:youtube\.com\/embed\/)([^&\n?#/]+)/,
  /(?:youtube\.com\/shorts\/)([^&\n?#/]+)/,
  /(?:youtube\.com\/live\/)([^&\n?#/]+)/,
  /(?:youtu\.be\/)([^&\n?#/]+)/,
  /youtube\.com\/watch\?.*[?&]v=([^&\n?#/]+)/,
]
const BARE_ID = /^[A-Za-z0-9_-]{11}$/

/** The video id of a YouTube URL or of a bare 11-character id; null when it is neither. */
export function extractVideoId(input) {
  const raw = String(input || '').trim().replace(/&amp;/g, '&')
  if (!raw) return null
  if (BARE_ID.test(raw)) return raw
  for (const pattern of VIDEO_ID_PATTERNS) {
    const m = raw.match(pattern)
    // The id goes into a URL path below, so only the characters YouTube uses are let through.
    if (m && m[1] && /^[A-Za-z0-9_-]{6,20}$/.test(m[1])) return m[1]
  }
  return null
}

/** One text from a track's segments. Line-break-only segments are dropped, whitespace collapsed. */
export function textFromSegments(segments) {
  return (Array.isArray(segments) ? segments : [])
    .map((s) => String(s?.text ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const pad = (n) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** The youtube-video node createYouTubeNode() in useTranscriptProcessor.js builds (no id). */
export function youtubeNodeFor(v) {
  const description = v.description
    ? `**Description:**\n${v.description.length > 500 ? v.description.substring(0, 500) + '...' : v.description}`
    : ''
  const info = `[SECTION | background-color:'#FFF'; color:'#333']
**${v.title}**

**Channel:** ${v.channel || 'Unknown Channel'}
**Duration:** ${formatDuration(v.durationSeconds) || 'Unknown duration'}
**Published:** ${v.publishedAt || 'Unknown date'}

${description}

**Source:** [Watch on YouTube](${v.url})
[END SECTION]`
  return {
    label: `![YOUTUBE src=${v.embedUrl}]${v.title}[END YOUTUBE]`,
    type: 'youtube-video',
    color: '#FF0000',
    info,
    bibl: [v.url],
    imageWidth: '100%',
    imageHeight: '100%',
    visible: true,
    path: null,
  }
}

function clampMaxChars(maxChars) {
  const n = Number.isFinite(maxChars) ? Math.floor(maxChars) : DEFAULT_MAX_CHARS
  return Math.min(MAX_MAX_CHARS, Math.max(MIN_MAX_CHARS, n))
}

/**
 * The transcript and metadata of one video.
 *
 * Returns { ok: true, found: true, … } with the text, { ok: true, found: false, reason } when the
 * video exists but has no transcript, or a fail().
 */
export async function getTranscript(env, { actor, video, language = null, maxChars, offset = 0 } = {}) {
  if (!actor || actor.anonymous || !actor.email) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  const videoId = extractVideoId(video)
  if (!videoId) {
    return fail(ERR.INVALID_INPUT, 'video must be a YouTube link (youtube.com/watch?v=…, youtu.be/…, shorts, live, embed) or an 11-character video id.')
  }

  let res
  let data
  try {
    res = await fetch(`${TRANSCRIPT_ENDPOINT}${encodeURIComponent(videoId)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    data = await res.json().catch(() => ({}))
  } catch (e) {
    return fail(ERR.INTERNAL_ERROR, `Could not reach the transcript endpoint (api-worker): ${e.message}`)
  }
  if (res.status === 429) return fail(ERR.RATE_LIMITED, data?.error || 'The transcript service is rate limited. Try again in a moment.')
  if (res.status === 404) return fail(ERR.GRAPH_NOT_FOUND, data?.error || `No video found for id ${videoId}.`)
  if (!res.ok || data?.success === false) {
    return fail(res.status >= 500 ? ERR.INTERNAL_ERROR : ERR.INVALID_INPUT, data?.error || `The transcript endpoint answered ${res.status}.`)
  }

  const entry = Array.isArray(data?.transcript) ? data.transcript[0] : null
  if (!entry) return fail(ERR.GRAPH_NOT_FOUND, `The transcript service returned nothing for video ${videoId}.`)

  const micro = entry.microformat?.playerMicroformatRenderer || {}
  const length = parseInt(micro.lengthSeconds, 10)
  const channelId = micro.externalChannelId || null
  const meta = {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    title: micro.title?.simpleText || entry.title || `YouTube Video ${videoId}`,
    channel: micro.ownerChannelName || null,
    channelUrl: channelId ? `https://www.youtube.com/channel/${channelId}` : null,
    durationSeconds: Number.isFinite(length) ? length : null,
    publishedAt: micro.publishDate || null,
    category: micro.category || null,
    description: micro.description?.simpleText || '',
  }

  const tracks = (Array.isArray(entry.tracks) ? entry.tracks : []).filter((t) => Array.isArray(t?.transcript) && t.transcript.length)
  const availableLanguages = [...new Set([
    ...tracks.map((t) => t.language),
    ...(Array.isArray(entry.availableLanguages) ? entry.availableLanguages : []),
  ].filter((l) => typeof l === 'string' && l))]
  const chapters = (Array.isArray(entry.chapters) ? entry.chapters : [])
    .filter((c) => c && typeof c.title === 'string' && c.title)
    .map((c) => ({ startSeconds: Number(c.start_time) || 0, title: c.title }))
  const node = youtubeNodeFor(meta)

  const wanted = language ? String(language).trim().toLowerCase() : null
  const track = wanted
    ? tracks.find((t) => String(t.language || '').toLowerCase() === wanted)
    : tracks[0]
  if (!track) {
    const reason = wanted && tracks.length
      ? `No transcript in "${language}". Available: ${availableLanguages.join(', ')}.`
      : (entry.playabilityStatus?.reason || 'This video has no transcript (captions are off or not yet generated).')
    return { ok: true, found: false, reason, ...meta, availableLanguages, chapters, node }
  }

  const full = textFromSegments(track.transcript)
  const start = Math.min(Math.max(0, Number.isFinite(offset) ? Math.floor(offset) : 0), full.length)
  const text = full.slice(start, start + clampMaxChars(maxChars))
  const end = start + text.length
  return {
    ok: true,
    found: true,
    ...meta,
    language: track.language || null,
    availableLanguages,
    chapters,
    segments: track.transcript.length,
    chars: full.length,
    offset: start,
    truncated: end < full.length,
    nextOffset: end < full.length ? end : null,
    text,
    node,
  }
}
