import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const vitestCli = fileURLToPath(
  new URL("../node_modules/vitest/vitest.mjs", import.meta.url),
);
const timeZones = ["UTC", "America/New_York"];

for (const timeZone of timeZones) {
  process.stdout.write(`\nChrono Notes tests with TZ=${timeZone}\n`);
  await run(process.execPath, [vitestCli, "run"], {
    ...process.env,
    TZ: timeZone,
  });
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal !== null) {
        reject(new Error(`Vitest exited from signal ${signal}`));
      } else if (code !== 0) {
        reject(new Error(`Vitest exited with code ${code ?? "unknown"}`));
      } else {
        resolve();
      }
    });
  });
}
