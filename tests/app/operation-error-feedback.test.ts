import { describe, expect, it } from "vitest";

import { formatPeriodicCascadeNotice, formatPluginErrorNotice } from "../../src/app/plugin-presentation";
import { IcsEventIndex } from "../../src/features/calendar/ics-event-index";
import { createTranslator } from "../../src/shared/i18n";
import { OperationError } from "../../src/shared/operation-error";
import { formatIcsSourceStatus } from "../../src/ui/settings/settings-presentation";

describe("localized operation failure feedback", () => {
  it("keeps ICS failure details independent from the interface language", async () => {
    const error = new OperationError(
      "icsVaultFileRequired", "Local ICS files require desktop filesystem access",
    );
    const index = new IcsEventIndex({ read: async () => { throw error; } });
    await index.refresh({ enabled: true, sources: ["/outside/team.ics"], displayZone: "UTC" });
    const snapshot = index.getSnapshot();
    const status = snapshot.sourceStatuses[0]!;
    expect(status.error).toBe(error.message);
    expect(status.errorDetails).toEqual({ code: "icsVaultFileRequired" });
    expect(snapshot.errors).toEqual([`team.ics: ${error.message}`]);
    const chinese = formatIcsSourceStatus(status, createTranslator("zh-CN", "en").t);
    const english = formatIcsSourceStatus(status, createTranslator("en", "en").t);
    expect(chinese).toContain("Calendars/team.ics");
    expect(chinese).toContain(error.message);
    expect(english).toContain(error.message);
    expect(chinese).not.toBe(english);
    index.stop();
  });

  it("shows actionable template feedback for direct and partial cascade failures", () => {
    const cause = new OperationError("templateMissing", "Template note not found: Templates/Daily.md", {
      path: "Templates/Daily.md",
    });
    const error = new Error(`Failed to create note: ${cause.message}`, { cause });
    const t = createTranslator("zh-CN", "en").t;
    const direct = formatPluginErrorNotice(error, t);
    expect(direct).toContain("找不到模板文件");
    expect(direct).toContain(error.message);
    const cascade = formatPeriodicCascadeNotice({
      status: "opened", path: "Daily/2026-10-17.md", created: true,
      cascade: [{
        status: "failed", noteType: "weekly", path: "Weekly/2026-W42.md",
        error: { name: error.name, message: error.message, details: cause.details },
      }],
    }, t);
    expect(cascade).toContain("找不到模板文件");
    expect(cascade).toContain(error.message);
  });
});
