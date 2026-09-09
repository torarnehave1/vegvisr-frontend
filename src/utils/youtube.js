// Shared YouTube URL helpers.
//
// One place that knows every YouTube URL shape the app accepts, so a new format
// (Shorts, live permalinks, …) is added once instead of in every component.

// Normalize a raw value into a clean URL: accepts a plain URL or a pasted
// <iframe …> embed snippet, and decodes HTML entities (&amp; → &).
export const normalizeVideoUrl = (raw) => {
  if (!raw) return ''
  let url = String(raw).trim()
  const srcMatch = url.match(/src=["']([^"']+)["']/)
  if (srcMatch) {
    url = srcMatch[1]
  }
  return url.replace(/&amp;/g, '&')
}

const VIDEO_ID_PATTERNS = [
  // Regular watch URLs
  /(?:youtube\.com\/watch\?v=)([^&\n?#/]+)/,
  // Embed URLs
  /(?:youtube\.com\/embed\/)([^&\n?#/]+)/,
  // Shorts URLs
  /(?:youtube\.com\/shorts\/)([^&\n?#/]+)/,
  // Live permalinks
  /(?:youtube\.com\/live\/)([^&\n?#/]+)/,
  // Short share links
  /(?:youtu\.be\/)([^&\n?#/]+)/,
  // Watch URLs where v= is not the first parameter
  /youtube\.com\/watch\?.*[?&]v=([^&\n?#/]+)/,
]

// Extract the 11-char video id from any supported YouTube URL. Returns null
// when the URL is not a recognizable YouTube video link.
export const extractYoutubeVideoId = (url) => {
  const trimmedUrl = normalizeVideoUrl(url)
  if (!trimmedUrl) return null

  for (const pattern of VIDEO_ID_PATTERNS) {
    const match = trimmedUrl.match(pattern)
    if (match && match[1]) return match[1]
  }
  return null
}

// Turn any supported YouTube URL into a plain embed URL (no extra params).
// Returns null when no video id can be extracted.
export const toYoutubeEmbedUrl = (url) => {
  const videoId = extractYoutubeVideoId(url)
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null
}
