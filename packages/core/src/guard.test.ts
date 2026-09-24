import { describe, it, expect } from "bun:test";
import { assertSafeUrl, UnsafeUrlError, canonicalize } from "./guard.js";

describe("assertSafeUrl", () => {
  const noSelf = [] as string[];

  it("accepts a valid https URL", () => {
    const url = assertSafeUrl("https://example.com/page", noSelf);
    expect(url.href).toBe("https://example.com/page");
  });

  it("accepts http", () => {
    const url = assertSafeUrl("http://example.com/page", noSelf);
    expect(url.protocol).toBe("http:");
  });

  it.each(["ftp://example.com", "file:///etc/passwd", "gopher://example.com"])(
    "rejects non-http scheme %s",
    (raw) => {
      expect(() => assertSafeUrl(raw, noSelf)).toThrow(UnsafeUrlError);
    },
  );

  it("rejects a malformed URL", () => {
    expect(() => assertSafeUrl("not a url", noSelf)).toThrow(UnsafeUrlError);
  });

  it.each([
    "http://127.0.0.1",
    "http://10.0.0.5",
    "http://169.254.169.254",
    "http://192.168.1.1",
    "http://172.16.0.1",
    "http://[::1]",
    "http://[fd00::1]",
    "http://localhost",
  ])("rejects private address %s", (raw) => {
    expect(() => assertSafeUrl(raw, noSelf)).toThrow(UnsafeUrlError);
  });

  it("rejects a self-referencing hostname", () => {
    expect(() =>
      assertSafeUrl("https://metadata.example.com/test", [
        "metadata.example.com",
      ]),
    ).toThrow(UnsafeUrlError);
  });

  it("rejects .local suffix", () => {
    expect(() => assertSafeUrl("https://mybox.local/test", noSelf)).toThrow(UnsafeUrlError);
  });

  it("rejects .onion suffix", () => {
    expect(() => assertSafeUrl("https://darkweb.onion/", noSelf)).toThrow(UnsafeUrlError);
  });

  it("rejects .internal suffix", () => {
    expect(() => assertSafeUrl("https://service.internal/", noSelf)).toThrow(UnsafeUrlError);
  });
});

describe("canonicalize", () => {
  it("strips utm_ parameters", () => {
    const result = canonicalize(new URL("https://example.com/page?utm_source=twitter&id=123"));
    expect(result).toBe("https://example.com/page?id=123");
  });

  it("strips fbclid", () => {
    const result = canonicalize(new URL("https://example.com/page?fbclid=abc123&q=hello"));
    expect(result).toBe("https://example.com/page?q=hello");
  });

  it("strips known tracking params", () => {
    const result = canonicalize(
      new URL("https://example.com/?gclid=abc&mc_cid=def&igshid=ghi&si=jkl"),
    );
    expect(result).toBe("https://example.com/");
  });

  it("sorts remaining parameters", () => {
    const result = canonicalize(new URL("https://example.com/?z=last&a=first&m=middle"));
    expect(result).toBe("https://example.com/?a=first&m=middle&z=last");
  });

  it("removes hash", () => {
    const result = canonicalize(new URL("https://example.com/page#section"));
    expect(result).toBe("https://example.com/page");
  });

  it("lowercases hostname", () => {
    const result = canonicalize(new URL("https://Example.COM/Path"));
    expect(result).toBe("https://example.com/Path");
  });
});
