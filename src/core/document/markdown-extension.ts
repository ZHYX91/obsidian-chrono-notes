/** The extension is case-insensitive; folders and the entire filename stem stay exact. */
export function findMarkdownExtensionVariant<T>(
  path: string,
  lookup: (candidate: string) => T | null | undefined,
): T | undefined {
  const exact = lookup(path);
  if (exact != null) return exact;
  if (!/\.md$/iu.test(path)) return undefined;
  const stem = path.slice(0, -3);
  for (const extension of [".md", ".MD", ".Md", ".mD"]) {
    const candidate = stem + extension;
    if (candidate === path) continue;
    const value = lookup(candidate);
    if (value != null) return value;
  }
  return undefined;
}
