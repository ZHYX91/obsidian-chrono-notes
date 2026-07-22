import { describe, expect, it, vi } from "vitest";

import { ObsidianPropertiesDateInterceptor } from "../../src/adapters/obsidian/obsidian-properties-date-interceptor";

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly classes = new Set<string>();
  readonly attributes = new Map<string, string>();
  parent: FakeElement | null = null;
  textContent = "";
  value = "";

  constructor(classes: string[] = []) {
    for (const className of classes) this.classes.add(className);
  }

  append(child: FakeElement): FakeElement {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  closest(selector: string): FakeElement | null {
    for (let current: FakeElement | null = this; current !== null; current = current.parent) {
      if (current.matches(selector)) return current;
    }
    return null;
  }

  querySelector(selector: string): FakeElement | null {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const nested = child.querySelector(selector);
      if (nested !== null) return nested;
    }
    return null;
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  private matches(selector: string): boolean {
    if (selector === ".clickable-icon") return this.classes.has("clickable-icon");
    if (selector === ".metadata-properties") return this.classes.has("metadata-properties");
    if (selector === "input[type=\"date\"]") return this.attributes.get("type") === "date";
    if (selector === ".metadata-property-value[data-property-type=\"date\"]") {
      return this.classes.has("metadata-property-value")
        && this.attributes.get("data-property-type") === "date";
    }
    if (selector === "[data-href], .internal-link") {
      return this.attributes.has("data-href") || this.classes.has("internal-link");
    }
    return false;
  }
}

function createEvent(target: FakeElement, overrides: { button?: number; ctrlKey?: boolean; metaKey?: boolean } = {}) {
  return {
    button: overrides.button ?? 0,
    ctrlKey: overrides.ctrlKey ?? false,
    metaKey: overrides.metaKey ?? false,
    target,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    stopImmediatePropagation: vi.fn(),
  };
}

function createHarness(enabled = true, dailyConfigured = true) {
  const openDaily = vi.fn();
  const interceptor = new ObsidianPropertiesDateInterceptor({
    getEnabled: () => enabled,
    isDailyConfigured: () => dailyConfigured,
    openDaily,
  });
  return { interceptor, openDaily };
}

function createDateIcon(value: string, propertyType = "date", insideProperties = true) {
  const root = new FakeElement(insideProperties ? ["metadata-properties"] : []);
  const property = root.append(new FakeElement(["metadata-property-value"]));
  property.attributes.set("data-property-type", propertyType);
  const input = property.append(new FakeElement());
  input.attributes.set("type", "date");
  input.value = value;
  const icon = property.append(new FakeElement(["clickable-icon"]));
  return icon.append(new FakeElement());
}

function createLink(candidate: string, insideProperties = true) {
  const root = new FakeElement(insideProperties ? ["metadata-properties"] : ["note-body"]);
  const link = root.append(new FakeElement(["internal-link"]));
  link.attributes.set("data-href", candidate);
  link.textContent = candidate;
  return link.append(new FakeElement());
}

describe("ObsidianPropertiesDateInterceptor", () => {
  it("intercepts a valid date icon and preserves a default target", () => {
    const { interceptor, openDaily } = createHarness();
    const event = createEvent(createDateIcon("2027-01-01"));
    interceptor.handleClick(event);

    expect(openDaily).toHaveBeenCalledWith({ year: 2027, month: 1, day: 1 }, "default");
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopImmediatePropagation).toHaveBeenCalledOnce();
  });

  it("opens a date icon in a new tab for Ctrl or Cmd", () => {
    const { interceptor, openDaily } = createHarness();
    interceptor.handleClick(createEvent(createDateIcon("2027-01-02"), { ctrlKey: true }));
    interceptor.handleClick(createEvent(createDateIcon("2027-01-03"), { metaKey: true }));
    expect(openDaily).toHaveBeenNthCalledWith(1, { year: 2027, month: 1, day: 2 }, "tab");
    expect(openDaily).toHaveBeenNthCalledWith(2, { year: 2027, month: 1, day: 3 }, "tab");
  });

  it("passes through links in Properties and note bodies", () => {
    const { interceptor, openDaily } = createHarness();
    const propertyLink = createEvent(createLink("Daily/2027-01-01"));
    const bodyLink = createEvent(createLink("2027-01-02", false));

    interceptor.handleClick(propertyLink);
    interceptor.handleClick(bodyLink);

    expect(openDaily).not.toHaveBeenCalled();
    expect(propertyLink.preventDefault).not.toHaveBeenCalled();
    expect(bodyLink.preventDefault).not.toHaveBeenCalled();
  });

  it("passes through disabled, unconfigured, non-left, invalid, and non-date icons", () => {
    const disabled = createHarness(false);
    disabled.interceptor.handleClick(createEvent(createDateIcon("2027-01-01")));
    expect(disabled.openDaily).not.toHaveBeenCalled();

    const unconfigured = createHarness(true, false);
    const unconfiguredEvent = createEvent(createDateIcon("2027-01-01"));
    unconfigured.interceptor.handleClick(unconfiguredEvent);
    expect(unconfigured.openDaily).not.toHaveBeenCalled();
    expect(unconfiguredEvent.preventDefault).not.toHaveBeenCalled();

    const { interceptor, openDaily } = createHarness();
    interceptor.handleClick(createEvent(createDateIcon("2027-01-01"), { button: 1 }));
    interceptor.handleClick(createEvent(createDateIcon("")));
    interceptor.handleClick(createEvent(createDateIcon("2027-01-01", "text")));
    interceptor.handleClick(createEvent(createDateIcon("2027-01-01", "date", false)));
    expect(openDaily).not.toHaveBeenCalled();
  });
});
