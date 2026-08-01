import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockEventCallback = (...args: unknown[]) => void;

const mocks = vi.hoisted(() => {
  interface Deferred<T> {
    readonly promise: Promise<T>;
    resolve(value: T): void;
    reject(error: unknown): void;
  }

  const createDeferred = <T>(): Deferred<T> => {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    return { promise, resolve, reject };
  };

  const state = {
    commands: [] as Array<{ readonly id: string }>,
    removedCommands: [] as string[],
    ribbons: [] as string[],
    removedRibbons: [] as string[],
    views: [] as Array<{ readonly type: string; readonly creator: (leaf: unknown) => unknown }>,
    removedViews: [] as string[],
    settingTabs: [] as unknown[],
    removedSettingTabs: [] as unknown[],
    workspaceLeaves: [] as Array<{ readonly view: unknown }>,
    workspaceAllLeaves: [] as Array<{
      readonly view: { readonly containerEl: { readonly ownerDocument: Document } };
    }>,
    layoutReadyCallbacks: [] as Array<() => void>,
    workspaceCallbacks: new Map<string, Array<MockEventCallback>>(),
    vaultCallbacks: new Map<string, Array<MockEventCallback>>(),
    domCallbacks: new Map<string, Array<EventListener>>(),
    domEventUnsubscribes: [] as Array<ReturnType<typeof vi.fn>>,
    documentVisibilityState: "visible" as DocumentVisibilityState,
    appLanguage: "en",
    localTimeZone: "Asia/Shanghai",
    eventUnsubscribes: [] as Array<ReturnType<typeof vi.fn>>,
    noteSourceUnsubscribes: [] as Array<ReturnType<typeof vi.fn>>,
    noteEventListeners: [] as Array<(event: unknown) => void>,
    navbarInstances: [] as MockNoteNavbarManager[],
    propertiesDateDisplayInstances: [] as MockPropertiesDateDisplay[],
    propertiesDateDocumentInstances: [] as MockPropertiesDateDocuments[],
    propertiesDateDocumentFailure: null as Document | null,
    settingsTabInstances: [] as MockSettingsTab[],
    intervalModalHosts: [] as unknown[],
    firstUseGuideOpen: vi.fn(),
    loadData: vi.fn<() => Promise<unknown>>(),
    saveData: vi.fn<(data: unknown) => Promise<void>>(),
    noteListPaths: vi.fn<() => readonly string[]>(),
    noteRead: vi.fn<(path: string) => Promise<string>>(),
    icsRead: vi.fn<(source: string) => Promise<string>>(),
    activeFilePath: null as string | null,
  };

  class MockPlugin {
    readonly app: unknown;
    readonly manifest: unknown;
    private readonly cleanups: Array<() => void> = [];
    private unloaded = false;

    constructor(app: unknown, manifest: unknown) {
      this.app = app;
      this.manifest = manifest;
    }

    onload(): void {}

    onunload(): void {}

    unload(): void {
      if (this.unloaded) return;
      this.unloaded = true;
      this.onunload();
      for (const cleanup of this.cleanups.reverse()) cleanup();
    }

    register(cleanup: () => void): void {
      this.cleanups.push(cleanup);
    }

    registerEvent(eventRef: { off(): void }): void {
      this.register(() => eventRef.off());
    }

    registerDomEvent(
      _target: EventTarget,
      type: string,
      listener: EventListener,
    ): void {
      const listeners = state.domCallbacks.get(type) ?? [];
      listeners.push(listener);
      state.domCallbacks.set(type, listeners);
      const unsubscribe = vi.fn(() => {
        const activeListeners = state.domCallbacks.get(type);
        if (activeListeners === undefined) return;
        const index = activeListeners.indexOf(listener);
        if (index >= 0) activeListeners.splice(index, 1);
      });
      state.domEventUnsubscribes.push(unsubscribe);
      this.register(unsubscribe);
    }

    registerInterval(id: number): number {
      this.register(() => clearInterval(id));
      return id;
    }

    registerView(type: string, creator: (leaf: unknown) => unknown): void {
      state.views.push({ type, creator });
      this.register(() => state.removedViews.push(type));
    }

    addCommand(command: { readonly id: string }): { readonly id: string } {
      state.commands.push(command);
      this.register(() => state.removedCommands.push(command.id));
      return command;
    }

    addRibbonIcon(_icon: string, title: string): HTMLElement {
      state.ribbons.push(title);
      this.register(() => state.removedRibbons.push(title));
      return {} as HTMLElement;
    }

    addSettingTab(tab: unknown): void {
      state.settingTabs.push(tab);
      this.register(() => state.removedSettingTabs.push(tab));
    }

    loadData(): Promise<unknown> {
      return state.loadData();
    }

    saveData(data: unknown): Promise<void> {
      return state.saveData(data);
    }
  }

  class MockTFolder {}

  class MockNotice {
    constructor(_message: string) {}
  }

  class MockNoteSource {
    listPaths(): readonly string[] {
      return state.noteListPaths();
    }

    read(path: string): Promise<string> {
      return state.noteRead(path);
    }

    subscribe(listener: (event: unknown) => void): () => void {
      state.noteEventListeners.push(listener);
      const unsubscribe = vi.fn();
      state.noteSourceUnsubscribes.push(unsubscribe);
      return unsubscribe;
    }
  }

  class MockIcsSourceReader {
    read(source: string): Promise<string> {
      return state.icsRead(source);
    }
  }

  class MockNoteNavbarManager {
    readonly update = vi.fn();
    readonly unmount = vi.fn();
    readonly handleFileRename = vi.fn();

    constructor(_app: unknown, _host: unknown) {
      state.navbarInstances.push(this);
    }
  }

  class MockSettingsTab {
    readonly activate = vi.fn();

    constructor(_app: unknown, _host: unknown) {
      state.settingsTabInstances.push(this);
    }
  }

  class MockChronoNotesView {
    readonly refresh = vi.fn();
    readonly jumpToDate = vi.fn();
    readonly syncToPeriodicNote = vi.fn();

    constructor(
      readonly leaf: unknown,
      readonly host: unknown,
    ) {}
  }

  class MockIntervalNoteListModal {
    readonly open = vi.fn();

    constructor(_app: unknown, host: unknown) {
      state.intervalModalHosts.push(host);
    }
  }

  class MockFirstUseGuideModal {
    constructor(..._args: unknown[]) {}

    open(): void {
      state.firstUseGuideOpen();
    }
  }

  class MockModal {
    readonly open = vi.fn();

    constructor(..._args: unknown[]) {}
  }

  class MockPropertiesDateInterceptor {
    readonly handleClick = vi.fn();

    constructor(_options: unknown) {}
  }

  class MockPropertiesDateDisplay {
    readonly addDocument = vi.fn();
    readonly removeDocument = vi.fn();
    readonly refreshAll = vi.fn();
    readonly setSettings = vi.fn();
    readonly dispose = vi.fn();

    constructor(readonly initialSettings: unknown) {
      state.propertiesDateDisplayInstances.push(this);
    }
  }

  class MockPropertiesDateDocuments {
    readonly addDocument = vi.fn((document: Document) => {
      this.display.addDocument(document);
      if (document === state.propertiesDateDocumentFailure) {
        throw new Error("injected Properties document setup failure");
      }
    });
    readonly removeDocument = vi.fn(
      (document: Document) => this.display.removeDocument(document),
    );
    readonly dispose = vi.fn(() => this.display.dispose());

    constructor(
      readonly display: MockPropertiesDateDisplay,
      readonly interceptor: MockPropertiesDateInterceptor,
    ) {
      state.propertiesDateDocumentInstances.push(this);
    }
  }

  const createEventRef = (): { off(): void } => {
    const off = vi.fn();
    state.eventUnsubscribes.push(off);
    return { off };
  };

  return {
    createDeferred,
    createEventRef,
    state,
    MockPlugin,
    MockTFolder,
    MockNotice,
    MockNoteSource,
    MockIcsSourceReader,
    MockNoteNavbarManager,
    MockSettingsTab,
    MockChronoNotesView,
    MockIntervalNoteListModal,
    MockFirstUseGuideModal,
    MockModal,
    MockPropertiesDateInterceptor,
    MockPropertiesDateDisplay,
    MockPropertiesDateDocuments,
  };
});

