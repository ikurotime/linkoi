import { afterEach, expect, it } from 'bun:test';
import app, { type Env, type KVStore } from './index.js';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
function setup() {
  const entries = new Map<string, unknown>();
  const pending: Promise<unknown>[] = [];
  const kv: KVStore = {
    async get<T>(key: string) { return (entries.get(key) ?? null) as T | null; },
    async put(key, value) { entries.set(key, JSON.parse(value)); },
    async delete(key) { entries.delete(key); },
  };
  const env: Env = { META_CACHE: kv, API_KEY: 'test-secret' };
  const ctx = { waitUntil(p: Promise<unknown>) { pending.push(p); }, passThroughOnException() {}, props: {} };
  const request = (path: string, method = 'GET', auth = true) => app.request('https://worker.example' + path, { method, headers: auth ? { authorization: 'Bearer test-secret' } : {} }, env, ctx);
  return { request, entries, pending };
}
it('preserves the response envelope and cache lifecycle', async () => {
  const { request, pending } = setup(); let calls = 0;
  globalThis.fetch = (async () => { calls++; return new Response('<title>Title</title><meta name="description" content="Description">', { headers: { 'content-type': 'text/html' } }); }) as unknown as typeof fetch;
  const path = '/?url=https%3A%2F%2Fexample.com&fallback=false';
  expect(await (await request(path)).json()).toMatchObject({ status: 'success', cache: 'miss', data: { title: 'Title', source: 'fast' } });
  await Promise.all(pending);
  expect(await (await request(path)).json()).toMatchObject({ cache: 'hit' });
  expect(calls).toBe(1);
  expect(await (await request(path + '&fresh=true')).json()).toMatchObject({ cache: 'bypass' });
  await Promise.all(pending);
  expect(calls).toBe(2);
  expect((await request(path, 'DELETE')).status).toBe(200);
  expect(await (await request(path)).json()).toMatchObject({ cache: 'miss' });
});
it('serves stale entries and revalidates in the background', async () => {
  const { request, entries, pending } = setup();
  entries.set('meta:v2:https://example.com/', { data: { title: 'Old' }, fetchedAt: 0 });
  globalThis.fetch = (async () => new Response('<title>New</title><meta name="description" content="D">', { headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch;
  expect(await (await request('/?url=https://example.com')).json()).toMatchObject({ cache: 'stale', data: { title: 'Old' } });
  await Promise.all(pending);
  expect(await (await request('/?url=https://example.com')).json()).toMatchObject({ cache: 'hit', data: { title: 'New' } });
});
it('requires the configured bearer token for invalidation and health', async () => {
  const { request } = setup();
  expect((await request('/health', 'GET', false)).status).toBe(401);
  expect((await request('/?url=https://example.com', 'DELETE', false)).status).toBe(401);
  expect((await request('/health')).status).toBe(200);
});
it('rejects missing URLs and private targets', async () => {
  const { request } = setup();
  expect((await request('/')).status).toBe(400);
  expect((await request('/?url=http://127.0.0.1')).status).toBe(400);
});

it('ignores results cached by the old extractor', async () => {
  const { request, entries } = setup();
  entries.set('meta:v1:https://example.com/', { data: { title: 'Old external result', source: 'fallback' }, fetchedAt: Date.now() / 1000 });
  globalThis.fetch = (async () => new Response('<title>Own parser</title>', { headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch;
  expect(await (await request('/?url=https://example.com')).json()).toMatchObject({ cache: 'miss', data: { title: 'Own parser', source: 'fast' } });
});
