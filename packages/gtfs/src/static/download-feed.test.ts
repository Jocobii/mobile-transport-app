import { describe, expect, it, vi } from "vitest";
import { downloadStaticFeed } from "./download-feed";

function fakeFetch(response: { ok: boolean; status: number; body?: Uint8Array }) {
  return vi.fn(async (_url: string | Request | URL, init?: RequestInit) => {
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    return {
      ok: response.ok,
      status: response.status,
      arrayBuffer: async () => (response.body ?? new Uint8Array()).buffer,
    } as Response;
  });
}

describe("downloadStaticFeed", () => {
  it("returns the response bytes on success", async () => {
    const body = new Uint8Array([1, 2, 3]);
    const fetchImpl = fakeFetch({ ok: true, status: 200, body });

    const result = await downloadStaticFeed("https://example.test/gtfs.zip", {
      userAgent: "transit-app/0.1",
      timeoutMs: 1000,
      fetchImpl,
    });

    expect(result).toEqual(body);
  });

  it("sends the configured user agent", async () => {
    const fetchImpl = fakeFetch({ ok: true, status: 200 });

    await downloadStaticFeed("https://example.test/gtfs.zip", {
      userAgent: "transit-app/0.1",
      timeoutMs: 1000,
      fetchImpl,
    });

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["user-agent"]).toBe("transit-app/0.1");
  });

  it("throws with the url and status on a non-2xx response", async () => {
    const fetchImpl = fakeFetch({ ok: false, status: 503 });

    await expect(
      downloadStaticFeed("https://example.test/gtfs.zip", {
        userAgent: "transit-app/0.1",
        timeoutMs: 1000,
        fetchImpl,
      }),
    ).rejects.toThrow(/https:\/\/example\.test\/gtfs\.zip.*503/);
  });
});
