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

/**
 * Checks the `Authorization: Bearer <token>` header in constant time.
 * Used by the cron route, which authenticates with `CRON_SECRET` instead of an API key.
 */
export function hasValidBearerToken(request: Request, expectedToken: string): boolean {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return false;
  }
  const providedToken = header.slice("Bearer ".length);
  return timingSafeEqual(sha256(providedToken), sha256(expectedToken));
}
