import {
  resolvePropertyDatePattern,
  resolvePropertyTimePattern,
  type PropertyDateDisplayFormat,
  type PropertyTimeDisplayFormat,
} from "../../core/properties/property-date-display";

const PROPERTY_INPUT_SELECTOR = [
  '.metadata-properties input.metadata-input.mod-date[type="date"]',
  '.metadata-properties input.metadata-input.mod-datetime[type="datetime-local"]',
].join(", ");

const DISPLAY_INLINE_SIZE_PROPERTY =
  "--chrono-notes-property-date-display-inline-size";
const DISPLAY_INLINE_START_PROPERTY =
  "--chrono-notes-property-date-display-inline-start";
const DISPLAY_BLOCK_START_PROPERTY =
  "--chrono-notes-property-date-display-block-start";
const DISPLAY_BLOCK_SIZE_PROPERTY =
  "--chrono-notes-property-date-display-block-size";

const INPUT_PRESENTATION_PROPERTIES = Object.freeze([
  "direction",
  "font-family",
  "font-size",
  "font-style",
  "font-variant-numeric",
  "font-weight",
  "letter-spacing",
  "line-height",
]);

export interface PropertyDateDisplaySettings {
  readonly locale: string;
  readonly dateFormat: PropertyDateDisplayFormat;
  readonly timeFormat: PropertyTimeDisplayFormat;
  readonly dateCustomFormat: string;
  readonly timeCustomFormat: string;
}

export interface PropertyDateValueFormatter {
  formatMoment(value: string, pattern: string, locale: string): string | null;
  formatSystemDate(value: string): string | null;
  formatSystemTime(value: string, includeSeconds: boolean): string | null;
}

interface ManagedInput {
  readonly input: HTMLInputElement;
  readonly host: HTMLElement;
  readonly refresh: () => void;
  readonly syncLayoutObservation: () => void;
  readonly dispose: () => void;
}

interface ManagedDocument {
  readonly observer: MutationObserver | null;
  readonly inputs: Map<HTMLInputElement, ManagedInput>;
  observing: boolean;
}

export class ObsidianPropertiesDateDisplay {
  private readonly documents = new Map<Document, ManagedDocument>();

  constructor(
    private settings: PropertyDateDisplaySettings,
    private readonly formatter: PropertyDateValueFormatter,
  ) {}

  addDocument(document: Document): void {
    if (this.documents.has(document)) return;
    const inputs = new Map<HTMLInputElement, ManagedInput>();
    const MutationObserverConstructor = document.defaultView?.MutationObserver;
    const observer = MutationObserverConstructor === undefined
      ? null
      : new MutationObserverConstructor((records) => {
        if (this.shouldScanMutations(document, records)) this.scanDocument(document);
      });
    this.documents.set(document, { observer, inputs, observing: false });
    this.updateDocumentObservation(document);
    this.scanDocument(document);
  }

  removeDocument(document: Document): void {
    const managed = this.documents.get(document);
    if (managed === undefined) return;
    managed.observer?.disconnect();
    for (const input of managed.inputs.values()) this.unmanageInput(input);
    managed.inputs.clear();
    this.documents.delete(document);
  }

  setSettings(settings: PropertyDateDisplaySettings): void {
    this.settings = settings;
    this.refreshAll();
  }

  refreshAll(): void {
    for (const document of this.documents.keys()) {
      this.updateDocumentObservation(document);
      this.scanDocument(document);
      const managed = this.documents.get(document);
      if (managed === undefined) continue;
      for (const input of managed.inputs.values()) input.refresh();
    }
  }

  dispose(): void {
    for (const document of [...this.documents.keys()]) this.removeDocument(document);
  }

