import { describe, expect, it } from 'bun:test'
import {
  resolveDeepLink,
  youtubeAppLinks,
  youtubeWebUrl,
} from '../src/index.js'

describe('public package API', () => {
  it('resolves content without prescribing the host product or its routes', () => {
    expect(resolveDeepLink('https://youtu.be/dQw4w9WgXcQ?t=2m')).toEqual({
      provider: 'youtube',
      target: { videoId: 'dQw4w9WgXcQ', startSeconds: 120 },
      urls: {
        web: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s',
        ios: 'youtube://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s',
        android:
          'intent://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ%26t%3D120s;end',
      },
      previewImageUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    })
  })

  it.each(['https://example.com/video', 'https://youtube.com/@creator', ''])(
    'returns null for unsupported input %s',
    (input) => {
      expect(resolveDeepLink(input)).toBeNull()
    },
  )

  it.each([
    { videoId: 'bad#Intent;package=evil', startSeconds: 0 },
    { videoId: 'dQw4w9WgXcQ', startSeconds: -1 },
    { videoId: 'dQw4w9WgXcQ', startSeconds: 0.5 },
    { videoId: 'dQw4w9WgXcQ', startSeconds: NaN },
    { videoId: 'dQw4w9WgXcQ', startSeconds: Infinity },
    { videoId: 'dQw4w9WgXcQ', startSeconds: 2147483648 },
  ])('rejects unsafe direct builder input %o', (target) => {
    expect(() => youtubeWebUrl(target)).toThrow(TypeError)
    expect(() => youtubeAppLinks(target)).toThrow(TypeError)
  })
})
