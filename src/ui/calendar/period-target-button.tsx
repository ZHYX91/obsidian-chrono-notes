import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import type { LocalDate, PeriodicNoteType } from "../../core/periodic/periodic-date";
import type { NoteOpenTarget } from "../../features/periodic/periodic-note-commands";
import { resolvePeriodPickerAction, resolvePeriodPickerKeyboardAction } from "./calendar-period-picker";

interface PeriodTargetButtonProps {
  readonly ariaLabel: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly current: boolean;
  readonly date: LocalDate;
  readonly noteType: PeriodicNoteType;
  readonly tabIndex?: number;
  readonly onFocus?: () => void;
  readonly onNavigate?: (event: KeyboardEvent<HTMLButtonElement>) => void;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly onOpen?: (
    date: LocalDate,
    noteType: PeriodicNoteType,
    target: NoteOpenTarget,
  ) => Promise<void>;
  readonly onClose?: () => void;
}

export function PeriodTargetButton(props: PeriodTargetButtonProps) {
  const {
    ariaLabel,
    children,
    className = "",
    current,
    date,
    noteType,
    onClose,
    onOpen,
    onSelect,
    selected,
    tabIndex,
    onFocus,
    onNavigate,
  } = props;

  const runAction = (action: ReturnType<typeof resolvePeriodPickerAction>) => {
    if (action === "select" || (action !== "ignore" && onOpen === undefined)) {
      onSelect();
    } else if (action === "open-default" || action === "open-tab") {
      onClose?.();
      void onOpen?.(date, noteType, action === "open-tab" ? "tab" : "default");
    }
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    const action = resolvePeriodPickerAction(event);
    if (action === "open-tab") event.preventDefault();
    runAction(action);
  };
  const handleAuxClick = (event: MouseEvent<HTMLButtonElement>) => {
    const action = resolvePeriodPickerAction(event);
    if (action !== "ignore") event.preventDefault();
    runAction(action);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    onNavigate?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "Enter" && (onOpen === undefined || (!event.ctrlKey && !event.metaKey && !event.shiftKey))) {
      event.preventDefault();
      onSelect();
      return;
    }
    const action = resolvePeriodPickerKeyboardAction(event);
    if (action === null) return;
    event.preventDefault();
    onClose?.();
    void onOpen?.(
      date,
      noteType,
      action === "open-tab" ? "tab" : "default",
    );
  };

  return (
    <button
      type="button"
      className={[
        className,
        current ? "is-current" : "",
        selected ? "is-selected" : "",
      ].filter(Boolean).join(" ")}
      data-selected={String(selected)}
      aria-current={current ? "true" : undefined}
      aria-label={ariaLabel}
      aria-pressed={selected}
      tabIndex={tabIndex}
      onFocus={onFocus}
      onClick={handleClick}
      onAuxClick={handleAuxClick}
      onMouseDown={(event) => {
        if (event.button === 1) event.preventDefault();
      }}
      onKeyDown={handleKeyDown}
    >
      {children}
    </button>
  );
}
