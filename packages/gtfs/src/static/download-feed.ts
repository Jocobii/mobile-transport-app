export interface DownloadStaticFeedOptions {
  userAgent: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch | undefined;
}

/**
 * Downloads a GTFS static feed (a zip archive) as raw bytes.
 * Throws with the URL and status on a non-2xx response.
 */
export async function downloadStaticFeed(
  url: string,
  options: DownloadStaticFeedOptions,
): Promise<Uint8Array> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetchImpl(url, {
      headers: { "user-agent": options.userAgent },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Failed to download GTFS feed from ${url}: HTTP ${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}
