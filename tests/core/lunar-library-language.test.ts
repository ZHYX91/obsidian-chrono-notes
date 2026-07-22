import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18n } from "lunar-typescript";

import { withLunarLibraryLanguage } from "../../src/core/calendar/lunar-library-language";

describe("withLunarLibraryLanguage", () => {
  beforeEach(() => I18n.setLanguage("chs"));
  afterEach(() => {
    vi.restoreAllMocks();
    I18n.setLanguage("chs");
  });

  it("does not update the library for a same-language operation", () => {
    const setLanguage = vi.spyOn(I18n, "setLanguage");

    expect(withLunarLibraryLanguage("zh-CN", () => "result")).toBe("result");
    expect(setLanguage).not.toHaveBeenCalled();
  });

  it("switches and restores a different language", () => {
    const visited: string[] = [];
    const setLanguage = vi.spyOn(I18n, "setLanguage");

    withLunarLibraryLanguage("en-US", () => visited.push(I18n.getLanguage()));

    expect(visited).toEqual(["en"]);
    expect(I18n.getLanguage()).toBe("chs");
    expect(setLanguage).toHaveBeenNthCalledWith(1, "en");
    expect(setLanguage).toHaveBeenNthCalledWith(2, "chs");
  });

  it("restores a same-language scope when the operation changes global state", () => {
    withLunarLibraryLanguage("zh-CN", () => I18n.setLanguage("en"));

    expect(I18n.getLanguage()).toBe("chs");
  });

  it("keeps nested same-language and cross-language scopes isolated", () => {
    const visited: string[] = [];

    withLunarLibraryLanguage("zh-CN", () => {
      visited.push(I18n.getLanguage());
      withLunarLibraryLanguage("zh-TW", () => {
        visited.push(I18n.getLanguage());
        withLunarLibraryLanguage("zh-TW", () => visited.push(I18n.getLanguage()));
      });
      visited.push(I18n.getLanguage());
    });

    expect(visited).toEqual(["chs", "cht", "cht", "chs"]);
    expect(I18n.getLanguage()).toBe("chs");
  });

  it("restores the previous language when the operation throws", () => {
    expect(() => withLunarLibraryLanguage("en", () => {
      throw new Error("failed");
    })).toThrow("failed");

    expect(I18n.getLanguage()).toBe("chs");
  });

  it("keeps sequential locale calls independent", () => {
    const visited = ["zh-CN", "zh-TW", "en-US"].map((locale) =>
      withLunarLibraryLanguage(locale, () => I18n.getLanguage()));

    expect(visited).toEqual(["chs", "cht", "en"]);
    expect(I18n.getLanguage()).toBe("chs");
  });
});
