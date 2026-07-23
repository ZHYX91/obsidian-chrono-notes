import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { artifactPaths } from "./build-contract.mjs";

export const ACCEPTANCE_MARKER_NAME = ".chrono-notes-acceptance.json";
export const ACCEPTANCE_MARKER_KIND = "chrono-notes-acceptance-vault";
export const ACCEPTANCE_MARKER_VERSION = 1;
export const DEFAULT_RETENTION_HOURS = 7 * 24;

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function getDefaultAcceptanceRoot() {
  return path.join(os.tmpdir(), "chrono-notes-acceptance");
}

export async function createAcceptanceVault({
  acceptanceRoot = getDefaultAcceptanceRoot(),
  now = new Date(),
  sourceRoot = projectRoot,
} = {}) {
  const resolvedRoot = path.resolve(acceptanceRoot);
  const resolvedSource = path.resolve(sourceRoot);
  await mkdir(resolvedRoot, { recursive: true });
  const safeRoot = await realpath(resolvedRoot);
  await pruneAcceptanceVaults({
    acceptanceRoot: safeRoot,
    maxAgeHours: DEFAULT_RETENTION_HOURS,
    now,
  });

  const sourceManifest = await readJson(path.join(resolvedSource, "manifest.json"));
  assert.equal(sourceManifest.id, "chrono-notes", "Unexpected plugin manifest ID");
  assert.match(
    sourceManifest.version,
    /^\d+\.\d+\.\d+$/u,
    "Plugin manifest version must use x.y.z",
  );
  const settingsSchemaVersion = await readSettingsSchemaVersion(resolvedSource);
  const runId = createRunId(now);
  const target = path.join(safeRoot, runId);
  assertDescendant(safeRoot, target);
  await mkdir(target);
  const markerPath = path.join(target, ACCEPTANCE_MARKER_NAME);
  const creatingMarker = {
    kind: ACCEPTANCE_MARKER_KIND,
    markerVersion: ACCEPTANCE_MARKER_VERSION,
    state: "creating",
    createdAt: now.toISOString(),
    pluginVersion: sourceManifest.version,
    generatedFiles: {},
  };
  await writeJson(markerPath, creatingMarker);

  try {
    const files = createFixtureFiles(settingsSchemaVersion);
    for (const [relativePath, content] of Object.entries(files)) {
      await writeFixtureFile(target, relativePath, content);
    }

    const artifactSources = {
      ".obsidian/plugins/chrono-notes/main.js": artifactPaths.main,
      ".obsidian/plugins/chrono-notes/manifest.json": artifactPaths.manifest,
      ".obsidian/plugins/chrono-notes/styles.css": artifactPaths.styles,
    };
    for (const [relativePath, sourcePath] of Object.entries(artifactSources)) {
      const absoluteSource = path.resolve(resolvedSource, sourcePath);
      await assertRegularFile(absoluteSource, `Missing production artifact: ${sourcePath}`);
      const destination = resolveGeneratedPath(target, relativePath);
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(absoluteSource, destination, {
        errorOnExist: true,
        force: false,
      });
    }

    const generatedFiles = {};
    for (const relativePath of [
      ...Object.keys(files),
      ...Object.keys(artifactSources),
    ].sort()) {
      generatedFiles[relativePath] = await hashFile(
        resolveGeneratedPath(target, relativePath),
      );
    }

    await writeJson(markerPath, {
      ...creatingMarker,
      state: "ready",
      generatedFiles,
    });
    await verifyAcceptanceVault({ acceptanceRoot: safeRoot, target });
    return target;
  } catch (error) {
    await writeJson(markerPath, {
      ...creatingMarker,
      state: "failed",
      failure: error instanceof Error ? error.message : String(error),
    }).catch(() => undefined);
    throw error;
  }
}

