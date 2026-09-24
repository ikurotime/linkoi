import { afterEach, describe, expect, it } from 'bun:test';
import { resolve, fromHtml, fetchHtml } from './index.js';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const html = '<html><head><meta property="og:title" content="A page"><meta name="description" content="Description"><meta property="og:image" content="/image.jpg"></head></html>';
function stub(fn: (input: string | URL | Request, init?: RequestInit) => Promise<Response>) { globalThis.fetch = fn as typeof fetch; }
describe('public API', () => {
  it('extracts supplied HTML without network access', async () => {
    stub(async () => { throw new Error('Unexpected network access'); });
    const data = await fromHtml(html, 'https://example.com/page', { fallback: false });
    expect(data.title).toBe('A page');
    expect(data.image).toBe('https://example.com/image.jpg');
  });
  it('resolves relative assets after a redirect', async () => {
    stub(async input => input.toString() === 'https://example.com/'
      ? new Response(null, { status: 302, headers: { location: 'https://destination.example/page' } })
      : new Response(html, { headers: { 'content-type': 'text/html' } }));
    const data = await resolve('https://example.com', { fallback: false });
    expect(data.url).toBe('https://destination.example/page');
    expect(data.image).toBe('https://destination.example/image.jpg');
  });
  it('rejects private redirect destinations before fetching them', async () => {
    let calls = 0;
    stub(async () => { calls++; return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/admin' } }); });
    await expect(resolve('https://example.com')).rejects.toThrow('Unsafe redirect');
    expect(calls).toBe(1);
  });
  it('rejects invalid resource limits', async () => {
    await expect(resolve('https://example.com', { maxBytes: 0 })).rejects.toThrow(RangeError);
  });
  it('caps a single oversized stream chunk', async () => {
    stub(async () => new Response('x'.repeat(10000), { headers: { 'content-type': 'text/html' } }));
    const data = await fetchHtml(new URL('https://example.com'), { maxBytes: 128, timeoutMs: 1000, selfHosts: [] });
    expect(data.html.length).toBe(128);
    expect(data.truncated).toBe(true);
  });
  it('falls back to HTML if the YouTube provider fails', async () => {
    stub(async input => input.toString().includes('googleapis.com')
      ? new Response(null, { status: 503 })
      : new Response(html, { headers: { 'content-type': 'text/html' } }));
    expect((await resolve('https://youtu.be/P4QodeA_lQ0', { youtubeApiKey: 'test', fallback: false })).title).toBe('A page');
  });
});
