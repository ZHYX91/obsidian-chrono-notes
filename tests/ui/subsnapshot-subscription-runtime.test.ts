import { Window } from "happy-dom";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const selectorSpies = vi.hoisted(() => ({
  intervalList: vi.fn(),
  navbar: vi.fn(),
}));
const runtimeMocks = vi.hoisted(() => ({
  MarkdownView: class MarkdownView {},
}));

vi.mock("obsidian", () => {
  class Modal {
    readonly titleEl = createObsidianElement("div");
    readonly contentEl = createObsidianElement("div");

    constructor(_app: unknown) {}
  }

  return { MarkdownView: runtimeMocks.MarkdownView, Modal };
});

vi.mock("../../src/features/periodic/note-navbar-query", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../src/features/periodic/note-navbar-query")
  >();
  return {
    ...actual,
    selectNoteNavbarContextFromProjection: (
      ...args: Parameters<typeof actual.selectNoteNavbarContextFromProjection>
    ) => {
      selectorSpies.navbar();
      return actual.selectNoteNavbarContextFromProjection(...args);
    },
  };
});

vi.mock("../../src/features/intervals/interval-note-query", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../src/features/intervals/interval-note-query")
  >();
  return {
    ...actual,
    selectIntervalNotesFromProjection: (
      ...args: Parameters<typeof actual.selectIntervalNotesFromProjection>
    ) => {
      selectorSpies.intervalList();
      return actual.selectIntervalNotesFromProjection(...args);
    },
  };
});

vi.mock("../../src/ui/use-local-today", () => ({
  useLocalToday: () => Object.freeze({ year: 2026, month: 7, day: 20 }),
}));

import type { NoteIndex, NoteIndexSnapshot } from "../../src/features/notes/note-index";
import { createTranslator } from "../../src/shared/i18n";
import { createDefaultSettings } from "../../src/shared/settings";
import { IntervalNoteListModal } from "../../src/ui/modals/interval-note-list-modal";
import { NoteNavbarManager } from "../../src/ui/note-navbar/note-navbar";
import {
  createNoteIndexSnapshot,
  createParsedNoteIndexSnapshot,
} from "../support/note-index-snapshot";

