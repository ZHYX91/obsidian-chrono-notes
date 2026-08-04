import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

// @ts-expect-error The docs checker is an executable JavaScript module.
import { checkDocsI18n } from "../../scripts/check-docs-i18n.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const temporaryDirectories: string[] = [];
let fixtureRoot = "";

beforeEach(async () => {
  fixtureRoot = await mkdtemp(path.join(tmpdir(), "chrono-notes-docs-"));
  temporaryDirectories.push(fixtureRoot);
  await cp(path.join(projectRoot, "docs"), path.join(fixtureRoot, "docs"), { recursive: true });
});

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("stable docs i18n contract", () => {
  it("accepts the synchronized paired documents", () => {
    expect(checkDocsI18n(fixtureRoot)).toEqual([]);
  });

  it("rejects a missing translation pair", async () => {
    await rm(path.join(fixtureRoot, "docs", "ux-spec.en.md"));

    expect(checkDocsI18n(fixtureRoot)).toContain(
      "Missing paired translation: docs/ux-spec.en.md",
    );
  });

  it("rejects a missing source pair", async () => {
    await rm(path.join(fixtureRoot, "docs", "architecture.zh-CN.md"));

    expect(checkDocsI18n(fixtureRoot)).toContain(
      "Missing paired source document: docs/architecture.zh-CN.md",
    );
  });

  it("rejects a translation without translation_of metadata", async () => {
    await replaceInDoc(
      "docs/testing-strategy.en.md",
      "translation_of: testing-strategy.zh-CN.md",
      "translation_status: synced",
    );

    expect(checkDocsI18n(fixtureRoot)).toContain(
      "docs/testing-strategy.en.md must declare translation_of: testing-strategy.zh-CN.md",
    );
  });

  it("rejects a synced translation whose heading structure diverges", async () => {
    await appendToDoc("docs/architecture.en.md", "\n## 7. Missing section\n");

    const errors = checkDocsI18n(fixtureRoot);
    expect(errors.some((error: string) => error.startsWith(
      "docs/architecture.en.md heading structure must match docs/architecture.zh-CN.md:",
    ))).toBe(true);
  });

  it("accepts an outdated translation whose heading structure diverges", async () => {
    await replaceInDoc(
      "docs/ux-spec.en.md",
      "translation_status: synced",
      "translation_status: outdated",
    );
    await appendToDoc("docs/ux-spec.en.md", "\n## 8. Draft section\n");

    expect(checkDocsI18n(fixtureRoot)).toEqual([]);
  });
});

async function replaceInDoc(filePath: string, search: string, replacement: string) {
  const absolutePath = path.join(fixtureRoot, filePath);
  const source = await readFile(absolutePath, "utf8");
  expect(source).toContain(search);
  await writeFile(absolutePath, source.replace(search, replacement));
}

async function appendToDoc(filePath: string, suffix: string) {
  const absolutePath = path.join(fixtureRoot, filePath);
  await writeFile(absolutePath, `${await readFile(absolutePath, "utf8")}${suffix}`);
}
