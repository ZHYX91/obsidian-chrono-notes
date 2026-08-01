import { readFile } from "node:fs/promises";

import { assertRuntimeContract, parsePnpmVersion } from "./runtime-contract.mjs";

const [nodeVersionSource, packageSource] = await Promise.all([
  readFile(".node-version", "utf8"),
  readFile("package.json", "utf8"),
]);
const configuredNodeVersion = nodeVersionSource.trim();
const packageJson = JSON.parse(packageSource);
const currentPnpmVersion = parsePnpmVersion(process.env.npm_config_user_agent);

assertRuntimeContract({
  configuredNodeVersion,
  currentNodeVersion: process.versions.node,
  currentPnpmVersion,
  packageJson,
});

process.stdout.write(
  `Runtime contract passed for Node.js ${configuredNodeVersion} and pnpm ${currentPnpmVersion}.\n`,
);
