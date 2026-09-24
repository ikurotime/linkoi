import { UnsafeUrlError, assertSafeUrl } from "./guard.js";

export class FetchHtmlError extends Error {
  /**
   * Declared and assigned rather than written as a `readonly` constructor
   * parameter: parameter properties are TypeScript-only syntax that cannot be
   * erased, which `erasableSyntaxOnly` in @tabstash/tsconfig rules out.
   */
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface FetchHtmlOptions {
  maxBytes: number;
  timeoutMs: number;
  selfHosts: string[];
  maxRedirects?: number;
}

export interface FetchedDocument {
  html: string;
  finalUrl: string;
  contentType: string;
  truncated: boolean;
}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36";
const META_HEAD_SNIFF_BYTES = 2048;

/**
 * Both fields spelled out: the workers-types TextDecoder requires ignoreBOM,
 * so `{ fatal: false }` alone does not typecheck there. This used to be cast
 * through `any`, which silenced the real requirement.
 */
const DECODER_OPTIONS = { fatal: false, ignoreBOM: false } as const;

function decode(bytes: Uint8Array, contentType: string): string {
  const declared = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType)?.[1];
  const sniffed = declared
    ? undefined
    : /charset\s*=\s*["']?([\w-]+)/i.exec(
        new TextDecoder("utf-8", DECODER_OPTIONS).decode(bytes.slice(0, META_HEAD_SNIFF_BYTES)),
      )?.[1];
  const label = (declared ?? sniffed ?? "utf-8").toLowerCase();
  if (label !== "utf-8" && label !== "utf8") {
    try {
      return new TextDecoder(label, DECODER_OPTIONS).decode(bytes);
    } catch {
      /** Unknown charset label — fall through to the UTF-8 decode below. */
    }
  }
  return new TextDecoder("utf-8", DECODER_OPTIONS).decode(bytes);
}

async function readCapped(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  let truncated = false;

  try {
    while (received < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      const part = value.subarray(0, maxBytes - received);
      chunks.push(part);
      received += part.byteLength;
    }
    if (received >= maxBytes) {
      truncated = true;
      await reader.cancel();
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, truncated };
}

export async function fetchHtml(target: URL, opts: FetchHtmlOptions): Promise<FetchedDocument> {
  const maxRedirects = opts.maxRedirects ?? 5;
  const maxRetries = 2;
  let current = target;
  let lastError: FetchHtmlError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }

    for (let hop = 0; hop <= maxRedirects; hop++) {
      let response: Response;
      try {
        response = await fetch(current.toString(), {
          redirect: "manual",
          signal: AbortSignal.timeout(opts.timeoutMs),
          headers: {
            "user-agent": USER_AGENT,
            accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
            "accept-language": "en,es;q=0.9,*;q=0.5",
          },
        });
      } catch (err) {
        throw new FetchHtmlError(
          `Upstream fetch failed: ${err instanceof Error ? err.message : "unknown"}`,
          502,
        );
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new FetchHtmlError("Redirect without Location header", 502);
        try {
          current = assertSafeUrl(new URL(location, current).toString(), opts.selfHosts);
        } catch (err) {
          if (err instanceof UnsafeUrlError)
            throw new FetchHtmlError(`Unsafe redirect target: ${err.message}`, 400);
          throw err;
        }
        continue;
      }

      if (response.status === 429) {
        lastError = new FetchHtmlError("Upstream responded 429", 429);
        break;
      }

      if (!response.ok) {
        throw new FetchHtmlError(`Upstream responded ${response.status}`, 502);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!/text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType)) {
        throw new FetchHtmlError(`Not an HTML document (${contentType})`, 415);
      }

      if (!response.body) throw new FetchHtmlError("Empty response body", 502);

      const { bytes, truncated } = await readCapped(response.body, opts.maxBytes);
      return {
        html: decode(bytes, contentType),
        finalUrl: current.toString(),
        contentType,
        truncated,
      };
    }

    if (!lastError) break;
    if (lastError.status !== 429) throw lastError;
  }

  if (lastError) throw lastError;
  throw new FetchHtmlError("Too many redirects", 502);
}
