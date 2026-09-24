import { describe, it, expect } from "bun:test";
import { normalize, isGoodEnough } from "./normalize.js";
import type { RawTags } from "./extract.js";

function tags(overrides?: Partial<RawTags>): RawTags {
  return {
    meta: new Map(),
    links: new Map(),
    jsonLd: [],
    title: undefined,
    htmlLang: undefined,
    ...overrides,
  };
}

describe("normalize", () => {
  it("uses og:title as primary title", () => {
    const t = tags({ meta: new Map([["og:title", "OG Title"]]), title: "HTML Title" });
    const meta = normalize(t, "https://example.com");
    expect(meta.title).toBe("OG Title");
  });

  it("falls back to twitter:title", () => {
    const t = tags({ meta: new Map([["twitter:title", "Twitter Title"]]), title: "HTML Title" });
    const meta = normalize(t, "https://example.com");
    expect(meta.title).toBe("Twitter Title");
  });

  it("falls back to html title", () => {
    const t = tags({ title: "HTML Title" });
    const meta = normalize(t, "https://example.com");
    expect(meta.title).toBe("HTML Title");
  });

  it("returns null for missing title", () => {
    const meta = normalize(tags(), "https://example.com");
    expect(meta.title).toBeNull();
  });

  it("uses og:description as primary description", () => {
    const t = tags({ meta: new Map([["og:description", "OG desc"]]) });
    const meta = normalize(t, "https://example.com");
    expect(meta.description).toBe("OG desc");
  });

  it("falls back to twitter:description then meta description", () => {
    const t = tags({ meta: new Map([["description", "Meta desc"]]) });
    const meta = normalize(t, "https://example.com");
    expect(meta.description).toBe("Meta desc");
  });

  it("uses og:image as primary image", () => {
    const t = tags({ meta: new Map([["og:image", "https://example.com/img.jpg"]]) });
    const meta = normalize(t, "https://example.com");
    expect(meta.image).toBe("https://example.com/img.jpg");
  });

  it("resolves relative og:image against canonical URL", () => {
    const t = tags({
      links: new Map([["canonical", ["https://example.com/page"]]]),
      meta: new Map([["og:image", "/img.jpg"]]),
    });
    const meta = normalize(t, "https://example.com/other");
    expect(meta.image).toBe("https://example.com/img.jpg");
  });

  it("uses canonical link for url", () => {
    const t = tags({ links: new Map([["canonical", ["https://canonical.example"]]]) });
    const meta = normalize(t, "https://original.example");
    expect(meta.url).toBe("https://canonical.example/");
  });

  it("falls back to og:url for canonical", () => {
    const t = tags({ meta: new Map([["og:url", "https://og.example/page"]]) });
    const meta = normalize(t, "https://original.example");
    expect(meta.url).toBe("https://og.example/page");
  });

  it("falls back to finalUrl", () => {
    const meta = normalize(tags(), "https://original.example/page");
    expect(meta.url).toBe("https://original.example/page");
  });

  it("uses apple-touch-icon as primary logo", () => {
    const t = tags({
      links: new Map([["apple-touch-icon", ["https://example.com/apple-icon.png"]]]),
    });
    const meta = normalize(t, "https://example.com");
    expect(meta.logo).toBe("https://example.com/apple-icon.png");
  });

  it("falls back to icon then favicon.ico", () => {
    const t = tags({ links: new Map([["icon", ["/icon.png"]]]) });
    const meta = normalize(t, "https://example.com");
    expect(meta.logo).toBe("https://example.com/icon.png");
  });

  it("uses og:site_name for publisher", () => {
    const t = tags({ meta: new Map([["og:site_name", "Example Site"]]) });
    const meta = normalize(t, "https://example.com");
    expect(meta.publisher).toBe("Example Site");
  });

  it("falls back to hostname for publisher", () => {
    const meta = normalize(tags(), "https://www.example.com/page");
    expect(meta.publisher).toBe("example.com");
  });

  it("extracts author from article:author", () => {
    const t = tags({ meta: new Map([["article:author", "John Doe"]]) });
    const meta = normalize(t, "https://example.com");
    expect(meta.author).toBe("John Doe");
  });

  it("parses ISO date from article:published_time", () => {
    const t = tags({ meta: new Map([["article:published_time", "2026-05-31T17:00:25Z"]]) });
    const meta = normalize(t, "https://example.com");
    expect(meta.date).toBe("2026-05-31T17:00:25.000Z");
  });

  it("rejects invalid dates", () => {
    const t = tags({ meta: new Map([["date", "not-a-date"]]) });
    const meta = normalize(t, "https://example.com");
    expect(meta.date).toBeNull();
  });

  it("extracts language from og:locale", () => {
    const t = tags({ meta: new Map([["og:locale", "es_ES"]]) });
    const meta = normalize(t, "https://example.com");
    expect(meta.lang).toBe("es");
  });

  it("falls back to html lang", () => {
    const t = tags({ htmlLang: "fr-CA" });
    const meta = normalize(t, "https://example.com");
    expect(meta.lang).toBe("fr");
  });

  it("truncates long title with ellipsis", () => {
    const long = "a".repeat(300);
    const t = tags({ title: long });
    const meta = normalize(t, "https://example.com");
    expect(meta.title?.length).toBe(200);
    expect(meta.title?.endsWith("\u2026")).toBe(true);
  });

  it("parses JSON-LD from script tags", () => {
    const t = tags({
      jsonLd: ['{"@type":"WebPage","headline":"JSON-LD Title","description":"JSON-LD desc"}'],
    });
    const meta = normalize(t, "https://example.com");
    expect(meta.title).toBe("JSON-LD Title");
    expect(meta.description).toBe("JSON-LD desc");
  });

  it("flattens @graph arrays in JSON-LD", () => {
    const t = tags({
      jsonLd: ['{"@graph":[{"@type":"WebPage","headline":"From Graph"}]}'],
    });
    const meta = normalize(t, "https://example.com");
    expect(meta.title).toBe("From Graph");
  });

  it("strips data: URLs from image", () => {
    const t = tags({ meta: new Map([["og:image", "data:image/png;base64,abc"]]) });
    const meta = normalize(t, "https://example.com");
    expect(meta.image).toBeNull();
  });
});

describe("isGoodEnough", () => {
  it("returns false when title is missing", () => {
    expect(
      isGoodEnough({
        url: "https://example.com",
        title: null,
        description: null,
        image: null,
        logo: null,
        publisher: null,
        author: null,
        date: null,
        lang: null,
        source: "fast",
      }),
    ).toBe(false);
  });

  it("returns true with title and description", () => {
    expect(
      isGoodEnough({
        url: "https://example.com",
        title: "T",
        description: "D",
        image: null,
        logo: null,
        publisher: null,
        author: null,
        date: null,
        lang: null,
        source: "fast",
      }),
    ).toBe(true);
  });

  it("returns true with title and image", () => {
    expect(
      isGoodEnough({
        url: "https://example.com",
        title: "T",
        description: null,
        image: "https://example.com/img.jpg",
        logo: null,
        publisher: null,
        author: null,
        date: null,
        lang: null,
        source: "fast",
      }),
    ).toBe(true);
  });

  it("returns false with only title and nothing else", () => {
    expect(
      isGoodEnough({
        url: "https://example.com",
        title: "T",
        description: null,
        image: null,
        logo: null,
        publisher: null,
        author: null,
        date: null,
        lang: null,
        source: "fast",
      }),
    ).toBe(false);
  });
});
