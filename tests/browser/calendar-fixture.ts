import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));

export async function createCalendarBrowserFixture(): Promise<{ html: string; script: string }> {
  const [bundle, styles] = await Promise.all([
    build({
      entryPoints: [resolve(here, "calendar-entry.tsx")], bundle: true, write: false,
      format: "iife", platform: "browser", define: { "process.env.NODE_ENV": '"production"' },
    }),
    build({ entryPoints: [resolve(here, "../../src/ui/styles/index.css")], bundle: true, write: false }),
  ]);
  const script = bundle.outputFiles[0]?.text;
  const css = styles.outputFiles[0]?.text;
  if (script === undefined || css === undefined) throw new Error("Calendar fixture did not bundle");
  return {
    script,
    html: `<!doctype html><html><head><meta charset="utf-8"><style>
      :root { --text-normal:#222; --text-muted:#666; --text-faint:#777; --text-error:#b21d32;
        --text-warning:#a46200; --text-success:#267f46; --text-on-accent:white; --interactive-accent:#7155d8;
        --background-primary:#fff; --background-secondary:#f5f4f9; --background-modifier-border:#d9d7df;
        --background-modifier-hover:#eeeaf7; --background-modifier-form-field:#fff;
        --font-interface:Arial,sans-serif; --font-ui-medium:14px; --font-ui-small:13px; --font-ui-smaller:12px;
        --font-smallest:11px; --radius-s:4px; --radius-m:8px; --size-4-2:8px; }
      * { box-sizing:border-box; } body { font-family:Arial,sans-serif; margin:20px; color:#222; }
      button, select { font:inherit; color:inherit; background:#f5f4f9; border:1px solid #d9d7df; border-radius:4px; padding:4px 8px; }
      button { cursor:pointer; } button:disabled { opacity:.55; } input { font:inherit; }
      #calendar-fixture { border:1px solid #d9d7df; border-radius:8px; padding:12px; }
      ${css}
    </style></head><body><div id="calendar-fixture"></div></body></html>`,
  };
}
