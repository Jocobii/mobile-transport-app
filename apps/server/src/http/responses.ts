import type { ApiErrorBody, ApiErrorCode } from "@transit/contracts";

/** Cache policy for responses that must always be fresh. */
export const NO_STORE = "no-store";

const STATUS_BY_ERROR_CODE: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  invalid_request: 400,
  not_found: 404,
  server_misconfigured: 500,
  internal_error: 500,
};

export function jsonResponse<T>(
  body: T,
  options: { status?: number; cacheControl: string },
): Response {
  return Response.json(body, {
    status: options.status ?? 200,
    headers: { "cache-control": options.cacheControl },
  });
}

export function errorResponse(code: ApiErrorCode, message: string): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return jsonResponse(body, { status: STATUS_BY_ERROR_CODE[code], cacheControl: NO_STORE });
}