export async function verifyAcceptanceVault({
  acceptanceRoot = getDefaultAcceptanceRoot(),
  target,
}) {
  const { marker, safeTarget } = await readSafeMarker(acceptanceRoot, target);
  assert.equal(marker.state, "ready", "Acceptance Vault is not ready");
  assert.ok(
    isRecord(marker.generatedFiles),
    "Acceptance Vault marker is missing generated file hashes",
  );

  for (const [relativePath, expectedHash] of Object.entries(marker.generatedFiles)) {
    assert.equal(typeof expectedHash, "string", `Invalid hash for ${relativePath}`);
    const generatedPath = resolveGeneratedPath(safeTarget, relativePath);
    await assertRegularFile(generatedPath, `Missing generated file: ${relativePath}`);
    assert.equal(
      await hashFile(generatedPath),
      expectedHash,
      `Generated file changed: ${relativePath}`,
    );
  }

  const pluginManifest = await readJson(
    path.join(safeTarget, ".obsidian", "plugins", "chrono-notes", "manifest.json"),
  );
  assert.equal(
    pluginManifest.version,
    marker.pluginVersion,
    "Deployed plugin version does not match the acceptance marker",
  );
  return marker;
}

export async function cleanAcceptanceVault({
  acceptanceRoot = getDefaultAcceptanceRoot(),
  target,
}) {
  const { safeTarget } = await readSafeMarker(acceptanceRoot, target);
  await rm(safeTarget, { recursive: true, force: false });
}

export async function pruneAcceptanceVaults({
  acceptanceRoot = getDefaultAcceptanceRoot(),
  maxAgeHours = DEFAULT_RETENTION_HOURS,
  now = new Date(),
} = {}) {
  assert.ok(
    Number.isFinite(maxAgeHours) && maxAgeHours >= 0,
    "maxAgeHours must be a non-negative number",
  );
  const resolvedRoot = path.resolve(acceptanceRoot);
  await mkdir(resolvedRoot, { recursive: true });
  const safeRoot = await realpath(resolvedRoot);
  const entries = await readdir(safeRoot, { withFileTypes: true });
  const removed = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const target = path.join(safeRoot, entry.name);
    let marker;
    try {
      ({ marker } = await readSafeMarker(safeRoot, target));
    } catch {
      continue;
    }
    const createdAt = Date.parse(marker.createdAt);
    if (!Number.isFinite(createdAt)) continue;
    const ageHours = (now.getTime() - createdAt) / 3_600_000;
    if (ageHours < maxAgeHours) continue;
    await rm(target, { recursive: true, force: false });
    removed.push(target);
  }
  return removed;
}

