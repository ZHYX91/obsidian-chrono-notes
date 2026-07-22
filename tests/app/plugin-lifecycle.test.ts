import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    layoutReadyCallbacks: [] as Array<() => void>,
    workspaceCallbacks: new Map<string, Array<() => void>>(),
    vaultCallbacks: new Map<string, Array<() => void>>(),
    domCallbacks: new Map<string, Array<EventListener>>(),
    domEventUnsubscribes: [] as Array<ReturnType<typeof vi.fn>>,
    documentVisibilityState: "visible" as DocumentVisibilityState,
    localTimeZone: "Asia/Shanghai",
    eventUnsubscribes: [] as Array<ReturnType<typeof vi.fn>>,
    noteSourceUnsubscribes: [] as Array<ReturnType<typeof vi.fn>>,
    noteEventListeners: [] as Array<(event: unknown) => void>,
    navbarInstances: [] as MockNoteNavbarManager[],
    settingsTabInstances: [] as MockSettingsTab[],
    intervalModalHosts: [] as unknown[],
    firstUseGuideOpen: vi.fn(),
    loadData: vi.fn<() => Promise<unknown>>(),
    saveData: vi.fn<(data: unknown) => Promise<void>>(),
    noteListPaths: vi.fn<() => readonly string[]>(),
    noteRead: vi.fn<(path: string) => Promise<string>>(),
    icsRead: vi.fn<(source: string) => Promise<string>>(),
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
  };
});

vi.mock("obsidian", () => ({
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
    ObsidianPeriodicNoteTemplatePort: MockPort,
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

import ChronoNotesPlugin from "../../src/app/plugin";
import { createDefaultSettings } from "../../src/shared/settings";

describe("ChronoNotesPlugin lifecycle composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCollections();
    mocks.state.loadData.mockResolvedValue({ firstUseGuideSeen: true });
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
      "Chrono Notes: deferred indexing failed",
      expect.any(Error),
    ));
    expect(plugin.noteIndex).not.toBeNull();
    expect(plugin.icsEventIndex).not.toBeNull();

    plugin.unload();
    error.mockRestore();
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
    expect(mocks.state.domEventUnsubscribes).toHaveLength(2);
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

    try {
      expect(modalHost.getSettingsRevision()).toBe(0);
      plugin.settings.confirmPeriodicNoteCreation = false;
      await plugin.saveSettings();
      expect(view.refresh).not.toHaveBeenCalled();
      expect(remainingListener).not.toHaveBeenCalled();
      expect(navbar.update).not.toHaveBeenCalled();
      expect(refreshIcs).not.toHaveBeenCalled();
      expect(modalHost.getSettingsRevision()).toBe(0);

      plugin.settings.todoAnnotationMode = "color";
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
        "Chrono Notes: listener notification failed",
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

    plugin.settings.todoAnnotationMode = "color";
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
    mocks.state.loadData.mockResolvedValue({ firstUseGuideSeen: false });
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
    mocks.state.loadData.mockResolvedValue({ firstUseGuideSeen: false });
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
      "Chrono Notes: failed to persist first-use guide state",
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
    callbacks: Map<string, Array<() => void>>,
    event: string,
    callback: () => void,
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
    on: (event: string, callback: () => void) =>
      addCallback(mocks.state.workspaceCallbacks, event, callback),
    getLeavesOfType: () => mocks.state.workspaceLeaves,
    getRightLeaf: () => null,
    getLeaf: () => ({ setViewState: vi.fn() }),
    revealLeaf: vi.fn(),
    getActiveFile: () => null,
  };
  const vault = {
    on: (event: string, callback: () => void) =>
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
  mocks.state.layoutReadyCallbacks.length = 0;
  mocks.state.workspaceCallbacks.clear();
  mocks.state.vaultCallbacks.clear();
  mocks.state.domCallbacks.clear();
  mocks.state.domEventUnsubscribes.length = 0;
  mocks.state.documentVisibilityState = "visible";
  mocks.state.localTimeZone = "Asia/Shanghai";
  mocks.state.eventUnsubscribes.length = 0;
  mocks.state.noteSourceUnsubscribes.length = 0;
  mocks.state.noteEventListeners.length = 0;
  mocks.state.navbarInstances.length = 0;
  mocks.state.settingsTabInstances.length = 0;
  mocks.state.intervalModalHosts.length = 0;
}
