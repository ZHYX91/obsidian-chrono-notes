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
    button.disabled = true;
    button.className = "chrono-notes-settings-tab-scroll";
    button.dataset.side = side;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-controls", list.id);
    return button;
  }

  function distanceToEdge(tab: HTMLButtonElement, viewport: DOMRect, right: boolean): number {
    const rect = tab.getBoundingClientRect();
    return right ? rect.right - viewport.right : viewport.left - rect.left;
  }

  function firstClippedTab(right: boolean): HTMLButtonElement | undefined {
    const viewport = list.getBoundingClientRect();
    if (viewport.width <= 0) return;
    let nearest = Infinity;
    let target: HTMLButtonElement | undefined;
    for (const tab of tabs) {
      const distance = distanceToEdge(tab, viewport, right);
      if (distance <= 0.5 || distance >= nearest) continue;
      nearest = distance;
      target = tab;
    }
    return target;
  }

  function updateButtons(): void {
    const focused = row.ownerDocument.activeElement;
    const rtl = ownerWindow?.getComputedStyle(list).direction === "rtl";
    const viewport = list.getBoundingClientRect();
    const canScrollEarlier = firstClippedTab(rtl) !== undefined;
    const canScrollLater = firstClippedTab(!rtl) !== undefined;
    const revealEarlier = canScrollEarlier && earlier.disabled;
    earlier.disabled = !canScrollEarlier;
    later.disabled = !canScrollLater;
    if (revealEarlier) {
      const resized = list.getBoundingClientRect();
      list.scrollLeft += rtl ? resized.right - viewport.right : resized.left - viewport.left;
    }
    if ((focused === earlier && earlier.disabled) || (focused === later && later.disabled)) {
      const other = focused === earlier ? later : earlier;
      (other.disabled ? activeTab : other).focus({ preventScroll: true });
    }
  }

  function scroll(toEnd: boolean): void {
    const right = toEnd !== (ownerWindow?.getComputedStyle(list).direction === "rtl");
    const target = firstClippedTab(right);
    if (target === undefined) return;
    // Reveal the same tab after reserving space for the reverse control.
    const other = toEnd ? earlier : later;
    other.disabled = false;
    const viewport = list.getBoundingClientRect();
    const distance = Math.max(0, Math.min(distanceToEdge(target, viewport, right), viewport.width));
    list.scrollLeft += right ? distance : -distance;
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
    updateButtons();
    if (width > 0 && needsInitialReveal) {
      const bounds = list.getBoundingClientRect();
      const active = activeTab.getBoundingClientRect();
      if (active.left < bounds.left) list.scrollLeft += active.left - bounds.left;
      else if (active.right > bounds.right) list.scrollLeft += active.right - bounds.right;
      needsInitialReveal = false;
      updateButtons();
    }
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
