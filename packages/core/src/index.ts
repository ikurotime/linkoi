import { assertSafeUrl } from './guard.js';
import { fetchHtml } from './fetch-html.js';
import { extractRawTags } from './extract.js';
import { normalize, isGoodEnough, type Metadata } from './normalize.js';
import { extractVideoId, resolveYouTube } from './youtube.js';

export interface ExtractOptions {
  /** Maximum downloaded HTML bytes. Default: 2 MiB. */
  maxBytes?: number;
  /** Timeout per upstream fetch. Default: 5 seconds. */
  timeoutMs?: number;
  selfHosts?: string[];
  fallback?: boolean;
  youtubeApiKey?: string;
}

/** Extract supplied HTML without making a network request on the fast path. */
export async function fromHtml(html: string, url: string, options: Pick<ExtractOptions, 'fallback'> = {}): Promise<Metadata> {
  const base = assertSafeUrl(url, []);
  const result = normalize(await extractRawTags(html), base.toString());
  if (isGoodEnough(result) || options.fallback === false) return result;
  try {
    const { extractWithFallback } = await import('./fallback.js');
    return await extractWithFallback(html, base.toString(), result);
  } catch {
    return result;
  }
}

/** Fetch one public URL and return normalized page metadata. */
export async function resolve(input: string | URL, options: ExtractOptions = {}): Promise<Metadata> {
  const target = assertSafeUrl(input.toString(), options.selfHosts ?? []);
  const maxBytes = options.maxBytes ?? 2_097_152;
  const timeoutMs = options.timeoutMs ?? 5000;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new RangeError('maxBytes must be a positive integer');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new RangeError('timeoutMs must be a positive integer');
  const videoId = options.youtubeApiKey ? extractVideoId(target) : null;
  if (videoId && options.youtubeApiKey) {
    try {
      const data = await resolveYouTube(videoId, options.youtubeApiKey);
      return { ...data, logo: null, lang: null, source: 'fast' };
    } catch { /* A failed provider request falls back to the page HTML. */ }
  }
  const document = await fetchHtml(target, { maxBytes, timeoutMs, selfHosts: options.selfHosts ?? [] });
  return fromHtml(document.html, document.finalUrl, options);
}

export { normalize, isGoodEnough } from './normalize.js';
export type { Metadata } from './normalize.js';
export { extractRawTags } from './extract.js';
export type { RawTags } from './extract.js';
export { fetchHtml, FetchHtmlError } from './fetch-html.js';
export { assertSafeUrl, canonicalize, UnsafeUrlError } from './guard.js';
