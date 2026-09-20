import { describe, expect, it } from "vitest";
import { createClock } from "./clock";

function fakeTimers() {
  let callback: (() => void) | undefined;
  let started = 0;
  let cleared = 0;
  return {
    timers: {
      setInterval(cb: () => void) {
        started += 1;
        callback = cb;
        return "handle";
      },
      clearInterval() {
        cleared += 1;
        callback = undefined;
      },
    },
    tick: () => callback?.(),
    get started() {
      return started;
    },
    get cleared() {
      return cleared;
    },
    get running() {
      return callback !== undefined;
    },
  };
}

describe("createClock", () => {
  it("shares one timer between listeners and passes the current time", () => {
    const fake = fakeTimers();
    let now = 100;
    const clock = createClock(fake.timers, () => now);
    const first: number[] = [];
    const second: number[] = [];
    clock.subscribe((value) => first.push(value));
    clock.subscribe((value) => second.push(value));

    now = 101;
    fake.tick();

    expect(fake.started).toBe(1);
    expect(first).toEqual([101]);
    expect(second).toEqual([101]);
  });

  it("stops the timer when the last listener leaves and restarts it for the next", () => {
    const fake = fakeTimers();
    const clock = createClock(fake.timers, () => 1);
    const offA = clock.subscribe(() => undefined);
    const offB = clock.subscribe(() => undefined);

    offA();
    expect(fake.running).toBe(true);
    offB();
    expect(fake.running).toBe(false);
    expect(fake.cleared).toBe(1);

    clock.subscribe(() => undefined);
    expect(fake.started).toBe(2);
  });

  it("does not call a listener that unsubscribed", () => {
    const fake = fakeTimers();
    const clock = createClock(fake.timers, () => 5);
    const calls: number[] = [];
    const off = clock.subscribe((value) => calls.push(value));
    clock.subscribe(() => undefined);
    off();
    fake.tick();
    expect(calls).toEqual([]);
  });
});
