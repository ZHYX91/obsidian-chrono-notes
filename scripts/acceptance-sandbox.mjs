import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createAcceptanceVault, verifyAcceptanceVault } from "./acceptance-vault.mjs";
import { artifactPaths } from "./build-contract.mjs";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultKitRoot = path.resolve(projectRoot, "..", "obsidian-acceptance-kit");

function parseOptions(arguments_) {
  const options = new Map();
  for (let index = 0; index < arguments_.length; index += 1) {
    const flag = arguments_[index];
    if (flag === "--") continue;
    assert.ok(flag.startsWith("--"), `Unexpected argument: ${flag}`);
    assert.ok(!options.has(flag), `Duplicate argument: ${flag}`);
    const value = arguments_[index + 1];
    assert.ok(value !== undefined && !value.startsWith("--"), `${flag} requires a value`);
    options.set(flag, value);
    index += 1;
  }
  return options;
}

function required(options, flag) {
  const value = options.get(flag);
  assert.ok(value !== undefined, `${flag} is required`);
  return value;
}

function assertOnly(options, allowed) {
  for (const flag of options.keys()) {
    assert.ok(allowed.includes(flag), `Unknown argument: ${flag}`);
  }
}

async function loadKit(kitRoot) {
  const packageJson = JSON.parse(await readFile(path.join(kitRoot, "package.json"), "utf8"));
  assert.equal(packageJson.name, "@zhyx/obsidian-acceptance-kit", "Unexpected acceptance kit package");
  assert.match(packageJson.version, /^0\.2\./u, "Chrono Notes requires acceptance kit 0.2.x");
  return import(pathToFileURL(path.join(kitRoot, "src", "index.mjs")).href);
}

async function gitIdentity() {
  const [{ stdout: commit }, { stdout: tree }] = await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD"], { cwd: projectRoot, encoding: "utf8" }),
    execFileAsync("git", ["rev-parse", "HEAD^{tree}"], { cwd: projectRoot, encoding: "utf8" }),
  ]);
  return { commit: commit.trim(), tree: tree.trim() };
}

async function createKitConfig(stagingRoot, productVault, hostProfile) {
  const fixturesDirectory = path.join(stagingRoot, "fixtures");
  await cp(productVault, fixturesDirectory, { recursive: true, errorOnExist: true, force: false });
  for (const assetName of ["main.js", "manifest.json", "styles.css"]) {
    await rm(path.join(fixturesDirectory, ".obsidian", "plugins", "chrono-notes", assetName));
  }
  const manifest = JSON.parse(await readFile(path.join(projectRoot, "manifest.json"), "utf8"));
  const identity = await gitIdentity();
  const configPath = path.join(stagingRoot, "acceptance.config.mjs");
  const config = {
    pluginId: "chrono-notes",
    fixturesDirectory,
    hostProfile,
    candidate: {
      version: manifest.version,
      ...identity,
      assets: {
        "main.js": path.resolve(projectRoot, artifactPaths.main),
        "manifest.json": path.resolve(projectRoot, artifactPaths.manifest),
        "styles.css": path.resolve(projectRoot, artifactPaths.styles),
      },
    },
  };
  await writeFile(configPath, `export default ${JSON.stringify(config, null, 2)};\n`, "utf8");
  return configPath;
}

export async function prepareChronoSandbox({
  bundlePath,
  obsidianDirectory,
  obsidianVersion,
  kitRoot = defaultKitRoot,
  memoryInMB = 4096,
}) {
  const kit = await loadKit(path.resolve(kitRoot));
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "chrono-notes-sandbox-stage-"));
  let sharedVaultPath = null;
  try {
    const productRoot = path.join(stagingRoot, "product-vaults");
    await mkdir(productRoot);
    const productVault = await createAcceptanceVault({ acceptanceRoot: productRoot });
    const configPath = await createKitConfig(stagingRoot, productVault, {
      profileId: "windows-sandbox-clean",
      platform: "windows-sandbox",
      obsidianVersion,
    });
    const config = await kit.loadAcceptanceConfig(configPath);
    const prepared = await kit.prepareVault(config);
    sharedVaultPath = prepared.vaultPath;
    await kit.installCandidate(config, {
      vaultPath: prepared.vaultPath,
      runId: prepared.marker.runId,
    });
    await kit.verifyInput({ vaultPath: prepared.vaultPath, runId: prepared.marker.runId });
    const sandbox = await kit.prepareWindowsSandbox({
      vaultPath: prepared.vaultPath,
      runId: prepared.marker.runId,
      obsidianDirectory: path.resolve(obsidianDirectory),
      bundlePath: path.resolve(bundlePath),
      memoryInMB,
    });
    return {
      ...sandbox,
      candidate: prepared.marker.candidate,
      hostProfile: prepared.marker.hostProfile,
      productFixtureContract: "chrono-notes-acceptance-vault-v2",
    };
  } catch (error) {
    if (sharedVaultPath !== null) {
      error.message = `${error.message} (preserved temporary Vault: ${sharedVaultPath})`;
    }
    throw error;
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}

export async function verifyChronoSandbox({ bundlePath, runId, kitRoot = defaultKitRoot }) {
  const kit = await loadKit(path.resolve(kitRoot));
  const infrastructure = await kit.verifyWindowsSandboxResult({
    bundlePath: path.resolve(bundlePath),
    runId,
  });
  const resultRoot = path.join(path.resolve(bundlePath), "output", runId);
  const resultVault = path.join(resultRoot, "vault");
  const fixtureMarker = await verifyAcceptanceVault({
    acceptanceRoot: resultRoot,
    target: resultVault,
  });
  return {
    infrastructure,
    productFixtureContractVerified: true,
    productFixtureMarker: fixtureMarker,
    productScenarioStatus: "not-evaluated",
  };
}

async function runCli() {
  const [command, ...arguments_] = process.argv.slice(2);
  const options = parseOptions(arguments_);
  if (command === "prepare") {
    assertOnly(options, [
      "--bundle",
      "--obsidian-dir",
      "--obsidian-version",
      "--kit-root",
      "--memory-mb",
    ]);
    const result = await prepareChronoSandbox({
      bundlePath: required(options, "--bundle"),
      obsidianDirectory: required(options, "--obsidian-dir"),
      obsidianVersion: required(options, "--obsidian-version"),
      kitRoot: options.get("--kit-root") ?? defaultKitRoot,
      memoryInMB: options.has("--memory-mb") ? Number(options.get("--memory-mb")) : 4096,
    });
    process.stdout.write(`${JSON.stringify({ success: true, data: result }, null, 2)}\n`);
    return;
  }
  if (command === "verify") {
    assertOnly(options, ["--bundle", "--run-id", "--kit-root"]);
    const result = await verifyChronoSandbox({
      bundlePath: required(options, "--bundle"),
      runId: required(options, "--run-id"),
      kitRoot: options.get("--kit-root") ?? defaultKitRoot,
    });
    process.stdout.write(`${JSON.stringify({ success: true, data: result }, null, 2)}\n`);
    return;
  }
  assert.fail("Usage: acceptance-sandbox.mjs <prepare|verify> [options]");
}

const isCli = process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    await runCli();
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, null, 2)}\n`);
    process.exitCode = 1;
  }
}
