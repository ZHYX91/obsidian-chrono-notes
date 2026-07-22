import type { IntervalWeekData } from "../../features/intervals/interval-note-query";
import type { NoteOpenTarget } from "../../features/periodic/periodic-note-commands";
import type { Translator } from "../../shared/i18n";
import { formatNoteTaskProgress } from "../note-task-progress-presentation";
import { IntervalGantt } from "./interval-gantt";

export interface MonthIntervalStripProps {
  readonly data: IntervalWeekData;
  readonly translator: Translator;
  readonly activePath: string | null;
  readonly onHoverPathChange: (path: string | null) => void;
  readonly onFocusPathChange: (path: string | null) => void;
  readonly onOpenPath: (path: string, target: NoteOpenTarget) => Promise<void>;
}

export function MonthIntervalStrip({
  data,
  translator,
  activePath,
  onHoverPathChange,
  onFocusPathChange,
  onOpenPath,
}: MonthIntervalStripProps) {
  return (
    <IntervalGantt
      data={data}
      variant="month"
      ariaLabel={translator.t("weekView.rangeNotes")}
      formatDuration={(count) => translator.t("intervalList.duration", { count })}
      formatMore={(count) => translator.t("navbar.moreRelated", { count })}
      formatTaskProgress={(statistics) => formatNoteTaskProgress(statistics, translator.t)}
      linkedPathInteraction={{
        activePath,
        onHoverPathChange,
        onFocusPathChange,
      }}
      onOpenPath={onOpenPath}
    />
  );
}
