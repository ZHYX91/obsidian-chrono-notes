// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ObsidianPropertiesDateDisplay,
  type PropertyDateDisplaySettings,
  type PropertyDateValueFormatter,
} from "../../src/adapters/obsidian/obsidian-properties-date-display";

const DEFAULT_SETTINGS: PropertyDateDisplaySettings = Object.freeze({
  locale: "en",
  dateFormat: "ymd-dash",
  timeFormat: "24-hour-seconds",
  dateCustomFormat: "YYYY-MM-DD",
  timeCustomFormat: "HH:mm",
});

const formatter: PropertyDateValueFormatter = {
  formatMoment(value, pattern) {
    const date = value.slice(0, 10);
    const time = value.includes("T") ? value.slice(11, 19) : "";
    const [year, month, day] = date.split("-");
    const [hour, minute, second] = time.split(":");
    return pattern
      .replace("YYYY", year ?? "")
      .replace("MM", month ?? "")
      .replace("DD", day ?? "")
      .replace("M", String(Number(month)))
      .replace("D", String(Number(day)))
      .replace("HH", hour ?? "")
      .replace("mm", minute ?? "")
      .replace("ss", second ?? "");
  },
  formatSystemDate: () => "SYSTEM-DATE",
  formatSystemTime: (_value, includeSeconds) =>
    includeSeconds ? "SYSTEM-TIME-SECONDS" : "SYSTEM-TIME",
};

