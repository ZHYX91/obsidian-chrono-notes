import { describe, expect, it } from "vitest";

import {
  getPropertyDateFieldOrder,
  isPropertyDateDisplayFormat,
  isPropertyTimeDisplayFormat,
  isValidPropertyDateFormat,
  isValidPropertyTimeFormat,
  normalizePropertyCustomFormat,
  resolvePropertyDatePattern,
  resolvePropertyTimePattern,
} from "../../src/core/properties/property-date-display";

describe("Properties date and time display formats", () => {
  it("resolves every fixed date and time preset to a Moment pattern", () => {
    expect(resolvePropertyDatePattern("ymd-dash", "")).toBe("YYYY-MM-DD");
    expect(resolvePropertyDatePattern("ymd-slash", "")).toBe("YYYY/M/D");
    expect(resolvePropertyDatePattern("ymd-slash-padded", "")).toBe("YYYY/MM/DD");
    expect(resolvePropertyDatePattern("dmy-slash", "")).toBe("DD/MM/YYYY");
    expect(resolvePropertyDatePattern("mdy-slash", "")).toBe("MM/DD/YYYY");
    expect(resolvePropertyTimePattern("24-hour", "")).toBe("HH:mm");
    expect(resolvePropertyTimePattern("24-hour-seconds", "")).toBe("HH:mm:ss");
    expect(resolvePropertyTimePattern("12-hour", "")).toBe("h:mm A");
    expect(resolvePropertyTimePattern("12-hour-seconds", "")).toBe("h:mm:ss A");
  });

  it("keeps operating-system mode distinct from all plugin formats", () => {
    expect(resolvePropertyDatePattern("system", "YYYY-MM-DD")).toBeNull();
    expect(resolvePropertyTimePattern("system", "HH:mm")).toBeNull();
    expect(isPropertyDateDisplayFormat("locale")).toBe(false);
    expect(isPropertyTimeDisplayFormat("locale")).toBe(false);
  });

  it("accepts one date field of each kind with literals and determines its order", () => {
    for (const format of [
      "YYYY年M月D日",
      "YYYY年MM月DD日",
      "DD [of] MM [of] YYYY",
      "MM/DD/YYYY",
    ]) {
      expect(isValidPropertyDateFormat(format)).toBe(true);
    }
    expect(getPropertyDateFieldOrder("YYYY年M月D日")).toBe("ymd");
    expect(getPropertyDateFieldOrder("DD/MM/YYYY")).toBe("dmy");
    expect(getPropertyDateFieldOrder("MM/DD/YYYY")).toBe("mdy");
  });

  it("rejects ambiguous, incomplete, unsupported, and oversized date patterns", () => {
    for (const format of [
      "",
      "YYYY-MM",
      "YYYY-MM-DD-DD",
      "YYYY MMMM DD",
      "YYYY-MM-DD Z",
      "[unterminated YYYY-MM-DD",
      "YYYY-MM-DD\\",
      "YYYY-MM-DD".repeat(9),
    ]) {
      expect(isValidPropertyDateFormat(format)).toBe(false);
    }
    expect(resolvePropertyDatePattern("custom", "YYYY MMMM DD")).toBeNull();
  });

  it("accepts 12- and 24-hour local time patterns but excludes time zones", () => {
    for (const format of ["HH:mm", "H:mm:ss", "h:mm A", "hh时mm分ss秒 a"]) {
      expect(isValidPropertyTimeFormat(format)).toBe(true);
    }
    for (const format of ["", "HH", "HH:mm A", "h:mm Z", "HH:mm:ss:ss"]) {
      expect(isValidPropertyTimeFormat(format)).toBe(false);
    }
    expect(resolvePropertyTimePattern("custom", "h:mm Z")).toBeNull();
  });

  it("limits persisted custom strings without trimming user literals", () => {
    expect(normalizePropertyCustomFormat(" YYYY年M月D日 ", "fallback"))
      .toBe(" YYYY年M月D日 ");
    expect(normalizePropertyCustomFormat("x".repeat(100), "fallback")).toHaveLength(80);
    expect(normalizePropertyCustomFormat(null, "fallback")).toBe("fallback");
  });
});
