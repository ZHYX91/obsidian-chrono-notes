import type { Setting } from "obsidian";
import { describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({ Setting: class {} }));

import { createTranslator } from "../../src/shared/i18n";
import {
  configureNoteIndexCacheSetting,
  configureNoteIndexStatusSetting,
} from "../../src/ui/settings/index-cache-settings";
import type {
  SettingsHost,
  SettingsSectionContext,
} from "../../src/ui/settings/settings-section-context";

describe("index and cache settings", () => {
  it("updates the index summary through a cleanup-safe dedicated subscription", () => {
    const harness = createHarness();
    const cleanup = configureNoteIndexStatusSetting(harness.setting, harness.context);

    expect(harness.setName).toHaveBeenCalledWith("Current note index");
    expect(harness.setDesc).toHaveBeenLastCalledWith(
      "Ready. 3 notes indexed; 0 read errors.",
    );

    harness.status = {
      ...harness.status,
      readiness: "indexing",
      noteCount: 1,
      errorCount: 1,
    };
    harness.notifyIndex();
    expect(harness.setDesc).toHaveBeenLastCalledWith(
      "Indexing Vault files. 1 notes are currently visible; 1 read errors.",
    );

    cleanup();
    expect(harness.listenerCount()).toBe(0);
  });

  it("clears only through the host rebuild operation and reports the resulting cache", async () => {
    const harness = createHarness();
    harness.getCacheStatus
      .mockResolvedValueOnce({ state: "stored", entryCount: 3 })
      .mockResolvedValueOnce({ state: "stored", entryCount: 3 });
    const cleanup = configureNoteIndexCacheSetting(harness.setting, harness.context);
    await Promise.resolve();

    expect(harness.setDesc).toHaveBeenLastCalledWith(
      "Derived index data for 3 notes is stored for this Vault.",
    );
    expect(harness.hints).toContain(
      "Clears only derived Chrono Notes index data for the current Vault, then rereads its Markdown files. Notes, settings, and other Vault caches are unchanged.",
    );
    expect(harness.setButtonText).toHaveBeenLastCalledWith("Clear cache and rebuild");
    expect(harness.setDisabled).toHaveBeenLastCalledWith(false);

    await harness.clickButton();

    expect(harness.rebuild).toHaveBeenCalledOnce();
    expect(harness.setDesc).toHaveBeenCalledWith(
      "Clearing this Vault's cache and rebuilding the note index…",
    );
    expect(harness.setDesc).toHaveBeenLastCalledWith(
      "Derived index data for 3 notes is stored for this Vault.",
    );
    cleanup();
    expect(harness.listenerCount()).toBe(0);
  });

  it("keeps a deterministic inline failure when immediate cache persistence fails", async () => {
    const harness = createHarness();
    harness.rebuild.mockRejectedValueOnce(new Error("save failed"));
    configureNoteIndexCacheSetting(harness.setting, harness.context);
    await Promise.resolve();

    await harness.clickButton();

    expect(harness.setDesc).toHaveBeenLastCalledWith(
      "The cache could not be cleared or the note index could not be rebuilt.",
    );
  });
});

function createHarness() {
  const listeners = new Set<() => void>();
  const setName = vi.fn();
  const setDesc = vi.fn();
  const setButtonText = vi.fn();
  const setDisabled = vi.fn();
  const hints: string[] = [];
  let click: (() => void | Promise<void>) | null = null;
  const setting = {
    descEl: {
      createDiv: ({ text }: { text: string }) => {
        hints.push(text);
        return {};
      },
    },
    setName(name: string) {
      setName(name);
      return this;
    },
    setDesc(desc: string) {
      setDesc(desc);
      return this;
    },
    addButton(configure: (button: unknown) => void) {
      const button = {
        onClick(handler: () => void | Promise<void>) {
          click = handler;
          return this;
        },
        setButtonText(text: string) {
          setButtonText(text);
          return this;
        },
        setDisabled(disabled: boolean) {
          setDisabled(disabled);
          return this;
        },
      };
      configure(button);
      return this;
    },
  } as unknown as Setting;
  const getCacheStatus = vi.fn<SettingsHost["getNoteIndexCacheStatus"]>(
    async () => ({ state: "empty" }),
  );
  const rebuild = vi.fn(async () => undefined);
  const harness = {
    status: {
      active: true,
      readiness: "ready",
      noteCount: 3,
      errorCount: 0,
      backgroundVerificationActive: false,
      cacheConfigured: true,
      rebuildingCache: false,
    } as NonNullable<ReturnType<SettingsHost["getNoteIndexStatus"]>>,
    setting,
    setName,
    setDesc,
    setButtonText,
    setDisabled,
    hints,
    getCacheStatus,
    rebuild,
    notifyIndex: () => {
      for (const listener of listeners) listener();
    },
    listenerCount: () => listeners.size,
    clickButton: async () => {
      if (click === null) throw new Error("Expected a button click handler.");
      await click();
    },
  };
  const host = {
    getNoteIndexStatus: () => harness.status,
    subscribeNoteIndex: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getNoteIndexCacheStatus: getCacheStatus,
    rebuildNoteIndexCache: rebuild,
  } as unknown as SettingsHost;
  return Object.assign(harness, {
    context: {
      host,
      translator: createTranslator("en", "en"),
    } as SettingsSectionContext,
  });
}