  private scanDocument(document: Document): void {
    const managed = this.documents.get(document);
    if (managed === undefined) return;
    for (const [input, item] of managed.inputs) {
      if (this.shouldRetainInput(document, input, item)) continue;
      this.unmanageInput(item);
      managed.inputs.delete(input);
    }
    if (!this.hasAnyCustomDisplay()) return;
    for (const element of document.querySelectorAll<HTMLInputElement>(PROPERTY_INPUT_SELECTOR)) {
      if (managed.inputs.has(element) || !this.shouldManageInput(element)) continue;
      managed.inputs.set(element, this.manageInput(element));
    }
    for (const item of managed.inputs.values()) item.syncLayoutObservation();
  }

  private updateDocumentObservation(document: Document): void {
    const managed = this.documents.get(document);
    if (managed === undefined || managed.observer === null) return;
    const shouldObserve = this.hasAnyCustomDisplay();
    if (shouldObserve === managed.observing) return;
    managed.observer.disconnect();
    managed.observing = shouldObserve;
    if (!shouldObserve) return;
    managed.observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "type"],
      childList: true,
      subtree: true,
    });
  }

  private shouldScanMutations(
    document: Document,
    records: readonly MutationRecord[],
  ): boolean {
    const managed = this.documents.get(document);
    if (managed === undefined) return false;
    return records.some((record) => {
      const target = record.target;
      if (record.type === "childList") {
        if (target.nodeType !== 1) return true;
        const element = target as Element;
        return element.closest(".chrono-notes-property-date-display-value") === null;
      }
      if (target.nodeType !== 1) return false;
      const element = target as Element;
      if (element.tagName === "INPUT") {
        const input = element as HTMLInputElement;
        return managed.inputs.has(input) || input.closest(".metadata-properties") !== null;
      }
      if (element.matches(".metadata-properties")) return true;
      return [...managed.inputs.keys()].some((input) => element.contains(input));
    });
  }

  private shouldRetainInput(
    document: Document,
    input: HTMLInputElement,
    managed: ManagedInput,
  ): boolean {
    return input.isConnected &&
      input.ownerDocument === document &&
      input.parentElement === managed.host &&
      input.matches(PROPERTY_INPUT_SELECTOR) &&
      this.shouldManageInput(input);
  }

  private hasAnyCustomDisplay(): boolean {
    return resolvePropertyDatePattern(
      this.settings.dateFormat,
      this.settings.dateCustomFormat,
    ) !== null || resolvePropertyTimePattern(
      this.settings.timeFormat,
      this.settings.timeCustomFormat,
    ) !== null;
  }

  private shouldManageInput(input: HTMLInputElement): boolean {
    const datePattern = resolvePropertyDatePattern(
      this.settings.dateFormat,
      this.settings.dateCustomFormat,
    );
    if (input.type === "date") return datePattern !== null;
    if (input.type !== "datetime-local") return false;
    const timePattern = resolvePropertyTimePattern(
      this.settings.timeFormat,
      this.settings.timeCustomFormat,
    );
    return datePattern !== null || timePattern !== null;
  }

  private manageInput(input: HTMLInputElement): ManagedInput {
    const host = input.parentElement ?? input.ownerDocument.body;
    const view = input.ownerDocument.defaultView;
    const forcedColorsQuery = view?.matchMedia("(forced-colors: active)") ?? null;
    let overlay: HTMLSpanElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const observedLayoutElements = new Set<Element>();
    let refresh: () => void;

    const clearLayout = (): void => {
      host.style.removeProperty(DISPLAY_INLINE_SIZE_PROPERTY);
      host.style.removeProperty(DISPLAY_INLINE_START_PROPERTY);
      host.style.removeProperty(DISPLAY_BLOCK_START_PROPERTY);
      host.style.removeProperty(DISPLAY_BLOCK_SIZE_PROPERTY);
    };
    const clearPresentation = (): void => {
      host.classList.remove(
        "chrono-notes-property-date-display-host",
        "chrono-notes-property-date-display-active",
      );
      input.classList.remove("chrono-notes-property-date-native-input");
      clearLayout();
      resizeObserver?.disconnect();
      resizeObserver = null;
      observedLayoutElements.clear();
      overlay?.remove();
      overlay = null;
    };
    const showNativeEditor = (): void => {
      host.classList.remove("chrono-notes-property-date-display-active");
    };
    const syncLayoutTargets = (displayOverlay: HTMLSpanElement): void => {
      if (resizeObserver === null) return;
      const targets = new Set<Element>([host, input]);
      for (const child of host.children) {
        if (child !== displayOverlay) targets.add(child);
      }
      for (const element of observedLayoutElements) {
        if (targets.has(element)) continue;
        resizeObserver.unobserve(element);
        observedLayoutElements.delete(element);
      }
      for (const element of targets) {
        if (observedLayoutElements.has(element)) continue;
        resizeObserver.observe(element);
        observedLayoutElements.add(element);
      }
    };
    const ensureOverlay = (): HTMLSpanElement => {
      if (overlay !== null) return overlay;
      overlay = host.createSpan({
        cls: "chrono-notes-property-date-display-value",
      });
      overlay.setAttribute("aria-hidden", "true");
      const ResizeObserverConstructor = view?.ResizeObserver;
      resizeObserver = ResizeObserverConstructor === undefined
        ? null
        : new ResizeObserverConstructor(() => refresh());
      syncLayoutTargets(overlay);
      return overlay;
    };
    refresh = (): void => {
      if (forcedColorsQuery?.matches === true) {
        clearPresentation();
        return;
      }
      if (input.ownerDocument.activeElement === input) {
        showNativeEditor();
        return;
      }
      const formatted = this.formatInput(input);
      if (formatted === null || formatted.length === 0) {
        clearPresentation();
        return;
      }
      const displayOverlay = ensureOverlay();
      syncLayoutTargets(displayOverlay);
      host.classList.remove(
        "chrono-notes-property-date-display-host",
        "chrono-notes-property-date-display-active",
      );
      input.classList.remove("chrono-notes-property-date-native-input");
      clearLayout();
      displayOverlay.removeAttribute("style");
      displayOverlay.textContent = formatted;
      copyInputPresentation(input, displayOverlay);
      input.classList.add("chrono-notes-property-date-native-input");
      host.classList.add(
        "chrono-notes-property-date-display-host",
        "chrono-notes-property-date-display-active",
      );
      applyDisplayLayout(input, host, displayOverlay);
    };
    const dispose = (): void => {
      forcedColorsQuery?.removeEventListener("change", refresh);
      input.removeEventListener("focus", showNativeEditor);
      input.removeEventListener("blur", refresh);
      input.removeEventListener("input", refresh);
      input.removeEventListener("change", refresh);
      clearPresentation();
    };
    const syncLayoutObservation = (): void => {
      if (overlay !== null) syncLayoutTargets(overlay);
    };

    input.addEventListener("focus", showNativeEditor);
    input.addEventListener("blur", refresh);
    input.addEventListener("input", refresh);
    input.addEventListener("change", refresh);
    forcedColorsQuery?.addEventListener("change", refresh);
    refresh();
    return { input, host, refresh, syncLayoutObservation, dispose };
  }

  private unmanageInput(managed: ManagedInput): void {
    managed.dispose();
  }

  private formatInput(input: HTMLInputElement): string | null {
    const value = input.value;
    if (value.length === 0) return null;
    const datePattern = resolvePropertyDatePattern(
      this.settings.dateFormat,
      this.settings.dateCustomFormat,
    );
    if (input.type === "date") {
      if (datePattern === null) return null;
      return this.formatter.formatMoment(value, datePattern, this.settings.locale);
    }

    const timePattern = resolvePropertyTimePattern(
      this.settings.timeFormat,
      this.settings.timeCustomFormat,
    );
    if (datePattern === null && timePattern === null) return null;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value)) {
      return null;
    }
    const date = datePattern === null
      ? this.formatter.formatSystemDate(value)
      : this.formatter.formatMoment(value, datePattern, this.settings.locale);
    const time = timePattern === null
      ? this.formatter.formatSystemTime(value, /T\d{2}:\d{2}:\d{2}/.test(value))
      : this.formatter.formatMoment(value, timePattern, this.settings.locale);
    return date === null || time === null ? null : `${date} ${time}`;
  }

}

