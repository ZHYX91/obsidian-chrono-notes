import { createRequire } from "node:module";
import { Window } from "happy-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("obsidian", async () => ({
  ...await import("../browser/obsidian-host"),
  moment: createRequire(createRequire(import.meta.url).resolve("obsidian/package.json"))("moment"),
}));
vi.mock("../../src/ui/settings/index-cache-settings", () => ({
  renderIndexCacheSettingsSection: () => undefined,
}));

import type {} from "../browser/settings-entry";

afterEach(() => vi.unstubAllGlobals());

it("keeps the custom date input and focus through a save failure and retry", async () => {
  const dom = new Window();
  vi.stubGlobal("window", dom);
  vi.stubGlobal("document", dom.document);
  vi.stubGlobal("HTMLElement", dom.HTMLElement);
  vi.stubGlobal("Event", dom.Event);
  vi.stubGlobal("getComputedStyle", dom.getComputedStyle.bind(dom));
  await import("../browser/settings-entry");
  const fixture = document.createElement("div");
  fixture.id = "settings-fixture";
  document.body.append(fixture);
  window.mountChronoSettings("en", 420);
  const format = () => fixture.querySelector<HTMLSelectElement>(
    '[data-chrono-settings-control="propertyDateDisplayFormat"]',
  )!;
  const input = () => fixture.querySelector<HTMLInputElement>(
    ".chrono-notes-property-custom-format-setting input",
  );
  expect(input()).toBeNull();
  format().focus();
  window.beforeChronoSettingsSave = async () => { throw new Error("injected write failure"); };
  format().value = "custom";
  format().dispatchEvent(new Event("change", { bubbles: true }));
  await expect(window.chronoSettingsPending).rejects.toThrow("injected write failure");
  const status = () => fixture.querySelector<HTMLElement>(".chrono-notes-settings-save-status")!;
  expect(status().dataset.state).toBe("failed");
  expect(input()).not.toBeNull();
  expect(document.activeElement).toBe(format());

  delete window.beforeChronoSettingsSave;
  status().querySelector("button")!.click();
  await vi.waitFor(() => expect(status().dataset.state).toBe("idle"));
  expect(input()?.disabled).toBe(false);
  expect(format().value).toBe("custom");

  window.beforeChronoSettingsSave = async () => { throw new Error("second write failure"); };
  format().value = "system";
  format().dispatchEvent(new Event("change", { bubbles: true }));
  await expect(window.chronoSettingsPending).rejects.toThrow("second write failure");
  expect(input()).toBeNull();
  let release!: () => void;
  window.beforeChronoSettingsSave = () => new Promise<void>((resolve) => { release = resolve; });
  status().querySelector("button")!.click();
  expect(status().dataset.state).toBe("saving");
  const integrations = fixture.querySelector<HTMLButtonElement>('[data-tab-id="extensions-and-integrations"]')!;
  integrations.click();
  release();
  await vi.waitFor(() => {
    expect(fixture.querySelector<HTMLElement>(".chrono-notes-settings-save-status")?.dataset.state).toBe("idle");
  });
  expect(fixture.querySelector('[aria-selected="true"]')?.getAttribute("data-tab-id")).toBe("extensions-and-integrations");
  expect(document.activeElement?.getAttribute("data-tab-id")).toBe("extensions-and-integrations");

  fixture.querySelector<HTMLButtonElement>('[data-tab-id="general"]')!.click();
  expect(format().value).toBe("system");
  expect(input()).toBeNull();
  expect(window.captureChronoSettings().savedCount).toBe(4);
  delete window.beforeChronoSettingsSave;
  fixture.remove();
});