vi.mock("obsidian", () => ({
  getLanguage: () => mocks.state.appLanguage,
  moment: vi.fn(),
  Notice: mocks.MockNotice,
  Plugin: mocks.MockPlugin,
  TFolder: mocks.MockTFolder,
}));

vi.mock("../../src/adapters/obsidian/obsidian-note-source", () => ({
  ObsidianNoteSource: mocks.MockNoteSource,
}));

vi.mock("../../src/adapters/obsidian/obsidian-ics-source-reader", () => ({
  ObsidianIcsSourceReader: mocks.MockIcsSourceReader,
}));

vi.mock("../../src/adapters/obsidian/obsidian-properties-date-interceptor", () => ({
  ObsidianPropertiesDateInterceptor: mocks.MockPropertiesDateInterceptor,
}));

vi.mock("../../src/adapters/obsidian/obsidian-properties-date-display", () => ({
  ObsidianPropertiesDateDisplay: mocks.MockPropertiesDateDisplay,
}));

vi.mock("../../src/adapters/obsidian/obsidian-properties-date-documents", () => ({
  ObsidianPropertiesDateDocuments: mocks.MockPropertiesDateDocuments,
}));

vi.mock("../../src/adapters/obsidian/obsidian-plugin-settings", () => ({
  openObsidianPluginSettings: vi.fn(),
}));

vi.mock("../../src/adapters/obsidian/obsidian-date-context-menu", () => ({
  showObsidianDateContextMenu: vi.fn(),
}));

vi.mock("../../src/adapters/obsidian/obsidian-periodic-note-ports", () => {
  class MockPort {}
  return {
    ObsidianIntervalNoteFilePort: MockPort,
    ObsidianPeriodicNoteFilePort: MockPort,
    ObsidianNoteTemplatePort: MockPort,
    ObsidianPeriodicNoteWorkspacePort: MockPort,
    ObsidianTaskFilePort: MockPort,
    ObsidianTaskWorkspacePort: MockPort,
  };
});

vi.mock("../../src/ui/note-navbar/note-navbar", () => ({
  NoteNavbarManager: mocks.MockNoteNavbarManager,
}));

vi.mock("../../src/ui/settings/settings-tab", () => ({
  ChronoNotesSettingTab: mocks.MockSettingsTab,
}));

vi.mock("../../src/ui/calendar/chrono-notes-view", () => ({
  CHRONO_NOTES_VIEW_TYPE: "chrono-notes-calendar",
  ChronoNotesView: mocks.MockChronoNotesView,
}));

vi.mock("../../src/ui/modals/interval-note-list-modal", () => ({
  IntervalNoteListModal: mocks.MockIntervalNoteListModal,
}));

vi.mock("../../src/ui/modals/first-use-guide-modal", () => ({
  FirstUseGuideModal: mocks.MockFirstUseGuideModal,
}));

vi.mock("../../src/ui/modals/confirm-periodic-note-modal", () => ({
  ConfirmPeriodicNoteModal: mocks.MockModal,
}));

