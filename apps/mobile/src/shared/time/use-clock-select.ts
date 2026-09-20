import { useEffect, useReducer, useRef } from "react";
import { appClock, nowInSeconds } from "./clock";

/** True when both flat objects have the same own keys with `Object.is` equal values. */
export function shallowEqual<T extends object>(a: T, b: T): boolean {
  const keys = Object.keys(a) as Array<keyof T>;
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => Object.is(a[key], b[key]));
}

/**
 * Derives a value from the current time and re-renders only when that value changes, not every
 * second. A row showing "5 min" renders once a minute instead of 60 times.
 * `select` must be pure; `isEqual` decides whether two results are the same (default `Object.is`).
 */
export function useClockSelect<T>(
  select: (nowSeconds: number) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const value = select(nowInSeconds());
  const latest = useRef({ select, isEqual, value });
  latest.current = { select, isEqual, value };
  const [, rerender] = useReducer((count: number) => count + 1, 0);

  useEffect(
    () =>
      appClock.subscribe((now) => {
        const { select: currentSelect, isEqual: currentIsEqual, value: shown } = latest.current;
        if (!currentIsEqual(currentSelect(now), shown)) rerender();
      }),
    [],
  );

  return value;
}
