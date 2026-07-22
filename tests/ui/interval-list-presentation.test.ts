import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { createTranslator } from "../../src/shared/i18n";
import {
  formatIntervalListCount,
  formatIntervalListDuration,
  getIntervalListEmptyState,
  getIntervalListMessages,
} from "../../src/ui/modals/interval-list-presentation";
import { readPluginStyles } from "../support/plugin-styles";

const intervalListModalSource = readFileSync(
  new URL("../../src/ui/modals/interval-note-list-modal.tsx", import.meta.url),
  "utf8",
);

describe("interval list presentation", () => {
  it("formats singular and plural result counts", () => {
    const t = createTranslator("en", "en").t;

    expect(formatIntervalListCount(1, t)).toBe("1 range note");
    expect(formatIntervalListCount(2, t)).toBe("2 range notes");
  });

  it("builds translated search, filter, sort, action, and empty-state labels", () => {
    const messages = getIntervalListMessages(createTranslator("zh-TW", "en").t);

    expect(messages).toMatchObject({
      title: "區間筆記",
      searchPlaceholder: "搜尋標題或路徑",
      allDates: "所有日期",
      currentMonth: "本月",
      currentYear: "本年",
      startAscending: "開始日期升序",
      startDescending: "開始日期降序",
      createRange: "建立區間筆記",
      creationNotConfigured: "尚未設定區間筆記建立目錄。",
      scanNotConfigured: "尚未設定自訂掃描目錄。",
      scanFolderMissing: "設定的掃描目錄尚不存在。",
      creationOutsideScope: "區間筆記建立目錄不在目前掃描範圍內。",
      openRangeSettings: "開啟區間設定",
      resetFilters: "重設篩選",
      emptyScope: "目前掃描範圍內沒有區間筆記。",
      emptyFilters: "沒有符合目前篩選條件的區間筆記。",
    });
  });

  it("formats localized inclusive durations", () => {
    const t = createTranslator("zh-CN", "en").t;
    expect(formatIntervalListDuration(7, t)).toBe("7 天");
  });

  it("selects one actionable empty state without conflating setup and filtering", () => {
    const ready = {
      canCreateVisibleItem: true,
      issue: null,
    } as const;
    expect(getIntervalListEmptyState(0, 0, ready)).toEqual({
      kind: "empty-scope",
      action: "create",
    });
    expect(getIntervalListEmptyState(3, 0, ready)).toEqual({
      kind: "empty-filters",
      action: "reset",
    });
    expect(getIntervalListEmptyState(3, 2, ready)).toBeNull();
    expect(getIntervalListEmptyState(0, 0, {
      canCreateVisibleItem: true,
      issue: "scan-folder-missing",
    })).toEqual({
      kind: "scan-folder-missing",
      action: "create",
    });
    expect(getIntervalListEmptyState(0, 0, {
      canCreateVisibleItem: false,
      issue: "creation-outside-scope",
    })).toEqual({
      kind: "creation-outside-scope",
      action: "settings",
    });
  });

  it("exposes the empty-state kind to styling without serializing the state object", () => {
    expect(intervalListModalSource).toContain(
      "data-empty-state={emptyState.kind}",
    );
    expect(intervalListModalSource).not.toContain(
      "data-empty-state={emptyState}",
    );
  });

  it("wires exact task progress into list text, tooltip, and accessible labels", () => {
    expect(intervalListModalSource).toContain(
      "data-task-state={progress.state}",
    );
    expect(intervalListModalSource).toContain(
      'aria-label={`${openLabel}. ${progressLabel}`}',
    );
    expect(intervalListModalSource).toContain(
      "{duration} · {compactProgress}",
    );
  });

  it("uses the modal width rather than the viewport for its compact toolbar", () => {
    const styles = readPluginStyles();

    expect(styles).toMatch(
      /\.chrono-notes-interval-list-modal\s*\{[^}]*container-type:\s*inline-size;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-interval-list\s*\{[^}]*min-width:\s*0;[^}]*width:\s*100%;/s,
    );
    expect(styles).toMatch(
      /@container\s*\(max-width:\s*620px\)[\s\S]*\.chrono-notes-interval-list-toolbar/,
    );
  });

  it("keeps results above the Android soft keyboard", () => {
    const styles = readPluginStyles();

    expect(intervalListModalSource).toContain(
      'keyboard.addListener("keyboardDidShow"',
    );
    expect(intervalListModalSource).toContain(
      'keyboard.addListener("keyboardDidHide"',
    );
    expect(intervalListModalSource).toContain(
      'modalEl.addEventListener("focusin", handleFocusIn)',
    );
    expect(intervalListModalSource).toContain(
      "window.innerHeight > viewportHeightBeforeKeyboard",
    );
    expect(intervalListModalSource).toContain(
      'modalEl.addClass("chrono-notes-interval-list-modal-container")',
    );
    expect(styles).toMatch(
      /\.chrono-notes-interval-list-modal-container\.is-keyboard-visible\s*\{[^}]*transform:\s*translateY\(var\(--chrono-notes-keyboard-shift\)\);/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-interval-list-modal-container\.is-keyboard-visible[\s\S]*?\.chrono-notes-interval-list-results\s*\{[^}]*max-height:\s*max\(/s,
    );
  });
});