vi.mock("../../src/ui/modals/confirm-interval-note-modal", () => ({
  ConfirmIntervalNoteModal: mocks.MockModal,
}));

vi.mock("../../src/ui/modals/create-interval-note-modal", () => ({
  CreateIntervalNoteModal: mocks.MockModal,
}));

vi.mock("../../src/ui/modals/jump-to-date-modal", () => ({
  JumpToDateModal: mocks.MockModal,
}));

vi.mock("../../src/ui/modals/mini-calendar-modal", () => ({
  MiniCalendarModal: mocks.MockModal,
}));

import type { App, PluginManifest } from "obsidian";

import { openObsidianPluginSettings } from "../../src/adapters/obsidian/obsidian-plugin-settings";
import ChronoNotesPlugin from "../../src/app/plugin";
import { createDefaultSettings } from "../../src/shared/settings";

describe("ChronoNotesPlugin lifecycle composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCollections();
    mocks.state.appLanguage = "en";
    mocks.state.loadData.mockResolvedValue({
      ...createDefaultSettings(),
      firstUseGuideSeen: true,
    });
    mocks.state.saveData.mockResolvedValue(undefined);
    mocks.state.noteListPaths.mockReturnValue([]);
    mocks.state.noteRead.mockResolvedValue("");
    mocks.state.icsRead.mockResolvedValue("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n");
    vi.stubGlobal("navigator", { language: "en-US" });
    vi.stubGlobal("document", {
      get visibilityState() {
        return mocks.state.documentVisibilityState;
      },
    });
    vi.stubGlobal("window", {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    });
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(() => ({
      locale: "en-US",
      calendar: "gregory",
      numberingSystem: "latn",
      timeZone: mocks.state.localTimeZone,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("registers the composition root and releases every registered runtime resource", async () => {
    const existingPopoutDocument = {} as Document;
    mocks.state.workspaceAllLeaves.push({
      view: { containerEl: { ownerDocument: existingPopoutDocument } },
    });
    const plugin = createPlugin();
    await plugin.onload();

    expect(mocks.state.commands.map(({ id }) => id).sort()).toEqual([
      "jump-to-date",
      "open-calendar",
      "open-daily-note",
      "open-mini-calendar",
      "open-monthly-note",
      "open-quarterly-note",
      "open-range-note-list",
      "open-weekly-note",
      "open-yearly-note",
    ]);
    expect(mocks.state.views).toHaveLength(1);
    expect(mocks.state.ribbons).toHaveLength(1);
    expect(mocks.state.settingTabs).toHaveLength(1);
    expect(mocks.state.navbarInstances).toHaveLength(1);
    expect(mocks.state.propertiesDateDisplayInstances).toHaveLength(1);
    expect(mocks.state.propertiesDateDocumentInstances).toHaveLength(1);
    expect(mocks.state.propertiesDateDisplayInstances[0]).toMatchObject({
      initialSettings: {
        locale: "en",
        dateFormat: "system",
        timeFormat: "system",
        dateCustomFormat: "YYYY-MM-DD dddd",
        timeCustomFormat: "HH:mm",
      },
    });
    expect(mocks.state.propertiesDateDisplayInstances[0]?.addDocument).toHaveBeenCalledTimes(2);
    expect(mocks.state.propertiesDateDisplayInstances[0]?.addDocument)
      .toHaveBeenCalledWith(existingPopoutDocument);
    const openedPopoutDocument = {} as Document;
    mocks.state.workspaceCallbacks.get("window-open")?.[0]?.(
      undefined,
      { document: openedPopoutDocument },
    );
    expect(mocks.state.propertiesDateDocumentInstances[0]?.addDocument)
      .toHaveBeenCalledWith(openedPopoutDocument);
    mocks.state.workspaceCallbacks.get("window-close")?.[0]?.(
      undefined,
      { document: openedPopoutDocument },
    );
    expect(mocks.state.propertiesDateDocumentInstances[0]?.removeDocument)
      .toHaveBeenCalledWith(openedPopoutDocument);
    mocks.state.workspaceCallbacks.get("css-change")?.[0]?.();
    expect(mocks.state.propertiesDateDisplayInstances[0]?.refreshAll).toHaveBeenCalledOnce();
    expect(plugin.noteIndex).not.toBeNull();
    expect(plugin.icsEventIndex).not.toBeNull();

    const noteIndex = plugin.noteIndex;
    const icsEventIndex = plugin.icsEventIndex;
    if (noteIndex === null || icsEventIndex === null) {
      throw new Error("Expected both indexes to be composed.");
    }
    const stopNotes = vi.spyOn(noteIndex, "stop");
    const stopIcs = vi.spyOn(icsEventIndex, "stop");
    const navbar = mocks.state.navbarInstances[0];
    if (navbar === undefined) throw new Error("Expected the navbar to be composed.");

    mocks.state.layoutReadyCallbacks[0]?.();
    mocks.state.workspaceCallbacks.get("active-leaf-change")?.[0]?.();
    expect(navbar.update).toHaveBeenCalledTimes(2);

    plugin.unload();

    expect(stopNotes).toHaveBeenCalledOnce();
    expect(stopIcs).toHaveBeenCalledOnce();
    expect(navbar.unmount).toHaveBeenCalledOnce();
    expect(mocks.state.propertiesDateDisplayInstances[0]?.dispose).toHaveBeenCalledOnce();
    expect(mocks.state.propertiesDateDocumentInstances[0]?.dispose).toHaveBeenCalledOnce();
    expect(mocks.state.noteSourceUnsubscribes[0]).toHaveBeenCalledOnce();
    expect(mocks.state.removedViews).toEqual(["chrono-notes-calendar"]);
    expect(mocks.state.removedCommands).toHaveLength(mocks.state.commands.length);
    expect(mocks.state.removedRibbons).toHaveLength(1);
    expect(mocks.state.removedSettingTabs).toEqual(mocks.state.settingTabs);
    expect(mocks.state.eventUnsubscribes.every((unsubscribe) =>
      unsubscribe.mock.calls.length === 1)).toBe(true);
    expect(plugin.noteIndex).toBeNull();
    expect(plugin.icsEventIndex).toBeNull();

    mocks.state.layoutReadyCallbacks.forEach((callback) => callback());
    mocks.state.workspaceCallbacks.get("active-leaf-change")?.forEach((callback) => callback());
    mocks.state.vaultCallbacks.get("rename")?.forEach((callback) => callback());
    expect(navbar.update).toHaveBeenCalledTimes(2);
    expect(navbar.handleFileRename).not.toHaveBeenCalled();
  });

  it("opens the plugin settings root without claiming a nested range-page deep link", async () => {
    const plugin = createPlugin();
    await plugin.onload();
    plugin.openIntervalNoteList();
    const modalHost = mocks.state.intervalModalHosts[0] as {
      openRangeSettings(): void;
    } | undefined;
    if (modalHost === undefined) throw new Error("Expected the interval modal host.");

    modalHost.openRangeSettings();

    expect(mocks.state.settingsTabInstances[0]?.activate).not.toHaveBeenCalled();
    expect(openObsidianPluginSettings).toHaveBeenCalledWith(
      plugin.app,
      "chrono-notes",
    );
    plugin.unload();
  });

  it("rolls back already attached Properties documents when a later leaf fails", async () => {
    const failingDocument = {} as Document;
    mocks.state.propertiesDateDocumentFailure = failingDocument;
    mocks.state.workspaceAllLeaves.push({
      view: { containerEl: { ownerDocument: failingDocument } },
    });
    const plugin = createPlugin();

    await expect(plugin.onload()).rejects.toThrow(
      "injected Properties document setup failure",
    );

    const documents = mocks.state.propertiesDateDocumentInstances[0];
    const display = mocks.state.propertiesDateDisplayInstances[0];
    expect(documents?.addDocument).toHaveBeenCalledTimes(2);
    expect(documents?.dispose).toHaveBeenCalledOnce();
    expect(display?.dispose).toHaveBeenCalledOnce();
    expect(plugin.noteIndex).toBeNull();
    expect(plugin.icsEventIndex).toBeNull();
  });

  it("persists a migrated released configuration before composing the runtime", async () => {
    mocks.state.loadData.mockResolvedValue({
      schemaVersion: 15,
      firstUseGuideSeen: true,
      calendarOverlays: ["persian", "islamic-umalqura"],
      todoAnnotationMode: "hole",
      periodicNotes: {
        daily: {
          enabled: true,
          pattern: "'Daily'/yyyy-MM-dd/yyyy-MM-dd",
          templatePath: "",
        },
      },
    });
    const plugin = createPlugin();

    await plugin.onload();

    expect(mocks.state.saveData).toHaveBeenCalledOnce();
    expect(mocks.state.saveData).toHaveBeenCalledWith(expect.objectContaining({
      schemaVersion: 18,
      calendarExtensions: ["persian", "islamic-umalqura"],
      showTaskProgress: true,
      periodicNotes: expect.objectContaining({
        daily: expect.objectContaining({
          pattern: "[Daily]/YYYY-MM-DD/YYYY-MM-DD",
        }),
      }),
    }));
    plugin.unload();
  });

  it("keeps migrated runtime settings usable when persistence fails", async () => {
    mocks.state.loadData.mockResolvedValue({
      schemaVersion: 16,
      firstUseGuideSeen: true,
      periodicNotes: {
        weekly: {
          enabled: true,
          pattern: "'Weekly'/kkkk-'W'WW",
          templatePath: "",
        },
      },
    });
    mocks.state.saveData.mockRejectedValue(new Error("disk full"));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const plugin = createPlugin();

    await expect(plugin.onload()).resolves.toBeUndefined();

    expect(plugin.settings.schemaVersion).toBe(18);
    expect(plugin.settings.periodicNotes.weekly.pattern).toBe("[Weekly]/GGGG-[W]WW");
    expect(error).toHaveBeenCalledWith(
      "Chrono Notes Calendar: failed to persist migrated settings",
      expect.any(Error),
    );
    plugin.unload();
  });

  it("resolves Auto from Obsidian's configured language instead of the system locale", async () => {
    mocks.state.appLanguage = "ar";
    vi.stubGlobal("navigator", { language: "zh-CN" });
    const plugin = createPlugin();

    await plugin.onload();

    expect(plugin.getTranslator()).toMatchObject({
      locale: "ar",
      direction: "rtl",
    });
    plugin.unload();
  });

  it("defers indexing until layout-ready and reports a startup failure without blocking UI", async () => {
    const plugin = createPlugin();
    mocks.state.noteListPaths.mockImplementation(() => {
      throw new Error("list failed");
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await plugin.onload();
    expect(mocks.state.noteListPaths).not.toHaveBeenCalled();
    expect(mocks.state.views).toHaveLength(1);
    expect(mocks.state.commands).not.toHaveLength(0);

    mocks.state.layoutReadyCallbacks[0]?.();
    await vi.waitFor(() => expect(mocks.state.noteListPaths).toHaveBeenCalledOnce());
    expect(mocks.state.noteSourceUnsubscribes[0]).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(error).toHaveBeenCalledWith(
      "Chrono Notes Calendar: deferred indexing failed",
      expect.any(Error),
    ));
    expect(plugin.noteIndex).not.toBeNull();
    expect(plugin.icsEventIndex).not.toBeNull();

    plugin.unload();
    error.mockRestore();
  });

  it("serializes a current-Vault cache clear with a full note-index rebuild", async () => {
    mocks.state.noteListPaths.mockReturnValue(["ready.md"]);
    mocks.state.noteRead.mockResolvedValue("# Ready");
    const plugin = createPlugin();
    await plugin.onload();
    mocks.state.layoutReadyCallbacks[0]?.();
    const index = plugin.noteIndex;
    if (index === null) throw new Error("Expected a NoteIndex.");
    await vi.waitFor(() => expect(index.getSnapshot().readiness).toBe("ready"));
    const stop = vi.spyOn(index, "stop");
    const clearCache = vi.spyOn(index, "clearCacheWhileStopped");
    const start = vi.spyOn(index, "start");
    const listener = vi.fn();
    index.subscribe(listener);

    const first = plugin.rebuildNoteIndexCache();
    const second = plugin.rebuildNoteIndexCache();
    await Promise.all([first, second]);
    await plugin.rebuildNoteIndexCache();

    expect(stop).toHaveBeenCalledTimes(2);
    expect(clearCache).toHaveBeenCalledTimes(2);
    expect(start).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalled();
    expect(mocks.state.noteSourceUnsubscribes).toHaveLength(3);
    expect(mocks.state.noteSourceUnsubscribes.slice(0, 2).every(
      (unsubscribe) => unsubscribe.mock.calls.length === 1,
    )).toBe(true);
    expect(index.getSnapshot().readiness).toBe("ready");
    plugin.unload();
  });

  it("restores the source subscription when clearing the cache fails", async () => {
    const plugin = createPlugin();
    await plugin.onload();
    mocks.state.layoutReadyCallbacks[0]?.();
    const index = plugin.noteIndex;
    if (index === null) throw new Error("Expected a NoteIndex.");
    await vi.waitFor(() => expect(index.getSnapshot().readiness).toBe("ready"));
    const cacheError = new Error("clear failed");
    vi.spyOn(index, "clearCacheWhileStopped").mockRejectedValueOnce(cacheError);
    const start = vi.spyOn(index, "start");

    await expect(plugin.rebuildNoteIndexCache()).rejects.toBe(cacheError);

    expect(start).toHaveBeenCalledOnce();
    expect(index.getStatus().active).toBe(true);
    expect(index.getSnapshot().readiness).toBe("ready");
    expect(mocks.state.noteSourceUnsubscribes).toHaveLength(2);
    expect(mocks.state.noteSourceUnsubscribes[0]).toHaveBeenCalledOnce();
    plugin.unload();
  });

  it("normalizes a non-Error cache failure while restoring the index", async () => {
    const plugin = createPlugin();
    await plugin.onload();
    mocks.state.layoutReadyCallbacks[0]?.();
    const index = plugin.noteIndex;
    if (index === null) throw new Error("Expected a NoteIndex.");
    await vi.waitFor(() => expect(index.getSnapshot().readiness).toBe("ready"));
    vi.spyOn(index, "clearCacheWhileStopped").mockRejectedValueOnce("clear failed");

    await expect(plugin.rebuildNoteIndexCache()).rejects.toMatchObject({
      message: "Failed to clear NoteIndex cache",
      cause: "clear failed",
    });

    expect(index.getStatus().active).toBe(true);
    expect(mocks.state.noteSourceUnsubscribes).toHaveLength(2);
    plugin.unload();
  });

  it("retries one failed rebuild start and restores the source subscription", async () => {
    const plugin = createPlugin();
    await plugin.onload();
    mocks.state.layoutReadyCallbacks[0]?.();
    const index = plugin.noteIndex;
    if (index === null) throw new Error("Expected a NoteIndex.");
    await vi.waitFor(() => expect(index.getSnapshot().readiness).toBe("ready"));
    const startError = new Error("transient start failure");
    const start = vi.spyOn(index, "start").mockRejectedValueOnce(startError);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(plugin.rebuildNoteIndexCache()).resolves.toBeUndefined();

    expect(start).toHaveBeenCalledTimes(2);
    expect(index.getStatus().active).toBe(true);
    expect(index.getSnapshot().readiness).toBe("ready");
    expect(mocks.state.noteSourceUnsubscribes).toHaveLength(2);
    expect(consoleError).toHaveBeenCalledWith(
      "Chrono Notes Calendar: recovered a failed NoteIndex cache rebuild start",
      startError,
    );
    plugin.unload();
    consoleError.mockRestore();
  });

  it("does not restart a cache rebuild after plugin unload", async () => {
    const plugin = createPlugin();
    await plugin.onload();
    mocks.state.layoutReadyCallbacks[0]?.();
    const index = plugin.noteIndex;
    if (index === null) throw new Error("Expected a NoteIndex.");
    await vi.waitFor(() => expect(index.getSnapshot().readiness).toBe("ready"));
    const clearing = mocks.createDeferred<void>();
    vi.spyOn(index, "clearCacheWhileStopped").mockReturnValue(clearing.promise);
    const start = vi.spyOn(index, "start");

    const rebuilding = plugin.rebuildNoteIndexCache();
    await vi.waitFor(() => expect(index.getStatus().active).toBe(false));
    plugin.unload();
    clearing.resolve(undefined);
    await rebuilding;

    expect(start).not.toHaveBeenCalled();
    expect(plugin.noteIndex).toBeNull();
  });

  it("synchronizes open calendar views to the active periodic note", async () => {
    const plugin = createPlugin();
    await plugin.onload();
    plugin.settings.periodicNotes.daily = {
      enabled: true,
      pattern: "[Daily]/YYYY-MM-DD",
      templatePath: "",
    };
    plugin.settings.periodicNotes.monthly = {
      enabled: true,
      pattern: "[Monthly]/YYYY-MM",
      templatePath: "",
    };
    const registration = mocks.state.views[0];
    if (registration === undefined) throw new Error("Expected calendar view");
    mocks.state.activeFilePath = "Daily/2026-07-22.md";
    const view = registration.creator({}) as InstanceType<
      typeof mocks.MockChronoNotesView
    >;
    expect(view.syncToPeriodicNote).toHaveBeenCalledWith(
      { year: 2026, month: 7, day: 22 },
      "daily",
    );
    mocks.state.workspaceLeaves.push({ view });

    mocks.state.workspaceCallbacks.get("file-open")?.[0]?.({
      path: "Daily/2026-07-16.md",
    });
    expect(view.syncToPeriodicNote).toHaveBeenLastCalledWith(
      { year: 2026, month: 7, day: 16 },
      "daily",
    );

    mocks.state.activeFilePath = "Monthly/2026-04.md";
    mocks.state.workspaceCallbacks.get("active-leaf-change")?.[0]?.();
    expect(view.syncToPeriodicNote).toHaveBeenLastCalledWith(
      { year: 2026, month: 4, day: 1 },
      "monthly",
    );

    mocks.state.activeFilePath = "Other/note.md";
    mocks.state.workspaceCallbacks.get("file-open")?.[0]?.({
      path: "Other/note.md",
    });
    expect(view.syncToPeriodicNote).toHaveBeenCalledTimes(3);
    plugin.unload();
  });

  it("keeps deferred initial note reads stopped when they settle after unload", async () => {
    const read = mocks.createDeferred<string>();
    mocks.state.noteListPaths.mockReturnValue(["slow.md"]);
    mocks.state.noteRead.mockReturnValue(read.promise);
    const plugin = createPlugin();

    await plugin.onload();
    expect(mocks.state.noteRead).not.toHaveBeenCalled();
    mocks.state.layoutReadyCallbacks[0]?.();
    await vi.waitFor(() => expect(mocks.state.noteRead).toHaveBeenCalledWith("slow.md"));
    plugin.unload();
    read.resolve("# Late note");
    await Promise.resolve();
    await Promise.resolve();

    expect(plugin.noteIndex).toBeNull();
    expect(plugin.icsEventIndex).toBeNull();
    expect(mocks.state.removedViews).toEqual(["chrono-notes-calendar"]);
    expect(mocks.state.removedCommands).toHaveLength(mocks.state.commands.length);
    expect(mocks.state.removedSettingTabs).toEqual(mocks.state.settingTabs);
  });

  it("keeps a late ICS refresh stopped after unload", async () => {
    const read = mocks.createDeferred<string>();
    const settings = createDefaultSettings();
    settings.firstUseGuideSeen = true;
    settings.ics = { enabled: true, sources: ["late.ics"] };
    mocks.state.loadData.mockResolvedValue(settings);
    mocks.state.icsRead.mockReturnValue(read.promise);
    const plugin = createPlugin();
    await plugin.onload();

    mocks.state.layoutReadyCallbacks[0]?.();
    await vi.waitFor(() => expect(mocks.state.icsRead).toHaveBeenCalledWith("late.ics"));
    const index = plugin.icsEventIndex;
    if (index === null) throw new Error("Expected the ICS index to be composed.");
    const listener = vi.fn();
    index.subscribe(listener);
    const versionBeforeUnload = index.getSnapshot().version;

    plugin.unload();
    read.resolve("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n");
    await Promise.resolve();
    await Promise.resolve();

    expect(index.getSnapshot().version).toBe(versionBeforeUnload + 1);
    expect(index.getSnapshot()).toMatchObject({
      state: "disabled",
      enabled: false,
      eventCount: 0,
    });
    expect(listener).not.toHaveBeenCalled();
    expect(plugin.icsEventIndex).toBeNull();
  });

  it("refreshes ICS once when the app resumes in a different system time zone", async () => {
    const settings = createDefaultSettings();
    settings.firstUseGuideSeen = true;
    settings.ics = { enabled: true, sources: ["mobile.ics"] };
    mocks.state.loadData.mockResolvedValue(settings);
    const plugin = createPlugin();
    await plugin.onload();
    mocks.state.layoutReadyCallbacks[0]?.();
    const index = plugin.icsEventIndex;
    if (index === null) throw new Error("Expected the ICS index to be composed.");
    await vi.waitFor(() => expect(index.getSnapshot().state).toBe("ready"));
    const refresh = vi.spyOn(index, "refresh");
    const visibilityChange = mocks.state.domCallbacks.get("visibilitychange")?.[0];
    if (visibilityChange === undefined) {
      throw new Error("Expected an ICS visibility-change listener.");
    }

    mocks.state.documentVisibilityState = "hidden";
    mocks.state.localTimeZone = "America/Los_Angeles";
    visibilityChange({ type: "visibilitychange" } as Event);
    expect(refresh).not.toHaveBeenCalled();

    mocks.state.documentVisibilityState = "visible";
    visibilityChange({ type: "visibilitychange" } as Event);
    visibilityChange({ type: "visibilitychange" } as Event);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(refresh).toHaveBeenCalledWith({
      enabled: true,
      sources: ["mobile.ics"],
      displayZone: "America/Los_Angeles",
    });

    visibilityChange({ type: "visibilitychange" } as Event);
    expect(refresh).toHaveBeenCalledOnce();

    plugin.unload();
    expect(mocks.state.domEventUnsubscribes).toHaveLength(1);
    expect(mocks.state.domEventUnsubscribes.every((unsubscribe) =>
      unsubscribe.mock.calls.length === 1)).toBe(true);
    expect(mocks.state.domCallbacks.get("visibilitychange")).toEqual([]);

    mocks.state.localTimeZone = "Europe/London";
    visibilityChange({ type: "visibilitychange" } as Event);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("routes each successful settings impact only to its affected consumers", async () => {
    const plugin = createPlugin();
    await plugin.onload();
    plugin.openIntervalNoteList();
    const modalHost = mocks.state.intervalModalHosts[0] as {
      getSettingsRevision(): number;
      subscribeSettings(listener: () => void): () => void;
    } | undefined;
    if (modalHost === undefined) throw new Error("Expected the interval modal host.");

    const view = new mocks.MockChronoNotesView({}, {});
    mocks.state.workspaceLeaves.push({ view });
    const remainingListener = vi.fn();
    modalHost.subscribeSettings(() => {
      throw new Error("listener failed");
    });
    modalHost.subscribeSettings(remainingListener);
    const reportError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const navbar = mocks.state.navbarInstances[0];
    if (navbar === undefined) throw new Error("Expected the navbar to be composed.");
    const refreshIcs = vi.spyOn(plugin, "refreshIcs");
    const propertiesDateDisplay = mocks.state.propertiesDateDisplayInstances[0];
    if (propertiesDateDisplay === undefined) {
      throw new Error("Expected the Properties date display adapter to be composed.");
    }

    try {
      expect(modalHost.getSettingsRevision()).toBe(0);
      plugin.settings.confirmPeriodicNoteCreation = false;
      await plugin.saveSettings();
      expect(view.refresh).not.toHaveBeenCalled();
      expect(remainingListener).not.toHaveBeenCalled();
      expect(navbar.update).not.toHaveBeenCalled();
      expect(refreshIcs).not.toHaveBeenCalled();
      expect(modalHost.getSettingsRevision()).toBe(0);
      expect(propertiesDateDisplay.setSettings).not.toHaveBeenCalled();

      plugin.settings.propertyDateDisplayFormat = "dmy-slash";
      await plugin.saveSettings();
      expect(propertiesDateDisplay.setSettings).toHaveBeenCalledOnce();
      expect(propertiesDateDisplay.setSettings).toHaveBeenCalledWith({
        locale: "en",
        dateFormat: "dmy-slash",
        timeFormat: "system",
        dateCustomFormat: "YYYY-MM-DD dddd",
        timeCustomFormat: "HH:mm",
      });
      expect(view.refresh).not.toHaveBeenCalled();
      expect(remainingListener).not.toHaveBeenCalled();
      expect(navbar.update).not.toHaveBeenCalled();

      plugin.settings.showTaskProgress = false;
      await plugin.saveSettings();
      expect(view.refresh).toHaveBeenCalledOnce();
      expect(remainingListener).not.toHaveBeenCalled();
      expect(navbar.update).not.toHaveBeenCalled();
      expect(modalHost.getSettingsRevision()).toBe(0);

      plugin.settings.showNoteNavbar = false;
      await plugin.saveSettings();
      expect(view.refresh).toHaveBeenCalledOnce();
      expect(remainingListener).not.toHaveBeenCalled();
      expect(navbar.update).toHaveBeenCalledOnce();
      expect(modalHost.getSettingsRevision()).toBe(0);

      plugin.settings.rangeNotes.customFolder = "Projects";
      await plugin.saveSettings();
      expect(view.refresh).toHaveBeenCalledTimes(2);
      expect(remainingListener).toHaveBeenCalledOnce();
      expect(navbar.update).toHaveBeenCalledTimes(2);
      expect(modalHost.getSettingsRevision()).toBe(1);
      expect(reportError).toHaveBeenCalledWith(
        "Chrono Notes Calendar: listener notification failed",
        expect.any(Error),
      );

      plugin.settings.ics = { enabled: true, sources: ["team.ics"] };
      await plugin.saveSettings();
      expect(refreshIcs).toHaveBeenCalledOnce();
      expect(refreshIcs).toHaveBeenCalledWith(
        false,
        expect.objectContaining({
          ics: { enabled: true, sources: ["team.ics"] },
        }),
      );
      expect(view.refresh).toHaveBeenCalledTimes(2);
      expect(remainingListener).toHaveBeenCalledOnce();
      expect(navbar.update).toHaveBeenCalledTimes(2);
      expect(modalHost.getSettingsRevision()).toBe(1);
    } finally {
      refreshIcs.mockRestore();
      reportError.mockRestore();
      plugin.unload();
    }
  });

  it("serializes failed and succeeding saves against the last persisted snapshot", async () => {
    const plugin = createPlugin();
    await plugin.onload();
    const failedSave = mocks.createDeferred<void>();
    const successfulSave = mocks.createDeferred<void>();
    mocks.state.saveData.mockReset();
    mocks.state.saveData
      .mockReturnValueOnce(failedSave.promise)
      .mockReturnValueOnce(successfulSave.promise);
    const view = new mocks.MockChronoNotesView({}, {});
    mocks.state.workspaceLeaves.push({ view });
    const navbar = mocks.state.navbarInstances[0];
    if (navbar === undefined) throw new Error("Expected the navbar to be composed.");

    plugin.settings.showTaskProgress = false;
    const first = plugin.saveSettings();
    plugin.settings.showNoteNavbar = false;
    const second = plugin.saveSettings();
    await Promise.resolve();
    expect(mocks.state.saveData).toHaveBeenCalledOnce();

    failedSave.reject(new Error("disk full"));
    await expect(first).rejects.toThrow("disk full");
    await vi.waitFor(() => expect(mocks.state.saveData).toHaveBeenCalledTimes(2));
    expect(view.refresh).not.toHaveBeenCalled();
    expect(navbar.update).not.toHaveBeenCalled();

    successfulSave.resolve(undefined);
    await second;

    expect(view.refresh).toHaveBeenCalledOnce();
    expect(navbar.update).toHaveBeenCalledOnce();
    plugin.unload();
  });

  it("does not open the first-use guide when its save settles after unload", async () => {
    vi.useFakeTimers();
    const save = mocks.createDeferred<void>();
    mocks.state.loadData.mockResolvedValue({
      ...createDefaultSettings(),
      firstUseGuideSeen: false,
    });
    mocks.state.saveData.mockReturnValue(save.promise);
    const plugin = createPlugin();
    await plugin.onload();
    const firstUseCallback = mocks.state.layoutReadyCallbacks[0];
    if (firstUseCallback === undefined) {
      throw new Error("Expected a first-use layout-ready callback.");
    }

    firstUseCallback();
    await vi.waitFor(() => expect(mocks.state.saveData).toHaveBeenCalledOnce());
    plugin.unload();
    save.resolve(undefined);
    await Promise.resolve();
    await Promise.resolve();
    await vi.runAllTimersAsync();

    expect(mocks.state.firstUseGuideOpen).not.toHaveBeenCalled();
  });

  it("does not open the first-use guide when persisting its seen marker fails", async () => {
    vi.useFakeTimers();
    mocks.state.loadData.mockResolvedValue({
      ...createDefaultSettings(),
      firstUseGuideSeen: false,
    });
    mocks.state.saveData.mockRejectedValue(new Error("disk full"));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const plugin = createPlugin();
    await plugin.onload();
    const firstUseCallback = mocks.state.layoutReadyCallbacks[0];
    if (firstUseCallback === undefined) {
      throw new Error("Expected a first-use layout-ready callback.");
    }

    firstUseCallback();
    await vi.waitFor(() => expect(mocks.state.saveData).toHaveBeenCalledOnce());
    await vi.runAllTimersAsync();

    expect(mocks.state.firstUseGuideOpen).not.toHaveBeenCalled();
    expect(plugin.settings.firstUseGuideSeen).toBe(false);
    expect(error).toHaveBeenCalledWith(
      "Chrono Notes Calendar: failed to persist first-use guide state",
      expect.any(Error),
    );
    plugin.unload();
  });
});

function createPlugin(): ChronoNotesPlugin {
  return new ChronoNotesPlugin(
    createApp() as unknown as App,
    { id: "chrono-notes" } as PluginManifest,
  );
}

function createApp(): Record<string, unknown> {
  const addCallback = (
    callbacks: Map<string, Array<MockEventCallback>>,
    event: string,
    callback: MockEventCallback,
  ): { off(): void } => {
    const listeners = callbacks.get(event) ?? [];
    listeners.push(callback);
    callbacks.set(event, listeners);
    return mocks.createEventRef();
  };

  const workspace = {
    onLayoutReady: (callback: () => void) => {
      mocks.state.layoutReadyCallbacks.push(callback);
    },
    on: (event: string, callback: MockEventCallback) =>
      addCallback(mocks.state.workspaceCallbacks, event, callback),
    iterateAllLeaves: (
      callback: (leaf: {
        readonly view: { readonly containerEl: { readonly ownerDocument: Document } };
      }) => void,
    ) => {
      for (const leaf of mocks.state.workspaceAllLeaves) callback(leaf);
    },
    getLeavesOfType: () => mocks.state.workspaceLeaves,
    getRightLeaf: () => null,
    getLeaf: () => ({ setViewState: vi.fn() }),
    revealLeaf: vi.fn(),
    getActiveFile: () => mocks.state.activeFilePath === null
      ? null
      : { path: mocks.state.activeFilePath },
  };
  const vault = {
    adapter: {
      getResourcePath: () => "app://vault/.obsidian",
    },
    configDir: ".obsidian",
    getName: () => "Test Vault",
    on: (event: string, callback: MockEventCallback) =>
      addCallback(mocks.state.vaultCallbacks, event, callback),
    getAbstractFileByPath: () => null,
  };
  return { vault, workspace };
}

function resetCollections(): void {
  mocks.state.commands.length = 0;
  mocks.state.removedCommands.length = 0;
  mocks.state.ribbons.length = 0;
  mocks.state.removedRibbons.length = 0;
  mocks.state.views.length = 0;
  mocks.state.removedViews.length = 0;
  mocks.state.settingTabs.length = 0;
  mocks.state.removedSettingTabs.length = 0;
  mocks.state.workspaceLeaves.length = 0;
  mocks.state.workspaceAllLeaves.length = 0;
  mocks.state.layoutReadyCallbacks.length = 0;
  mocks.state.workspaceCallbacks.clear();
  mocks.state.vaultCallbacks.clear();
  mocks.state.domCallbacks.clear();
  mocks.state.domEventUnsubscribes.length = 0;
  mocks.state.documentVisibilityState = "visible";
  mocks.state.appLanguage = "en";
  mocks.state.localTimeZone = "Asia/Shanghai";
  mocks.state.activeFilePath = null;
  mocks.state.eventUnsubscribes.length = 0;
  mocks.state.noteSourceUnsubscribes.length = 0;
  mocks.state.noteEventListeners.length = 0;
  mocks.state.navbarInstances.length = 0;
  mocks.state.propertiesDateDisplayInstances.length = 0;
  mocks.state.propertiesDateDocumentInstances.length = 0;
  mocks.state.propertiesDateDocumentFailure = null;
  mocks.state.settingsTabInstances.length = 0;
  mocks.state.intervalModalHosts.length = 0;
}
