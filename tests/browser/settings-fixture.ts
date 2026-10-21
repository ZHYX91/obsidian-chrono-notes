import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));

export async function createSettingsBrowserFixture(): Promise<{ html: string; script: string }> {
  const bundle = await build({
    entryPoints: [resolve(here, "settings-entry.ts")],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    plugins: [{
      name: "settings-host-fixture",
      setup(builder) {
        builder.onResolve({ filter: /^obsidian$/ }, () => ({
          path: resolve(here, "obsidian-host.ts"),
        }));
        // These sections are outside this contract. Keep real routing and the
        // complete extensions panel, including its actual async event handlers.
        builder.onResolve({ filter: /^\.\/(general|appearance|periodic|range)-settings-section$/ }, (args) => ({
          path: args.path, namespace: "unused-panel",
        }));
        builder.onLoad({ filter: /.*/, namespace: "unused-panel" }, (args) => {
          const renderers: Record<string, string> = {
            "./general-settings-section": "renderGeneralSettingsSection",
            "./appearance-settings-section": "renderAppearanceSettingsSection",
            "./periodic-settings-section": "renderPeriodicSettingsSection",
            "./range-settings-section": "renderRangeSettingsSection",
          };
          const renderer = renderers[args.path];
          if (renderer === undefined) throw new Error(`Unexpected settings panel: ${args.path}`);
          return { contents: `export function ${renderer}() {}`, loader: "js" };
        });
        builder.onResolve({ filter: /^\.\/declarative-settings$/ }, () => ({
          path: "declarative", namespace: "inactive-surface",
        }));
        builder.onLoad({ filter: /.*/, namespace: "inactive-surface" }, () => ({
          contents: "export const applyDeclarativeControlValue=()=>{throw Error('inactive surface')};export const getDeclarativeControlValue=()=>undefined;export const getDeclarativeSettingDefinitions=()=>[];",
          loader: "js",
        }));
      },
    }],
  });
  const script = bundle.outputFiles[0]?.text;
  if (script === undefined) throw new Error("Settings fixture did not bundle");
  const css = await readFile(resolve(here, "../../src/ui/styles/settings.css"), "utf8");
  return {
    script,
    html: `<!doctype html><html><head><meta charset="utf-8"><style>
      :root { --size-2-1:2px; --size-4-5:20px; --font-ui-small:13px; --font-semibold:600;
        --text-normal:#222; --text-muted:#666; --background-modifier-border:#ccc;
        --interactive-accent:#7852ee; --font-ui-smaller:12px; --background-secondary:#f5f5f5; }
      body { font-family:Arial,sans-serif; margin:32px; color:#222; }
      .setting-item { padding:12px 0; border-bottom:1px solid #ddd; }
      .setting-item-description { font-size:12px; color:#666; }
      select { max-width:100%; }
      ${css}
    </style></head><body><div id="settings-fixture"></div></body></html>`,
  };
}
