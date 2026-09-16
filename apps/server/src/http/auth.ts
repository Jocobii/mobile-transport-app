import { createHash, timingSafeEqual } from "node:crypto";
import { API_KEY_HEADER } from "@transit/contracts";

/**
 * Checks the API key header in constant time.
 * Both values are hashed first so the comparison does not leak the key length.
 */
export function hasValidApiKey(request: Request, expectedApiKey: string): boolean {
  const providedApiKey = request.headers.get(API_KEY_HEADER);
  if (providedApiKey === null) {
    return false;
  }
  return timingSafeEqual(sha256(providedApiKey), sha256(expectedApiKey));
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}
