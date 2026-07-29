import { execFileSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  ACCEPTANCE_MARKER_NAME,
  cleanAcceptanceVault,
  createAcceptanceVault,
  pruneAcceptanceVaults,
  verifyAcceptanceVault,
} from "../../scripts/acceptance-vault.mjs";

const temporaryRoots: string[] = [];
const ACCEPTANCE_TEST_TIMEOUT_MS = 15_000;
const acceptanceScript = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../scripts/acceptance-vault.mjs",
);

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true })),
  );
});

describe("acceptance Vault lifecycle", () => {
  it("creates and verifies a deterministic isolated Vault from production artifacts", async () => {
    const harness = await createHarness();
    const target = await createAcceptanceVault({
      acceptanceRoot: harness.acceptanceRoot,
      now: new Date("2026-07-23T08:00:00.000Z"),
      sourceRoot: harness.sourceRoot,
    });

    const marker = await verifyAcceptanceVault({
      acceptanceRoot: harness.acceptanceRoot,
      target,
    });
    const settings = JSON.parse(
      await readFile(
        path.join(target, ".obsidian", "plugins", "chrono-notes", "data.json"),
        "utf8",
      ),
    ) as {
      calendarExtensions: string[];
      ics: { sources: string[] };
      locale: string;
      periodicNotes: { daily: { pattern: string } };
      rangeNotes: { templatePath: string };
      schemaVersion: number;
    };
    const communityPlugins = JSON.parse(
      await readFile(
        path.join(target, ".obsidian", "community-plugins.json"),
        "utf8",
      ),
    ) as string[];
    const ics = await readFile(
      path.join(target, "Fixtures", "acceptance.ics"),
      "utf8",
    );

    expect(marker).toMatchObject({
      kind: "chrono-notes-acceptance-vault",
      pluginVersion: "9.8.7",
      state: "ready",
    });
    expect(settings).toMatchObject({
      calendarExtensions: ["persian", "islamic-umalqura"],
      ics: { sources: ["Fixtures/acceptance.ics"] },
      locale: "en",
      periodicNotes: { daily: { pattern: "[Daily]/YYYY-MM-DD" } },
      rangeNotes: { templatePath: "" },
      schemaVersion: 16,
    });
    expect(communityPlugins).toEqual(["chrono-notes"]);
    expect(ics).toContain("SUMMARY:Team offsite");
    expect(ics).not.toContain("fixture");
    expect(
      await readFile(
        path.join(target, ".obsidian", "plugins", "chrono-notes", "main.js"),
        "utf8",
      ),
    ).toBe("plugin bundle\n");
  }, ACCEPTANCE_TEST_TIMEOUT_MS);

  it("detects changes to generated files", async () => {
    const harness = await createHarness();
    const target = await createAcceptanceVault({
      acceptanceRoot: harness.acceptanceRoot,
      sourceRoot: harness.sourceRoot,
    });
    await writeFile(
      path.join(target, "Daily", "2026-07-14.md"),
      "changed\n",
      "utf8",
    );

    await expect(
      verifyAcceptanceVault({
        acceptanceRoot: harness.acceptanceRoot,
        target,
      }),
    ).rejects.toThrow("Generated file changed: Daily/2026-07-14.md");
  }, ACCEPTANCE_TEST_TIMEOUT_MS);

  it("accepts host JSON normalization while preserving required values", async () => {
    const harness = await createHarness();
    const target = await createAcceptanceVault({
      acceptanceRoot: harness.acceptanceRoot,
      sourceRoot: harness.sourceRoot,
    });
    const jsonPaths = [
      ".obsidian/app.json",
      ".obsidian/appearance.json",
      ".obsidian/core-plugins.json",
      ".obsidian/plugins/chrono-notes/data.json",
    ];

    for (const relativePath of jsonPaths) {
      const filePath = path.join(target, relativePath);
      const value = JSON.parse(await readFile(filePath, "utf8")) as Record<
        string,
        unknown
      >;
      if (relativePath === ".obsidian/core-plugins.json") {
        value.switcher = true;
      }
      await writeFile(filePath, JSON.stringify(value), "utf8");
    }

    await expect(
      verifyAcceptanceVault({
        acceptanceRoot: harness.acceptanceRoot,
        target,
      }),
    ).resolves.toMatchObject({ state: "ready" });

    const corePluginsPath = path.join(target, ".obsidian", "core-plugins.json");
    const corePlugins = JSON.parse(
      await readFile(corePluginsPath, "utf8"),
    ) as Record<string, unknown>;
    corePlugins["file-explorer"] = false;
    await writeFile(corePluginsPath, JSON.stringify(corePlugins), "utf8");
    await expect(
      verifyAcceptanceVault({
        acceptanceRoot: harness.acceptanceRoot,
        target,
      }),
    ).rejects.toThrow(
      "Generated JSON required values changed: .obsidian/core-plugins.json",
    );
  }, ACCEPTANCE_TEST_TIMEOUT_MS);

  it("rejects changes to required generated JSON values", async () => {
    const harness = await createHarness();
    const target = await createAcceptanceVault({
      acceptanceRoot: harness.acceptanceRoot,
      sourceRoot: harness.sourceRoot,
    });
    const appearancePath = path.join(target, ".obsidian", "appearance.json");
    const appearance = JSON.parse(
      await readFile(appearancePath, "utf8"),
    ) as Record<string, unknown>;
    appearance.theme = "moonstone";
    await writeFile(appearancePath, JSON.stringify(appearance), "utf8");

    await expect(
      verifyAcceptanceVault({
        acceptanceRoot: harness.acceptanceRoot,
        target,
      }),
    ).rejects.toThrow("Generated JSON changed: .obsidian/appearance.json");
  }, ACCEPTANCE_TEST_TIMEOUT_MS);

  it("accepts pnpm's literal argument separator in CLI commands", async () => {
    const harness = await createHarness();
    const target = await createAcceptanceVault({
      acceptanceRoot: harness.acceptanceRoot,
      sourceRoot: harness.sourceRoot,
    });

    expect(
      execFileSync(
        process.execPath,
        [
          acceptanceScript,
          "verify",
          "--",
          "--root",
          harness.acceptanceRoot,
          "--target",
          target,
        ],
        { encoding: "utf8" },
      ),
    ).toContain(`Acceptance Vault verified: ${target}`);
  }, ACCEPTANCE_TEST_TIMEOUT_MS);

  it("cleans only marked Vaults below the declared acceptance root", async () => {
    const harness = await createHarness();
    const target = await createAcceptanceVault({
      acceptanceRoot: harness.acceptanceRoot,
      sourceRoot: harness.sourceRoot,
    });
    const unmarkedTarget = path.join(harness.acceptanceRoot, "unmarked");
    await mkdir(unmarkedTarget);

    await expect(
      cleanAcceptanceVault({
        acceptanceRoot: harness.acceptanceRoot,
        target: unmarkedTarget,
      }),
    ).rejects.toThrow("Acceptance Vault marker is missing");
    await expect(
      cleanAcceptanceVault({
        acceptanceRoot: harness.acceptanceRoot,
        target: harness.sourceRoot,
      }),
    ).rejects.toThrow("Path must stay below the acceptance root");

    await cleanAcceptanceVault({
      acceptanceRoot: harness.acceptanceRoot,
      target,
    });
    await expect(readFile(path.join(target, ACCEPTANCE_MARKER_NAME))).rejects.toThrow();
  }, ACCEPTANCE_TEST_TIMEOUT_MS);

  it("prunes only expired marked Vaults and leaves unrelated directories alone", async () => {
    const harness = await createHarness();
    const oldTarget = await createAcceptanceVault({
      acceptanceRoot: harness.acceptanceRoot,
      now: new Date("2026-07-01T00:00:00.000Z"),
      sourceRoot: harness.sourceRoot,
    });
    const unmarkedTarget = path.join(harness.acceptanceRoot, "unmarked");
    await mkdir(unmarkedTarget);

    const removed = await pruneAcceptanceVaults({
      acceptanceRoot: harness.acceptanceRoot,
      maxAgeHours: 24,
      now: new Date("2026-07-03T00:00:00.000Z"),
    });

    expect(removed).toEqual([oldTarget]);
    await expect(readFile(path.join(oldTarget, ACCEPTANCE_MARKER_NAME))).rejects.toThrow();
    await expect(
      readFile(path.join(unmarkedTarget, ACCEPTANCE_MARKER_NAME)),
    ).rejects.toThrow();
  }, ACCEPTANCE_TEST_TIMEOUT_MS);
});

