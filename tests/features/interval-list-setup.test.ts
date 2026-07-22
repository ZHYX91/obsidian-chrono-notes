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

  it("requires a creation folder when scanning the entire Vault", () => {
    expect(getIntervalListSetup(rangeSettings({
      scanScope: "entire-vault",
      folder: "",
    }), true)).toEqual({
      canCreateVisibleItem: false,
      issue: "creation-not-configured",
    });
    expect(getIntervalListSetup(rangeSettings({
      scanScope: "entire-vault",
    }), true)).toEqual({
      canCreateVisibleItem: true,
      issue: null,
    });
  });

  it("allows creating the configured range folder when it does not exist yet", () => {
    expect(getIntervalListSetup(rangeSettings(), false)).toEqual({
      canCreateVisibleItem: true,
      issue: "scan-folder-missing",
    });
  });

  it("diagnoses missing custom scan configuration and directories", () => {
    expect(getIntervalListSetup(rangeSettings({
      scanScope: "custom-folder",
      customFolder: "",
    }), false)).toEqual({
      canCreateVisibleItem: false,
      issue: "scan-not-configured",
    });
    expect(getIntervalListSetup(rangeSettings({
      scanScope: "custom-folder",
      customFolder: "Projects",
      folder: "Projects/Ranges",
    }), false)).toEqual({
      canCreateVisibleItem: true,
      issue: "scan-folder-missing",
    });
  });

  it("requires custom-scope creation to produce visible notes", () => {
    expect(getIntervalListSetup(rangeSettings({
      scanScope: "custom-folder",
      customFolder: "Projects",
      folder: "",
    }), true)).toEqual({
      canCreateVisibleItem: false,
      issue: "creation-not-configured",
    });
    expect(getIntervalListSetup(rangeSettings({
      scanScope: "custom-folder",
      customFolder: "Projects",
      folder: "Ranges",
    }), true)).toEqual({
      canCreateVisibleItem: false,
      issue: "creation-outside-scope",
    });
    expect(getIntervalListSetup(rangeSettings({
      scanScope: "custom-folder",
      customFolder: "Projects",
      folder: "Projects/Ranges",
    }), true)).toEqual({
      canCreateVisibleItem: true,
      issue: null,
    });
  });
});

function rangeSettings(
  overrides: Partial<RangeNoteSettings> = {},
): RangeNoteSettings {
  return {
    showInCalendar: true,
    folder: "Ranges",
    scanScope: "range-folder",
    customFolder: "",
    monthViewLimit: 2,
    weekViewLimit: 5,
    ...overrides,
  };
}
