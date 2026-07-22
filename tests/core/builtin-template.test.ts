import { describe, expect, it } from "vitest";

import { renderBuiltinTemplate } from "../../src/core/template/builtin-template";

describe("renderBuiltinTemplate", () => {
  it("renders target-period dates separately from the current time", () => {
    expect(
      renderBuiltinTemplate(
        [
          "# {{title}}",
          "date={{date}}",
          "custom={{date:YYYY/MM/DD}}",
          "time={{time}}",
          "seconds={{time:HH:mm:ss}}",
        ].join("\n"),
        {
          date: { year: 2026, month: 4, day: 1 },
          title: "2026-Q2",
          now: new Date("2030-08-09T10:11:12Z"),
          timeZone: "UTC",
        },
      ),
    ).toBe(
      [
        "# 2026-Q2",
        "date=2026-04-01",
        "custom=2026/04/01",
        "time=10:11",
        "seconds=10:11:12",
      ].join("\n"),
    );
  });

  it("leaves unknown placeholders untouched", () => {
    expect(
      renderBuiltinTemplate("{{unknown}} {{date}}", {
        date: { year: 2026, month: 5, day: 18 },
        title: "Daily",
        now: new Date("2030-01-01T00:00:00Z"),
        timeZone: "UTC",
      }),
    ).toBe("{{unknown}} 2026-05-18");
  });
});
