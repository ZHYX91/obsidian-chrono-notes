import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { buildTemplaterPeriodFormatter } from "../../src/core/template/templater-period-format";

// Emulate the host with the Moment dependency declared by Obsidian itself.
const require = createRequire(import.meta.url);
const hostRequire = createRequire(require.resolve("obsidian/package.json"));
const moment = hostRequire("moment") as typeof import("moment");
for (const locale of ["ar", "fa", "hi"]) hostRequire(`moment/locale/${locale}`);
moment.locale("en");

function formatter(source = buildTemplaterPeriodFormatter(), locale = "en") {
  moment.locale(locale);
  const tp = { date: { now: (format: string, offset = 0, reference?: string) =>
    (reference === undefined ? moment() : moment(reference, "YYYY-MM-DD"))
      .add(offset, "days").format(format) }, obsidian: { moment } };
  // Execute the exact bridge injected into Templater, including the serialized shared lexer.
  return runInNewContext(`${source}; chronoDate;`, { tp }) as
    (format: string, offset?: number | string, reference?: string) => string;
}

describe("Templater extended date bridge", () => {
  beforeEach(() => {
    vi.spyOn(moment, "now").mockReturnValue(Date.UTC(2026, 8, 7, 12, 34, 56));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    moment.locale("en");
  });

  it("uses the actual host Moment current-time semantics without a reference", () => {
    expect(moment(undefined, "YYYY-MM-DD").isValid()).toBe(false);
    const format = formatter();
    expect(format("DEC[s] [C]CEN YYYY-MM-DD")).toBe("2020s C21 2026-09-07");
    expect(format("HH:mm:ss")).toBe(moment().format("HH:mm:ss"));
    expect(() => format("CEN", 0, "not-a-date")).toThrow("Invalid calendar reference date");
  });

  it("keeps the serialized helpers self-contained after production minification", async () => {
    const output = await build({
      entryPoints: [fileURLToPath(new URL("../../src/core/template/templater-period-format.ts", import.meta.url))],
      bundle: true, minify: true, platform: "browser", format: "cjs", target: "es2022", write: false,
    });
    const module = { exports: {} as { buildTemplaterPeriodFormatter: () => string } };
    runInNewContext(output.outputFiles[0]?.text ?? "", { module });
    const format = formatter(module.exports.buildTemplaterPeriodFormatter());
    expect(format("[DEC/CEN] DEC[s] [C]CEN", 1, "2000-12-31")).toBe("DEC/CEN 2000s C21");
    expect(format("DEC[s] [C]CEN")).toBe("2020s C21");
  });

  it("preserves native formats, literal tokens and date offsets", () => {
    const format = formatter();
    expect(format("DEC[s] [C]CEN YYYY-MM-DD", 1, "2000-12-31")).toBe("2000s C21 2001-01-01");
    expect(format("DEC[s] [C]CEN", 0, "2000-12-31")).toBe("2000s C20");
    expect(format("[DEC] \\C\\E\\N YYYY-MM-DD")).toBe("DEC CEN 2026-09-07");
    expect(format("Do MMMM YYYY")).toBe("7th September 2026");
    expect(format("[it's] YYYY")).toBe("it's 2026");
    expect(format("DEC[s] [C]CEN", "P1Y", "2000-01-01")).toBe("2000s C21");
    expect(format("[\uE000DEC] DEC[s]")).toBe("\uE000DEC 2020s");
  });

  it.each(["ar", "fa", "hi"])("keeps extensions fixed without changing native %s digits", (locale) => {
    const format = formatter(undefined, locale);
    const nativeYear = moment.utc("2026-09-07", "YYYY-MM-DD", locale, true).format("YYYY");
    expect(nativeYear).not.toBe("2026");
    expect(format("DEC[s] [C]CEN YYYY")).toBe(`2020s C21 ${nativeYear}`);
    expect(format("[DEC] DEC[s]", 1, "2000-12-31")).toBe("DEC 2000s");
    expect(format("CEN", 1, "2000-12-31")).toBe("21");
  });
});
