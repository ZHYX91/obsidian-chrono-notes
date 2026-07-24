import { Window } from "happy-dom";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { HostEnvironmentProvider } from "../../src/ui/host-environment";

export function renderWithTestHost(element: ReactElement): string {
  const ownerWindow = new Window();
  return renderToStaticMarkup(
    createElement(
      HostEnvironmentProvider,
      {
        children: element,
        document: ownerWindow.document as unknown as Document,
      },
    ),
  );
}
