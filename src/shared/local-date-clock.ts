import type { LocalDate } from "../core/periodic/periodic-date";

export function getCurrentLocalDate(now: Date = new Date()): LocalDate {
  assertValidDate(now);
  return Object.freeze({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  });
}

export function getMillisecondsUntilNextLocalDay(now: Date = new Date()): number {
  assertValidDate(now);
  const next = new Date(now.getTime());
  next.setHours(24, 0, 0, 0);
  const delay = next.getTime() - now.getTime();
  if (!Number.isFinite(delay) || delay <= 0) {
    throw new RangeError("Unable to resolve the next local day");
  }
  return delay;
}

function assertValidDate(value: Date): void {
  if (!Number.isFinite(value.getTime())) throw new RangeError("Invalid clock date");
}
