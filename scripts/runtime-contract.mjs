import assert from "node:assert/strict";

export function assertRuntimeContract({
  configuredNodeVersion,
  currentNodeVersion,
  currentPnpmVersion,
  packageJson,
}) {
  const packageManagerMatch = /^pnpm@(\d+\.\d+\.\d+)$/u.exec(
    packageJson.packageManager ?? "",
  );
  assert.ok(
    packageManagerMatch,
    "package.json packageManager must pin pnpm to an exact version",
  );

  assert.match(
    configuredNodeVersion,
    /^\d+\.\d+\.\d+$/u,
    ".node-version must pin an exact Node.js version",
  );
  assert.equal(
    packageJson.engines?.node,
    configuredNodeVersion,
    "package.json engines.node must match .node-version exactly",
  );
  assert.equal(
    currentNodeVersion,
    configuredNodeVersion,
    `Node.js ${configuredNodeVersion} is required; received ${currentNodeVersion}`,
  );
  assert.equal(
    currentPnpmVersion,
    packageManagerMatch[1],
    `pnpm ${packageManagerMatch[1]} is required; received ${currentPnpmVersion}`,
  );
}

export function parsePnpmVersion(userAgent) {
  const match = /(?:^|\s)pnpm\/(\d+\.\d+\.\d+)(?:\s|$)/u.exec(userAgent ?? "");
  assert.ok(match, "Run the runtime check through pnpm so its exact version can be verified");
  return match[1];
}
