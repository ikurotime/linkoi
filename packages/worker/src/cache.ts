import type { Metadata } from "@linkoi/core";

export interface KVStore {
  get<T>(key: string, type: "json"): Promise<T | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface CacheEntry {
  data: Metadata;
  fetchedAt: number;
}

export type CacheState = "miss" | "fresh" | "stale";

export interface CacheLookup {
  state: CacheState;
  entry: CacheEntry | null;
}

function keyFor(canonicalUrl: string): string {
  return `meta:v2:${canonicalUrl}`;
}

export async function readCache(
  kv: KVStore,
  canonicalUrl: string,
  freshTtlSeconds: number,
): Promise<CacheLookup> {
  const raw = await kv.get<CacheEntry>(keyFor(canonicalUrl), "json");
  if (!raw) return { state: "miss", entry: null };
  const age = Math.floor(Date.now() / 1000) - raw.fetchedAt;
  return { state: age < freshTtlSeconds ? "fresh" : "stale", entry: raw };
}

export async function writeCache(
  kv: KVStore,
  canonicalUrl: string,
  data: Metadata,
  staleTtlSeconds: number,
): Promise<void> {
  const entry: CacheEntry = { data, fetchedAt: Math.floor(Date.now() / 1000) };
  await kv.put(keyFor(canonicalUrl), JSON.stringify(entry), { expirationTtl: staleTtlSeconds });
}

export async function invalidate(kv: KVStore, canonicalUrl: string): Promise<void> {
  await kv.delete(keyFor(canonicalUrl));
}
