import {
  parseNoteDocument,
  type NoteContentState,
  type ParsedNoteDocument,
} from "../document/parse-note-document";
import {
  parseFrontmatter,
  type FrontmatterParseFailure,
} from "../document/parse-frontmatter";
import { summarizeNotePreview } from "./note-preview";
import { calculateNoteStatistics, type NoteStatistics } from "./note-statistics";
import {
  parseNoteInterval,
  type NoteInterval,
  type NoteIntervalParseFailure,
} from "./note-interval";
import { parseNoteTasks, type NoteTask } from "./note-tasks";

export interface ParsedNote {
  readonly path: string;
  readonly state: NoteContentState;
  readonly document: ParsedNoteDocument;
  readonly frontmatter: Readonly<Record<string, unknown>> | null;
  readonly frontmatterError: FrontmatterParseFailure | null;
  readonly interval: NoteInterval | null;
  readonly intervalError: NoteIntervalParseFailure | null;
  readonly preview: string | null;
  readonly tasks: readonly NoteTask[];
  readonly statistics: NoteStatistics;
}

/** Parse all document-derived note state exactly once for the index. */
export function parseNote(path: string, content: string): ParsedNote {
  const document = parseNoteDocument(content);
  return parseNoteFromDocument(path, document);
}

/** Derive indexed note state from an already-normalized document boundary. */
export function parseNoteFromDocument(
  path: string,
  document: ParsedNoteDocument,
): ParsedNote {
  const parsedFrontmatter = parseParsedFrontmatter(document);
  const parsedInterval = parseNoteInterval(parsedFrontmatter.value);
  const tasks = parseNoteTasks(document.body, path, document.bodyStartLine);
  return Object.freeze({
    path,
    state: document.state,
    document,
    frontmatter: parsedFrontmatter.value,
    frontmatterError: parsedFrontmatter.error,
    interval: parsedInterval.value,
    intervalError: parsedInterval.error,
    preview: summarizeNotePreview(document.body),
    tasks,
    statistics: calculateNoteStatistics(document.body, tasks),
  });
}

function parseParsedFrontmatter(document: ParsedNoteDocument): Readonly<{
  value: Readonly<Record<string, unknown>> | null;
  error: FrontmatterParseFailure | null;
}> {
  if (document.frontmatterStatus === "valid") {
    return parseFrontmatter(document.frontmatterText ?? "");
  }
  if (document.frontmatterStatus === "unterminated") {
    return Object.freeze({
      value: null,
      error: Object.freeze({
        name: "FrontmatterSyntaxError",
        message: "Frontmatter is missing a closing delimiter",
      }),
    });
  }
  return Object.freeze({ value: null, error: null });
}
