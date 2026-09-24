export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal", "instance-data"]);

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".onion"];

function isBlockedIPv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((p) => Number(p));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = octets;
  if (a! === 0 || a! === 10 || a! === 127) return true;
  if (a! === 169 && b! === 254) return true;
  if (a! === 172 && b! >= 16 && b! <= 31) return true;
  if (a! === 192 && b! === 168) return true;
  if (a! === 100 && b! >= 64 && b! <= 127) return true;
  if (a! >= 224) return true;
  return false;
}

function isBlockedIPv6(host: string): boolean {
  const inner = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (inner === "::" || inner === "::1") return true;
  if (inner.startsWith("fe80:")) return true;
  if (/^f[cd]/.test(inner)) return true;
  if (inner.startsWith("::ffff:")) return isBlockedIPv4(inner.slice(7));
  return false;
}

export function assertSafeUrl(raw: string, selfHosts: string[]): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Not a valid absolute URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError(`Unsupported scheme: ${url.protocol}`);
  }

  const host = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(host)) throw new UnsafeUrlError("Blocked hostname");
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) throw new UnsafeUrlError("Blocked hostname");
  if (host.startsWith("[") ? isBlockedIPv6(host) : isBlockedIPv4(host)) {
    throw new UnsafeUrlError("Blocked address range");
  }
  if (selfHosts.some((s) => host === s || host.endsWith(`.${s}`))) {
    throw new UnsafeUrlError("Refusing to fetch own hostname");
  }

  return url;
}

const STRIPPED_PARAMS = [
  /^utm_/,
  /^fbclid$/,
  /^gclid$/,
  /^mc_[ce]id$/,
  /^ref$/,
  /^ref_src$/,
  /^igshid$/,
  /^si$/,
];

export function canonicalize(url: URL): string {
  const out = new URL(url.toString());
  out.hash = "";
  out.hostname = out.hostname.toLowerCase();

  const keep: [string, string][] = [];
  for (const [key, value] of out.searchParams) {
    if (!STRIPPED_PARAMS.some((re) => re.test(key))) keep.push([key, value]);
  }
  keep.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  out.search = "";
  for (const [key, value] of keep) out.searchParams.append(key, value);

  return out.toString();
}
