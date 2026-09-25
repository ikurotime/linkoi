import { describe, expect, it } from 'bun:test'
import {
  parseYouTubeUrl,
  youtubeAppLinks,
  youtubeWebUrl,
} from '../src/index.js'

const id = 'dQw4w9WgXcQ'

describe('YouTube smart links', () => {
  it.each([
    `https://youtu.be/${id}?si=tracking`,
    `https://www.youtube.com/watch?v=${id}&list=playlist&index=2`,
    `youtube.com/shorts/${id}`,
    `https://m.youtube.com/live/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://music.youtube.com/watch?v=${id}`,
  ])('normalizes supported video URL %s', (url) => {
    expect(parseYouTubeUrl(url)).toEqual({ videoId: id, startSeconds: 0 })
  })

  it.each([
    ['?t=1h2m3s', 3723],
    ['?t=90', 90],
    ['?start=45', 45],
    ['#t=2m', 120],
  ])('preserves timestamp %s', (suffix, seconds) => {
    const target = parseYouTubeUrl(`https://youtu.be/${id}${suffix}`)!
    expect(target.startSeconds).toBe(seconds)
    const links = youtubeAppLinks(target)
    expect(links.web).toBe(
      `https://www.youtube.com/watch?v=${id}&t=${seconds}s`,
    )
    expect(links.ios).toBe(
      `youtube://www.youtube.com/watch?v=${id}&t=${seconds}s`,
    )
    expect(links.android).toContain(
      `S.browser_fallback_url=${encodeURIComponent(links.web)};end`,
    )
    expect(links.android).toContain('package=com.google.android.youtube;')
  })

  it.each([
    '',
    'javascript:alert(1)',
    'https://example.com/watch?v=dQw4w9WgXcQ',
    `https://youtube.com.evil.com/watch?v=${id}`,
    `https://youtube.com@evil.com/watch?v=${id}`,
    `https://evil.com@youtube.com/watch?v=${id}`,
    `https://youtube.com:444/watch?v=${id}`,
    `https://youtu.be/${id}/extra`,
    'https://youtube.com/playlist?list=123',
    'https://youtube.com/@creator',
    'https://youtube.com/watch?v=bad',
    `https://youtu.be/${id}?t=-1`,
    `https://youtu.be/${id}?t=1e30`,
    `https://youtu.be/${id}?t=99999999999999999`,
    `https://youtu.be/${id}?t=2%3Bend`,
    `https://youtube.com\\@evil.com/watch?v=${id}`,
  ])('rejects unsupported or unsafe input %s', (url) => {
    expect(parseYouTubeUrl(url)).toBeNull()
  })

  it('produces the same link regardless of tracking parameters and source format', () => {
    const short = parseYouTubeUrl(`https://youtu.be/${id}?si=a&t=60`)!
    const watch = parseYouTubeUrl(
      `https://youtube.com/watch?v=${id}&t=1m&utm_source=ig`,
    )!
    expect(youtubeWebUrl(short)).toBe(youtubeWebUrl(watch))
  })
})