async function createHarness(): Promise<{
  acceptanceRoot: string;
  sourceRoot: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "chrono-acceptance-test-"));
  temporaryRoots.push(root);
  const sourceRoot = path.join(root, "project");
  const acceptanceRoot = path.join(root, "acceptance");
  const artifactRoot = path.join(sourceRoot, "dist");
  const settingsRoot = path.join(sourceRoot, "src", "shared");
  await mkdir(artifactRoot, { recursive: true });
  await mkdir(settingsRoot, { recursive: true });
  await writeFile(
    path.join(sourceRoot, "manifest.json"),
    `${JSON.stringify({
      id: "chrono-notes",
      name: "Chrono Notes Calendar",
      version: "9.8.7",
      minAppVersion: "1.12.7",
      description: "Acceptance test",
      author: "ZhengYX",
      isDesktopOnly: false,
    }, null, 2)}\n`,
    "utf8",
  );
  await writeFile(path.join(artifactRoot, "main.js"), "plugin bundle\n", "utf8");
  await writeFile(
    path.join(artifactRoot, "manifest.json"),
    `${JSON.stringify({
      id: "chrono-notes",
      version: "9.8.7",
    })}\n`,
    "utf8",
  );
  await writeFile(path.join(artifactRoot, "styles.css"), "/* styles */\n", "utf8");
  await writeFile(
    path.join(settingsRoot, "settings.ts"),
    "export const SETTINGS_SCHEMA_VERSION = 16;\n",
    "utf8",
  );
  return { acceptanceRoot, sourceRoot };
}
