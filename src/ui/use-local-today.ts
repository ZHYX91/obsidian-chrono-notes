import { useEffect, useState } from "react";

import {
  isSameLocalDate,
  type LocalDate,
} from "../core/periodic/periodic-date";
import {
  getCurrentLocalDate,
  getMillisecondsUntilNextLocalDay,
} from "../shared/local-date-clock";

export function useLocalToday(): LocalDate {
  const [today, setToday] = useState(getCurrentLocalDate);

  useEffect(() => {
    let timeout: number | null = null;
    const synchronize = () => {
      if (timeout !== null) window.clearTimeout(timeout);
      const now = new Date();
      const current = getCurrentLocalDate(now);
      setToday((previous) =>
        isSameLocalDate(previous, current) ? previous : current,
      );
      timeout = window.setTimeout(
        synchronize,
        getMillisecondsUntilNextLocalDay(now),
      );
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") synchronize();
    };

    synchronize();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      if (timeout !== null) window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return today;
}