beforeEach(() => {
  Node.prototype.createSpan = function createSpan(
    options?: { cls?: string },
  ): HTMLSpanElement {
    const span = this.ownerDocument?.createElement("span") ?? document.createElement("span");
    if (options?.cls !== undefined) span.className = options.cls;
    this.appendChild(span);
    return span;
  };
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ObsidianPropertiesDateDisplay", () => {
  it("formats an unfocused date without changing its native value", () => {
    const input = appendInput("date", "mod-date", "2026-07-31");
    const display = new ObsidianPropertiesDateDisplay(DEFAULT_SETTINGS, formatter);

    display.addDocument(document);

    expect(input.value).toBe("2026-07-31");
    expect(getOverlay(input).textContent).toBe("2026-07-31");
    expect(getOverlay(input).getAttribute("aria-hidden")).toBe("true");
    expect(input.parentElement?.classList.contains(
      "chrono-notes-property-date-display-active",
    )).toBe(true);
    display.dispose();
  });

  it("does not emit edit events while refreshing presentation state", () => {
    const input = appendInput("date", "mod-date", "2026-07-31");
    const onInput = vi.fn();
    const onChange = vi.fn();
    input.addEventListener("input", onInput);
    input.addEventListener("change", onChange);
    const display = new ObsidianPropertiesDateDisplay(DEFAULT_SETTINGS, formatter);

    display.addDocument(document);
    display.setSettings({ ...DEFAULT_SETTINGS, dateFormat: "dmy-slash" });
    input.focus();
    input.blur();

    expect(input.value).toBe("2026-07-31");
    expect(onInput).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    display.dispose();
  });

  it("reveals the native editor without field rewriting and restores the overlay", () => {
    const input = appendInput("date", "mod-date", "2026-07-31");
    const display = new ObsidianPropertiesDateDisplay({
      ...DEFAULT_SETTINGS,
      dateFormat: "custom",
      dateCustomFormat: "YYYY年M月D日",
    }, formatter);
    display.addDocument(document);

    expect(getOverlay(input).textContent).toBe("2026年7月31日");
    input.focus();
    expect(input.parentElement?.classList.contains(
      "chrono-notes-property-date-display-active",
    )).toBe(false);
    expect(input.classList.contains("chrono-notes-property-date-native-input")).toBe(true);
    expect(getOverlay(input).textContent).toBe("2026年7月31日");
    expect(input.value).toBe("2026-07-31");

    input.blur();
    expect(getOverlay(input).textContent).toBe("2026年7月31日");
    expect(input.value).toBe("2026-07-31");
    display.dispose();
  });

  it("expands the date input to the rendered display width and leaves room for the link", () => {
    const input = appendInput("date", "mod-date", "2026-07-31");
    const host = input.parentElement;
    if (host === null) throw new Error("Expected input host.");
    host.className = "metadata-property-value";
    host.style.gap = "4px";
    const link = document.createElement("button");
    link.className = "clickable-icon";
    host.append(link);
    mockInlineGeometry(host, input, link, 300, 120, 28);
    const display = new ObsidianPropertiesDateDisplay({
      ...DEFAULT_SETTINGS,
      dateFormat: "custom",
      dateCustomFormat: "YYYY年MM月DD日",
    }, formatter);

    display.addDocument(document);
    const overlay = getOverlay(input);
    Object.defineProperty(overlay, "scrollWidth", { value: 220 });
    input.dispatchEvent(new Event("blur"));

    expect(host.style.getPropertyValue(
      "--chrono-notes-property-date-display-inline-size",
    )).toBe("220px");
    expect(host.style.getPropertyValue(
      "--chrono-notes-property-date-display-inline-start",
    )).toBe("0px");
    expect(host.style.getPropertyValue(
      "--chrono-notes-property-date-display-block-start",
    )).toBe("0px");
    expect(host.style.getPropertyValue(
      "--chrono-notes-property-date-display-block-size",
    )).toBe("30px");
    expect(input.value).toBe("2026-07-31");

    input.focus();
    expect(host.classList.contains("chrono-notes-property-date-display-active")).toBe(false);
    expect(host.style.getPropertyValue(
      "--chrono-notes-property-date-display-inline-size",
    )).toBe("220px");
    input.blur();
    expect(host.classList.contains("chrono-notes-property-date-display-active")).toBe(true);
    display.dispose();
  });

  it("clamps an overlong custom display before the daily-note link", () => {
    const input = appendInput("date", "mod-date", "2026-07-31");
    const host = input.parentElement;
    if (host === null) throw new Error("Expected input host.");
    host.className = "metadata-property-value";
    host.style.gap = "4px";
    const link = document.createElement("button");
    host.append(link);
    mockInlineGeometry(host, input, link, 260, 120, 28);
    const display = new ObsidianPropertiesDateDisplay(DEFAULT_SETTINGS, formatter);

    display.addDocument(document);
    const overlay = getOverlay(input);
    Object.defineProperty(overlay, "scrollWidth", { value: 400 });
    input.dispatchEvent(new Event("blur"));

    expect(host.style.getPropertyValue(
      "--chrono-notes-property-date-display-inline-size",
    )).toBe("228px");
    expect(228 + 28 + 4).toBeLessThanOrEqual(260);
    display.dispose();
    expect(host.style.getPropertyValue(
      "--chrono-notes-property-date-display-inline-size",
    )).toBe("");
  });

  it("recalculates the available width when the Properties row resizes", () => {
    const resizeCallbacks: Array<() => void> = [];
    const disconnect = vi.fn();
    const observe = vi.fn();
    const unobserve = vi.fn();
    const originalResizeObserver = window.ResizeObserver;
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: class {
        constructor(callback: () => void) {
          resizeCallbacks.push(callback);
        }

        disconnect = disconnect;
        observe = observe;
        unobserve = unobserve;
      },
    });
    const input = appendInput("date", "mod-date", "2026-07-31");
    const host = input.parentElement;
    if (host === null) throw new Error("Expected input host.");
    host.className = "metadata-property-value";
    host.style.gap = "4px";
    const link = document.createElement("button");
    host.append(link);
    mockInlineGeometry(host, input, link, 300, 120, 28);
    const display = new ObsidianPropertiesDateDisplay(DEFAULT_SETTINGS, formatter);

    display.addDocument(document);
    const overlay = getOverlay(input);
    Object.defineProperty(overlay, "scrollWidth", { value: 220 });
    expect(resizeCallbacks).toHaveLength(1);
    expect(observe).toHaveBeenCalledWith(host);
    expect(observe).toHaveBeenCalledWith(input);
    expect(observe).toHaveBeenCalledWith(link);
    resizeCallbacks[0]?.();

    expect(host.style.getPropertyValue(
      "--chrono-notes-property-date-display-inline-size",
    )).toBe("220px");
    display.dispose();
    expect(disconnect).toHaveBeenCalledOnce();
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: originalResizeObserver,
    });
  });

  it("measures inline start from the right edge in RTL Properties rows", () => {
    const input = appendInput("date", "mod-date", "2026-07-31");
    const host = input.parentElement;
    if (host === null) throw new Error("Expected input host.");
    host.className = "metadata-property-value";
    host.style.direction = "rtl";
    host.style.gap = "4px";
    const link = document.createElement("button");
    host.append(link);
    Object.defineProperty(host, "clientWidth", { value: 300 });
    host.getBoundingClientRect = () => rect(0, 300);
    input.getBoundingClientRect = () => {
      const configured = Number.parseFloat(host.style.getPropertyValue(
        "--chrono-notes-property-date-display-inline-size",
      ));
      const width = Number.isFinite(configured) ? configured : 120;
      return rect(300 - width, width);
    };
    link.getBoundingClientRect = () => rect(0, 28);
    const display = new ObsidianPropertiesDateDisplay(DEFAULT_SETTINGS, formatter);

    display.addDocument(document);
    const overlay = getOverlay(input);
    Object.defineProperty(overlay, "scrollWidth", { value: 220 });
    input.dispatchEvent(new Event("blur"));

    expect(host.style.getPropertyValue(
      "--chrono-notes-property-date-display-inline-size",
    )).toBe("220px");
    expect(host.style.getPropertyValue(
      "--chrono-notes-property-date-display-inline-start",
    )).toBe("0px");
    display.dispose();
  });

  it("positions from the input direction when an RTL row keeps the editor LTR", () => {
    const input = appendInput("date", "mod-date", "2026-07-31");
    const host = input.parentElement;
    if (host === null) throw new Error("Expected input host.");
    host.className = "metadata-property-value";
    host.style.direction = "rtl";
    input.style.direction = "ltr";
    host.style.gap = "4px";
    const link = document.createElement("button");
    host.append(link);
    Object.defineProperty(host, "clientWidth", { value: 300 });
    host.getBoundingClientRect = () => rect(0, 300);
    input.getBoundingClientRect = () => {
      const configured = Number.parseFloat(host.style.getPropertyValue(
        "--chrono-notes-property-date-display-inline-size",
      ));
      const width = Number.isFinite(configured) ? configured : 120;
      return rect(300 - width, width);
    };
    link.getBoundingClientRect = () => rect(0, 28);
    const display = new ObsidianPropertiesDateDisplay(DEFAULT_SETTINGS, formatter);

    display.addDocument(document);
    const overlay = getOverlay(input);
    Object.defineProperty(overlay, "scrollWidth", { value: 220 });
    input.dispatchEvent(new Event("blur"));

    expect(host.style.getPropertyValue(
      "--chrono-notes-property-date-display-inline-start",
    )).toBe("80px");
    expect(overlay.style.direction).toBe("ltr");
    display.dispose();
  });

  it("combines independently selected date and time formats", () => {
    const input = appendInput(
      "datetime-local",
      "mod-datetime",
      "2026-07-31T14:05:06",
    );
    const display = new ObsidianPropertiesDateDisplay({
      ...DEFAULT_SETTINGS,
      dateFormat: "ymd-slash-padded",
      timeFormat: "system",
    }, formatter);
    display.addDocument(document);

    expect(getOverlay(input).textContent).toBe("2026/07/31 SYSTEM-TIME-SECONDS");
    expect(input.value).toBe("2026-07-31T14:05:06");
    display.dispose();
  });

  it("copies native text metrics and picker-reserved logical insets", () => {
    const input = appendInput("date", "mod-date", "2026-07-31");
    input.style.fontFamily = "Test Native Font";
    input.style.fontSize = "17px";
    input.style.paddingInlineStart = "24px";
    input.style.paddingInlineEnd = "8px";
    const display = new ObsidianPropertiesDateDisplay(DEFAULT_SETTINGS, formatter);

    display.addDocument(document);

    const overlay = getOverlay(input);
    expect(overlay.style.fontFamily).toContain("Test Native Font");
    expect(overlay.style.fontSize).toBe("17px");
    expect(overlay.style.color).toBe("");
    expect(overlay.style.paddingInlineStart).toBe("24px");
    expect(overlay.style.paddingInlineEnd).toBe("8px");

    input.style.fontSize = "19px";
    input.style.paddingInlineStart = "26px";
    display.refreshAll();
    expect(getOverlay(input).style.fontSize).toBe("19px");
    expect(getOverlay(input).style.paddingInlineStart).toBe("26px");
    display.dispose();
  });

  it("falls back to native while forced colors are active and refreshes afterward", () => {
    let forcedColors = true;
    const listenerState: { current: EventListener | null } = { current: null };
    const query = {
      get matches() {
        return forcedColors;
      },
      media: "(forced-colors: active)",
      onchange: null,
      addEventListener: vi.fn((_type: string, listener: EventListener) => {
        listenerState.current = listener;
      }),
      removeEventListener: vi.fn((_type: string, listener: EventListener) => {
        if (listenerState.current === listener) listenerState.current = null;
      }),
    } as unknown as MediaQueryList;
    vi.spyOn(window, "matchMedia").mockReturnValue(query);
    const input = appendInput("date", "mod-date", "2026-07-31");
    const display = new ObsidianPropertiesDateDisplay(DEFAULT_SETTINGS, formatter);

    display.addDocument(document);
    expect(input.parentElement?.querySelector(
      ".chrono-notes-property-date-display-value",
    )).toBeNull();

    forcedColors = false;
    listenerState.current?.(new Event("change"));
    expect(getOverlay(input).textContent).toBe("2026-07-31");
    display.dispose();
    expect(listenerState.current).toBeNull();
  });

  it("leaves fully system-controlled inputs entirely unmanaged", () => {
    const systemInput = appendInput("date", "mod-date", "2026-07-31");
    const systemDateTimeInput = appendInput(
      "datetime-local",
      "mod-datetime",
      "2026-07-31T14:05",
    );
    const display = new ObsidianPropertiesDateDisplay({
      ...DEFAULT_SETTINGS,
      dateFormat: "system",
      timeFormat: "system",
    }, formatter);
    display.addDocument(document);

    for (const input of [systemInput, systemDateTimeInput]) {
      const host = input.parentElement;
      expect(host?.querySelector(".chrono-notes-property-date-display-value")).toBeNull();
      expect(host?.className).toBe("");
      expect(input.className).not.toContain("chrono-notes");
      expect(host?.getAttribute("style")).toBeNull();
    }
    display.dispose();
  });

  it("does not observe document mutations until a custom display is enabled", () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal("MutationObserver", class {
      constructor(_callback: MutationCallback) {}

      observe = observe;
      disconnect = disconnect;
    });
    const input = appendInput("date", "mod-date", "2026-07-31");
    const display = new ObsidianPropertiesDateDisplay({
      ...DEFAULT_SETTINGS,
      dateFormat: "system",
      timeFormat: "system",
    }, formatter);

    display.addDocument(document);
    expect(observe).not.toHaveBeenCalled();
    expect(input.parentElement?.querySelector(
      ".chrono-notes-property-date-display-value",
    )).toBeNull();

    display.setSettings(DEFAULT_SETTINGS);
    expect(observe).toHaveBeenCalledOnce();
    expect(getOverlay(input).textContent).toBe("2026-07-31");
    display.setSettings({
      ...DEFAULT_SETTINGS,
      dateFormat: "system",
      timeFormat: "system",
    });
    expect(input.parentElement?.querySelector(
      ".chrono-notes-property-date-display-value",
    )).toBeNull();
    display.dispose();
  });

  it("keeps empty and unformattable custom values native until a display exists", () => {
    const emptyInput = appendInput("date", "mod-date", "");
    const emptyDisplay = new ObsidianPropertiesDateDisplay(DEFAULT_SETTINGS, formatter);
    emptyDisplay.addDocument(document);
    expect(emptyInput.parentElement?.querySelector(
      ".chrono-notes-property-date-display-value",
    )).toBeNull();
    expect(emptyInput.classList.contains("chrono-notes-property-date-native-input")).toBe(false);
    emptyDisplay.dispose();

    document.body.replaceChildren();
    const rejectedInput = appendInput("date", "mod-date", "2026-07-31");
    const rejectingFormatter: PropertyDateValueFormatter = {
      ...formatter,
      formatMoment: () => null,
    };
    const rejectedDisplay = new ObsidianPropertiesDateDisplay(
      DEFAULT_SETTINGS,
      rejectingFormatter,
    );
    rejectedDisplay.addDocument(document);
    expect(rejectedInput.parentElement?.querySelector(
      ".chrono-notes-property-date-display-value",
    )).toBeNull();
    expect(rejectedInput.classList.contains(
      "chrono-notes-property-date-native-input",
    )).toBe(false);
    rejectedDisplay.dispose();
  });

  it("manages Date & time without touching Date when only time is customized", () => {
    const dateInput = appendInput("date", "mod-date", "2026-07-31");
    const dateTimeInput = appendInput(
      "datetime-local",
      "mod-datetime",
      "2026-07-31T14:05:06",
    );
    const display = new ObsidianPropertiesDateDisplay({
      ...DEFAULT_SETTINGS,
      dateFormat: "system",
      timeFormat: "24-hour-seconds",
    }, formatter);

    display.addDocument(document);

    expect(dateInput.parentElement?.querySelector(
      ".chrono-notes-property-date-display-value",
    )).toBeNull();
    expect(getOverlay(dateTimeInput).textContent).toBe("SYSTEM-DATE 14:05:06");
    display.dispose();
  });

  it("passes expanded custom patterns through without changing the ISO input", () => {
    const input = appendInput(
      "datetime-local",
      "mod-datetime",
      "2026-07-31T14:05:06.123",
    );
    const formatMoment = vi.fn((_value: string, pattern: string) => `[${pattern}]`);
    const spyFormatter: PropertyDateValueFormatter = {
      ...formatter,
      formatMoment,
    };
    const display = new ObsidianPropertiesDateDisplay({
      ...DEFAULT_SETTINGS,
      dateFormat: "custom",
      dateCustomFormat: "dddd, MMMM D, YYYY",
      timeFormat: "custom",
      timeCustomFormat: "LTS",
    }, spyFormatter);

    display.addDocument(document);

    expect(getOverlay(input).textContent).toBe("[dddd, MMMM D, YYYY] [LTS]");
    expect(formatMoment).toHaveBeenNthCalledWith(
      1,
      "2026-07-31T14:05:06.123",
      "dddd, MMMM D, YYYY",
      "en",
    );
    expect(formatMoment).toHaveBeenNthCalledWith(
      2,
      "2026-07-31T14:05:06.123",
      "LTS",
      "en",
    );
    expect(input.value).toBe("2026-07-31T14:05:06.123");
    display.dispose();
  });

  it("creates and removes presentation state as settings and values change", () => {
    const input = appendInput("date", "mod-date", "2026-07-31");
    const host = input.parentElement;
    if (host === null) throw new Error("Expected input host.");
    const display = new ObsidianPropertiesDateDisplay({
      ...DEFAULT_SETTINGS,
      dateFormat: "system",
      timeFormat: "system",
    }, formatter);
    display.addDocument(document);

    expect(host.querySelector(".chrono-notes-property-date-display-value")).toBeNull();
    display.setSettings(DEFAULT_SETTINGS);
    expect(getOverlay(input).textContent).toBe("2026-07-31");

    input.value = "";
    input.dispatchEvent(new Event("input"));
    expect(host.querySelector(".chrono-notes-property-date-display-value")).toBeNull();
    expect(host.classList.contains("chrono-notes-property-date-display-host")).toBe(false);
    expect(input.classList.contains("chrono-notes-property-date-native-input")).toBe(false);

    input.value = "2026-08-01";
    input.dispatchEvent(new Event("input"));
    expect(getOverlay(input).textContent).toBe("2026-08-01");
    display.setSettings({
      ...DEFAULT_SETTINGS,
      dateFormat: "system",
      timeFormat: "system",
    });
    expect(host.querySelector(".chrono-notes-property-date-display-value")).toBeNull();
    expect(host.style.cssText).toBe("");
    display.dispose();
  });

  it("manages dynamically rendered Properties inputs", async () => {
    const display = new ObsidianPropertiesDateDisplay(DEFAULT_SETTINGS, formatter);
    display.addDocument(document);

    const input = appendInput("date", "mod-date", "2026-07-31");
    await vi.waitFor(() => expect(getOverlay(input).textContent).toBe("2026-07-31"));
    display.dispose();
  });

  it("rebinds moved inputs and releases inputs that stop matching Properties", async () => {
    const input = appendInput("date", "mod-date", "2026-07-31");
    const originalHost = input.parentElement;
    const properties = input.closest<HTMLElement>(".metadata-properties");
    if (originalHost === null || properties === null) {
      throw new Error("Expected input host and Properties root.");
    }
    const display = new ObsidianPropertiesDateDisplay(DEFAULT_SETTINGS, formatter);
    display.addDocument(document);

    const replacementHost = document.createElement("div");
    properties.append(replacementHost);
    replacementHost.append(input);
    await vi.waitFor(() => {
      expect(originalHost.querySelector(
        ".chrono-notes-property-date-display-value",
      )).toBeNull();
      expect(getOverlay(input).textContent).toBe("2026-07-31");
    }, { timeout: 3_000 });

    input.classList.remove("mod-date");
    await vi.waitFor(() => {
      expect(replacementHost.querySelector(
        ".chrono-notes-property-date-display-value",
      )).toBeNull();
      expect(input.classList.contains("chrono-notes-property-date-native-input")).toBe(false);
    }, { timeout: 3_000 });

    input.classList.add("mod-date");
    await vi.waitFor(
      () => expect(getOverlay(input).textContent).toBe("2026-07-31"),
      { timeout: 3_000 },
    );
    input.type = "text";
    await vi.waitFor(() => {
      expect(replacementHost.querySelector(
        ".chrono-notes-property-date-display-value",
      )).toBeNull();
    }, { timeout: 3_000 });
    display.dispose();
  });

  it("releases and reacquires inputs when the Properties root is toggled", async () => {
    const input = appendInput("date", "mod-date", "2026-07-31");
    const properties = input.closest<HTMLElement>(".metadata-properties");
    if (properties === null) throw new Error("Expected Properties root.");
    const display = new ObsidianPropertiesDateDisplay(DEFAULT_SETTINGS, formatter);
    display.addDocument(document);

    properties.classList.remove("metadata-properties");
    await vi.waitFor(() => {
      expect(input.parentElement?.querySelector(
        ".chrono-notes-property-date-display-value",
      )).toBeNull();
    });

    properties.classList.add("metadata-properties");
    await vi.waitFor(() => {
      expect(getOverlay(input).textContent).toBe("2026-07-31");
    });
    display.dispose();
  });

  it("cleans a disconnected input when Properties re-renders", async () => {
    const input = appendInput("date", "mod-date", "2026-07-31");
    const host = input.parentElement;
    if (host === null) throw new Error("Expected input host.");
    const display = new ObsidianPropertiesDateDisplay(DEFAULT_SETTINGS, formatter);
    display.addDocument(document);

    expect(input.classList.contains("chrono-notes-property-date-native-input")).toBe(true);
    host.remove();
    appendInput("date", "mod-date", "2026-08-01");

    await vi.waitFor(() => {
      expect(input.classList.contains("chrono-notes-property-date-native-input")).toBe(false);
    });
    expect(host.querySelector(".chrono-notes-property-date-display-value")).toBeNull();
    display.dispose();
  });

  it("updates every document and removes all DOM state on dispose", () => {
    const popout = document.implementation.createHTMLDocument("popout");
    const mainInput = appendInput("date", "mod-date", "2026-07-31");
    const popoutInput = appendInput("date", "mod-date", "2026-07-31", popout);
    const display = new ObsidianPropertiesDateDisplay(DEFAULT_SETTINGS, formatter);
    display.addDocument(document);
    display.addDocument(popout);

    display.setSettings({
      ...DEFAULT_SETTINGS,
      dateFormat: "dmy-slash",
    });
    expect(getOverlay(mainInput).textContent).toBe("31/07/2026");
    expect(getOverlay(popoutInput).textContent).toBe("31/07/2026");

    display.dispose();
    for (const target of [document, popout]) {
      expect(target.querySelector(".chrono-notes-property-date-display-value")).toBeNull();
    }
    expect(mainInput.classList.contains("chrono-notes-property-date-native-input")).toBe(false);
  });
});

