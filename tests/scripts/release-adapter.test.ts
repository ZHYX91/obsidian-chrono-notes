import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// @ts-expect-error The release adapter is an executable JavaScript module without declarations.
import { releaseConfig, verifyReleaseCorePin } from "../../scripts/release.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const vendorRoot = path.join(projectRoot, "scripts", "vendor");

describe("release-core adapter", () => {
  it("declares only Chrono Notes' standalone release policy", () => {
    expect(releaseConfig).toEqual({
      schemaVersion: 1,
      plugin: {
        id: "chrono-notes",
        name: "Chrono Notes",
        minAppVersion: "1.12.7",
        isDesktopOnly: false,
      },
      assets: { styles: "required" },
      publication: { repository: "ZHYX91/obsidian-chrono-notes" },
    });
  });

  it("binds the vendored runtime to its exact lock", async () => {
    const lock = JSON.parse(
      readFileSync(path.join(vendorRoot, "obsidian-release-core.lock.json"), "utf8"),
    ) as { sha256: string };
    const runtime = readFileSync(path.join(vendorRoot, "obsidian-release-core.mjs"));
    expect(createHash("sha256").update(runtime).digest("hex")).toBe(lock.sha256);
    await expect(verifyReleaseCorePin()).resolves.toBeUndefined();
  });

  it("has a repository-local built-in-only import closure", () => {
    const adapter = readFileSync(path.join(projectRoot, "scripts", "release.mjs"), "utf8");
    const runtime = readFileSync(
      path.join(vendorRoot, "obsidian-release-core.mjs"),
      "utf8",
    );
    for (const source of [adapter, runtime, readFileSync(path.join(projectRoot, "package.json"), "utf8")]) {
      expect(source).not.toMatch(
        /(?:[A-Za-z]:[\\/]|obsidian-plugin-workspace|\.\.\/obsidian-|"(?:file|link|workspace):)/u,
      );
    }
    expect(adapter).toContain('from "./vendor/obsidian-release-core.mjs"');
    for (const match of runtime.matchAll(/\bfrom\s+["']([^"']+)["']/gu)) {
      expect(match[1]).toMatch(/^node:/u);
    }
  });

  it("keeps build diagnostics outside the exact public dist inventory", () => {
    const contract = readFileSync(
      path.join(projectRoot, "scripts", "build-contract.mjs"),
      "utf8",
    );
    expect(contract).toContain('metafile: "build/chrono-notes.meta.json"');
    expect(contract).not.toContain('metafile: "dist/');
  });
});
