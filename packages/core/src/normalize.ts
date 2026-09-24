import { decodeEntities, type RawTags } from "./extract.js";

export interface Metadata {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  logo: string | null;
  publisher: string | null;
  author: string | null;
  date: string | null;
  lang: string | null;
  source: "fast" | "fallback";
}

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 500;

function clean(value: string | undefined | null, maxLength: number): string | null {
  if (!value) return null;
  const text = decodeEntities(value).replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}\u2026` : text;
}

function absoluteUrl(value: string | undefined | null, base: string): string | null {
  if (!value) return null;
  const raw = decodeEntities(value).trim();
  if (!raw || raw.startsWith("data:")) return null;
  try {
    const resolved = new URL(raw, base);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return null;
    return resolved.toString();
  } catch {
    return null;
  }
}

function isoDate(value: string | undefined | null): string | null {
  if (!value) return null;
  const parsed = new Date(value.trim());
  const time = parsed.getTime();
  if (!Number.isFinite(time)) return null;
  const year = parsed.getUTCFullYear();
  if (year < 1990 || year > 2100) return null;
  return parsed.toISOString();
}

function languageTag(value: string | undefined | null): string | null {
  if (!value) return null;
  const match = /^([a-z]{2,3})(?:[-_]([a-z]{2,4}))?/i.exec(value.trim());
  if (!match) return null;
  return match[1]!.toLowerCase();
}

function firstOf<T>(candidates: Array<() => T | null>): T | null {
  for (const candidate of candidates) {
    const value = candidate();
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

interface JsonLdNode {
  "@type"?: string | string[];
  name?: string;
  headline?: string;
  description?: string;
  image?: unknown;
  datePublished?: string;
  dateCreated?: string;
  author?: unknown;
  publisher?: unknown;
  inLanguage?: string;
  "@graph"?: JsonLdNode[];
}

function flattenJsonLd(blocks: string[]): JsonLdNode[] {
  const nodes: JsonLdNode[] = [];
  const visit = (value: unknown, depth: number) => {
    if (depth > 6 || value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    const node = value as JsonLdNode;
    nodes.push(node);
    if (Array.isArray(node["@graph"])) visit(node["@graph"], depth + 1);
  };
  for (const block of blocks) {
    try {
      visit(JSON.parse(block), 0);
    } catch {
      /** A malformed ld+json block is skipped; the others still count. */
    }
  }
  return nodes;
}

function jsonLdString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = jsonLdString(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["name", "url", "@id"]) {
      if (typeof record[key] === "string") return record[key] as string;
    }
  }
  return null;
}

export function normalize(tags: RawTags, finalUrl: string): Metadata {
  const meta = tags.meta;
  const get = (key: string) => meta.get(key);
  const nodes = flattenJsonLd(tags.jsonLd);
  const node = (pick: (n: JsonLdNode) => unknown): string | null => {
    for (const candidate of nodes) {
      const value = jsonLdString(pick(candidate));
      if (value) return value;
    }
    return null;
  };

  const canonicalLink = tags.links.get("canonical")?.[0];
  const ogUrl = get("og:url");
  let canonical = absoluteUrl(canonicalLink, finalUrl) ?? absoluteUrl(ogUrl, finalUrl) ?? finalUrl;
  if (canonical.includes("/undefined") || canonical.includes("undefined/")) {
    canonical = finalUrl;
  }

  const title = firstOf([
    () => clean(get("og:title"), MAX_TITLE),
    () => clean(get("twitter:title"), MAX_TITLE),
    () =>
      clean(
        node((n) => n.headline ?? n.name),
        MAX_TITLE,
      ),
    () => clean(tags.title, MAX_TITLE),
  ]);

  const description = firstOf([
    () => clean(get("og:description"), MAX_DESCRIPTION),
    () => clean(get("twitter:description"), MAX_DESCRIPTION),
    () => clean(get("description"), MAX_DESCRIPTION),
    () =>
      clean(
        node((n) => n.description),
        MAX_DESCRIPTION,
      ),
  ]);

  const image = firstOf([
    () => absoluteUrl(get("og:image:secure_url"), canonical),
    () => absoluteUrl(get("og:image:url"), canonical),
    () => absoluteUrl(get("og:image"), canonical),
    () => absoluteUrl(get("twitter:image"), canonical),
    () => absoluteUrl(get("twitter:image:src"), canonical),
    () =>
      absoluteUrl(
        node((n) => n.image),
        canonical,
      ),
  ]);

  const logo = firstOf([
    () => absoluteUrl(tags.links.get("apple-touch-icon")?.[0], canonical),
    () => absoluteUrl(tags.links.get("icon")?.[0], canonical),
    () => absoluteUrl(tags.links.get("shortcut")?.[0], canonical),
    () => absoluteUrl(get("msapplication-tileimage"), canonical),
    () => absoluteUrl("/favicon.ico", canonical),
  ]);

  const publisher = firstOf([
    () => clean(get("og:site_name"), MAX_TITLE),
    () => clean(get("application-name"), MAX_TITLE),
    () =>
      clean(
        node((n) => n.publisher),
        MAX_TITLE,
      ),
    () => {
      try {
        return new URL(canonical).hostname.replace(/^www\./, "");
      } catch {
        return null;
      }
    },
  ]);

  const author = firstOf([
    () => clean(get("article:author"), MAX_TITLE),
    () => clean(get("author"), MAX_TITLE),
    () => clean(get("twitter:creator"), MAX_TITLE),
    () =>
      clean(
        node((n) => n.author),
        MAX_TITLE,
      ),
  ]);

  const date = firstOf([
    () => isoDate(get("article:published_time")),
    () => isoDate(get("article:modified_time")),
    () => isoDate(get("date")),
    () => isoDate(node((n) => n.datePublished ?? n.dateCreated)),
  ]);

  const lang = firstOf([
    () => languageTag(get("og:locale")),
    () => languageTag(tags.htmlLang),
    () => languageTag(node((n) => n.inLanguage)),
  ]);

  return {
    url: canonical,
    title,
    description,
    image,
    logo,
    publisher,
    author,
    date,
    lang,
    source: "fast",
  };
}

export function isGoodEnough(meta: Metadata): boolean {
  if (!meta.title) return false;
  return Boolean(meta.description || meta.image);
}
