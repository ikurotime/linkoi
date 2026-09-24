import { Hono } from "hono";
import { cors } from "hono/cors";
import { assertSafeUrl, canonicalize, UnsafeUrlError, FetchHtmlError, resolve as extract } from "@linkoi/core";
import { readCache, writeCache, invalidate, type KVStore } from "./cache.js";

export interface Env {
  META_CACHE: KVStore;
  MAX_HTML_BYTES?: string;
  FETCH_TIMEOUT_MS?: string;
  FRESH_TTL_SECONDS?: string;
  STALE_TTL_SECONDS?: string;
  SELF_HOSTS?: string;
  API_KEY?: string;
  /** YouTube Data API v3 key (optional, enables full metadata for YouTube URLs) */
  YOUTUBE_API_KEY?: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use("/*", cors({ origin: "*", allowMethods: ["GET", "DELETE", "OPTIONS"] }));

app.use("/*", async (c, next) => {
  const expected = c.env.API_KEY;
  if (expected) {
    const provided = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
    if (provided !== expected) return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

function config(env: Env) {
  return {
    maxBytes: Number(env.MAX_HTML_BYTES ?? 2_097_152),
    timeoutMs: Number(env.FETCH_TIMEOUT_MS ?? 5000),
    freshTtl: Number(env.FRESH_TTL_SECONDS ?? 86_400),
    staleTtl: Number(env.STALE_TTL_SECONDS ?? 604_800),
    selfHosts: (env.SELF_HOSTS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  };
}

export function resolve(target: URL, env: Env, allowFallback = true) {
  const cfg = config(env);
  return extract(target, {
    maxBytes: cfg.maxBytes, timeoutMs: cfg.timeoutMs, selfHosts: cfg.selfHosts,
    fallback: allowFallback, youtubeApiKey: env.YOUTUBE_API_KEY,
  });
}

app.get("/", async (c) => {
  const raw = c.req.query("url");
  if (!raw) return c.json({ error: "Missing `url` query parameter" }, 400);

  const cfg = config(c.env);
  let target: URL;
  try {
    target = assertSafeUrl(raw, cfg.selfHosts);
  } catch (err) {
    if (err instanceof UnsafeUrlError) return c.json({ error: err.message }, 400);
    throw err;
  }

  const canonical = canonicalize(target);
  const skipCache = c.req.query("fresh") === "true";
  const allowFallback = c.req.query("fallback") !== "false";

  if (!skipCache) {
    const { state, entry } = await readCache(c.env.META_CACHE, canonical, cfg.freshTtl);
    if (entry && state === "fresh")
      return c.json({ status: "success", data: entry.data, cache: "hit" });
    if (entry && state === "stale") {
      c.executionCtx.waitUntil(
        resolve(target, c.env, allowFallback)
          .then((fresh) => writeCache(c.env.META_CACHE, canonical, fresh, cfg.staleTtl))
          .catch((err) => console.error("revalidate failed", canonical, err)),
      );
      return c.json({ status: "success", data: entry.data, cache: "stale" });
    }
  }

  try {
    const data = await resolve(target, c.env, allowFallback);
    c.executionCtx.waitUntil(writeCache(c.env.META_CACHE, canonical, data, cfg.staleTtl));
    return c.json({ status: "success", data, cache: skipCache ? "bypass" : "miss" });
  } catch (err) {
    if (err instanceof FetchHtmlError)
      return c.json({ status: "error", error: err.message }, err.status as 400 | 429 | 502);
    console.error("unhandled", err);
    return c.json({ status: "error", error: "Extraction failed" }, 500);
  }
});

app.delete("/", async (c) => {
  const raw = c.req.query("url");
  if (!raw) return c.json({ error: "Missing `url` query parameter" }, 400);
  try {
    const target = assertSafeUrl(raw, config(c.env).selfHosts);
    await invalidate(c.env.META_CACHE, canonicalize(target));
    return c.json({ status: "success" });
  } catch (err) {
    if (err instanceof UnsafeUrlError) return c.json({ error: err.message }, 400);
    throw err;
  }
});

app.get("/health", (c) => c.json({ ok: true }));

export default app;

export { readCache, writeCache, invalidate } from "./cache.js";
export type { KVStore, CacheEntry, CacheLookup } from "./cache.js";
