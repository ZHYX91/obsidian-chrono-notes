import { describe, expect, it } from "vitest";

// @ts-expect-error The runtime contract is implemented in JavaScript.
import { assertRuntimeContract, parsePnpmVersion } from "../../scripts/runtime-contract.mjs";

const packageJson = {
  engines: { node: "24.18.0" },
  packageManager: "pnpm@11.9.0",
};

describe("runtime contract", () => {
  it("accepts one exact Node.js and pnpm toolchain", () => {
    expect(() => assertRuntimeContract({
      configuredNodeVersion: "24.18.0",
      currentNodeVersion: "24.18.0",
      currentPnpmVersion: "11.9.0",
      packageJson,
    })).not.toThrow();
    expect(parsePnpmVersion("pnpm/11.9.0 npm/? node/v24.18.0 win32 x64"))
      .toBe("11.9.0");
  });

  it("rejects floating or mismatched runtime declarations", () => {
    expect(() => assertRuntimeContract({
      configuredNodeVersion: "24",
      currentNodeVersion: "24.18.0",
      currentPnpmVersion: "11.9.0",
      packageJson,
    })).toThrow(/pin an exact Node\.js version/u);
    expect(() => assertRuntimeContract({
      configuredNodeVersion: "24.18.0",
      currentNodeVersion: "24.17.0",
      currentPnpmVersion: "11.9.0",
      packageJson,
    })).toThrow(/Node\.js 24\.18\.0 is required/u);
    expect(() => assertRuntimeContract({
      configuredNodeVersion: "24.18.0",
      currentNodeVersion: "24.18.0",
      currentPnpmVersion: "11.8.0",
      packageJson,
    })).toThrow(/pnpm 11\.9\.0 is required/u);
    expect(() => parsePnpmVersion("node/v24.18.0 win32 x64"))
      .toThrow(/through pnpm/u);
  });
});
