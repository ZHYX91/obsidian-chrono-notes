import { useEffect, useRef, type RefObject } from "react";

export function useCalendarPickerDialog(
  anchorRef: RefObject<HTMLElement>,
  onClose: () => void,
  scrollSelected = false,
): RefObject<HTMLDivElement> {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
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
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus !== null && document.contains(previousFocus)) {
        previousFocus.focus();
      }
    };
  }, [anchorRef, onClose, scrollSelected]);

  return rootRef;
}
