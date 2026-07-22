import type { NoteTask } from "../../core/note/note-tasks";
import {
  rescheduleTaskDueDateInContent,
  toggleTaskInContent,
  type TaskLineRewriteResult,
} from "../../core/note/task-line-rewrite";
import type { LocalDate } from "../../core/periodic/periodic-date";
import type { NoteOpenTarget } from "../periodic/periodic-note-commands";

export interface TaskFilePort {
  process(path: string, update: (content: string) => string | null): Promise<void>;
}

export interface TaskWorkspacePort {
  openAtLine(path: string, line: number, target: NoteOpenTarget): Promise<void>;
}

export type TaskCommandResult = Exclude<TaskLineRewriteResult, { status: "updated" }> |
  Readonly<{ status: "updated" }>;

export class TaskCommands {
  constructor(
    private readonly files: TaskFilePort,
    private readonly workspace: TaskWorkspacePort,
  ) {}

  async toggle(task: NoteTask): Promise<TaskCommandResult> {
    return this.apply(task, (content) => toggleTaskInContent(content, task));
  }

  async rescheduleDue(task: NoteTask, nextDueDate: LocalDate): Promise<TaskCommandResult> {
    return this.apply(
      task,
      (content) => rescheduleTaskDueDateInContent(content, task, nextDueDate),
    );
  }

  openSource(task: NoteTask, target: NoteOpenTarget): Promise<void> {
    return this.workspace.openAtLine(task.path, task.line, target);
  }

  private async apply(
    task: NoteTask,
    rewrite: (content: string) => TaskLineRewriteResult,
  ): Promise<TaskCommandResult> {
    let outcome: TaskLineRewriteResult | null = null;
    await this.files.process(task.path, (content) => {
      outcome = rewrite(content);
      return outcome.status === "updated" ? outcome.content : null;
    });
    const result = outcome as TaskLineRewriteResult | null;
    if (result === null) throw new Error("Task file processor did not run");
    return result.status === "updated" ? Object.freeze({ status: "updated" }) : result;
  }
}
