import { beforeEach, describe, expect, it, vi } from "vitest";

import { showObsidianDateContextMenu } from "../../../src/adapters/obsidian/obsidian-date-context-menu";
import { createTranslator } from "../../../src/shared/i18n";

const obsidianMocks = vi.hoisted(() => {
  const item = {
    setTitle: vi.fn(),
    setIcon: vi.fn(),
    onClick: vi.fn(),
  };
  const menu = {
    setUseNativeMenu: vi.fn(),
    addItem: vi.fn(),
    addSeparator: vi.fn(),
    showAtMouseEvent: vi.fn(),
  };

  item.setTitle.mockReturnValue(item);
  item.setIcon.mockReturnValue(item);
  item.onClick.mockReturnValue(item);
  menu.setUseNativeMenu.mockReturnValue(menu);
  menu.addItem.mockImplementation((configure) => {
    configure(item);
    return menu;
  });
  menu.addSeparator.mockReturnValue(menu);
  menu.showAtMouseEvent.mockReturnValue(menu);

  return {
    forEvent: vi.fn(() => menu),
    item,
    menu,
    notice: vi.fn(),
  };
});

vi.mock("obsidian", () => ({
  Menu: {
    forEvent: obsidianMocks.forEvent,
  },
  Notice: obsidianMocks.notice,
}));

describe("showObsidianDateContextMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the visible Obsidian menu while preserving action groups and icons", () => {
    const event = {} as MouseEvent;

    showObsidianDateContextMenu({
      event,
      date: { year: 2026, month: 7, day: 19 },
      configured: true,
      noteExists: false,
      rangeConfigured: true,
      translator: createTranslator("en", "en"),
      onOpenDaily: vi.fn(),
      onCreateRange: vi.fn(),
    });

    expect(obsidianMocks.forEvent).toHaveBeenCalledWith(event);
    expect(obsidianMocks.menu.setUseNativeMenu).toHaveBeenCalledWith(false);
    expect(obsidianMocks.menu.addItem).toHaveBeenCalledTimes(4);
    expect(obsidianMocks.menu.addSeparator).toHaveBeenCalledTimes(2);
    expect(obsidianMocks.item.setIcon.mock.calls.map(([icon]) => icon)).toEqual([
      "square-pen",
      "files",
      "calendar-range",
      "copy",
    ]);
    expect(obsidianMocks.menu.showAtMouseEvent).toHaveBeenCalledWith(event);
  });
});
