import { describe, expect, it } from "vitest";
import { createPollController, type PollTimers } from "./poll-controller";

const INTERVAL_MS = 20_000;

/** Manual timers: nothing fires until `advance` is called. */
function createFakeTimers() {
  let time = 0;
  let nextId = 1;
  const pending = new Map<number, { at: number; callback: () => void }>();

  const timers: PollTimers = {
    setTimeout(callback, delayMs) {
      const id = nextId++;
      pending.set(id, { at: time + delayMs, callback });
      return id;
    },
    clearTimeout(handle) {
      pending.delete(handle as number);
    },
  };

  return {
    timers,
    pendingCount: () => pending.size,
    async advance(ms: number) {
      time += ms;
      for (const [id, timer] of [...pending]) {
        if (timer.at <= time) {
          pending.delete(id);
          timer.callback();
        }
      }
      await flush();
    },
  };
}

async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

/** A fetcher whose calls are resolved or rejected by the test, in any order. */
function createControlledFetcher() {
  const calls: { resolve: (value: string) => void; reject: (error: unknown) => void }[] = [];
  const fetcher = () =>
    new Promise<string>((resolve, reject) => {
      calls.push({ resolve, reject });
    });
  return { fetcher, calls };
}

function setup() {
  const fake = createFakeTimers();
  const { fetcher, calls } = createControlledFetcher();
  const successes: { data: string; at: number }[] = [];
  const errors: unknown[] = [];
  const controller = createPollController<string>({
    fetcher,
    intervalMs: INTERVAL_MS,
    timers: fake.timers,
    now: () => 1000,
    onSuccess: (data, at) => successes.push({ data, at }),
    onError: (error) => errors.push(error),
  });
  return { fake, calls, successes, errors, controller };
}

describe("createPollController", () => {
  it("fetches immediately on resume and reports the success with its timestamp", async () => {
    const { calls, successes, controller } = setup();

    controller.resume();
    expect(calls).toHaveLength(1);
    calls[0]?.resolve("a");
    await flush();

    expect(successes).toEqual([{ data: "a", at: 1000 }]);
  });

  it("schedules the next fetch one interval after the previous one settles", async () => {
    const { fake, calls, controller } = setup();
    controller.resume();
    calls[0]?.resolve("a");
    await flush();

    await fake.advance(INTERVAL_MS - 1);
    expect(calls).toHaveLength(1);
    await fake.advance(1);
    expect(calls).toHaveLength(2);
  });

  it("does not schedule the next fetch while the current one is still in flight", async () => {
    const { fake, calls, controller } = setup();
    controller.resume();

    await fake.advance(INTERVAL_MS * 3);

    expect(calls).toHaveLength(1);
  });

  it("keeps polling after a failed fetch and reports the error", async () => {
    const { fake, calls, errors, controller } = setup();
    controller.resume();
    calls[0]?.reject(new Error("offline"));
    await flush();

    expect(errors).toHaveLength(1);
    await fake.advance(INTERVAL_MS);
    expect(calls).toHaveLength(2);
  });

  it("stops polling while paused and fetches again immediately on resume", async () => {
    const { fake, calls, controller } = setup();
    controller.resume();
    calls[0]?.resolve("a");
    await flush();

    controller.pause();
    await fake.advance(INTERVAL_MS * 3);
    expect(calls).toHaveLength(1);
    expect(fake.pendingCount()).toBe(0);

    controller.resume();
    expect(calls).toHaveLength(2);
  });

  it("ignores a response that arrives while paused", async () => {
    const { calls, successes, controller } = setup();
    controller.resume();
    controller.pause();
    calls[0]?.resolve("late");
    await flush();

    expect(successes).toEqual([]);
  });

  it("ignores every response after stop", async () => {
    const { fake, calls, successes, errors, controller } = setup();
    controller.resume();
    controller.stop();
    calls[0]?.resolve("stale");
    await flush();
    await fake.advance(INTERVAL_MS * 2);

    expect(successes).toEqual([]);
    expect(errors).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it("applies only the response of the latest request when a refetch overlaps", async () => {
    const { calls, successes, controller } = setup();
    controller.resume();
    controller.refetch();
    expect(calls).toHaveLength(2);

    calls[1]?.resolve("new");
    calls[0]?.resolve("old");
    await flush();

    expect(successes.map((s) => s.data)).toEqual(["new"]);
  });

  it("does nothing on refetch while paused", () => {
    const { calls, controller } = setup();
    controller.refetch();
    expect(calls).toHaveLength(0);
  });
});
