import { ApiError } from "@transit/api-client";

/**
 * Which i18n key to show for an error caught from `@transit/api-client` (EPIC-010): the owner's
 * access-control message for `access_denied`, the generic error otherwise.
 */
export function errorMessageKey(error: unknown): "common.error" | "errors.accessDenied" {
  if (error instanceof ApiError && error.code === "access_denied") {
    return "errors.accessDenied";
  }
  return "common.error";
}
