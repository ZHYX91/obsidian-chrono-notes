import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

// @ts-expect-error The README checker is an executable JavaScript module.
import { checkReadmeI18n } from "../../scripts/check-readme-i18n.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const temporaryDirectories: string[] = [];
let fixtureRoot = "";

beforeEach(async () => {
  fixtureRoot = await mkdtemp(path.join(tmpdir(), "chrono-notes-readme-"));
  temporaryDirectories.push(fixtureRoot);
  await Promise.all([
    cp(path.join(projectRoot, "CHANGELOG.md"), path.join(fixtureRoot, "CHANGELOG.md")),
    cp(path.join(projectRoot, "CONTRIBUTING.md"), path.join(fixtureRoot, "CONTRIBUTING.md")),
    cp(path.join(projectRoot, "README.md"), path.join(fixtureRoot, "README.md")),
    cp(path.join(projectRoot, "SECURITY.md"), path.join(fixtureRoot, "SECURITY.md")),
    cp(path.join(projectRoot, "manifest.json"), path.join(fixtureRoot, "manifest.json")),
    cp(path.join(projectRoot, "LICENSE"), path.join(fixtureRoot, "LICENSE")),
    cp(path.join(projectRoot, "docs"), path.join(fixtureRoot, "docs"), { recursive: true }),
  ]);
});

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("README marketplace link contract", () => {
  it("accepts the synchronized repository READMEs", () => {
    expect(checkReadmeI18n(fixtureRoot)).toEqual([]);
  });

  it("keeps a complete cross-language navigation bar in every README", async () => {
    const files = ["README.md","docs/i18n/README.zh-CN.md","docs/i18n/README.zh-TW.md","docs/i18n/README.de-DE.md","docs/i18n/README.fr-FR.md","docs/i18n/README.es-ES.md","docs/i18n/README.pt-BR.md","docs/i18n/README.ru-RU.md","docs/i18n/README.ja-JP.md","docs/i18n/README.ko-KR.md","docs/i18n/README.vi-VN.md","docs/i18n/README.ar.md","docs/i18n/README.fa.md","docs/i18n/README.he.md","docs/i18n/README.am.md","docs/i18n/README.hi.md"];
    const names = ["English","简体中文","繁體中文","Deutsch","Français","Español","Português","Русский","日本語","한국어","Tiếng Việt","العربية","فارسی","עברית","አማርኛ","हिन्दी"];
    for (const name of files) {
      const content = await readFile(path.join(fixtureRoot, name), "utf8");
      const nav = content.split(/\r?\n/u)[2];
      for (const label of names) expect(nav).toContain(`[${label}](`);
      expect(content).not.toContain("__NAV__");
    }
  });

  it("rejects a missing translated README", async () => {
    await rm(path.join(fixtureRoot, "docs/i18n/README.de-DE.md"));
    expect(checkReadmeI18n(fixtureRoot)).toContain(
      "Missing README file: docs/i18n/README.de-DE.md",
    );
  });

  it("rejects a repository-relative target in the English marketplace README", async () => {
    await replaceInReadme(
      "README.md",
      "[English](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/README.md)",
      "[English](README.md)",
    );

    expect(checkReadmeI18n(fixtureRoot)).toContain(
      "README.md must use a canonical absolute GitHub target for repository content: README.md",
    );
  });

  it("rejects an absolute repository target in a translated README", async () => {
    await replaceInReadme(
      "docs/i18n/README.zh-CN.md",
      "[English](../../README.md)",
      "[English](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/README.md)",
    );

    expect(checkReadmeI18n(fixtureRoot)).toContain(
      "docs/i18n/README.zh-CN.md must use a relative target for repository content: https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/README.md",
    );
  });

  it("rejects a missing translated repository target", async () => {
    await replaceInReadme(
      "docs/i18n/README.zh-CN.md",
      "../../LICENSE",
      "../../MISSING-LICENSE",
    );

    expect(checkReadmeI18n(fixtureRoot)).toContain(
      "docs/i18n/README.zh-CN.md contains a missing relative target: ../../MISSING-LICENSE",
    );
  });
});

async function replaceInReadme(filePath: string, search: string, replacement: string) {
  const absolutePath = path.join(fixtureRoot, filePath);
  const source = await readFile(absolutePath, "utf8");
  expect(source).toContain(search);
  await writeFile(absolutePath, source.replace(search, replacement));
}
