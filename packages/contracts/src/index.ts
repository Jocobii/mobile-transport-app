/**
 * Public API contract (v1). The server maps domain objects to these shapes;
 * the mobile app only depends on this package.
 * Endpoints are defined in the project decisions document.
 */

export const API_VERSION = "v1";

/** Header used to send the API key. */
export const API_KEY_HEADER = "x-api-key";

/** Stable error codes. Clients may branch on these; never rename a published code. */
export type ApiErrorCode =
  | "unauthorized"
  | "invalid_request"
  | "not_found"
  | "server_misconfigured"
  | "internal_error";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export interface FeedHealth {
  agencyId: string;
  ok: boolean;
  /** Unix epoch seconds reported by the feed. */
  dataTimestamp?: number;
  /** Unix epoch seconds when the server last fetched the feed. */
  fetchedAt?: number;
}

/** GET /api/v1/health */
export interface HealthResponse {
  status: "ok" | "degraded";
  /** Unix epoch seconds when the response was produced. */
  checkedAt: number;
  catalogVersion?: string;
  feeds: FeedHealth[];
}
