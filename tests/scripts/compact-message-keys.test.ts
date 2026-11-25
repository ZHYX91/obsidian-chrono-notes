import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";

import { MESSAGE_CATALOGS, type MessageCatalogs } from "../../src/shared/i18n";
// @ts-expect-error The production build configuration is JavaScript.
import { createJavascriptBuildOptions } from "../../scripts/build-contract.mjs";

describe("production message catalogs", () => {
  it("preserves every locale, property order, message, plural form and frozen value", async () => {
    const bundle = await build({
      ...createJavascriptBuildOptions({ production: true, logLevel: "silent" }),
      entryPoints: ["src/shared/i18n/catalogs/index.ts"],
      write: false,
    });
    const output = bundle.outputFiles?.[0];
    if (output === undefined) throw new Error("No catalog bundle");
    expect(Object.keys(bundle.metafile?.inputs ?? {}).some((path) => path.includes("chrono:message-keys")))
      .toBe(true);
    const module = { exports: {} as { MESSAGE_CATALOGS: MessageCatalogs } };
    runInNewContext(output.text, { module });
    const packed = module.exports.MESSAGE_CATALOGS;
    expect(Object.isFrozen(packed)).toBe(true);
    expect(Object.keys(packed)).toEqual(Object.keys(MESSAGE_CATALOGS));
    for (const locale of Object.keys(MESSAGE_CATALOGS) as (keyof MessageCatalogs)[]) {
      const source = MESSAGE_CATALOGS[locale];
      const catalog = packed[locale];
      expect(Object.isFrozen(catalog), locale).toBe(true);
      expect(Object.keys(catalog), locale).toEqual(Object.keys(source));
      expect(JSON.parse(JSON.stringify(catalog)), locale).toEqual(source);
      expect(Object.values(catalog).every((value) => typeof value === "string" || Object.isFrozen(value)), locale)
        .toBe(true);
    }
  });
});
