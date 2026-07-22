import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = resolve(process.cwd(), "src");
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const LAYER_IMPORTS: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({
  core: new Set(["core"]),
  shared: new Set(["core", "shared"]),
  features: new Set(["core", "shared", "features"]),
  adapters: new Set(["core", "shared", "features", "adapters"]),
  ui: new Set(["core", "shared", "features", "ui"]),
  app: new Set(["core", "shared", "features", "adapters", "ui", "app"]),
});

describe("source dependency architecture", () => {
  const files = listSourceFiles(SOURCE_ROOT);
  const graph = buildRelativeImportGraph(files);

  it("keeps imports inside the documented layer direction", () => {
    const violations: string[] = [];
    for (const [source, dependencies] of graph) {
      const sourceLayer = getLayer(source);
      if (sourceLayer === undefined) continue;
      const allowedLayers = LAYER_IMPORTS[sourceLayer];
      if (allowedLayers === undefined) continue;
      for (const dependency of dependencies) {
        const dependencyLayer = getLayer(dependency);
        if (dependencyLayer !== undefined && !allowedLayers.has(dependencyLayer)) {
          violations.push(`${displayPath(source)} -> ${displayPath(dependency)}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("keeps core independent from Obsidian and React", () => {
    const violations: string[] = [];
    for (const file of files.filter((candidate) => getLayer(candidate) === "core")) {
      const source = readFileSync(file, "utf8");
      for (const specifier of collectModuleSpecifiers(file, source)) {
        if (
          specifier === "obsidian" ||
          specifier === "react" ||
          specifier === "react-dom" ||
          specifier.startsWith("react-dom/")
        ) {
          violations.push(`${displayPath(file)} -> ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("has no cycles between source modules", () => {
    expect(findCycles(graph).map((cycle) => cycle.map(displayPath))).toEqual([]);
  });
});

function listSourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...listSourceFiles(path));
    else if (SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(path);
  }
  return files.sort();
}

function buildRelativeImportGraph(files: readonly string[]): Map<string, readonly string[]> {
  const sourceFiles = new Set(files);
  return new Map(files.map((file) => {
    const source = readFileSync(file, "utf8");
    const dependencies = collectModuleSpecifiers(file, source)
      .filter((specifier) => specifier.startsWith("."))
      .map((specifier) => resolveSourceModule(file, specifier))
      .filter((dependency): dependency is string => (
        dependency !== null && sourceFiles.has(dependency)
      ));
    return [file, Object.freeze([...new Set(dependencies)].sort())] as const;
  }));
}

function collectModuleSpecifiers(file: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const specifiers: string[] = [];
  sourceFile.forEachChild((node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
  });
  return specifiers;
}

function resolveSourceModule(importer: string, specifier: string): string | null {
  const base = resolve(dirname(importer), specifier);
  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    resolve(base, "index.ts"),
    resolve(base, "index.tsx"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function findCycles(graph: ReadonlyMap<string, readonly string[]>): string[][] {
  const complete = new Set<string>();
  const active = new Map<string, number>();
  const stack: string[] = [];
  const cycles: string[][] = [];

  const visit = (file: string): void => {
    if (complete.has(file)) return;
    const activeIndex = active.get(file);
    if (activeIndex !== undefined) {
      cycles.push([...stack.slice(activeIndex), file]);
      return;
    }
    active.set(file, stack.length);
    stack.push(file);
    for (const dependency of graph.get(file) ?? []) visit(dependency);
    stack.pop();
    active.delete(file);
    complete.add(file);
  };

  for (const file of graph.keys()) visit(file);
  return cycles;
}

function getLayer(file: string): string | undefined {
  return relative(SOURCE_ROOT, file).split(/[\\/]/, 1)[0];
}

function displayPath(file: string): string {
  return relative(process.cwd(), file).replaceAll("\\", "/");
}
