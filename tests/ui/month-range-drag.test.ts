import { describe, expect, it } from "vitest";

import {
  isDateInMonthRange,
  MonthRangeDragGesture,
  type MonthRangeDragInput,
} from "../../src/ui/calendar/month-range-drag";

const primary: MonthRangeDragInput = {
  button: 0,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
};

describe("MonthRangeDragGesture", () => {
  it("previews and completes a normalized forward range", () => {
    const gesture = new MonthRangeDragGesture();

    expect(gesture.start(date(14), primary)).toEqual({
      start: date(14),
      end: date(14),
      didDrag: false,
    });
    expect(gesture.move(date(17), 1)).toEqual({
      start: date(14),
      end: date(17),
      didDrag: true,
    });
    expect(gesture.finish(date(17), 0)).toEqual({
      start: date(14),
      end: date(17),
    });
    expect(gesture.isActive()).toBe(false);
    expect(gesture.consumeClick()).toBe(true);
    expect(gesture.consumeClick()).toBe(false);
  });

  it("normalizes a reverse drag so callers can select the normalized end", () => {
    const gesture = new MonthRangeDragGesture();

    gesture.start(date(20), primary);
    expect(gesture.move(date(16), 1)).toEqual({
      start: date(16),
      end: date(20),
      didDrag: true,
    });
    expect(gesture.finish(date(16), 0)).toEqual({
      start: date(16),
      end: date(20),
    });
  });

  it("keeps an ordinary same-cell click and does not suppress it", () => {
    const gesture = new MonthRangeDragGesture();

    gesture.start(date(14), primary);

    expect(gesture.finish(date(14), 0)).toBeNull();
    expect(gesture.consumeClick()).toBe(false);
  });

  it.each([
    { ...primary, button: 1 },
    { ...primary, altKey: true },
    { ...primary, ctrlKey: true },
    { ...primary, metaKey: true },
    { ...primary, shiftKey: true },
  ])("ignores non-primary or modified starts %#", (input) => {
    const gesture = new MonthRangeDragGesture();

    expect(gesture.start(date(14), input)).toBeNull();
    expect(gesture.isActive()).toBe(false);
  });

  it("cancels when the primary button is no longer held during movement", () => {
    const gesture = new MonthRangeDragGesture();

    gesture.start(date(14), primary);

    expect(gesture.move(date(16), 0)).toBeNull();
    expect(gesture.isActive()).toBe(false);
    expect(gesture.finish(date(16), 0)).toBeNull();
  });

  it("cancels explicitly without leaving preview or click suppression", () => {
    const gesture = new MonthRangeDragGesture();

    gesture.start(date(14), primary);
    gesture.move(date(18), 1);
    gesture.cancel();

    expect(gesture.getPreview()).toBeNull();
    expect(gesture.finish(undefined, 0)).toBeNull();
    expect(gesture.consumeClick()).toBe(false);
  });

  it("finishes from the last crossed cell when mouseup occurs outside the grid", () => {
    const gesture = new MonthRangeDragGesture();

    gesture.start(date(14), primary);
    gesture.move(date(19), 1);

    expect(gesture.finish(undefined, 0)).toEqual({
      start: date(14),
      end: date(19),
    });
  });

  it("clears stale click suppression when any new mouse gesture starts", () => {
    const gesture = new MonthRangeDragGesture();

    gesture.start(date(14), primary);
    gesture.move(date(16), 1);
    gesture.finish(date(16), 0);
    gesture.start(date(20), { ...primary, ctrlKey: true });

    expect(gesture.consumeClick()).toBe(false);
  });

  it("identifies preview cells across month boundaries", () => {
    const preview = {
      start: { year: 2026, month: 6, day: 30 },
      end: { year: 2026, month: 7, day: 2 },
    } as const;

    expect(isDateInMonthRange({ year: 2026, month: 6, day: 29 }, preview)).toBe(false);
    expect(isDateInMonthRange({ year: 2026, month: 7, day: 1 }, preview)).toBe(true);
    expect(isDateInMonthRange({ year: 2026, month: 7, day: 3 }, preview)).toBe(false);
  });
});

function date(day: number) {
  return { year: 2026, month: 7, day } as const;
}
