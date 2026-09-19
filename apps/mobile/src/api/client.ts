import { createApiClient } from "@transit/api-client";

// Expo only inlines `process.env.EXPO_PUBLIC_*` when the variable is referenced statically.
const baseUrl = process.env.EXPO_PUBLIC_API_URL;
const apiKey = process.env.EXPO_PUBLIC_API_KEY;

if (!baseUrl) {
  throw new Error("EXPO_PUBLIC_API_URL is not set. Copy apps/mobile/.env.example to .env.local.");
}

/** The only place that reads the API environment variables. */
export const apiClient = createApiClient({ baseUrl, apiKey });
