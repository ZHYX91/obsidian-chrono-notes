// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatLocalDateKey } from "../../src/core/periodic/periodic-date";
import { useLocalToday } from "../../src/ui/use-local-today";

describe("useLocalToday", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("updates at the next local midnight", async () => {
    vi.setSystemTime(new Date(2026, 6, 18, 23, 59, 59, 900));
    await renderProbe(root);
    expect(container.textContent).toBe("2026-07-18");

    await act(async () => vi.advanceTimersByTime(100));
    expect(container.textContent).toBe("2026-07-19");
  });

  it("recalibrates when the document becomes visible", async () => {
    vi.setSystemTime(new Date(2026, 6, 18, 12));
    await renderProbe(root);
    expect(container.textContent).toBe("2026-07-18");

    vi.setSystemTime(new Date(2026, 6, 19, 12));
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(container.textContent).toBe("2026-07-19");
  });
});

async function renderProbe(root: Root): Promise<void> {
  await act(async () => {
    root.render(createElement(TodayProbe));
  });
}

function TodayProbe() {
  return createElement("span", null, formatLocalDateKey(useLocalToday()));
}
