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
                  embeds: {
                    imageCount: 2,
                    pdfCount: 1,
                    audioCount: 0,
                    videoCount: 0,
                    noteCount: 1,
                    otherCount: 0,
                  },
                  calendarExtensions: [
                    {
                      id: "chinese-lunar",
                      dateText: "Lunar 5/23",
                      events: [],
                      transition: null,
                      accessibilityText: "Lunar month 5, day 23",
                    },
                    {
                      id: "ganzhi",
                      dateText: "M YiWei",
                      events: [],
                      transition: "month",
                      accessibilityText:
                        "Year BingWu, month YiWei, day RenWu",
                    },
                  ],
                  calendarEvents: [{
                    id: "solar-term:小暑",
                    kind: "solar-term",
                    text: "Minor Heat",
                    sources: [
                      { id: "chinese-lunar", transitionTime: null },
                      { id: "ganzhi", transitionTime: "09:56" },
                    ],
                  }],
                  icsEvents: [{
                    id: "team-sync",
                    title: "Team sync",
                    source: "team.ics",
                    sourceLabel: "Team",
                    isAllDay: true,
                    startsOnDate: true,
                    endsOnDate: true,
                    continuesBefore: false,
                    continuesAfter: false,
                    timeLabel: null,
                    sortTimestamp: 0,
                  }],
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
    expect(secondaryDocument.querySelector("#owner-preview")?.textContent)
      .toContain("Lunar month 5, day 23");
    expect(secondaryDocument.querySelector("#owner-preview")?.textContent)
      .toContain("Year BingWu, month YiWei, day RenWu");
    expect(secondaryDocument.querySelector("#owner-preview")?.textContent)
      .toContain(
        "Minor Heat; sources: Chinese lunar calendar, Ganzhi calendar (transition 09:56)",
      );
    expect(secondaryDocument.querySelector("#owner-preview")?.textContent)
      .toContain("Team sync");
    expect(secondaryDocument.querySelector("#owner-preview")?.textContent)
      .toContain("Images 2 · PDFs 1 · Embedded notes 1");
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
