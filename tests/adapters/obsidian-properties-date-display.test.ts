// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ObsidianPropertiesDateDisplay,
  PROPERTY_DATE_FORMAT_ROOT_CLASSES,
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
  document.documentElement.classList.remove(...PROPERTY_DATE_FORMAT_ROOT_CLASSES);
});

describe("ObsidianPropertiesDateDisplay", () => {
  it("formats an unfocused date without changing its native value", () => {
    const input = appendInput("date", "mod-date", "2026-07-31");
    const display = new ObsidianPropertiesDateDisplay(DEFAULT_SETTINGS, formatter);

    display.addDocument(document);

    expect(input.value).toBe("2026-07-31");
    expect(getOverlay(input).textContent).toBe("2026-07-31");
    expect(input.parentElement?.classList.contains(
      "chrono-notes-property-date-display-active",
    )).toBe(true);
    display.dispose();
  });

  it("reveals the untouched native editor on focus and restores the overlay on blur", () => {
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
    expect(input.value).toBe("2026-07-31");
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
    const originalResizeObserver = window.ResizeObserver;
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: class {
        constructor(callback: () => void) {
          resizeCallbacks.push(callback);
        }

        disconnect = disconnect;
        observe(): void {}
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

  it("leaves system, empty, and malformed values entirely native", () => {
    const systemInput = appendInput("date", "mod-date", "2026-07-31");
    const emptyInput = appendInput("date", "mod-date", "");
    const display = new ObsidianPropertiesDateDisplay({
      ...DEFAULT_SETTINGS,
      dateFormat: "system",
      timeFormat: "system",
    }, formatter);
    display.addDocument(document);

    for (const input of [systemInput, emptyInput]) {
      expect(input.parentElement?.classList.contains(
        "chrono-notes-property-date-display-active",
      )).toBe(false);
    }
    display.dispose();
  });

  it("manages dynamically rendered Properties inputs", async () => {
    const display = new ObsidianPropertiesDateDisplay(DEFAULT_SETTINGS, formatter);
    display.addDocument(document);

    const input = appendInput("date", "mod-date", "2026-07-31");
    await vi.waitFor(() => expect(getOverlay(input).textContent).toBe("2026-07-31"));
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
    expect(document.documentElement.classList.contains(
      "chrono-notes-property-date-format-dmy",
    )).toBe(true);
    expect(popout.documentElement.classList.contains(
      "chrono-notes-property-date-format-dmy",
    )).toBe(true);
    expect(getOverlay(mainInput).textContent).toBe("31/07/2026");
    expect(getOverlay(popoutInput).textContent).toBe("31/07/2026");

    display.dispose();
    for (const target of [document, popout]) {
      expect(PROPERTY_DATE_FORMAT_ROOT_CLASSES.some((className) =>
        target.documentElement.classList.contains(className))).toBe(false);
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