function createFixtureFiles(settingsSchemaVersion) {
  return {
    ".obsidian/app.json": jsonText({}),
    ".obsidian/appearance.json": jsonText({
      baseFontSize: 16,
      theme: "obsidian",
      cssTheme: "",
    }),
    ".obsidian/community-plugins.json": jsonText(["chrono-notes"]),
    ".obsidian/core-plugins.json": jsonText({
      "file-explorer": true,
      "global-search": true,
      properties: true,
      "page-preview": true,
      "command-palette": true,
      "file-recovery": true,
    }),
    ".obsidian/plugins/chrono-notes/data.json": jsonText({
      schemaVersion: settingsSchemaVersion,
      locale: "en",
      weekStartDay: "monday",
      calendarOverlays: ["chinese-lunar", "ganzhi"],
      holidayRegions: ["cn", "sg"],
      showNoteIndicators: true,
      quarterNameMode: "number",
      fontSizeMode: "immutable",
      immutableFontSizeFactor: 10,
      todoAnnotationMode: "hole",
      interceptPropertyDateClicks: true,
      showHoverPreview: true,
      showNoteNavbar: true,
      relatedIntervalNotesCollapsed: false,
      firstUseGuideSeen: true,
      statisticDisplayDimension: "word-count",
      statisticValueStep: 20,
      yearViewHeatmap: false,
      confirmPeriodicNoteCreation: true,
      confirmIntervalNoteCreation: true,
      cascadeLargerNotes: false,
      templateEngine: "builtin",
      periodicNotes: {
        daily: {
          enabled: true,
          pattern: "'Daily'/yyyy-MM-dd",
          templatePath: "",
        },
        weekly: {
          enabled: true,
          pattern: "'Weekly'/kkkk-'W'WW",
          templatePath: "",
        },
        monthly: {
          enabled: true,
          pattern: "'Monthly'/yyyy-MM",
          templatePath: "",
        },
        quarterly: {
          enabled: true,
          pattern: "'Quarterly'/yyyy-'Q'q",
          templatePath: "",
        },
        yearly: {
          enabled: true,
          pattern: "'Yearly'/yyyy",
          templatePath: "",
        },
      },
      rangeNotes: {
        showInCalendar: true,
        folder: "Intervals",
        scanScope: "range-folder",
        customFolder: "",
        monthViewLimit: 2,
        weekViewLimit: 5,
      },
      ics: {
        enabled: true,
        sources: ["Fixtures/acceptance.ics"],
      },
    }),
    "Acceptance.md": `# Chrono Notes acceptance Vault

This Vault is generated. Do not store personal notes here.

Primary calendar window: July 2026.
Layout combinations: February 17 and February 28, 2026.
Future calendar locale samples: March 20 and September 11, 2026.
`,
    "Daily/2026-02-17.md": `---
category: acceptance-layout
---
# Task progress and regional rest marker

- [x] Completed task
- [ ] Pending task one
- [ ] Pending task two
`,
    "Daily/2026-02-28.md": `---
category: acceptance-layout
---
# Task progress and adjusted workday marker

- [x] Completed task
- [ ] Pending task
`,
    "Daily/2026-03-20.md": `---
category: calendar-reference
---
# Persian calendar reference

نوروز · Nowruz reference date.
`,
    "Daily/2026-07-14.md": `---
aliases:
  - 2026-07-14
---
# Tuesday acceptance note

First preview line with [[Linked note]].
Second preview line #acceptance.
Third preview line.
Fourth preview line.
Fifth line must not enter the four-line preview.

- [ ] Due today 📅 2026-07-14
- [ ] Scheduled today ⏳ 2026-07-14
- [ ] Multi marker 📅 2026-07-15 ⏳ 2026-07-15
- [x] Completed overdue 📅 2026-07-10
`,
    "Daily/2026-07-15.md": `---
category: frontmatter-only
---
`,
    "Daily/2026-07-16.md": `# Thursday acceptance note

Short body.
`,
    "Daily/2026-07-17.md": `# Friday acceptance note

- [x] Completed
`,
    "Daily/2026-09-11.md": `---
category: calendar-reference
---
# Ethiopic and Hebrew locale samples

እንቁጣጣሽ · ראש השנה · calendar rendering reference.
`,
    "Weekly/2026-W29.md": `# Week 29

Weekly acceptance fixture.
`,
    "Monthly/2026-07.md": `# July 2026

Monthly acceptance fixture.
`,
    "Quarterly/2026-Q3.md": `# 2026 Q3

Quarterly acceptance fixture.
`,
    "Yearly/2026.md": `# 2026

Yearly acceptance fixture.
`,
    "Intervals/Alpha.md": `---
start: 2026-07-13
end: 2026-07-16
---
# Alpha interval

- [x] Completed item
- [ ] Pending item
`,
    "Intervals/Beta.md": `---
start: 2026-07-14
end: 2026-07-17
---
# Beta interval

Overlaps Alpha.
`,
    "Intervals/Gamma.md": `---
start: 2026-07-15
end: 2026-07-18
---
# Gamma interval

Exercises a third range lane and overflow.
`,
    "Fixtures/acceptance.ics": `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Chrono Notes//Acceptance//EN
BEGIN:VEVENT
UID:team-offsite@example.test
DTSTART;VALUE=DATE:20260714
DTEND;VALUE=DATE:20260715
SUMMARY:Team offsite
END:VEVENT
BEGIN:VEVENT
UID:project-review@example.test
DTSTART:20260714T013000Z
DTEND:20260714T023000Z
SUMMARY:Project review
END:VEVENT
BEGIN:VEVENT
UID:design-sprint@example.test
DTSTART:20260715T220000
DTEND:20260717T010000
SUMMARY:Design sprint
END:VEVENT
BEGIN:VEVENT
UID:daily-sync@example.test
DTSTART;VALUE=DATE:20260714
RRULE:FREQ=DAILY;COUNT=3
SUMMARY:Daily sync
END:VEVENT
END:VCALENDAR
`,
  };
}