function appendInput(
  type: "date" | "datetime-local",
  className: "mod-date" | "mod-datetime",
  value: string,
  target: Document = document,
): HTMLInputElement {
  let properties = target.querySelector<HTMLElement>(".metadata-properties");
  if (properties === null) {
    properties = target.createElement("div");
    properties.className = "metadata-properties";
    target.body.append(properties);
  }
  const host = target.createElement("div");
  const input = target.createElement("input");
  input.type = type;
  input.className = `metadata-input ${className}`;
  input.value = value;
  host.append(input);
  properties.append(host);
  return input;
}

function getOverlay(input: HTMLInputElement): HTMLSpanElement {
  const overlay = input.parentElement?.querySelector<HTMLSpanElement>(
    ".chrono-notes-property-date-display-value",
  );
  if (overlay === null || overlay === undefined) throw new Error("Expected display overlay.");
  return overlay;
}

function mockInlineGeometry(
  host: HTMLElement,
  input: HTMLInputElement,
  link: HTMLElement,
  hostWidth: number,
  inputWidth: number,
  linkWidth: number,
): void {
  Object.defineProperty(host, "clientWidth", { value: hostWidth });
  host.getBoundingClientRect = () => rect(0, hostWidth);
  input.getBoundingClientRect = () => {
    const configured = Number.parseFloat(host.style.getPropertyValue(
      "--chrono-notes-property-date-display-inline-size",
    ));
    return rect(0, Number.isFinite(configured) ? configured : inputWidth);
  };
  link.getBoundingClientRect = () => rect(hostWidth - linkWidth, linkWidth);
}

function rect(left: number, width: number): DOMRect {
  return {
    bottom: 30,
    height: 30,
    left,
    right: left + width,
    top: 0,
    width,
    x: left,
    y: 0,
    toJSON: () => ({}),
  };
}
