import {
  parseLocalDateKey,
  type LocalDate,
} from "../../core/periodic/periodic-date";

export function parsePropertyDateInput(value: string): LocalDate | null {
  return parseLocalDateKey(value.trim());
}
