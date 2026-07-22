// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSettingsTabLayout,
  type SettingsTabDefinition,
} from "../../src/ui/settings/settings-tab-layout";
import type { SettingsTabId } from "../../src/ui/settings/settings-tab-navigation";

const tabs: readonly SettingsTabDefinition[] = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "periodic", label: "Periodic notes" },
  { id: "ranges", label: "Range notes" },
  { id: "integrations", label: "Integrations" },
];

describe("createSettingsTabLayout", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("builds linked tablist, tab, and tabpanel semantics", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const layout = createSettingsTabLayout(
      container,
      tabs,
      "periodic",
      "Chrono Notes settings categories",
      vi.fn(),
    );
    const tabList = container.querySelector<HTMLElement>("[role=tablist]");
    const tabElements = Array.from(container.querySelectorAll<HTMLElement>("[role=tab]"));

    expect(tabList?.getAttribute("aria-label")).toBe("Chrono Notes settings categories");
    expect(tabList?.getAttribute("aria-orientation")).toBe("horizontal");
    expect(tabElements.map((tab) => tab.getAttribute("aria-selected"))).toEqual([
      "false",
      "false",
      "true",
      "false",
      "false",
    ]);
    expect(tabElements.map((tab) => tab.tabIndex)).toEqual([-1, -1, 0, -1, -1]);
    expect(layout.panelEl.getAttribute("role")).toBe("tabpanel");
    expect(layout.panelEl.tabIndex).toBe(0);
    expect(layout.activeTabEl.getAttribute("aria-controls")).toBe(layout.panelEl.id);
    expect(layout.panelEl.getAttribute("aria-labelledby")).toBe(layout.activeTabEl.id);
  });

  it.each([
    ["ArrowRight", "general", "appearance"],
    ["ArrowLeft", "general", "integrations"],
    ["Home", "ranges", "general"],
    ["End", "appearance", "integrations"],
  ] as Array<[string, SettingsTabId, SettingsTabId]>)(
    "maps %s from %s to %s",
    (key, initialTab, expectedTab) => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const onSelect = vi.fn();
      createSettingsTabLayout(
        container,
        tabs,
        initialTab,
        "Chrono Notes settings categories",
        onSelect,
      );
      const activeTab = container.querySelector<HTMLElement>("[role=tab][aria-selected=true]");

      activeTab?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      expect(onSelect).toHaveBeenCalledWith(expectedTab);
    },
  );

  it("focuses an already active tab without rerendering", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onSelect = vi.fn();
    const { activeTabEl } = createSettingsTabLayout(
      container,
      tabs,
      "general",
      "Chrono Notes settings categories",
      onSelect,
    );

    activeTabEl.click();

    expect(document.activeElement).toBe(activeTabEl);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("allows the owner to restore focus to the active tab after rerendering", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    let activeTab: SettingsTabId = "general";

    const render = (focus: boolean): void => {
      container.replaceChildren();
      const layout = createSettingsTabLayout(
        container,
        tabs,
        activeTab,
        "Chrono Notes settings categories",
        (tabId) => {
          activeTab = tabId;
          render(true);
        },
      );
      if (focus) layout.activeTabEl.focus();
    };

    render(false);
    const firstTab = container.querySelector<HTMLElement>("[role=tab][aria-selected=true]");
    firstTab?.dispatchEvent(new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
    }));

    expect(activeTab).toBe("appearance");
    expect(document.activeElement?.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement?.textContent).toBe("Appearance");
  });
});
