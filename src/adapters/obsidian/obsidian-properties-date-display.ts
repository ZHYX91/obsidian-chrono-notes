import {
  getPropertyDateFieldOrder,
  resolvePropertyDatePattern,
  resolvePropertyTimePattern,
  type PropertyDateFieldOrder,
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

const ROOT_CLASS_BY_ORDER: Readonly<Record<PropertyDateFieldOrder, string>> = Object.freeze({
  ymd: "chrono-notes-property-date-format-ymd",
  dmy: "chrono-notes-property-date-format-dmy",
  mdy: "chrono-notes-property-date-format-mdy",
});

export const PROPERTY_DATE_FORMAT_ROOT_CLASSES = Object.freeze(
  Object.values(ROOT_CLASS_BY_ORDER),
);

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
  readonly overlay: HTMLSpanElement;
  readonly resizeObserver: ResizeObserver | null;
  readonly refresh: () => void;
  readonly showNative: () => void;
}

interface ManagedDocument {
  readonly observer: MutationObserver | null;
  readonly inputs: Map<HTMLInputElement, ManagedInput>;
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
      : new MutationObserverConstructor(() => this.scanDocument(document));
    this.documents.set(document, { observer, inputs });
    observer?.observe(document.documentElement, { childList: true, subtree: true });
    this.applyRootClass(document);
    this.scanDocument(document);
  }

  removeDocument(document: Document): void {
    const managed = this.documents.get(document);
    if (managed === undefined) return;
    managed.observer?.disconnect();
    for (const input of managed.inputs.values()) this.unmanageInput(input);
    managed.inputs.clear();
    this.removeFormatClasses(document);
    this.documents.delete(document);
  }

  setSettings(settings: PropertyDateDisplaySettings): void {
    this.settings = settings;
    for (const document of this.documents.keys()) {
      this.applyRootClass(document);
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
      if (input.isConnected) continue;
      this.unmanageInput(item);
      managed.inputs.delete(input);
    }
    for (const element of document.querySelectorAll<HTMLInputElement>(PROPERTY_INPUT_SELECTOR)) {
      if (managed.inputs.has(element)) continue;
      managed.inputs.set(element, this.manageInput(element));
    }
  }

  private manageInput(input: HTMLInputElement): ManagedInput {
    const host = input.parentElement ?? input.ownerDocument.body;
    const overlay = host.createSpan({
      cls: "chrono-notes-property-date-display-value",
    });
    overlay.setAttribute("aria-hidden", "true");
    input.classList.add("chrono-notes-property-date-native-input");
    host.classList.add("chrono-notes-property-date-display-host");

    const showNative = (): void => {
      host.classList.remove("chrono-notes-property-date-display-active");
      overlay.textContent = "";
    };
    const clearLayout = (): void => {
      host.style.removeProperty(DISPLAY_INLINE_SIZE_PROPERTY);
      host.style.removeProperty(DISPLAY_INLINE_START_PROPERTY);
    };
    const refresh = (): void => {
      if (input.ownerDocument.activeElement === input) {
        showNative();
        return;
      }
      host.classList.remove("chrono-notes-property-date-display-active");
      clearLayout();
      const formatted = this.formatInput(input);
      if (formatted === null || formatted.length === 0) {
        showNative();
        return;
      }
      overlay.textContent = formatted;
      host.classList.add("chrono-notes-property-date-display-active");
      applyDisplayLayout(input, host, overlay);
    };
    input.addEventListener("focus", showNative);
    input.addEventListener("blur", refresh);
    input.addEventListener("input", refresh);
    input.addEventListener("change", refresh);
    const ResizeObserverConstructor = input.ownerDocument.defaultView?.ResizeObserver;
    const resizeObserver = ResizeObserverConstructor === undefined
      ? null
      : new ResizeObserverConstructor(refresh);
    resizeObserver?.observe(host);
    refresh();
    return { input, host, overlay, resizeObserver, refresh, showNative };
  }

  private unmanageInput(managed: ManagedInput): void {
    const { input, host, overlay, resizeObserver, refresh, showNative } = managed;
    resizeObserver?.disconnect();
    input.removeEventListener("focus", showNative);
    input.removeEventListener("blur", refresh);
    input.removeEventListener("input", refresh);
    input.removeEventListener("change", refresh);
    input.classList.remove("chrono-notes-property-date-native-input");
    overlay.remove();
    if (!host.querySelector(".chrono-notes-property-date-display-value")) {
      host.classList.remove(
        "chrono-notes-property-date-display-host",
        "chrono-notes-property-date-display-active",
      );
      host.style.removeProperty(DISPLAY_INLINE_SIZE_PROPERTY);
      host.style.removeProperty(DISPLAY_INLINE_START_PROPERTY);
    }
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

  private applyRootClass(document: Document): void {
    this.removeFormatClasses(document);
    const pattern = resolvePropertyDatePattern(
      this.settings.dateFormat,
      this.settings.dateCustomFormat,
    );
    if (pattern === null) return;
    const order = getPropertyDateFieldOrder(pattern);
    if (order !== null) document.documentElement.classList.add(ROOT_CLASS_BY_ORDER[order]);
  }

  private removeFormatClasses(document: Document): void {
    document.documentElement.classList.remove(...PROPERTY_DATE_FORMAT_ROOT_CLASSES);
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
  const direction = input.ownerDocument.defaultView?.getComputedStyle(host).direction;
  const inlineStart = direction === "rtl"
    ? hostRect.right - inputRect.right
    : inputRect.left - hostRect.left;
  host.style.setProperty(
    DISPLAY_INLINE_START_PROPERTY,
    `${Math.max(0, Math.round(inlineStart))}px`,
  );
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
