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
  let followSelectedTab = true;
  let automaticScrollPosition: number | null = null;

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
      // Scroll extents are rounded to CSS pixels; label bounds can be fractional.
      if (distance <= 1 || distance >= nearest) continue;
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

  function onScroll(): void {
    const automatic = automaticScrollPosition !== null && Math.abs(list.scrollLeft - automaticScrollPosition) <= 1;
    automaticScrollPosition = null;
    updateButtons();
    // Panel content can narrow the strip before the earlier reveal event arrives.
    if (automatic) return;
    const viewport = list.getBoundingClientRect();
    const selected = activeTab.getBoundingClientRect();
    if (!viewport.width) return;
    // Keep following a visible selection on resize. Preserve a different page
    // when the user has scrolled the selection out of view.
    const visible = Math.min(selected.right, viewport.right) - Math.max(selected.left, viewport.left);
    followSelectedTab = visible >= Math.min(selected.width, viewport.width) - 1;
  }

  function onResize(): void {
    const positionBeforeMeasure = list.scrollLeft;
    // Compare the natural span with the FULL row. Measuring the narrowed
    // scrollport here would keep the controls visible after a window resize.
    const first = tabs[0]!.getBoundingClientRect();
    const last = tabs[tabs.length - 1]!.getBoundingClientRect();
    const span = Math.max(first.right, last.right) - Math.min(first.left, last.left);
    const width = row.getBoundingClientRect().width;
    row.classList.toggle("has-overflow", width > 0 && span - width > 1);
    updateButtons();
    if (width <= 0) return;
    if (!row.classList.contains("has-overflow")) {
      followSelectedTab = true;
    } else if (followSelectedTab) {
      const bounds = list.getBoundingClientRect();
      const active = activeTab.getBoundingClientRect();
      if (active.left < bounds.left && active.right < bounds.right) list.scrollLeft += active.left - bounds.left;
      else if (active.right > bounds.right && active.left > bounds.left) list.scrollLeft += active.right - bounds.right;
      updateButtons();
    }
    if (list.scrollLeft !== positionBeforeMeasure) automaticScrollPosition = list.scrollLeft;
  }

  earlier.addEventListener("click", () => scroll(false));
  later.addEventListener("click", () => scroll(true));
  list.addEventListener("scroll", onScroll, { passive: true });
  const observer = ownerWindow?.ResizeObserver ? new ownerWindow.ResizeObserver(onResize) : null;
  observer?.observe(row);
  for (const tab of tabs) observer?.observe(tab);
  onResize();

  return () => {
    observer?.disconnect();
    list.removeEventListener("scroll", onScroll);
  };
}
