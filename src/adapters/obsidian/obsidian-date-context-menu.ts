import { Menu, Notice } from "obsidian";

import {
  formatLocalDateKey,
  type LocalDate,
} from "../../core/periodic/periodic-date";
import {
  buildDateContextMenuActions,
  type DateContextMenuActionGroup,
} from "../../features/calendar/date-context-menu";
import type { NoteOpenTarget } from "../../features/periodic/periodic-note-commands";
import type { Translator } from "../../shared/i18n";
import {
  formatCopiedDateNotice,
  getCopyDateFailedNotice,
  getDateContextMenuActionLabel,
} from "./date-context-menu-presentation";

export interface ObsidianDateContextMenuOptions {
  readonly event: MouseEvent;
  readonly date: LocalDate;
  readonly configured: boolean;
  readonly noteExists: boolean;
  readonly rangeConfigured: boolean;
  readonly translator: Translator;
  readonly onOpenDaily: (target: NoteOpenTarget) => Promise<void>;
  readonly onCreateRange: () => void;
}

export function showObsidianDateContextMenu(options: ObsidianDateContextMenuOptions): void {
  const actions = buildDateContextMenuActions(options);
  const menu = Menu.forEvent(options.event).setUseNativeMenu(false);
  let previousGroup: DateContextMenuActionGroup | null = null;

  for (const action of actions) {
    if (previousGroup !== null && action.group !== previousGroup) menu.addSeparator();
    previousGroup = action.group;
    menu.addItem((item) => {
      item
        .setTitle(getDateContextMenuActionLabel(
          action.id,
          options.noteExists,
          options.translator.t,
        ))
        .setIcon(action.icon)
        .onClick(() => {
          switch (action.id) {
            case "open-default":
              void options.onOpenDaily("default");
              break;
            case "open-tab":
              void options.onOpenDaily("tab");
              break;
            case "create-range":
              options.onCreateRange();
              break;
            case "copy-date":
              void copyDate(options.date, options.translator.t);
              break;
          }
        });
    });
  }
  menu.showAtMouseEvent(options.event);
}

async function copyDate(date: LocalDate, t: Translator["t"]): Promise<void> {
  const formatted = formatLocalDateKey(date);
  try {
    await navigator.clipboard.writeText(formatted);
    new Notice(formatCopiedDateNotice(formatted, t));
  } catch {
    new Notice(getCopyDateFailedNotice(t));
  }
}