function copyInputPresentation(
  input: HTMLInputElement,
  overlay: HTMLSpanElement,
): void {
  const view = input.ownerDocument.defaultView;
  if (view === null) return;
  const style = view.getComputedStyle(input);
  for (const property of INPUT_PRESENTATION_PROPERTIES) {
    const value = style.getPropertyValue(property);
    if (value.length > 0) overlay.style.setProperty(property, value);
  }
  for (const side of ["inline-start", "inline-end", "block-start", "block-end"]) {
    const inset = parseCssPixels(style.getPropertyValue(`padding-${side}`)) +
      parseCssPixels(style.getPropertyValue(`border-${side}-width`));
    overlay.style.setProperty(`padding-${side}`, `${inset}px`);
  }
}

function applyDisplayLayout(
  input: HTMLInputElement,
  host: HTMLElement,
  overlay: HTMLSpanElement,
): void {
  const nativeInlineSize = input.getBoundingClientRect().width;
  const displayInlineSize = overlay.scrollWidth;
  const availableInlineSize = getAvailableInputInlineSize(input, host, overlay);
  const desiredInlineSize = Math.max(nativeInlineSize, displayInlineSize);
  const targetInlineSize = availableInlineSize === null
    ? desiredInlineSize
    : Math.min(desiredInlineSize, availableInlineSize);
  if (targetInlineSize > 0) {
    host.style.setProperty(
      DISPLAY_INLINE_SIZE_PROPERTY,
      `${Math.ceil(targetInlineSize)}px`,
    );
  }

  const hostRect = host.getBoundingClientRect();
  const inputRect = input.getBoundingClientRect();
  if (hostRect.width <= 0 || inputRect.width <= 0) return;
  const direction = input.ownerDocument.defaultView?.getComputedStyle(input).direction;
  const inlineStart = direction === "rtl"
    ? hostRect.right - inputRect.right
    : inputRect.left - hostRect.left;
  host.style.setProperty(
    DISPLAY_INLINE_START_PROPERTY,
    `${Math.max(0, Math.round(inlineStart))}px`,
  );
  host.style.setProperty(
    DISPLAY_BLOCK_START_PROPERTY,
    `${Math.max(0, Math.round(inputRect.top - hostRect.top))}px`,
  );
  if (inputRect.height > 0) {
    host.style.setProperty(
      DISPLAY_BLOCK_SIZE_PROPERTY,
      `${Math.ceil(inputRect.height)}px`,
    );
  }
}

function getAvailableInputInlineSize(
  input: HTMLInputElement,
  host: HTMLElement,
  overlay: HTMLSpanElement,
): number | null {
  const view = input.ownerDocument.defaultView;
  if (view === null) return null;
  const hostStyle = view.getComputedStyle(host);
  const hostInlineSize = host.clientWidth || host.getBoundingClientRect().width;
  if (hostInlineSize <= 0) return null;
  const innerInlineSize = hostInlineSize -
    parseCssPixels(hostStyle.paddingInlineStart) -
    parseCssPixels(hostStyle.paddingInlineEnd);
  const siblings = [...host.children].filter((element) => {
    if (element === input || element === overlay) return false;
    const style = view.getComputedStyle(element);
    return style.display !== "none" && style.position !== "absolute";
  });
  const occupiedInlineSize = siblings.reduce((total, element) => {
    const style = view.getComputedStyle(element);
    return total + element.getBoundingClientRect().width +
      parseCssPixels(style.marginInlineStart) +
      parseCssPixels(style.marginInlineEnd);
  }, 0);
  const gap = parseCssPixels(hostStyle.columnGap || hostStyle.gap);
  return Math.max(0, innerInlineSize - occupiedInlineSize - gap * siblings.length);
}

function parseCssPixels(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
