import { parseYouTubeUrl, youtubeAppLinks } from './youtube.js'
import type { YouTubeTarget } from './youtube.js'

export {
  isYouTubeVideoId,
  parseYouTubeTime,
  parseYouTubeUrl,
  youtubeAppLinks,
  youtubeWebUrl,
} from './youtube.js'
export type { YouTubeTarget } from './youtube.js'

export interface AppLinks {
  readonly web: string
  readonly ios: string
  readonly android: string
}

/** Resolved content, not a hosted short link. The consuming product owns hosting. */
export interface DeepLink {
  readonly provider: 'youtube'
  readonly target: YouTubeTarget
  readonly urls: AppLinks
  readonly previewImageUrl: string
}

/** Invalid and unsupported input returns null; no network or browser globals. */
export function resolveDeepLink(input: string): DeepLink | null {
  const target = parseYouTubeUrl(input)
  if (!target) return null
  return {
    provider: 'youtube',
    target,
    urls: youtubeAppLinks(target),
    previewImageUrl: `https://i.ytimg.com/vi/${target.videoId}/hqdefault.jpg`,
  }
}
