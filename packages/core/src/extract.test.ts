import { describe, it, expect } from "bun:test";
import { decodeEntities, extractRawTags, headOf } from "./extract.js";

describe("decodeEntities", () => {
  it("decodes common named entities", () => {
    expect(decodeEntities("&amp; &lt; &gt; &quot; &apos;")).toBe("& < > \" '");
  });

  it("decodes numeric entities", () => {
    expect(decodeEntities("&#38; &#x26;")).toBe("& &");
  });

  it("decodes high code points", () => {
    expect(decodeEntities("&#x1f600;")).toBe("\u{1f600}");
  });

  it("passes through text without entities", () => {
    expect(decodeEntities("hello world")).toBe("hello world");
  });

  it("handles nbsp", () => {
    expect(decodeEntities("hello&nbsp;world")).toBe("hello\u00a0world");
  });

  it("leaves unknown entities as-is", () => {
    expect(decodeEntities("&unknown;")).toBe("&unknown;");
  });
});

describe("headOf", () => {
  it("returns content up to </head>", () => {
    const html = "<html><head><title>Test</title></head><body></body></html>";
    expect(headOf(html)).toBe("<html><head><title>Test</title></head>");
  });

  it("returns first 96KB when no </head>", () => {
    const long = "<html>" + "a".repeat(100_000);
    const result = headOf(long);
    expect(result.length).toBeLessThanOrEqual(96 * 1024);
  });

  it("is case-insensitive for </head>", () => {
    const html = "<HEAD><title>T</title></HEAD><body></body>";
    expect(headOf(html)).toBe("<HEAD><title>T</title></HEAD>");
  });
});

describe("extractRawTags (regex fallback)", () => {
  async function extract(html: string) {
    return extractRawTags(html);
  }

  it("extracts meta tags by property", async () => {
    const html =
      '<html><head><meta property="og:title" content="Hello"><meta property="og:image" content="https://example.com/img.jpg"></head><body></body></html>';
    const tags = await extract(html);
    expect(tags.meta.get("og:title")).toBe("Hello");
    expect(tags.meta.get("og:image")).toBe("https://example.com/img.jpg");
  });

  it("extracts meta tags by name", async () => {
    const html = '<html><head><meta name="description" content="A description"></head></html>';
    const tags = await extract(html);
    expect(tags.meta.get("description")).toBe("A description");
  });

  it("prefers first value for duplicate meta keys", async () => {
    const html =
      '<html><head><meta property="og:title" content="First"><meta property="og:title" content="Second"></head></html>';
    const tags = await extract(html);
    expect(tags.meta.get("og:title")).toBe("First");
  });

  it("extracts title", async () => {
    const html = "<html><head><title>My Page Title</title></head><body></body></html>";
    const tags = await extract(html);
    expect(tags.title).toBe("My Page Title");
  });

  it("extracts html lang", async () => {
    const html = '<html lang="en-US"><head><title>T</title></head></html>';
    const tags = await extract(html);
    expect(tags.htmlLang).toBe("en-US");
  });

  it("extracts link tags", async () => {
    const html =
      '<html><head><link rel="canonical" href="https://example.com/"><link rel="icon" href="/favicon.ico"></head></html>';
    const tags = await extract(html);
    expect(tags.links.get("canonical")).toEqual(["https://example.com/"]);
    expect(tags.links.get("icon")).toEqual(["/favicon.ico"]);
  });

  it("collects multiple links with the same rel", async () => {
    const html =
      '<html><head><link rel="icon" href="/favicon-32.png" sizes="32x32"><link rel="icon" href="/favicon-64.png" sizes="64x64"></head></html>';
    const tags = await extract(html);
    expect(tags.links.get("icon")).toEqual(["/favicon-32.png", "/favicon-64.png"]);
  });

  it("extracts JSON-LD blocks", async () => {
    const html =
      '<html><head><script type="application/ld+json">{"@type":"WebPage","name":"Test"}</script></head></html>';
    const tags = await extract(html);
    expect(tags.jsonLd).toEqual(['{"@type":"WebPage","name":"Test"}']);
  });

  it("extracts charset meta", async () => {
    const html = '<html><head><meta charset="utf-8"></head></html>';
    const tags = await extract(html);
    expect(tags.meta.get("charset")).toBe("utf-8");
  });

  it("handles an empty document", async () => {
    const tags = await extract("");
    expect(tags.title).toBeUndefined();
    expect(tags.meta.size).toBe(0);
    expect(tags.links.size).toBe(0);
    expect(tags.jsonLd).toEqual([]);
  });
});
