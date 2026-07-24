// @vitest-environment happy-dom

import { Window } from "happy-dom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CalendarPreviewTooltip } from "../../src/ui/calendar/calendar-preview-tooltip";
import { HostEnvironmentProvider } from "../../src/ui/host-environment";
import { createTranslator } from "../../src/shared/i18n";

describe("HostEnvironmentProvider", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("keeps calendar portals and listeners inside the owner document", async () => {
    const secondaryWindow = new Window();
    const secondaryDocument = secondaryWindow.document;
    const container = secondaryDocument.createElement("div");
    const anchor = secondaryDocument.createElement("button");
    secondaryDocument.body.append(container, anchor);
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue(
      new secondaryWindow.DOMRect(20, 20, 20, 20),
    );
    const ownerAddEventListener = vi.spyOn(secondaryWindow, "addEventListener");
    const primaryAddEventListener = vi.spyOn(window, "addEventListener");
    const root = createRoot(container as unknown as HTMLElement);

    await act(async () => {
      root.render(
        createElement(
          HostEnvironmentProvider,
          {
            document: secondaryDocument as unknown as Document,
            children: createElement(CalendarPreviewTooltip, {
              id: "owner-preview",
              preview: {
                key: "2026-07-23",
                anchor: anchor as unknown as HTMLElement,
                cell: {
                  noteState: "missing",
                  preview: null,
                  statistics: {
                    linkCount: 0,
                    tagCount: 0,
                    taskCompleted: 0,
                    taskCompletionRate: 0,
                    taskTotal: 0,
                    wordCount: 0,
                  },
                },
              },
              translator: createTranslator("en", "en"),
            }),
          },
        ),
      );
    });

    expect(secondaryDocument.querySelector("#owner-preview")).not.toBeNull();
    expect(document.querySelector("#owner-preview")).toBeNull();
    expect(ownerAddEventListener).toHaveBeenCalledWith(
      "resize",
      expect.any(Function),
    );
    expect(primaryAddEventListener).not.toHaveBeenCalledWith(
      "resize",
      expect.any(Function),
    );

    await act(async () => root.unmount());
    expect(secondaryDocument.querySelector("#owner-preview")).toBeNull();
  });
});