async function readSafeMarker(acceptanceRoot, target) {
  assert.equal(typeof target, "string", "An exact acceptance Vault target is required");
  const resolvedRoot = path.resolve(acceptanceRoot);
  const safeRoot = await realpath(resolvedRoot);
  const resolvedTarget = path.resolve(target);
  assertDescendant(safeRoot, resolvedTarget);
  const targetStats = await lstat(resolvedTarget);
  assert.ok(targetStats.isDirectory(), "Acceptance Vault target is not a directory");
  assert.ok(!targetStats.isSymbolicLink(), "Acceptance Vault target must not be a symlink");
  const safeTarget = await realpath(resolvedTarget);
  assertDescendant(safeRoot, safeTarget);

  const markerPath = path.join(safeTarget, ACCEPTANCE_MARKER_NAME);
  await assertRegularFile(markerPath, "Acceptance Vault marker is missing");
  const marker = await readJson(markerPath);
  assert.equal(marker.kind, ACCEPTANCE_MARKER_KIND, "Unexpected acceptance marker kind");
  assert.equal(
    marker.markerVersion,
    ACCEPTANCE_MARKER_VERSION,
    "Unsupported acceptance marker version",
  );
  return { marker, safeRoot, safeTarget };
}

function resolveGeneratedPath(target, relativePath) {
  assert.equal(typeof relativePath, "string", "Generated path must be a string");
  assert.ok(relativePath.length > 0, "Generated path must not be empty");
  const resolved = path.resolve(target, relativePath);
  assertDescendant(target, resolved);
  return resolved;
}

function assertDescendant(root, target) {
  const relativePath = path.relative(path.resolve(root), path.resolve(target));
  assert.ok(
    relativePath.length > 0 &&
      relativePath !== ".." &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath),
    `Path must stay below the acceptance root: ${target}`,
  );
}

async function assertRegularFile(filePath, message) {
  let fileStats;
  try {
    fileStats = await lstat(filePath);
  } catch {
    assert.fail(message);
  }
  assert.ok(fileStats.isFile(), message);
  assert.ok(!fileStats.isSymbolicLink(), `${message} (symlinks are not allowed)`);
}

async function hashFile(filePath) {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readSettingsSchemaVersion(sourceRoot) {
  const source = await readFile(
    path.join(sourceRoot, "src", "shared", "settings.ts"),
    "utf8",
  );
  const match = source.match(
    /export const SETTINGS_SCHEMA_VERSION = (?<version>\d+);/u,
  );
  assert.ok(match?.groups?.version !== undefined, "Settings schema version was not found");
  return Number(match.groups.version);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, jsonText(value), "utf8");
}

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeFixtureFile(target, relativePath, content) {
  const destination = resolveGeneratedPath(target, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content, "utf8");
}

function createRunId(now) {
  const timestamp = now.toISOString().replaceAll(/[:.]/gu, "-");
  return `${timestamp}-${process.pid}-${randomUUID().slice(0, 8)}`;
}

function parseCliOptions(arguments_) {
  const options = {};
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--") continue;
    if (argument === "--root" || argument === "--target" || argument === "--max-age-hours") {
      const value = arguments_[index + 1];
      assert.ok(value !== undefined, `${argument} requires a value`);
      options[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    assert.fail(`Unknown argument: ${argument}`);
  }
  return options;
}

async function runCli() {
  const [command, ...arguments_] = process.argv.slice(2);
  const options = parseCliOptions(arguments_);
  const acceptanceRoot = options.root === undefined
    ? getDefaultAcceptanceRoot()
    : path.resolve(options.root);

  if (command === "create") {
    const target = await createAcceptanceVault({ acceptanceRoot });
    process.stdout.write(`Acceptance Vault created: ${target}\n`);
    return;
  }
  if (command === "verify") {
    await verifyAcceptanceVault({
      acceptanceRoot,
      target: options.target,
    });
    process.stdout.write(`Acceptance Vault verified: ${path.resolve(options.target)}\n`);
    return;
  }
  if (command === "clean") {
    await cleanAcceptanceVault({
      acceptanceRoot,
      target: options.target,
    });
    process.stdout.write(`Acceptance Vault removed: ${path.resolve(options.target)}\n`);
    return;
  }
  if (command === "prune") {
    const maxAgeHours = options["max-age-hours"] === undefined
      ? DEFAULT_RETENTION_HOURS
      : Number(options["max-age-hours"]);
    const removed = await pruneAcceptanceVaults({
      acceptanceRoot,
      maxAgeHours,
    });
    process.stdout.write(
      removed.length === 0
        ? "No stale acceptance Vaults found.\n"
        : `Removed stale acceptance Vaults:\n${removed.join("\n")}\n`,
    );
    return;
  }
  assert.fail("Usage: acceptance-vault.mjs <create|verify|clean|prune> [options]");
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isCli = process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  await runCli();
}
