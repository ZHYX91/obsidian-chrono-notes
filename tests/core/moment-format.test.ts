import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";

import {
  compileMomentFormat,
  migrateLuxonDateFormatToMoment,
  quoteMomentLiteral,
} from "../../src/core/periodic/moment-format";

describe("Moment format compilation", () => {
  it("compiles the documented path tokens and bracket literals", () => {
    const date = DateTime.fromISO("2026-09-07", { zone: "UTC", locale: "en" });
    expect(date.toFormat(compileMomentFormat("[diary]/GGGG/GGGG-[W]WW", "date") ?? ""))
      .toBe("diary/2026/2026-W37");
    expect(date.toFormat(compileMomentFormat("YYYY-MM-DD ddd dddd [Q]Q", "date") ?? ""))
      .toBe("2026-09-07 Mon Monday Q3");
  });

  it("compiles documented time placeholders", () => {
    expect(compileMomentFormat("HH:mm:ss A", "date-time"))
      .toBe("HH':'mm':'ss' 'a");
  });

  it("rejects unsupported tokens and malformed literals", () => {
    expect(compileMomentFormat("yyyy-MM-dd", "date")).toBeNull();
    expect(compileMomentFormat("YYYY-[unterminated", "date")).toBeNull();
    expect(compileMomentFormat("YYYY-MM-DD HH", "date")).toBeNull();
  });

  it("quotes arbitrary suggested folder text without changing it", () => {
    const literal = "People/Bob's/[Archive]";
    const quoted = quoteMomentLiteral(literal);

    expect(quoted).toBe("[People/Bob's/[Archive\\]]");
    expect(DateTime.fromISO("2026-09-07").toFormat(compileMomentFormat(`${quoted}/YYYY`, "date") ?? ""))
      .toBe("People/Bob's/[Archive]/2026");
  });

  it("migrates the documented Luxon path grammar without changing valid Moment input", () => {
    expect(migrateLuxonDateFormatToMoment(
      "'diary'/yyyy/yyyy-MM/yyyy-MM-dd",
    )).toBe("[diary]/YYYY/YYYY-MM/YYYY-MM-DD");
    expect(migrateLuxonDateFormatToMoment(
      "'diary'/kkkk/kkkk-'W'WW",
    )).toBe("[diary]/GGGG/GGGG-[W]WW");
    expect(migrateLuxonDateFormatToMoment(
      "yyyy-MM-dd ccc cccc 'Q'q",
    )).toBe("YYYY-MM-DD ddd dddd [Q]Q");
    expect(migrateLuxonDateFormatToMoment(
      "[diary]/YYYY/YYYY-MM/YYYY-MM-DD",
    )).toBe("[diary]/YYYY/YYYY-MM/YYYY-MM-DD");
  });

  it("rejects malformed or undocumented Luxon formats during migration", () => {
    expect(migrateLuxonDateFormatToMoment("'unterminated/yyyy")).toBeNull();
    expect(migrateLuxonDateFormatToMoment("yyyy-MM-dd o")).toBeNull();
  });
});
