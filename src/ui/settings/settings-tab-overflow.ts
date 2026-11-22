/** Keep every measurement in physical coordinates, including negative scrollLeft in RTL. */
export function attachSettingsTabOverflow(
  row: HTMLElement,
  list: HTMLElement,
  tabs: readonly HTMLButtonElement[],
  activeTab: HTMLButtonElement,
  labels: { earlier: string; later: string },
): () => void {
  const ownerWindow = row.ownerDocument.defaultView;
  const earlier = makeButton(labels.earlier, "earlier");
  const later = makeButton(labels.later, "later");
  row.prepend(earlier);
  let needsInitialReveal = true;

  function makeButton(label: string, side: string): HTMLButtonElement {
    const button = row.createEl("button");
    button.type = "button";
    button.className = "chrono-notes-settings-tab-scroll";
    button.dataset.side = side;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-controls", list.id);
    return button;
  }

  function clippedDelta(toEnd: boolean): number {
    const rtl = ownerWindow?.getComputedStyle(list).direction === "rtl";
    const right = toEnd !== rtl;
    const bounds = list.getBoundingClientRect();
    if (bounds.width <= 0) return 0;
    // Search from the visible region outwards. A label wider than the strip
    // can be read a viewport at a time before moving on to the next one.
    let nearest = Infinity;
    for (const tab of tabs) {
      const rect = tab.getBoundingClientRect();
      const distance = right ? rect.right - bounds.right : bounds.left - rect.left;
      if (distance > 0.5) nearest = Math.min(nearest, distance);
    }
    if (!Number.isFinite(nearest)) return 0;
    return (right ? 1 : -1) * Math.min(nearest, bounds.width);
  }

  function updateButtons(): void {
    const focused = row.ownerDocument.activeElement;
    earlier.disabled = clippedDelta(false) === 0;
    later.disabled = clippedDelta(true) === 0;
    if ((focused === earlier && earlier.disabled) || (focused === later && later.disabled)) {
      const other = focused === earlier ? later : earlier;
      (other.disabled ? activeTab : other).focus({ preventScroll: true });
    }
  }

  function scroll(toEnd: boolean): void {
    list.scrollLeft += clippedDelta(toEnd);
    updateButtons();
  }

  function onResize(): void {
    // Compare the natural span with the FULL row. Measuring the narrowed
    // scrollport here would keep the controls visible after a window resize.
    const first = tabs[0]!.getBoundingClientRect();
    const last = tabs[tabs.length - 1]!.getBoundingClientRect();
    const span = Math.max(first.right, last.right) - Math.min(first.left, last.left);
    const width = row.getBoundingClientRect().width;
    row.classList.toggle("has-overflow", width > 0 && span - width > 0.5);
    if (width > 0 && needsInitialReveal) {
      const bounds = list.getBoundingClientRect();
      const active = activeTab.getBoundingClientRect();
      if (active.left < bounds.left) list.scrollLeft += active.left - bounds.left;
      else if (active.right > bounds.right) list.scrollLeft += active.right - bounds.right;
      needsInitialReveal = false;
    }
    updateButtons();
  }

  earlier.addEventListener("click", () => scroll(false));
  later.addEventListener("click", () => scroll(true));
  list.addEventListener("scroll", updateButtons, { passive: true });
  const observer = ownerWindow?.ResizeObserver ? new ownerWindow.ResizeObserver(onResize) : null;
  observer?.observe(row);
  for (const tab of tabs) observer?.observe(tab);
  onResize();

  return () => {
    observer?.disconnect();
    list.removeEventListener("scroll", updateButtons);
  };
}
