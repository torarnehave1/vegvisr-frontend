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

// Extract the playlist id from a `list=` parameter. Covers youtube.com and
// music.youtube.com alike — YouTube Music has no embeddable player of its own,
// so a music playlist is played through the ordinary YouTube iframe.
export const extractYoutubePlaylistId = (url) => {
  const trimmedUrl = normalizeVideoUrl(url)
  if (!trimmedUrl) return null

  const match = trimmedUrl.match(/[?&]list=([^&\n#]+)/)
  return match ? match[1] : null
}

// Turn any supported YouTube URL into a plain embed URL (no extra params).
// A URL carrying both a video and a playlist embeds the video within the
// playlist; a playlist on its own embeds as a videoseries. Returns null when
// neither can be extracted.
export const toYoutubeEmbedUrl = (url) => {
  const videoId = extractYoutubeVideoId(url)
  const playlistId = extractYoutubePlaylistId(url)

  if (videoId) {
    return playlistId
      ? `https://www.youtube.com/embed/${videoId}?list=${playlistId}`
      : `https://www.youtube.com/embed/${videoId}`
  }
  // The documented form for a playlist is /embed?listType=playlist&list=... —
  // https://developers.google.com/youtube/player_parameters says listType is
  // required in conjunction with list. The /embed/videoseries?list= variant also
  // plays, but appears nowhere in the docs, so it can be withdrawn without notice.
  return playlistId
    ? `https://www.youtube.com/embed?listType=playlist&list=${playlistId}`
    : null
}
