import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import {
  artifactPaths,
  externalModules,
  productionJavascriptBudgetBytes,
  productionJavascriptReferenceBytes,
} from "./build-contract.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const resolveProjectPath = (relativePath) => path.resolve(projectRoot, relativePath);

const [
  mainSource,
  stylesSource,
  builtManifestSource,
  sourceManifestSource,
  packageSource,
  versionsSource,
  metafileSource,
  mainStats,
] = await Promise.all([
  readFile(resolveProjectPath(artifactPaths.main), "utf8"),
  readFile(resolveProjectPath(artifactPaths.styles), "utf8"),
  readFile(resolveProjectPath(artifactPaths.manifest), "utf8"),
  readFile(resolveProjectPath("manifest.json"), "utf8"),
  readFile(resolveProjectPath("package.json"), "utf8"),
  readFile(resolveProjectPath("versions.json"), "utf8"),
  readFile(resolveProjectPath(artifactPaths.metafile), "utf8"),
  stat(resolveProjectPath(artifactPaths.main)),
]);

const builtManifest = JSON.parse(builtManifestSource);
const sourceManifest = JSON.parse(sourceManifestSource);
const packageJson = JSON.parse(packageSource);
const versions = JSON.parse(versionsSource);
const metafile = JSON.parse(metafileSource);

assert.deepEqual(builtManifest, sourceManifest, "Built manifest must match manifest.json");
assert.equal(
  sourceManifest.version,
  packageJson.version,
  "manifest.json and package.json versions must match",
);
assert.equal(
  versions[sourceManifest.version],
  sourceManifest.minAppVersion,
  "versions.json must map the package version to manifest.json minAppVersion",
);

const obsidianApiVersion = packageJson.devDependencies?.obsidian;
assert.match(
  obsidianApiVersion,
  /^\d+\.\d+\.\d+$/,
  "The Obsidian API dependency must be pinned to an exact version",
);
assertCompatibleObsidianVersions(obsidianApiVersion, sourceManifest.minAppVersion);

assert.ok(mainSource.length > 0, "Production main.js must not be empty");
assert.ok(stylesSource.length > 0, "Production styles.css must not be empty");
assert.ok(
  mainStats.size <= productionJavascriptBudgetBytes,
  `Production main.js is ${mainStats.size} B; budget is ${productionJavascriptBudgetBytes} B`,
);

for (const marker of [
  "react.development.js",
  "react-dom.development.js",
  "Download the React DevTools",
  "process.env.NODE_ENV",
]) {
  assert.ok(!mainSource.includes(marker), `Production bundle contains development marker: ${marker}`);
}

for (const desktopModule of ["node:fs/promises", "node:path"]) {
  assert.ok(
    mainSource.includes(desktopModule),
    `Production bundle lost the desktop ICS runtime branch for ${desktopModule}`,
  );
}

const mainOutput = findMetafileOutput(metafile, artifactPaths.main);
assert.equal(
  normalizePath(mainOutput.entryPoint),
  "main.ts",
  "Production main.js must be built from main.ts",
);

const externalImports = collectExternalImports(metafile);
const unexpectedExternals = [...externalImports]
  .filter((moduleId) => !externalModules.includes(moduleId))
  .sort();
assert.deepEqual(
  unexpectedExternals,
  [],
  `Unexpected production externals: ${unexpectedExternals.join(", ")}`,
);
for (const forbiddenExternal of ["process", "node:process", "buffer", "node:buffer"]) {
  assert.ok(
    !externalImports.has(forbiddenExternal),
    `Production bundle must not externalize ${forbiddenExternal}`,
  );
}

smokeLoadPlugin(resolveProjectPath(artifactPaths.main), mainSource);

console.log(
  `Production artifact check passed: ${mainStats.size} B / ${productionJavascriptBudgetBytes} B, ` +
  `headroom ${productionJavascriptBudgetBytes - mainStats.size} B, ` +
  `delta ${formatSignedBytes(mainStats.size - productionJavascriptReferenceBytes)}, ` +
  `externals: ${[...externalImports].sort().join(", ") || "none"}`,
);

