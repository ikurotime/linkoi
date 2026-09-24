export interface RawTags {
  meta: Map<string, string>;
  links: Map<string, string[]>;
  title?: string;
  jsonLd: string[];
  htmlLang?: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  hellip: "\u2026",
  mdash: "\u2014",
  ndash: "\u2013",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201c",
  rdquo: "\u201d",
  eacute: "\u00e9",
  egrave: "\u00e8",
  aacute: "\u00e1",
  iacute: "\u00ed",
  oacute: "\u00f3",
  uacute: "\u00fa",
  ntilde: "\u00f1",
  uuml: "\u00fc",
  ccedil: "\u00e7",
};

export function decodeEntities(input: string): string {
  if (!input.includes("&")) return input;
  return input.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);?/gi, (match, body: string) => {
    if (body.startsWith("#")) {
      const codePoint =
        body[1]?.toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff) {
        try {
          return String.fromCodePoint(codePoint);
        } catch {
          return match;
        }
      }
      return match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

function headOf(html: string): string {
  const match = /<\/head\s*>/i.exec(html);
  if (match) return html.slice(0, match.index + match[0].length);
  return html.slice(0, 96 * 1024);
}

function extractAttr(snippet: string, attrName: string): string | null {
  const escaped = attrName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]*))`, "i");
  const m = re.exec(snippet);
  return m ? (m[1] ?? m[2] ?? m[3] ?? null) : null;
}

function extractWithRegex(html: string): RawTags {
  const tags: RawTags = { meta: new Map(), links: new Map(), jsonLd: [] };

  const htmlLang = /<html[^>]*\slang\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))/i.exec(html);
  if (htmlLang)
    tags.htmlLang = (htmlLang[1] ?? htmlLang[2] ?? htmlLang[3] ?? "").trim() || undefined;

  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (titleMatch) tags.title = (titleMatch[1] ?? "").trim() || undefined;

  let m: RegExpExecArray | null;
  const metaRe = /<meta\s+([^>]*?)>/gi;
  while ((m = metaRe.exec(html)) !== null) {
    const snippet = m[1]!;
    const key = extractAttr(snippet, "property") ?? extractAttr(snippet, "name");
    const content = extractAttr(snippet, "content");
    if (key && content) {
      const normalizedKey = key.trim().toLowerCase();
      if (!tags.meta.has(normalizedKey)) tags.meta.set(normalizedKey, content);
      continue;
    }
    const charset = extractAttr(snippet, "charset");
    if (charset && !tags.meta.has("charset")) tags.meta.set("charset", charset);
  }

  const linkRe = /<link\s+([^>]*?)>/gi;
  while ((m = linkRe.exec(html)) !== null) {
    const snippet = m[1]!;
    const rel = extractAttr(snippet, "rel");
    const href = extractAttr(snippet, "href");
    if (rel && href) {
      for (const token of rel.trim().toLowerCase().split(/\s+/)) {
        const existing = tags.links.get(token);
        if (existing) existing.push(href);
        else tags.links.set(token, [href]);
      }
    }
  }

  const scriptRe =
    /<script[^>]*type\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/gi;
  while ((m = scriptRe.exec(html)) !== null) {
    tags.jsonLd.push(m[1]!);
  }

  return tags;
}

/**
 * Minimal shape of the Cloudflare HTMLRewriter API.
 *
 * Declared locally rather than pulled from @cloudflare/workers-types because
 * this module also runs where HTMLRewriter does not exist — that is what the
 * regex fallback below is for — so the global is looked up, not imported.
 */
interface RewriterElement {
  getAttribute(name: string): string | null;
  onEndTag(handler: () => void): void;
}

interface RewriterTextChunk {
  text: string;
  lastInTextNode: boolean;
}

interface RewriterHandlers {
  element?: (el: RewriterElement) => void;
  text?: (chunk: RewriterTextChunk) => void;
}

interface HTMLRewriterLike {
  on(selector: string, handlers: RewriterHandlers): HTMLRewriterLike;
  transform(response: Response): Response;
}

type HTMLRewriterCtor = new () => HTMLRewriterLike;

function getRewriterCtor(): HTMLRewriterCtor | undefined {
  return (globalThis as { HTMLRewriter?: HTMLRewriterCtor }).HTMLRewriter;
}

async function extractWithRewriter(html: string): Promise<RawTags> {
  const tags: RawTags = { meta: new Map(), links: new Map(), jsonLd: [] };

  let titleBuffer = "";
  let jsonLdBuffer = "";
  let inJsonLd = false;

  const Rewriter = getRewriterCtor();
  if (!Rewriter) return extractWithRegex(html);

  const rewriter = new Rewriter()
    .on("html", {
      element(el: RewriterElement) {
        const lang = el.getAttribute("lang");
        if (lang) tags.htmlLang = lang.trim();
      },
    })
    .on("meta", {
      element(el: RewriterElement) {
        const key = el.getAttribute("property") ?? el.getAttribute("name");
        const content = el.getAttribute("content");
        if (key && content) {
          const normalizedKey = key.trim().toLowerCase();
          if (!tags.meta.has(normalizedKey)) {
            tags.meta.set(normalizedKey, content);
          }
          return;
        }
        const charset = el.getAttribute("charset");
        if (charset && !tags.meta.has("charset")) tags.meta.set("charset", charset);
      },
    })
    .on("link", {
      element(el: RewriterElement) {
        const rel = el.getAttribute("rel");
        const href = el.getAttribute("href");
        if (!rel || !href) return;
        for (const token of rel.trim().toLowerCase().split(/\s+/)) {
          const existing = tags.links.get(token);
          if (existing) existing.push(href);
          else tags.links.set(token, [href]);
        }
      },
    })
    .on("title", {
      text(chunk: RewriterTextChunk) {
        titleBuffer += chunk.text;
        if (chunk.lastInTextNode && !tags.title) {
          tags.title = titleBuffer;
          titleBuffer = "";
        }
      },
    })
    .on('script[type="application/ld+json"]', {
      element(el: RewriterElement) {
        inJsonLd = true;
        jsonLdBuffer = "";
        el.onEndTag(() => {
          if (jsonLdBuffer.trim()) tags.jsonLd.push(jsonLdBuffer);
          inJsonLd = false;
          jsonLdBuffer = "";
        });
      },
      text(chunk: RewriterTextChunk) {
        if (inJsonLd) jsonLdBuffer += chunk.text;
      },
    });

  await rewriter.transform(new Response(headOf(html))).arrayBuffer();
  return tags;
}

export async function extractRawTags(html: string): Promise<RawTags> {
  if (getRewriterCtor()) {
    return extractWithRewriter(html);
  }
  return extractWithRegex(html);
}

export { headOf };
