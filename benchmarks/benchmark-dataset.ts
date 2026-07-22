export interface BenchmarkDataset {
  readonly contents: ReadonlyMap<string, string | Error>;
  readonly contentBytes: number;
  readonly errorCount: number;
}

export function createBenchmarkDataset(noteCount: number): BenchmarkDataset {
  const contents = new Map<string, string | Error>();
  let contentBytes = 0;
  let errorCount = 0;

  for (let index = 0; index < noteCount; index += 1) {
    const id = index.toString().padStart(5, "0");
    const day = (index % 28) + 1;
    const dateKey = `2026-07-${day.toString().padStart(2, "0")}`;
    const path = createBenchmarkPath(index, id);

    if (index % 211 === 0) {
      contents.set(path, new Error(`Synthetic read failure ${id}`));
      errorCount += 1;
      continue;
    }

    const content = createBenchmarkContent(index, id, dateKey);
    contents.set(path, content);
    contentBytes += Buffer.byteLength(content, "utf8");
  }

  return Object.freeze({ contents, contentBytes, errorCount });
}

function createBenchmarkContent(index: number, id: string, dateKey: string): string {
  if (index > 10 && index % 131 === 0) return "";

  if (index > 10 && index % 137 === 0) {
    return ["---", `kind: yaml-only-${id}`, "---"].join("\n");
  }

  if (index > 10 && index % 139 === 0) {
    return `\uFEFF---\r\nkind: bom-${id}\r\n---\r\nBOM benchmark ${id}`;
  }

  if (index % 40 === 0) {
    const endKey = index % 400 === 0
      ? "2027-07-20"
      : `2026-07-${Math.min(28, (index % 28) + 4).toString().padStart(2, "0")}`;
    return [
      "---",
      `start: ${dateKey}`,
      `end: ${endKey}`,
      `category: benchmark-${index % 8}`,
      "---",
      `Range benchmark ${id}`,
      `- [ ] Follow up 📅 ${dateKey}`,
    ].join(index % 3 === 0 ? "\r\n" : "\n");
  }

  if (index % 97 === 0) {
    return `---\nlabels: [unterminated\n---\nInvalid YAML benchmark ${id}`;
  }

  const taskCount = index % 41 === 0 ? 12 : index % 5 === 0 ? 1 : 0;
  const tasks = Array.from({ length: taskCount }, (_, taskIndex) => {
    const taskDate = index % 53 === 0 && taskIndex === 0 ? "2026-02-30" : dateKey;
    return `- [${(index + taskIndex) % 10 === 0 ? "x" : " "}] Task ${id}-${taskIndex} 📅 ${taskDate} ⏳ ${taskDate}`;
  });
  const links = index % 7 === 0 ? " [[Target]] #benchmark" : "";
  const paragraphs = Array.from(
    { length: index % 83 === 0 ? 30 : index % 19 === 0 ? 5 : 1 },
    (_, paragraphIndex) => `Synthetic paragraph ${paragraphIndex} for ${id}.${links}`,
  );
  const lines = [
    "---",
    `kind: benchmark-${index % 12}`,
    `sequence: ${index}`,
    "---",
    ...paragraphs,
    ...tasks,
  ];
  if (index > 10 && index % 149 === 0) {
    return lines.map((line, lineIndex) =>
      `${line}${lineIndex % 3 === 0 ? "\r\n" : lineIndex % 3 === 1 ? "\n" : "\r"}`)
      .join("");
  }
  return lines.join(index % 11 === 0 ? "\r" : index % 3 === 0 ? "\r\n" : "\n");
}

function createBenchmarkPath(index: number, id: string): string {
  switch (index) {
    case 1:
      return "Daily/2026-07-20.md";
    case 2:
      return "Weekly/2026-30.md";
    case 3:
      return "Monthly/2026-07.md";
    case 4:
      return "Quarterly/2026-Q3.md";
    case 5:
      return "Yearly/2026.md";
    case 6:
      return "Daily/2025-12-31.md";
    case 7:
      return "Weekly/2026-01.md";
    default:
      return index % 40 === 0
        ? `Ranges/range-${id}.md`
        : `Notes/note-${id}.md`;
  }
}
