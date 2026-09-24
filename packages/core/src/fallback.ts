import type { Metadata } from "./normalize.js";

type MetascraperFn = (input: { html: string; url: string }) => Promise<Record<string, unknown>>;

let cachedInstance: MetascraperFn | null = null;

async function getMetascraper(): Promise<MetascraperFn> {
  if (cachedInstance) return cachedInstance;

  const [factory, title, description, image, logo, author, date, lang, publisher, url] =
    await Promise.all([
      import("metascraper"),
      import("metascraper-title"),
      import("metascraper-description"),
      import("metascraper-image"),
      import("metascraper-logo"),
      import("metascraper-author"),
      import("metascraper-date"),
      import("metascraper-lang"),
      import("metascraper-publisher"),
      import("metascraper-url"),
    ]);

  const create = (factory.default ?? factory) as (rules: unknown[]) => MetascraperFn;
  const rule = (mod: { default?: unknown }) => ((mod.default ?? mod) as () => unknown)();

  cachedInstance = create([
    rule(title),
    rule(description),
    rule(image),
    rule(logo),
    rule(author),
    rule(date),
    rule(lang),
    rule(publisher),
    rule(url),
  ]);

  return cachedInstance;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function extractWithFallback(
  html: string,
  finalUrl: string,
  fastResult: Metadata,
): Promise<Metadata> {
  const metascraper = await getMetascraper();
  const result = await metascraper({ html, url: finalUrl });

  return {
    url: asString(result.url) ?? fastResult.url,
    title: asString(result.title) ?? fastResult.title,
    description: asString(result.description) ?? fastResult.description,
    image: asString(result.image) ?? fastResult.image,
    logo: asString(result.logo) ?? fastResult.logo,
    publisher: asString(result.publisher) ?? fastResult.publisher,
    author: asString(result.author) ?? fastResult.author,
    date: asString(result.date) ?? fastResult.date,
    lang: asString(result.lang) ?? fastResult.lang,
    source: "fallback",
  };
}
