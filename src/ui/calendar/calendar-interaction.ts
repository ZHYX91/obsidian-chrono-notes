import { shiftPeriod, type LocalDate } from "../../core/periodic/periodic-date";

export function moveCalendarSelection(date: LocalDate, key: string): LocalDate {
  const offset = (() => {
    switch (key) {
      case "ArrowLeft":
        return -1;
      case "ArrowRight":
        return 1;
      case "ArrowUp":
        return -7;
      case "ArrowDown":
        return 7;
      default:
        return 0;
    }
  })();
  return offset === 0 ? date : shiftPeriod(date, "daily", offset, "monday");
}
