import { useEffect, useRef, type RefObject } from "react";

import { useHostEnvironment } from "../host-environment";

export function useCalendarPickerDialog(
  anchorRef: RefObject<HTMLElement>,
  onClose: () => void,
  scrollSelected = false,
): RefObject<HTMLDivElement> {
  const host = useHostEnvironment();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const activeElement = host.document.activeElement as HTMLElement | null;
    const previousFocus = activeElement !== null &&
      typeof activeElement.focus === "function"
      ? activeElement
      : null;
    const root = rootRef.current;
    const selected = root?.querySelector<HTMLElement>('[data-selected="true"]');
    (selected ?? root?.querySelector<HTMLElement>("button"))?.focus();
    if (scrollSelected) {
      selected?.scrollIntoView({ block: "center" });
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      if (anchorRef.current?.contains(event.target as Node)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    host.document.addEventListener("pointerdown", handlePointerDown);
    host.document.addEventListener("keydown", handleKeyDown);
    return () => {
      host.document.removeEventListener("pointerdown", handlePointerDown);
      host.document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus !== null && host.document.contains(previousFocus)) {
        previousFocus.focus();
      }
    };
  }, [anchorRef, host.document, host.window, onClose, scrollSelected]);

  return rootRef;
}
