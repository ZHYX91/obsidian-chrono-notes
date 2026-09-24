export type DateContextMenuActionId =
  | "open-default"
  | "open-tab"
  | "view-events"
  | "create-range"
  | "copy-date";
export type DateContextMenuActionGroup = "note" | "calendar" | "range" | "clipboard";

export interface DateContextMenuAction {
  readonly id: DateContextMenuActionId;
  readonly group: DateContextMenuActionGroup;
  readonly icon: string;
}

export interface DateContextMenuOptions {
  readonly configured: boolean;
  readonly noteExists: boolean | null;
  readonly hasIcsEvents: boolean;
  readonly rangeConfigured: boolean;
}

export function buildDateContextMenuActions(
  options: DateContextMenuOptions,
): readonly DateContextMenuAction[] {
  const actions: DateContextMenuAction[] = [];
  if (options.configured) {
    actions.push(
      Object.freeze({
        id: "open-default",
        group: "note",
        icon: options.noteExists === null
          ? "file-question"
          : options.noteExists ? "file-text" : "square-pen",
      }),
      Object.freeze({
        id: "open-tab",
        group: "note",
        icon: "files",
      }),
    );
  }
  if (options.hasIcsEvents) {
    actions.push(Object.freeze({
      id: "view-events",
      group: "calendar",
      icon: "calendar-clock",
    }));
  }
  if (options.rangeConfigured) {
    actions.push(Object.freeze({
      id: "create-range",
      group: "range",
      icon: "calendar-range",
    }));
  }
  actions.push(Object.freeze({
    id: "copy-date",
    group: "clipboard",
    icon: "copy",
  }));
  return Object.freeze(actions);
}