if (process.argv.includes("--details")) {
  console.log("Largest main.js packages:");
  for (const [packageName, bytes] of aggregatePackageBytes(mainOutput.inputs).slice(0, 12)) {
    console.log(`${String(bytes).padStart(9)} B  ${packageName}`);
  }
  console.log("Largest main.js inputs:");
  for (const [inputPath, input] of Object.entries(mainOutput.inputs)
    .sort((left, right) => right[1].bytesInOutput - left[1].bytesInOutput)
    .slice(0, 12)) {
    console.log(`${String(input.bytesInOutput).padStart(9)} B  ${normalizePath(inputPath)}`);
  }
}

function aggregatePackageBytes(inputs) {
  const packages = new Map();
  for (const [inputPath, input] of Object.entries(inputs)) {
    const packageName = getPackageName(inputPath);
    packages.set(packageName, (packages.get(packageName) ?? 0) + input.bytesInOutput);
  }
  return [...packages.entries()].sort((left, right) =>
    right[1] - left[1] || left[0].localeCompare(right[0]));
}

function getPackageName(inputPath) {
  const normalized = normalizePath(inputPath);
  const marker = "/node_modules/";
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex < 0) return "(application)";
  const segments = normalized.slice(markerIndex + marker.length).split("/");
  return segments[0]?.startsWith("@")
    ? `${segments[0]}/${segments[1]}`
    : segments[0];
}

function formatSignedBytes(bytes) {
  return `${bytes >= 0 ? "+" : ""}${bytes} B`;
}

function assertCompatibleObsidianVersions(apiVersion, minimumAppVersion) {
  const api = parseNumericVersion(apiVersion, "Obsidian API dependency");
  const app = parseNumericVersion(minimumAppVersion, "minimum Obsidian app version");
  assert.deepEqual(
    api.slice(0, 2),
    app.slice(0, 2),
    "Obsidian API typings and minAppVersion must use the same major/minor release line",
  );
  assert.ok(
    compareNumericVersions(api, app) <= 0,
    "Obsidian API typings must not be newer than minAppVersion",
  );
}

function parseNumericVersion(version, label) {
  assert.match(version, /^\d+\.\d+\.\d+$/, `${label} must be a numeric semantic version`);
  return version.split(".").map(Number);
}

function compareNumericVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function collectExternalImports(buildMetafile) {
  const imports = new Set();
  for (const output of Object.values(buildMetafile.outputs)) {
    for (const importRecord of output.imports ?? []) {
      if (importRecord.external === true) imports.add(importRecord.path);
    }
  }
  return imports;
}

function findMetafileOutput(buildMetafile, relativeOutputPath) {
  const expected = resolveProjectPath(relativeOutputPath);
  const match = Object.entries(buildMetafile.outputs).find(
    ([outputPath]) => path.resolve(projectRoot, outputPath) === expected,
  );
  assert.ok(match !== undefined, `Metafile is missing ${relativeOutputPath}`);
  return match[1];
}

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function smokeLoadPlugin(bundlePath, bundleSource) {
  const runtimeMock = function ObsidianRuntimeMock() {};
  const moduleMock = new Proxy(Object.create(null), {
    get: () => runtimeMock,
  });
  const requireExternal = (moduleId) => {
    assert.ok(externalModules.includes(moduleId), `Smoke test encountered unexpected require: ${moduleId}`);
    return moduleMock;
  };
  const commonJsModule = { exports: {} };
  const wrapper = vm.runInThisContext(
    `(function (require, module, exports, __filename, __dirname) {\n${bundleSource}\n})`,
    { filename: bundlePath },
  );
  wrapper(
    requireExternal,
    commonJsModule,
    commonJsModule.exports,
    bundlePath,
    path.dirname(bundlePath),
  );

  assert.equal(
    typeof commonJsModule.exports.default,
    "function",
    "Bundle must expose a default plugin class",
  );
  assert.equal(
    typeof commonJsModule.exports.default.prototype.onload,
    "function",
    "Default plugin export must define onload()",
  );
}
