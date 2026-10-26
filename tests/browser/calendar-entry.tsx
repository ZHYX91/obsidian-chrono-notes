import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { NoteIndex } from "../../src/features/notes/note-index";
import { IcsEventIndex } from "../../src/features/calendar/ics-event-index";
import { ObsidianNoteIndexCache } from "../../src/adapters/obsidian/obsidian-note-index-cache";
import { selectWeekCalendar } from "../../src/features/calendar/week-calendar-query";
import { createDefaultSettings, type PluginLocale } from "../../src/shared/settings";
import { createTranslator } from "../../src/shared/i18n";
import { CalendarApp } from "../../src/ui/calendar/calendar-app";
import { WeekView } from "../../src/ui/calendar/week-view";
import { LongPressGesture } from "../../src/ui/calendar/long-press";
import type { NoteSourceListener } from "../../src/core/note/note-source";

interface BrowserMetrics {
  readonly count: number;
  readonly indexMs: number;
  readonly initialCacheWriteMs: number;
  readonly singleUpdateCacheWriteMs: number;
  readonly cacheBytes: number;
  readonly updateReads: number;
  readonly taskQueryMs: number;
  readonly renderMs: number;
  readonly rowCount: number;
  readonly nextPageRenderMs: number;
  readonly longTaskCount: number;
  readonly maxLongTaskMs: number;
}

declare global {
  interface Window {
    runChronoBrowserBenchmark: (count: number) => Promise<BrowserMetrics>;
    mountChronoCalendar: (locale: PluginLocale, width: number, eventTitles?: readonly string[]) => Promise<void>;
    mountChronoTaskLayout: (width: number, locale: PluginLocale) => Promise<void>;
    chronoTaskActions: string[];
  }
}

let root: Root | null = null;
let currentIndex: NoteIndex | null = null;
let gesture: LongPressGesture | null = null;
const date = { year: 2026, month: 10, day: 20 } as const;
const noAction = async () => undefined;

function rootContainer(width: number): HTMLDivElement {
  root?.unmount();
  currentIndex?.stop();
  gesture?.dispose();
  const container = document.getElementById("calendar-fixture") as HTMLDivElement;
  container.replaceChildren();
  container.style.width = `${width}px`;
  root = createRoot(container);
  return container;
}

function sourceFixture(count: number) {
  let listener: NoteSourceListener = () => undefined;
  let reads = 0;
  const contents = new Map(Array.from({ length: count }, (_, index) => [
    `Tasks/Task-${index}.md`, `# Task ${index}\n- [ ] Review item ${index} 📅 2026-10-20\n`,
  ]));
  let revision = 1;
  return {
    source: {
      listPaths: () => [...contents.keys()],
      listFiles: () => [...contents].map(([path, content]) => ({ path, mtime: revision, size: content.length })),
      read: async (path: string) => { reads += 1; return contents.get(path) ?? ""; },
      subscribe: (next: NoteSourceListener) => { listener = next; return () => { listener = () => undefined; }; },
    },
    getReads: () => reads,
    add: (path: string, content: string) => { contents.set(path, content); },
    update: () => {
      const path = "Tasks/Task-0.md";
      contents.set(path, (contents.get(path) ?? "").replace("[ ]", "[x]"));
      revision += 1;
      listener({ type: "modify", path });
    },
  };
}

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

window.runChronoBrowserBenchmark = async (count) => {
  const container = rootContainer(840);
  const longTasks: number[] = [];
  const observer = new PerformanceObserver((list) => {
    longTasks.push(...list.getEntries().map((entry) => entry.duration));
  });
  observer.observe({ type: "longtask" });
  const fixture = sourceFixture(count);
  const cache = new ObsidianNoteIndexCache({
    getName: () => "Chrono browser performance fixture",
    configDir: ".obsidian",
    adapter: { getBasePath: () => `fixture-${count}` },
  } as never);
  await cache.clear();
  const index = currentIndex = new NoteIndex(fixture.source, {
    cache, scheduleCacheSave: () => () => undefined,
  });
  let started = performance.now();
  await index.start();
  const indexMs = performance.now() - started;
  started = performance.now();
  await index.persistCacheNow();
  const initialCacheWriteMs = performance.now() - started;
  const stored = await cache.load();
  const cacheBytes = new TextEncoder().encode(JSON.stringify(stored)).length;
  const beforeReads = fixture.getReads();
  fixture.update();
  await index.start();
  const updateReads = fixture.getReads() - beforeReads;
  started = performance.now();
  await index.persistCacheNow();
  const singleUpdateCacheWriteMs = performance.now() - started;
  const settings = createDefaultSettings();
  const ics = new IcsEventIndex({ read: async () => "" });
  started = performance.now();
  const query = selectWeekCalendar(date, index.getSnapshot(), ics.getSnapshot(), {
    locale: "en-US", weekStartDay: "monday", today: date, calendarExtensions: [], holidayRegions: [],
    daily: settings.periodicNotes.daily, weekly: settings.periodicNotes.weekly,
    rangeNotes: settings.rangeNotes,
  });
  const taskQueryMs = performance.now() - started;
  gesture = new LongPressGesture({ setTimeout: (callback, delay) => window.setTimeout(callback, delay), clearTimeout: (handle) => window.clearTimeout(handle) });
  started = performance.now();
  flushSync(() => root!.render(<div className="chrono-notes-calendar"><WeekView
    query={query} translator={createTranslator("en", "en-US")}
    selectionKind="day" selectedDate={date} today={date} weekStartDay="monday"
    showNoteIndicators showTaskProgress activePreviewKey={null} previewId="preview"
    onSelectDate={() => undefined} onOpenPeriodic={noAction} onOpenPath={noAction}
    onCreateRange={() => undefined} onToggleTask={noAction} onRescheduleTask={noAction}
    onOpenTaskSource={noAction} onSchedulePreview={() => undefined} onDismissPreview={() => undefined}
    onOpenDateContextMenu={() => undefined} longPress={gesture!}
  /></div>));
  await frame();
  await frame();
  const renderMs = performance.now() - started;
  const rowCount = container.querySelectorAll(".chrono-notes-week-task").length;
  const next = [...container.querySelectorAll<HTMLButtonElement>(".chrono-notes-week-task-pages button")].at(-1);
  started = performance.now();
  next?.click();
  await frame();
  await frame();
  const nextPageRenderMs = performance.now() - started;
  observer.disconnect();
  await cache.clear();
  index.stop();
  return { count, indexMs, initialCacheWriteMs, singleUpdateCacheWriteMs, cacheBytes, updateReads, taskQueryMs, renderMs, rowCount,
    nextPageRenderMs, longTaskCount: longTasks.length, maxLongTaskMs: Math.max(0, ...longTasks) };

};

