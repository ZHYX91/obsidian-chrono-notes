import { useEffect, useState } from "react";

import {
  isSameLocalDate,
  type LocalDate,
} from "../core/periodic/periodic-date";
import {
  getCurrentLocalDate,
  getMillisecondsUntilNextLocalDay,
} from "../shared/local-date-clock";
import { useHostEnvironment } from "./host-environment";

export function useLocalToday(): LocalDate {
  const host = useHostEnvironment();
  const [today, setToday] = useState(getCurrentLocalDate);

  useEffect(() => {
    let timeout: number | null = null;
    const synchronize = () => {
      if (timeout !== null) host.window.clearTimeout(timeout);
      const now = new Date();
      const current = getCurrentLocalDate(now);
      setToday((previous) =>
        isSameLocalDate(previous, current) ? previous : current,
      );
      timeout = host.window.setTimeout(
        synchronize,
        getMillisecondsUntilNextLocalDay(now),
      );
    };
    const handleVisibilityChange = () => {
      if (host.document.visibilityState === "visible") synchronize();
    };

    synchronize();
    host.document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      if (timeout !== null) host.window.clearTimeout(timeout);
      host.document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [host.document, host.window]);

  return today;
}
