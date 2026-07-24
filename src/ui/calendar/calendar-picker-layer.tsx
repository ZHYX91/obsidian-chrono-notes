import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { useHostEnvironment } from "../host-environment";

export interface CalendarPickerModalSession {
  readonly mount: HTMLElement;
  close(): void;
}

export interface CalendarPickerModalHost {
  open(
    title: string,
    onRequestClose: () => void,
  ): CalendarPickerModalSession;
}

interface CalendarPickerLayerProps {
  readonly modalHost: CalendarPickerModalHost | undefined;
  readonly children: ReactNode;
  readonly title: string;
  readonly onClose: () => void;
}

export function CalendarPickerLayer({
  modalHost,
  children,
  title,
  onClose,
}: CalendarPickerLayerProps) {
  const host = useHostEnvironment();
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const useModal = modalHost !== undefined &&
    host.document.body.hasClass("is-mobile");

  useEffect(() => {
    if (!useModal || modalHost === undefined) return undefined;
    const session = modalHost.open(title, () => onCloseRef.current());
    setMount(session.mount);
    return () => session.close();
  }, [modalHost, title, useModal]);

  if (!useModal) return children;
  return mount === null ? null : createPortal(children, mount);
}
