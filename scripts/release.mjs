import config from "../release.config.mjs";
import { prepareReleaseArgs } from "./release-notes.mjs";
import { createReleaseAdapter } from "./vendor/obsidian-release-core.mjs";

const adapter = createReleaseAdapter({
  adapterUrl: import.meta.url,
  config,
});

export const projectRoot = adapter.projectRoot;
export const releaseConfig = adapter.releaseConfig;
export const verifyReleaseCorePin = adapter.verifyReleaseCorePin;
export const run = adapter.run;

await adapter.runIfMain({
  argv: await prepareReleaseArgs(adapter.projectRoot, process.argv.slice(2), process.env),
});
