import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const STABLE_VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;
const SOURCE_COMMANDS = new Set(["validate", "validate-tag", "bundle"]);
const EVENT_COMMANDS = new Set([
  "event-publication-boundary", "event-publication-preflight", "publish-github-event",
]);

export function extractReleaseNotes(changelog, version) {
  if (!STABLE_VERSION.test(version)) {
    throw new Error(`Release notes version is invalid: ${version}`);
  }
  const heading = `## ${version}`;
  const lines = changelog.split(/\r?\n/u);
  const start = lines.findIndex((line) => line === heading);
  if (start < 0) {
    throw new Error(`CHANGELOG.md has no section for ${version}`);
  }
  if (lines.indexOf(heading, start + 1) !== -1) {
    throw new Error(`CHANGELOG.md has duplicate sections for ${version}`);
  }
  const endOffset = lines.slice(start + 1).findIndex((line) => line.startsWith("## "));
  const end = endOffset < 0 ? lines.length : start + 1 + endOffset;
  const body = lines.slice(start + 1, end).join("\n").trim();
  if (body.length === 0) {
    throw new Error(`CHANGELOG.md section for ${version} is empty`);
  }
  return `${body}\n`;
}

export async function prepareReleaseArgs(projectRoot, argv, env = process.env) {
  const command = argv[0];
  if (!SOURCE_COMMANDS.has(command) && !EVENT_COMMANDS.has(command)) return argv;
  let version;
  if (EVENT_COMMANDS.has(command)) {
    version = env.GITHUB_REF_NAME ?? "";
  } else {
    const versionIndex = argv.indexOf("--version");
    version = versionIndex < 0
      ? JSON.parse(await readFile(path.join(projectRoot, "manifest.json"), "utf8")).version
      : argv[versionIndex + 1];
  }
  const changelog = await readFile(path.join(projectRoot, "CHANGELOG.md"), "utf8");
  const notes = extractReleaseNotes(changelog, version);
  if (command !== "publish-github-event" || argv.includes("--notes-file")) return argv;
  const outputDirectory = env.RUNNER_TEMP ?? path.join(projectRoot, "build");
  await mkdir(outputDirectory, { recursive: true });
  const notesFile = path.join(outputDirectory, `chrono-notes-${version}-release-notes.md`);
  await writeFile(notesFile, notes, "utf8");
  return [...argv, "--notes-file", notesFile];
}
