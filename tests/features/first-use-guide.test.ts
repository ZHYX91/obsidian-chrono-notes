import { describe, expect, it } from "vitest";

import { FirstUseGuideGate } from "../../src/features/onboarding/first-use-guide";

describe("FirstUseGuideGate", () => {
  it("claims one automatic opening for unseen settings", () => {
    const gate = new FirstUseGuideGate();

    expect(gate.trySchedule(false)).toBe(true);
    expect(gate.trySchedule(false)).toBe(false);
  });

  it("never claims an automatic opening for an existing seen marker", () => {
    const gate = new FirstUseGuideGate();

    expect(gate.trySchedule(true)).toBe(false);
    expect(gate.trySchedule(false)).toBe(false);
  });
});
