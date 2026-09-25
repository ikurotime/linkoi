export interface YouTubeTarget {
  readonly videoId: string
  readonly startSeconds: number
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
])

export function isYouTubeVideoId(value: string): boolean {
  return VIDEO_ID.test(value)
}

/** Accept YouTube's seconds and 1h2m3s timestamps, never arbitrary query text. */
export function parseYouTubeTime(value: string | null): number | null {
  if (!value) return 0
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value)
  const seconds = /^\d+$/.test(value)
    ? Number(value)
    : match
      ? Number(match[1] ?? 0) * 3600 +
        Number(match[2] ?? 0) * 60 +
        Number(match[3] ?? 0)
      : NaN
  return Number.isSafeInteger(seconds) && seconds >= 0 && seconds <= 2147483647
    ? seconds
    : null
}

/** Only video URLs on exact YouTube hosts; never a general-purpose redirect. */
export function parseYouTubeUrl(input: string): YouTubeTarget | null {
  const value = input.trim()
  if (!value || value.length > 4096 || /[\s\\]/.test(value)) return null
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
  } catch {
    return null
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port
  )
    return null

  let videoId: string | null = null
  if (url.hostname === 'youtu.be' || url.hostname === 'www.youtu.be') {
    videoId = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1] ?? null
  } else if (YOUTUBE_HOSTS.has(url.hostname)) {
    if (url.pathname === '/watch') videoId = url.searchParams.get('v')
    else
      videoId =
        /^\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{11})\/?$/.exec(
          url.pathname,
        )?.[1] ?? null
  }
  if (!videoId || !isYouTubeVideoId(videoId)) return null

  const hashTime = new URLSearchParams(url.hash.slice(1)).get('t')
  const startSeconds = parseYouTubeTime(
    url.searchParams.get('t') ?? url.searchParams.get('start') ?? hashTime,
  )
  if (startSeconds === null) return null
  return { videoId, startSeconds }
}

export function youtubeWebUrl(target: YouTubeTarget): string {
  // Public builders may be called by JavaScript or with deserialized values.
  // Validate here as well as in the URL parser before assembling app schemes.
  if (
    typeof target.videoId !== 'string' ||
    !isYouTubeVideoId(target.videoId) ||
    !Number.isSafeInteger(target.startSeconds) ||
    target.startSeconds < 0 ||
    target.startSeconds > 2147483647
  )
    throw new TypeError('Invalid YouTube target')
  return `https://www.youtube.com/watch?v=${target.videoId}${target.startSeconds ? `&t=${target.startSeconds}s` : ''}`
}

export function youtubeAppLinks(target: YouTubeTarget) {
  const web = youtubeWebUrl(target)
  return {
    web,
    // YouTube's custom iOS scheme is best-effort; keep the HTTPS link visible.
    ios: web.replace('https:', 'youtube:'),
    android: `${web.replace('https:', 'intent:')}#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=${encodeURIComponent(web)};end`,
  }
}
