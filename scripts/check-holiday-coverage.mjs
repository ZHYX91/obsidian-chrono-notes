import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const yearArgumentIndex = process.argv.indexOf("--year");
const yearArgument = yearArgumentIndex === -1
  ? undefined
  : process.argv[yearArgumentIndex + 1];

if (
  yearArgumentIndex !== -1 &&
  (!/^\d{4}$/.test(yearArgument ?? "") || Number(yearArgument) < 1)
) {
  console.error("Usage: node scripts/check-holiday-coverage.mjs [--year YYYY]");
  process.exitCode = 2;
} else {
  const result = spawnSync(
    process.execPath,
    [
      path.join(repositoryRoot, "node_modules", "vitest", "vitest.mjs"),
      "run",
      "tests/features/holiday-coverage.test.ts",
      "--reporter=verbose",
    ],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        CHRONO_HOLIDAY_RELEASE_CHECK: "1",
        ...(yearArgument === undefined ? {} : { CHRONO_HOLIDAY_BASE_YEAR: yearArgument }),
      },
      stdio: "inherit",
    },
  );

  if (result.error !== undefined) throw result.error;
  process.exitCode = result.status ?? 1;
}
