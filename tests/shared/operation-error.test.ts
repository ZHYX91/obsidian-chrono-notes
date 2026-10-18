import { describe, expect, it } from "vitest";

import { createTranslator } from "../../src/shared/i18n";
import {
  formatOperationError,
  getOperationErrorDetails,
  OperationError,
} from "../../src/shared/operation-error";

describe("operation errors", () => {
  it("retains typed cause details through a creation failure and translates at presentation", () => {
    const cause = new OperationError("templateMissing", "Template note not found: Templates/日报.md", {
      path: "Templates/日报.md",
    });
    const error = new Error(`Failed to create note: ${cause.message}`, { cause });
    const details = getOperationErrorDetails(error);
    expect(details).toEqual({ code: "templateMissing", path: "Templates/日报.md" });
    expect(Object.isFrozen(details)).toBe(true);
    const chinese = formatOperationError(error, createTranslator("zh-CN", "en").t);
    expect(chinese).toContain("找不到模板文件");
    expect(chinese).toContain("Templates/日报.md");
    expect(chinese).toContain(error.message);
    const english = formatOperationError(error, createTranslator("en", "en").t);
    expect(english).not.toContain("找不到模板文件");
    expect(english).toContain(error.message);
  });

  it("preserves unknown errors without guessing a category from their text", () => {
    const t = createTranslator("zh-CN", "en").t;
    expect(formatOperationError("Templater is not installed or enabled.", t))
      .toBe("Templater is not installed or enabled.");
    expect(formatOperationError(new Error("permission denied"), t)).toBe("permission denied");
  });

  it("handles a circular cause without looping", () => {
    const error = new Error("Unknown failure");
    error.cause = error;
    expect(getOperationErrorDetails(error)).toBeUndefined();
  });
});
