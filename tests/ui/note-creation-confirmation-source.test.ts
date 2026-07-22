import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const periodicModalSource = readFileSync(
  new URL("../../src/ui/modals/confirm-periodic-note-modal.ts", import.meta.url),
  "utf8",
);
const intervalModalSource = readFileSync(
  new URL("../../src/ui/modals/confirm-interval-note-modal.ts", import.meta.url),
  "utf8",
);
const pluginSource = readFileSync(
  new URL("../../src/app/plugin.ts", import.meta.url),
  "utf8",
);
const periodicSettingsSource = readFileSync(
  new URL("../../src/ui/settings/periodic-settings-section.ts", import.meta.url),
  "utf8",
);
const rangeSettingsSource = readFileSync(
  new URL("../../src/ui/settings/range-settings-section.ts", import.meta.url),
  "utf8",
);

describe("note creation confirmation wiring", () => {
  it("starts both modal suppression options cleared", () => {
    for (const source of [periodicModalSource, intervalModalSource]) {
      expect(source).toContain("private suppressFutureConfirmation = false;");
      expect(source).toContain("toggle.setValue(false).onChange");
    }
    expect(periodicModalSource).toContain("messages.suppressFuturePeriodicConfirmation");
    expect(intervalModalSource).toContain("messages.suppressFutureIntervalConfirmation");
  });

  it("gates each workflow and setting control with its own preference", () => {
    expect(pluginSource).toContain("this.settings.confirmPeriodicNoteCreation");
    expect(pluginSource).toContain("this.settings.confirmIntervalNoteCreation");
    expect(periodicSettingsSource).toContain("context.host.settings.confirmPeriodicNoteCreation");
    expect(rangeSettingsSource).toContain("context.host.settings.confirmIntervalNoteCreation");
    expect(pluginSource).not.toContain("this.settings.confirmBeforeCreate");
    expect(periodicSettingsSource).not.toContain("context.host.settings.confirmBeforeCreate");
    expect(rangeSettingsSource).not.toContain("context.host.settings.confirmBeforeCreate");
  });
});