describe("React sub-snapshot subscriptions", () => {
  beforeEach(() => {
    selectorSpies.intervalList.mockClear();
    selectorSpies.navbar.mockClear();
    const testWindow = new Window();
    vi.stubGlobal("window", testWindow);
    vi.stubGlobal("document", testWindow.document);
    vi.stubGlobal("navigator", testWindow.navigator);
    vi.stubGlobal("HTMLElement", testWindow.HTMLElement);
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    document.body.replaceChildren();
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    vi.unstubAllGlobals();
  });

  it("does not rerender Navbar for an ordinary note and unsubscribes on unmount", async () => {
    const settings = createDefaultSettings();
    settings.periodicNotes.weekly = {
      enabled: true,
      pattern: "'Weekly'/kkkk-WW",
      templatePath: "",
    };
    settings.rangeNotes.scanScope = "entire-vault";
    const noteIndex = new MutableNoteIndex(createNoteIndexSnapshot({}, 1));
    const viewContainer = document.createElement("div");
    const content = document.createElement("div");
    content.className = "view-content";
    viewContainer.append(content);
    document.body.append(viewContainer);
    const view = Object.assign(new runtimeMocks.MarkdownView(), {
      file: { path: "Weekly/2026-30.md" },
      containerEl: viewContainer,
      contentEl: content,
    });
    const leaf = { view };
    const manager = new NoteNavbarManager(
      { workspace: { getLeavesOfType: () => [leaf] } } as never,
      {
        noteIndex: noteIndex as unknown as NoteIndex,
        getSettings: () => settings,
        openPeriodic: vi.fn(async () => undefined),
        openCalendar: vi.fn(async () => undefined),
        openPath: vi.fn(async () => undefined),
        setRelatedCollapsed: vi.fn(async () => undefined),
        pickDate: vi.fn(),
      },
    );

    await act(async () => manager.update());
    const initialSelectorCalls = selectorSpies.navbar.mock.calls.length;
    expect(initialSelectorCalls).toBeGreaterThan(0);
    expect(noteIndex.listenerCount).toBe(1);

    await act(async () => noteIndex.publish(createOrdinaryNoteSnapshot(
      noteIndex.getSnapshot(),
      2,
    )));

    expect(selectorSpies.navbar).toHaveBeenCalledTimes(initialSelectorCalls);

    await act(async () => noteIndex.publish(createIntervalSnapshot(3)));
    expect(selectorSpies.navbar.mock.calls.length).toBeGreaterThan(initialSelectorCalls);

    await act(async () => manager.unmount());
    const callsAfterUnmount = selectorSpies.navbar.mock.calls.length;
    expect(noteIndex.listenerCount).toBe(0);

    noteIndex.publish(createIntervalSnapshot(4));
    expect(selectorSpies.navbar).toHaveBeenCalledTimes(callsAfterUnmount);
  });

  it("does not recompute the interval list for an ordinary note and unsubscribes on close", async () => {
    const settings = createDefaultSettings();
    settings.rangeNotes.folder = "Ranges";
    settings.rangeNotes.scanScope = "entire-vault";
    const noteIndex = new MutableNoteIndex(createNoteIndexSnapshot({}, 1));
    const settingsListeners = new Set<() => void>();
    const modal = new IntervalNoteListModal(
      {} as never,
      {
        noteIndex: noteIndex as unknown as NoteIndex,
        getSettings: () => settings,
        getSettingsRevision: () => 0,
        subscribeSettings: (listener) => {
          settingsListeners.add(listener);
          return () => settingsListeners.delete(listener);
        },
        openPath: vi.fn(async () => undefined),
        createRange: vi.fn(),
        folderExists: () => true,
        openRangeSettings: vi.fn(),
      },
      createTranslator("en", "en-US"),
    );

    await act(async () => modal.onOpen());
    const initialSelectorCalls = selectorSpies.intervalList.mock.calls.length;
    expect(initialSelectorCalls).toBeGreaterThan(0);
    expect(noteIndex.listenerCount).toBe(1);
    expect(settingsListeners.size).toBe(1);

    await act(async () => noteIndex.publish(createOrdinaryNoteSnapshot(
      noteIndex.getSnapshot(),
      2,
    )));

    expect(selectorSpies.intervalList).toHaveBeenCalledTimes(initialSelectorCalls);

    await act(async () => noteIndex.publish(createIntervalSnapshot(3)));
    expect(selectorSpies.intervalList.mock.calls.length).toBeGreaterThan(initialSelectorCalls);

    await act(async () => modal.onClose());
    const callsAfterClose = selectorSpies.intervalList.mock.calls.length;
    expect(noteIndex.listenerCount).toBe(0);
    expect(settingsListeners.size).toBe(0);

    noteIndex.publish(createIntervalSnapshot(4));
    expect(selectorSpies.intervalList).toHaveBeenCalledTimes(callsAfterClose);
  });
});

class MutableNoteIndex {
  private readonly listeners = new Set<() => void>();

  constructor(private snapshot: NoteIndexSnapshot) {}

  get listenerCount(): number {
    return this.listeners.size;
  }

  getSnapshot = (): NoteIndexSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  publish(snapshot: NoteIndexSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of [...this.listeners]) listener();
  }
}

function createOrdinaryNoteSnapshot(
  previous: NoteIndexSnapshot,
  version: number,
): NoteIndexSnapshot {
  const next = createParsedNoteIndexSnapshot({
    "Notes/ordinary.md": "Ordinary note update",
  }, version);
  return Object.freeze({
    ...next,
    intervals: previous.intervals,
  });
}

function createIntervalSnapshot(version: number): NoteIndexSnapshot {
  return createParsedNoteIndexSnapshot({
    "Ranges/current.md": [
      "---",
      "start: 2026-07-20",
      "end: 2026-07-22",
      "---",
      "Current range",
    ].join("\n"),
  }, version);
}

function createObsidianElement(tagName: string): HTMLElement {
  const element = document.createElement(tagName) as HTMLElement & {
    addClass(className: string): void;
    createDiv(): HTMLDivElement;
    empty(): void;
    setText(text: string): void;
  };
  element.addClass = (className) => element.classList.add(className);
  element.createDiv = () => {
    const child = createObsidianElement("div") as HTMLDivElement;
    element.append(child);
    return child;
  };
  element.empty = () => element.replaceChildren();
  element.setText = (text) => {
    element.textContent = typeof text === "string" ? text : text.textContent;
  };
  return element;
}
