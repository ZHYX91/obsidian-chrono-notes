import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createRoot: vi.fn(),
  render: vi.fn(),
  unmount: vi.fn(),
  calendarApp: vi.fn(),
}));

vi.mock("obsidian", () => ({
  ItemView: class {
    readonly contentEl = {
      empty: vi.fn(),
      addClass: vi.fn(),
    };

    constructor(readonly leaf: unknown) {}
  },
}));

vi.mock("react-dom/client", () => ({
  createRoot: mocks.createRoot,
}));

vi.mock("../../src/ui/modals/calendar-picker-modal-host", () => ({
  createCalendarPickerModalHost: vi.fn(() => ({ open: vi.fn() })),
}));

vi.mock("../../src/ui/calendar/calendar-app", () => ({
  CalendarApp: mocks.calendarApp,
}));

import type { WorkspaceLeaf } from "obsidian";

import { ChronoNotesView } from "../../src/ui/calendar/chrono-notes-view";

describe("ChronoNotesView React root lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createRoot.mockReturnValue({
      render: mocks.render,
      unmount: mocks.unmount,
    });
  });

  it("mounts one root, renders navigation updates, and never renders after close", async () => {
    const view = new ChronoNotesView({} as WorkspaceLeaf, createHost());

    await view.onOpen();
    expect(mocks.createRoot).toHaveBeenCalledOnce();
    expect(mocks.render).toHaveBeenCalledOnce();

    view.jumpToDate({ year: 2026, month: 7, day: 20 });
    expect(mocks.render).toHaveBeenCalledTimes(2);
    expect(getNavigationRequest()).toEqual({
      revision: 1,
      date: { year: 2026, month: 7, day: 20 },
      noteType: "daily",
      mode: "jump",
    });

    view.syncToPeriodicNote(
      { year: 2026, month: 4, day: 18 },
      "quarterly",
    );
    expect(mocks.render).toHaveBeenCalledTimes(3);
    expect(getNavigationRequest()).toEqual({
      revision: 2,
      date: { year: 2026, month: 4, day: 18 },
      noteType: "quarterly",
      mode: "sync",
    });

    await view.onClose();
    expect(mocks.unmount).toHaveBeenCalledOnce();

    view.refresh();
    view.jumpToDate({ year: 2026, month: 7, day: 21 });
    view.syncToPeriodicNote({ year: 2026, month: 7, day: 1 }, "monthly");
    expect(mocks.render).toHaveBeenCalledTimes(3);
    expect(mocks.unmount).toHaveBeenCalledOnce();
  });
});

function getNavigationRequest(): unknown {
  const element = mocks.render.mock.calls.at(-1)?.[0] as
    | { readonly props?: { readonly navigationRequest?: unknown } }
    | undefined;
  return element?.props?.navigationRequest;
}

function createHost(): ConstructorParameters<typeof ChronoNotesView>[1] {
  return {
    noteIndex: {} as never,
    icsEventIndex: {} as never,
    getSettings: vi.fn(),
    openPeriodic: vi.fn(),
    setYearHeatmap: vi.fn(),
    setStatisticDimension: vi.fn(),
    openPath: vi.fn(),
    createRange: vi.fn(),
    toggleTask: vi.fn(),
    rescheduleTask: vi.fn(),
    openTaskSource: vi.fn(),
    openDateContextMenu: vi.fn(),
  };
}
