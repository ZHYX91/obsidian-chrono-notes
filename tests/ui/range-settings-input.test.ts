import { describe, expect, it } from "vitest";

import { parsePositiveIntegerInput } from "../../src/ui/settings/range-settings-section";

describe("range-note visible lane settings", () => {
  it.each([
    { input: "1", expected: 1 },
    { input: "2", expected: 2 },
    { input: "12", expected: 12 },
    { input: "999", expected: 999 },
  ])("accepts the positive integer $input", ({ input, expected }) => {
    expect(parsePositiveIntegerInput(input)).toBe(expected);
  });

  it.each(["", "0", "0.5", "1.5", "-1", "+2", " 2", "2 ", "2e2", "Infinity", "9007199254740992"])(
    "rejects invalid or ambiguous input %s without truncating it",
    (input) => {
      expect(parsePositiveIntegerInput(input)).toBeNull();
    },
  );
});
