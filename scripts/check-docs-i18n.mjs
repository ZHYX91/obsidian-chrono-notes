import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const defaultProjectRoot = path.resolve(path.dirname(scriptPath), "..");
const docsDirectory = path.join(defaultProjectRoot, "docs");

// Stable capability checklists may stay Chinese-only without an English pair.
const chineseOnlyDocs = new Set(["features.zh-CN.md"]);

function parseFrontmatter(filePath, source, errors) {
  if (!source.startsWith("---")) {
    errors.push(`${filePath} must start with a YAML frontmatter block`);
    return {};
  }
  const end = source.indexOf("\n---", 3);
  if (end < 0) {
    errors.push(`${filePath} has an unterminated frontmatter block`);
    return {};
  }
  const block = source.slice(3, end);
  const frontmatter = {};
  for (const line of block.split(/\r\n|\n|\r/u)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/u);
    if (match) frontmatter[match[1]] = match[2].trim();
  }
  return frontmatter;
}

function collectHeadings(source) {
  const headings = [];
  for (const line of source.split(/\r\n|\n|\r/u)) {
    const match = line.match(/^(#{1,4}) (.+)$/u);
    if (match === null) continue;
    const level = match[1].length;
    const number = match[2].trim().match(/^(\d+(?:\.\d+)?)\s/u)?.[1] ?? null;
    headings.push({ level, number });
  }
  return headings;
}

function outlineSignature(headings) {
  return headings
    .filter(({ level }) => level <= 3)
    .map(({ level, number }) => (number === null ? `h${level}` : `n${number}`));
}

function validatePair(projectRoot, sourceName, translationName, errors) {
  const sourcePath = path.join(projectRoot, "docs", sourceName);
  const translationPath = path.join(projectRoot, "docs", translationName);
  if (!existsSync(sourcePath) || !existsSync(translationPath)) return;
  const source = readFileSync(sourcePath, "utf8").replace(/^\uFEFF/u, "");
  const translation = readFileSync(translationPath, "utf8").replace(/^\uFEFF/u, "");

  const sourceFrontmatter = parseFrontmatter(sourceName, source, errors);
  if (sourceFrontmatter.source_language !== "zh-CN") {
    errors.push(`docs/${sourceName} must declare source_language: zh-CN`);
  }
  if (sourceFrontmatter.translation_status !== "source") {
    errors.push(`docs/${sourceName} must declare translation_status: source`);
  }

  const translationFrontmatter = parseFrontmatter(translationName, translation, errors);
  if (translationFrontmatter.source_language !== "zh-CN") {
    errors.push(`docs/${translationName} must declare source_language: zh-CN`);
  }
  if (translationFrontmatter.translation_of !== sourceName) {
    errors.push(`docs/${translationName} must declare translation_of: ${sourceName}`);
  }
  if (
    translationFrontmatter.translation_status !== "synced" &&
    translationFrontmatter.translation_status !== "outdated"
  ) {
    errors.push(`docs/${translationName} must declare translation_status: synced or outdated`);
  }

  const sourceHeadings = collectHeadings(source);
  const translationHeadings = collectHeadings(translation);
  if (sourceHeadings.filter(({ level }) => level === 1).length !== 1) {
    errors.push(`docs/${sourceName} must contain exactly one H1 heading`);
  }
  if (translationHeadings.filter(({ level }) => level === 1).length !== 1) {
    errors.push(`docs/${translationName} must contain exactly one H1 heading`);
  }
  if (translationFrontmatter.translation_status !== "outdated") {
    const sourceOutline = outlineSignature(sourceHeadings);
    const translationOutline = outlineSignature(translationHeadings);
    if (JSON.stringify(sourceOutline) !== JSON.stringify(translationOutline)) {
      errors.push(
        `docs/${translationName} heading structure must match docs/${sourceName}: ` +
        `expected ${JSON.stringify(sourceOutline)} but found ${JSON.stringify(translationOutline)}`,
      );
    }
  }
}

export function checkDocsI18n(projectRoot = defaultProjectRoot) {
  const errors = [];
  const docsRoot = path.join(projectRoot, "docs");
  if (!existsSync(docsRoot)) return errors;
  const files = readdirSync(docsRoot)
    .filter((name) => name.endsWith(".md") && !name.endsWith(".d.md"))
    .sort();
  const sources = [];
  const translations = [];
  for (const name of files) {
    if (name.endsWith(".zh-CN.md")) sources.push(name);
    else if (name.endsWith(".en.md")) translations.push(name);
    else errors.push(`Unexpected stable document outside the zh-CN/en pair layout: ${name}`);
  }
  for (const name of translations) {
    if (!name.endsWith(".zh-CN.md")) {
      const sourceName = `${name.slice(0, -".en.md".length)}.zh-CN.md`;
      if (!sources.includes(sourceName)) {
        errors.push(`Missing paired source document: docs/${sourceName}`);
      }
    }
  }
  for (const sourceName of sources) {
    if (chineseOnlyDocs.has(sourceName)) continue;
    const translationName = `${sourceName.slice(0, -".zh-CN.md".length)}.en.md`;
    if (!translations.includes(translationName)) {
      errors.push(`Missing paired translation: docs/${translationName}`);
      continue;
    }
    validatePair(projectRoot, sourceName, translationName, errors);
  }
  for (const sourceName of sources) {
    if (!chineseOnlyDocs.has(sourceName)) continue;
    const translationName = `${sourceName.slice(0, -".zh-CN.md".length)}.en.md`;
    if (translations.includes(translationName)) {
      errors.push(
        `Chinese-only document docs/${sourceName} must not have an English pair`,
      );
    }
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const errors = checkDocsI18n();
  if (errors.length > 0) {
    console.error("Stable docs i18n contract failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  } else {
    console.log(
      `Stable docs i18n contract passed: ${readdirSync(docsDirectory).filter((name) => (
        name.endsWith(".zh-CN.md") || name.endsWith(".en.md")
      )).length} paired stable documents.`,
    );
  }
}
