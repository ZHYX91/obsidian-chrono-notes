import { describe, expect, it } from "vitest";

import {
  getIntervalListSetup,
  getIntervalNoteScanFolder,
} from "../../src/features/intervals/interval-list-setup";
import type { RangeNoteSettings } from "../../src/shared/settings";

describe("interval list setup", () => {
  it("resolves the scan folder for every supported scope", () => {
    expect(getIntervalNoteScanFolder(rangeSettings({
      scanScope: "entire-vault",
    }))).toBeNull();
    expect(getIntervalNoteScanFolder(rangeSettings())).toBe("Ranges");
    expect(getIntervalNoteScanFolder(rangeSettings({
      scanScope: "custom-folder",
      customFolder: "Projects/Ranges/",
    }))).toBe("Projects/Ranges");
  });

  it.each(["entire-vault", "range-folder", "custom-folder"] as const)(
    "requires a creation folder independently of the %s scan scope",
    (scanScope) => {
      expect(getIntervalListSetup(rangeSettings({
        scanScope,
        folder: "",
      }), true)).toEqual({
        canCreateVisibleItem: false,
        issue: "creation-not-configured",
      });
    },
  );

  it("allows creating the configured range folder when it does not exist yet", () => {
    expect(getIntervalListSetup(rangeSettings(), false)).toEqual({
      canCreateVisibleItem: true,
      issue: "scan-folder-missing",
    });
  });

  it("keeps creation available when the unmarked scan scope is not configured", () => {
    expect(getIntervalListSetup(rangeSettings({
      scanScope: "custom-folder",
      customFolder: "",
    }), false)).toEqual({
      canCreateVisibleItem: true,
      issue: "scan-not-configured",
    });
  });

  it("keeps creation available when the unmarked scan folder is missing", () => {
    expect(getIntervalListSetup(rangeSettings({
      scanScope: "custom-folder",
      customFolder: "Projects",
      folder: "Ranges",
    }), false)).toEqual({
      canCreateVisibleItem: true,
      issue: "scan-folder-missing",
    });
  });

  it.each(["Ranges", "Projects/Ranges", "Projects"])(
    "allows explicit range creation in %s regardless of the unmarked scope",
    (folder) => {
      expect(getIntervalListSetup(rangeSettings({
        scanScope: "custom-folder",
        customFolder: "Projects",
        folder,
      }), true)).toEqual({
        canCreateVisibleItem: true,
        issue: null,
      });
    },
  );

  it("allows creation when scanning the entire Vault", () => {
    expect(getIntervalListSetup(rangeSettings({
      scanScope: "entire-vault",
    }), true)).toEqual({ canCreateVisibleItem: true, issue: null });
  });
});

function rangeSettings(
  overrides: Partial<RangeNoteSettings> = {},
): RangeNoteSettings {
  return {
    showInCalendar: true,
    folder: "Ranges",
    templatePath: "",
    scanScope: "range-folder",
    customFolder: "",
    monthViewLimit: 2,
    weekViewLimit: 5,
    ...overrides,
  };
}
