import { parseDocument } from "yaml";

export interface FrontmatterParseFailure {
  readonly name: string;
  readonly message: string;
}

export interface ParsedFrontmatter {
  readonly value: Readonly<Record<string, unknown>> | null;
  readonly error: FrontmatterParseFailure | null;
}

export function parseFrontmatter(text: string): ParsedFrontmatter {
  try {
    return parseFrontmatterDocument(text);
  } catch (error) {
    return Object.freeze({ value: null, error: toParseFailure(error) });
  }
}

function parseFrontmatterDocument(text: string): ParsedFrontmatter {
  const document = parseDocument(text);
  const error = document.errors[0];
  if (error !== undefined) {
    return Object.freeze({
      value: null,
      error: Object.freeze({ name: error.name, message: error.message }),
    });
  }

  const value: unknown = document.toJS({ mapAsMap: false, maxAliasCount: 100 });
  if (value === null) {
    return Object.freeze({ value: Object.freeze({}), error: null });
  }
  if (!isRecord(value)) {
    return Object.freeze({
      value: null,
      error: Object.freeze({
        name: "FrontmatterTypeError",
        message: "Frontmatter root must be a mapping",
      }),
    });
  }

  return Object.freeze({ value: freezeDeep(value), error: null });
}

function toParseFailure(error: unknown): FrontmatterParseFailure {
  if (error instanceof Error) {
    return Object.freeze({ name: error.name, message: error.message });
  }
  return Object.freeze({ name: "YAMLParseError", message: String(error) });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function freezeDeep<T>(value: T, visited = new WeakSet<object>()): T {
  if (typeof value !== "object" || value === null || visited.has(value)) return value;
  visited.add(value);
  for (const nested of Object.values(value)) freezeDeep(nested, visited);
  return Object.freeze(value);
}
