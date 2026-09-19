import { useEffect, useState } from "react";

const TICK_MS = 1000;

const nowInSeconds = () => Math.floor(Date.now() / 1000);

/** Current time in epoch seconds, refreshed every second. */
export function useNow(): number {
  const [now, setNow] = useState(nowInSeconds);

  useEffect(() => {
    const id = setInterval(() => setNow(nowInSeconds()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  return now;
}