window.mountChronoCalendar = async (locale, width, eventTitles) => {
  rootContainer(width).classList.add("chrono-notes-view");
  const fixture = sourceFixture(4);
  fixture.add("Daily/2026-10-20.md", "# Daily note\n- [x] Review notes\n- [ ] Prepare weekly plan 📅 2026-10-20");
  const index = currentIndex = new NoteIndex(fixture.source);
  await index.start();
  const settings = createDefaultSettings();
  settings.locale = locale;
  settings.periodicNotes.daily.enabled = true;
  settings.periodicNotes.weekly.enabled = true;
  settings.periodicNotes.monthly.enabled = true;
  settings.periodicNotes.daily.pattern = "[Daily]/YYYY-MM-DD";
  settings.periodicNotes.weekly.pattern = "[Weeks]/GGGG-[W]WW";
  settings.periodicNotes.monthly.pattern = "[Months]/YYYY-MM";
  const ics = new IcsEventIndex({ read: async () => [
    "BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", "UID:team-review",
    "DTSTART:20261020T090000Z", "DTEND:20261020T093000Z", "SUMMARY:Team review",
    "END:VEVENT", "BEGIN:VEVENT", "UID:project-plan", "DTSTART;VALUE=DATE:20261020",
    "SUMMARY:Project planning", "END:VEVENT",
    ...(eventTitles ?? []).flatMap((title, index) => [
      "BEGIN:VEVENT", `UID:extra-${index}`, "DTSTART;VALUE=DATE:20261020",
      `SUMMARY:${title}`, "END:VEVENT",
    ]),
    "END:VCALENDAR", "",
  ].join("\r\n") });
  await ics.refresh({ enabled: true, sources: ["Calendars/example.ics"], displayZone: "UTC" });
  flushSync(() => root!.render(<CalendarApp noteIndex={index} icsEventIndex={ics}
    getSettings={() => settings} getTranslator={() => createTranslator(locale, "en-US")}
    onOpenPeriodic={noAction} onSetYearHeatmap={noAction} onSetStatisticDimension={noAction}
    onOpenPath={noAction} onCreateRange={() => undefined} onToggleTask={noAction}
    onRescheduleTask={noAction} onOpenTaskSource={noAction} onOpenDateContextMenu={() => undefined}
    navigationRequest={{ revision: 1, date, noteType: "daily", mode: "jump" }}
  />));
  await frame();
  await frame();
};

window.mountChronoTaskLayout = async (width, locale) => {
  const container = rootContainer(width);
  container.classList.add("chrono-notes-view");
  const fixture = sourceFixture(0);
  fixture.add("Projects/long-task.md", "- [ ] Review the current period and reconcile every outstanding project decision 📅 2026-12-30 ⏳ 2026-12-30 🛫 2026-12-30\n- [ ] Scheduled task with another long source label ⏳ 2026-12-31");
  const index = currentIndex = new NoteIndex(fixture.source);
  await index.start();
  const settings = createDefaultSettings();
  const day = { year: 2026, month: 12, day: 30 } as const;
  const today = { year: 2027, month: 1, day: 3 } as const;
  const ics = new IcsEventIndex({ read: async () => "" });
  const translator = createTranslator(locale, locale === "de-DE" ? "de-DE" : "en-US");
  const query = selectWeekCalendar(day, index.getSnapshot(), ics.getSnapshot(), {
    locale: translator.locale, weekStartDay: "monday", today, calendarExtensions: [], holidayRegions: [],
    daily: settings.periodicNotes.daily, weekly: settings.periodicNotes.weekly, rangeNotes: settings.rangeNotes,
  });
  window.chronoTaskActions = [];
  gesture = new LongPressGesture({ setTimeout: (callback, delay) => window.setTimeout(callback, delay), clearTimeout: (handle) => window.clearTimeout(handle) });
  flushSync(() => root!.render(<div className="chrono-notes-calendar"><WeekView
    query={query} translator={translator} selectionKind="day" selectedDate={day} today={today} weekStartDay="monday"
    showNoteIndicators showTaskProgress activePreviewKey={null} previewId="preview"
    onSelectDate={() => undefined} onOpenPeriodic={noAction} onOpenPath={noAction} onCreateRange={() => undefined}
    onToggleTask={async () => { window.chronoTaskActions.push("toggle"); }}
    onRescheduleTask={async (_task, target) => { window.chronoTaskActions.push(`date:${target.day}`); }}
    onOpenTaskSource={async (_task, target) => { window.chronoTaskActions.push(`source:${target}`); }}
    onSchedulePreview={() => undefined} onDismissPreview={() => undefined}
    onOpenDateContextMenu={() => undefined} longPress={gesture!}
  /></div>));
  await frame();
  await frame();
};
