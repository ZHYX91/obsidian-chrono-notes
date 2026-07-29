import { describe, expect, it } from "vitest";

import {
  getPropertyDateFieldOrder,
  isPropertyDateDisplayFormat,
  isPropertyTimeDisplayFormat,
  isValidPropertyDateFormat,
  isValidPropertyTimeFormat,
  normalizePropertyCustomFormat,
  resolvePropertyMomentLocale,
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

  it("accepts one or more non-repeated date fields with literals and determines complete orders", () => {
    for (const format of [
      "YYYY年M月D日",
      "YYYY年MM月DD日",
      "YYYY-MMM-DD",
      "YYYY-MMMM-DD",
      "YYYY-MM-ddd",
      "MMMM D",
      "dddd",
      "YY",
      "ddd, DD MMM YYYY",
      "dddd, MMMM D, YYYY",
      "DD [of] MM [of] YYYY",
      "YYYY-MM-DD [Z]",
      "YYYY-MM-DD \\Z",
      "MM/DD/YYYY",
    ]) {
      expect(isValidPropertyDateFormat(format)).toBe(true);
    }
    expect(getPropertyDateFieldOrder("YYYY年M月D日")).toBe("ymd");
    expect(getPropertyDateFieldOrder("dddd, MMMM D, YYYY")).toBe("mdy");
    expect(getPropertyDateFieldOrder("DD/MM/YYYY")).toBe("dmy");
    expect(getPropertyDateFieldOrder("MM/DD/YYYY")).toBe("mdy");
    expect(getPropertyDateFieldOrder("YYYY-MM-ddd")).toBeNull();
    expect(getPropertyDateFieldOrder("YYYY-MM-MM-DD")).toBeNull();
    expect(resolvePropertyDatePattern("custom", "YYYY-MM-ddd")).toBe("YYYY-MM-ddd");
  });

  it("rejects empty, literal-only, repeated, unsupported, and oversized date patterns", () => {
    for (const format of [
      "",
      "[date]",
      "YYYY-YY-MM-DD",
      "YYYY-MM-MMM-DD",
      "YYYY-MM-DD-DD",
      "ddd dddd, YYYY-MM-DD",
      "YYYY-MMMMM-DD",
      "YYYY-MM-Do",
      "YYYY-MM-DD dd",
      "YYYY-MM-DD Z",
      "YYYY-MM-DD ZZ",
      "YYYY-MM-DD z",
      "YYYY-MM-DD zz",
      "YYYY-MM-DD X",
      "YYYY-MM-DD x",
      "YYYY-MM-DD HH",
      "[unterminated YYYY-MM-DD",
      "YYYY-MM-DD\\",
      "YYYY-MM-DD".repeat(9),
    ]) {
      expect(isValidPropertyDateFormat(format)).toBe(false);
    }
    expect(resolvePropertyDatePattern("custom", "YYYY-MMMM-DD")).toBe(
      "YYYY-MMMM-DD",
    );
  });

  it("accepts explicit and localized civil-time patterns but rejects invalid combinations", () => {
    for (const format of [
      "HH",
      "H",
      "h",
      "hh",
      "k",
      "kk",
      "HH:mm",
      "H:mm:ss",
      "h A",
      "h:mm A",
      "hh时mm分ss秒 a",
      "kk:mm",
      "HH:mm:ss.SSS",
      "HH:mm:ss.S",
      "HH:mm:ss.SS",
      "LT",
      "LTS",
      "[at] LT",
      "HH:mm [Z]",
      "HH:mm \\Z",
    ]) {
      expect(isValidPropertyTimeFormat(format)).toBe(true);
    }
    for (const format of [
      "",
      "mm",
      "HH:ss",
      "HH:mm.SSS",
      "HH:mm A",
      "kk A",
      "h:mm Z",
      "h:mm ZZ",
      "h:mm z",
      "h:mm zz",
      "HH:mm:ss:ss",
      "HH:mm:ss.S.SS",
      "HH H",
      "HH:mm:m",
      "h A a",
      "LT HH:mm",
      "LT LTS",
      "LT A",
      "LTS ss",
      "YYYY-MM-DD HH:mm",
      "X",
      "x",
    ]) {
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

  it("normalizes Moment locales and gives unsupported Amharic a deterministic fallback", () => {
    expect(resolvePropertyMomentLocale("zh-CN")).toBe("zh-cn");
    expect(resolvePropertyMomentLocale("fa_IR")).toBe("fa-ir");
    expect(resolvePropertyMomentLocale("am")).toBe("en");
    expect(resolvePropertyMomentLocale("am-ET")).toBe("en");
  });
});
