import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const roots = ["src", "tests", "benchmarks", "scripts"];
const checkedExtensions = new Set([".ts", ".tsx", ".mjs", ".css"]);
const violations = [];

for (const root of roots) {
  for (const path of await listFiles(root)) {
    if (!checkedExtensions.has(extname(path))) continue;
    const content = await readFile(path, "utf8");
    if (content.startsWith("\uFEFF")) violations.push(`${path}: UTF-8 BOM`);
    if (content.length > 0 && !content.endsWith("\n")) {
      violations.push(`${path}: missing final newline`);
    }
    for (const [index, line] of content.replaceAll("\r\n", "\n").split("\n").entries()) {
      if (/\s+$/u.test(line)) violations.push(`${path}:${index + 1}: trailing whitespace`);
      if (line.includes("\t")) violations.push(`${path}:${index + 1}: tab indentation`);
    }
  }
}

if (violations.length > 0) {
  throw new Error(`Source style check failed:\n${violations.join("\n")}`);
}

process.stdout.write("Source style check passed.\n");

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path));
    else files.push(relative(process.cwd(), path).replaceAll("\\", "/"));
  }
  return files;
}
