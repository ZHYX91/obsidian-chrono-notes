import { shiftPeriod, type LocalDate } from "../../core/periodic/periodic-date";
import { isInteractiveCalendarDate } from "../../features/calendar/date-picker";

export function moveCalendarSelection(
  date: LocalDate,
  key: string,
  direction: "ltr" | "rtl" = "ltr",
): LocalDate {
  const offset = (() => {
    switch (key) {
      case "ArrowLeft":
        return direction === "rtl" ? 1 : -1;
      case "ArrowRight":
        return direction === "rtl" ? -1 : 1;
      case "ArrowUp":
        return -7;
      case "ArrowDown":
        return 7;
      default:
        return 0;
    }
  })();
  if (offset === 0) return date;
  const next = shiftPeriod(date, "daily", offset, "monday");
  return isInteractiveCalendarDate(next) ? next : date;
}
