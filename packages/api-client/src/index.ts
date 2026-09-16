import {
  API_KEY_HEADER,
  API_VERSION,
  type ApiErrorBody,
  type ApiErrorCode,
  type HealthResponse,
} from "@transit/contracts";

export interface ApiClientOptions {
  baseUrl: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | "http_error",
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createApiClient(options: ApiClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const root = `${options.baseUrl.replace(/\/$/, "")}/api/${API_VERSION}`;

  async function get<T>(path: string): Promise<T> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (options.apiKey) headers[API_KEY_HEADER] = options.apiKey;

    const response = await fetchImpl(`${root}${path}`, { headers });
    if (!response.ok) {
      const body = (await response.json().catch(() => undefined)) as ApiErrorBody | undefined;
      throw new ApiError(
        response.status,
        body?.error.code ?? "http_error",
        body?.error.message ?? response.statusText,
      );
    }
    return (await response.json()) as T;
  }

  return {
    getHealth: () => get<HealthResponse>("/health"),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
