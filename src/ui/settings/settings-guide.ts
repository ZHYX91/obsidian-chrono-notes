/** Settings tutorial disclosures: UI state belongs to the open settings window, not data.json. */
const openedByRoot = new WeakMap<HTMLElement, Set<string>>();

function session(root: HTMLElement): Set<string> {
  let opened = openedByRoot.get(root);
  if (opened == null) {
    opened = new Set<string>();
    openedByRoot.set(root, opened);
  }
  return opened;
}

export function rememberSettingsGuides(root: HTMLElement): void {
  const expanded = session(root);
  for (const guide of Array.from(root.querySelectorAll<HTMLDetailsElement>("details[data-chrono-guide]"))) {
    const key = guide.dataset.chronoGuide;
    if (key === undefined) continue;
    if (guide.open) expanded.add(key);
    else expanded.delete(key);
  }
}

export function clearSettingsGuideState(root: HTMLElement): void {
  openedByRoot.delete(root);
}

/**
 * Renders one native disclosure per instructional topic. Callers still append
 * their explanatory content to the returned body; operational alerts must be
 * placed outside this disclosure.
 */
export function createSettingsGuide(containerEl: HTMLElement, title: string, key = title): HTMLDivElement {
  const root = containerEl.closest<HTMLElement>(".chrono-notes-settings") ?? containerEl;
  const expanded = session(root);
  const details = containerEl.createEl("details", { cls: "chrono-notes-settings-guide" });
  details.dataset.chronoGuide = key;
  details.open = expanded.has(key);
  details.createEl("summary", { cls: "chrono-notes-settings-guide-summary", text: title });
  return details.createDiv({ cls: "chrono-notes-settings-guide-body" });
}
