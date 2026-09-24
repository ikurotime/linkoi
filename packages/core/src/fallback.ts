import type { Metadata } from "./normalize.js";

/** @deprecated Compatibility shim. Returns Linkoi's result without external extraction. */
export async function extractWithFallback(
  _html: string,
  _finalUrl: string,
  result: Metadata,
): Promise<Metadata> {
  return result;
}
