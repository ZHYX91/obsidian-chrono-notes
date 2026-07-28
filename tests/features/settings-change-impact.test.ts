import { describe, expect, it } from "vitest";

import { getSettingsChangeImpact } from "../../src/features/settings/settings-change-impact";
import { createDefaultSettings } from "../../src/shared/settings";

describe("getSettingsChangeImpact", () => {
  it("does not notify any consumer for an equal normalized snapshot", () => {
    const settings = createDefaultSettings();
    expect(getSettingsChangeImpact(settings, createDefaultSettings())).toEqual({
      changed: false,
      calendar: false,
      navbar: false,
      intervalList: false,
      ics: false,
      propertiesDateDisplay: false,
    });
  });

  it("keeps persistence-only settings away from query consumers", () => {
    const previous = createDefaultSettings();
    const candidates = [
      (() => {
        const next = createDefaultSettings();
        next.firstUseGuideSeen = true;
        next.confirmPeriodicNoteCreation = false;
        return next;
      })(),
      (() => {
        const next = createDefaultSettings();
        next.templateEngine = "templater";
        return next;
      })(),
      (() => {
        const next = createDefaultSettings();
        next.periodicNotes.daily.templatePath = "Templates/Daily.md";
        return next;
      })(),
      (() => {
        const next = createDefaultSettings();
        next.rangeNotes.templatePath = "Templates/Range.md";
        return next;
      })(),
      (() => {
        const next = createDefaultSettings();
        next.propertyDateDisplayFormat = "dmy-slash";
        return next;
      })(),
    ];

    for (const next of candidates) {
      expect(getSettingsChangeImpact(previous, next)).toEqual({
        changed: true,
        calendar: false,
        navbar: false,
        intervalList: false,
        ics: false,
        propertiesDateDisplay: next.propertyDateDisplayFormat === "dmy-slash",
      });
    }
  });

  it("refreshes the Properties display for each date and time format field", () => {
    const previous = createDefaultSettings();
    const candidates = [
      ["propertyDateDisplayFormat", "custom"],
      ["propertyTimeDisplayFormat", "12-hour"],
      ["propertyDateCustomFormat", "YYYY年M月D日"],
      ["propertyTimeCustomFormat", "h:mm A"],
    ] as const;
    for (const [key, value] of candidates) {
      const next = createDefaultSettings();
      Object.assign(next, { [key]: value });
      expect(getSettingsChangeImpact(previous, next)).toMatchObject({
        changed: true,
        calendar: false,
        navbar: false,
        intervalList: false,
        ics: false,
        propertiesDateDisplay: true,
      });
    }
  });

  it("refreshes localized Moment output when the plugin language changes", () => {
    const previous = createDefaultSettings();
    const next = createDefaultSettings();
    next.locale = "zh-CN";
    expect(getSettingsChangeImpact(previous, next)).toMatchObject({
      calendar: true,
      navbar: true,
      propertiesDateDisplay: true,
    });
  });

  it("routes calendar appearance and periodic path changes precisely", () => {
    const previous = createDefaultSettings();
    const appearance = createDefaultSettings();
    appearance.showTaskProgress = false;
    expect(getSettingsChangeImpact(previous, appearance)).toMatchObject({
      calendar: true,
      navbar: false,
      intervalList: false,
      ics: false,
    });

    const periodic = createDefaultSettings();
    periodic.periodicNotes.daily.enabled = true;
    periodic.periodicNotes.daily.pattern = "[Daily]/YYYY-MM-DD";
    expect(getSettingsChangeImpact(previous, periodic)).toMatchObject({
      calendar: true,
      navbar: true,
      intervalList: false,
      ics: false,
    });
  });

  it("routes interval scope, lane limits, and ICS sources to their consumers", () => {
    const previous = createDefaultSettings();
    const scope = createDefaultSettings();
    scope.rangeNotes.customFolder = "Projects";
    expect(getSettingsChangeImpact(previous, scope)).toMatchObject({
      calendar: true,
      navbar: true,
      intervalList: true,
      ics: false,
    });

    const laneLimit = createDefaultSettings();
    laneLimit.rangeNotes.monthViewLimit += 1;
    expect(getSettingsChangeImpact(previous, laneLimit)).toMatchObject({
      calendar: true,
      navbar: false,
      intervalList: false,
      ics: false,
    });

    const ics = createDefaultSettings();
    ics.ics.enabled = true;
    ics.ics.sources = ["team.ics"];
    expect(getSettingsChangeImpact(previous, ics)).toMatchObject({
      calendar: false,
      navbar: false,
      intervalList: false,
      ics: true,
    });
  });

  it("treats ordered provider and source lists as semantic", () => {
    const previous = createDefaultSettings();
    const providers = createDefaultSettings();
    providers.holidayRegions.reverse();
    expect(getSettingsChangeImpact(previous, providers).calendar).toBe(true);

    const sources = createDefaultSettings();
    sources.ics.sources = ["first.ics", "second.ics"];
    const reordered = createDefaultSettings();
    reordered.ics.sources = ["second.ics", "first.ics"];
    expect(getSettingsChangeImpact(sources, reordered).ics).toBe(true);
  });
});
