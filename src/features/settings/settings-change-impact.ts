import { PERIODIC_NOTE_TYPES } from "../../core/periodic/periodic-date";
import type {
  ChronoNotesSettings,
  IcsSettings,
  PeriodicNoteSettings,
  RangeNoteSettings,
} from "../../shared/settings";

export interface SettingsChangeImpact {
  readonly changed: boolean;
  readonly calendar: boolean;
  readonly navbar: boolean;
  readonly intervalList: boolean;
  readonly ics: boolean;
}

export function getSettingsChangeImpact(
  previous: Readonly<ChronoNotesSettings>,
  next: Readonly<ChronoNotesSettings>,
): SettingsChangeImpact {
  const periodicPathsChanged = PERIODIC_NOTE_TYPES.some((noteType) => {
    const left = previous.periodicNotes[noteType];
    const right = next.periodicNotes[noteType];
    return left.enabled !== right.enabled || left.pattern !== right.pattern;
  });
  const intervalScopeChanged = !sameIntervalScope(
    previous.rangeNotes,
    next.rangeNotes,
  );

  return Object.freeze({
    changed: !sameSettings(previous, next),
    calendar:
      previous.locale !== next.locale ||
      previous.weekStartDay !== next.weekStartDay ||
      !sameArray(previous.calendarOverlays, next.calendarOverlays) ||
      !sameArray(previous.holidayRegions, next.holidayRegions) ||
      previous.showNoteIndicators !== next.showNoteIndicators ||
      previous.quarterNameMode !== next.quarterNameMode ||
      previous.fontSizeMode !== next.fontSizeMode ||
      previous.immutableFontSizeFactor !== next.immutableFontSizeFactor ||
      previous.todoAnnotationMode !== next.todoAnnotationMode ||
      previous.showHoverPreview !== next.showHoverPreview ||
      previous.statisticDisplayDimension !== next.statisticDisplayDimension ||
      previous.statisticValueStep !== next.statisticValueStep ||
      previous.yearViewHeatmap !== next.yearViewHeatmap ||
      periodicPathsChanged ||
      !sameRangeNotes(previous.rangeNotes, next.rangeNotes),
    navbar:
      previous.locale !== next.locale ||
      previous.weekStartDay !== next.weekStartDay ||
      previous.showNoteNavbar !== next.showNoteNavbar ||
      previous.relatedIntervalNotesCollapsed !== next.relatedIntervalNotesCollapsed ||
      periodicPathsChanged ||
      intervalScopeChanged,
    intervalList: intervalScopeChanged,
    ics: !sameIcs(previous.ics, next.ics),
  });
}

function sameSettings(
  left: Readonly<ChronoNotesSettings>,
  right: Readonly<ChronoNotesSettings>,
): boolean {
  return left.schemaVersion === right.schemaVersion &&
    left.locale === right.locale &&
    left.weekStartDay === right.weekStartDay &&
    sameArray(left.calendarOverlays, right.calendarOverlays) &&
    sameArray(left.holidayRegions, right.holidayRegions) &&
    left.showNoteIndicators === right.showNoteIndicators &&
    left.quarterNameMode === right.quarterNameMode &&
    left.fontSizeMode === right.fontSizeMode &&
    left.immutableFontSizeFactor === right.immutableFontSizeFactor &&
    left.todoAnnotationMode === right.todoAnnotationMode &&
    left.interceptPropertyDateClicks === right.interceptPropertyDateClicks &&
    left.showHoverPreview === right.showHoverPreview &&
    left.showNoteNavbar === right.showNoteNavbar &&
    left.relatedIntervalNotesCollapsed === right.relatedIntervalNotesCollapsed &&
    left.firstUseGuideSeen === right.firstUseGuideSeen &&
    left.statisticDisplayDimension === right.statisticDisplayDimension &&
    left.statisticValueStep === right.statisticValueStep &&
    left.yearViewHeatmap === right.yearViewHeatmap &&
    left.confirmPeriodicNoteCreation === right.confirmPeriodicNoteCreation &&
    left.confirmIntervalNoteCreation === right.confirmIntervalNoteCreation &&
    left.cascadeLargerNotes === right.cascadeLargerNotes &&
    left.templateEngine === right.templateEngine &&
    PERIODIC_NOTE_TYPES.every((noteType) => samePeriodicNote(
      left.periodicNotes[noteType],
      right.periodicNotes[noteType],
    )) &&
    sameRangeNotes(left.rangeNotes, right.rangeNotes) &&
    sameIcs(left.ics, right.ics);
}

function samePeriodicNote(
  left: Readonly<PeriodicNoteSettings>,
  right: Readonly<PeriodicNoteSettings>,
): boolean {
  return left.enabled === right.enabled &&
    left.pattern === right.pattern &&
    left.templatePath === right.templatePath;
}

function sameRangeNotes(
  left: Readonly<RangeNoteSettings>,
  right: Readonly<RangeNoteSettings>,
): boolean {
  return sameIntervalScope(left, right) &&
    left.showInCalendar === right.showInCalendar &&
    left.monthViewLimit === right.monthViewLimit &&
    left.weekViewLimit === right.weekViewLimit;
}

function sameIntervalScope(
  left: Readonly<RangeNoteSettings>,
  right: Readonly<RangeNoteSettings>,
): boolean {
  return left.folder === right.folder &&
    left.scanScope === right.scanScope &&
    left.customFolder === right.customFolder;
}

function sameIcs(left: Readonly<IcsSettings>, right: Readonly<IcsSettings>): boolean {
  return left.enabled === right.enabled && sameArray(left.sources, right.sources);
}

function sameArray<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
