import { useEffect, useRef, useState } from "react";
import type { NoteTask } from "../../core/note/note-tasks";
import type { TaskUiFeedback } from "../../features/tasks/task-write-feedback";

interface TaskActionState extends TaskUiFeedback {
  readonly pending: boolean;
}

const IDLE: TaskActionState = Object.freeze({ pending: false, message: null, level: null });

/** Feedback follows the exact indexed task, not a line later occupied by another task. */
export function useTaskActionFeedback(tasks: readonly NoteTask[]) {
  const [states, setStates] = useState<ReadonlyMap<string, TaskActionState>>(new Map());
  const pending = useRef(new Set<string>());
  const mounted = useRef(true);
  const visible = useRef(new Set<string>());
  visible.current = new Set(tasks.map(taskIdentity));
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    setStates((previous) => {
      if ([...previous.keys()].every((key) => visible.current.has(key))) return previous;
      return new Map([...previous].filter(([key]) => visible.current.has(key)));
    });
  }, [tasks]);

  const run = async (task: NoteTask, action: () => Promise<TaskUiFeedback | void>): Promise<void> => {
    const key = taskIdentity(task);
    if (pending.current.has(key)) return;
    pending.current.add(key);
    setStates((previous) => new Map(previous).set(key, { ...IDLE, pending: true }));
    let feedback: TaskUiFeedback = IDLE;
    try {
      feedback = await action() ?? IDLE;
    } catch (error) {
      feedback = { level: "error", message: error instanceof Error ? error.message : String(error) };
    } finally {
      pending.current.delete(key);
      if (mounted.current && visible.current.has(key)) {
        setStates((previous) => new Map(previous).set(key, { ...feedback, pending: false }));
      }
    }
  };
  return { run, get: (task: NoteTask): TaskActionState => states.get(taskIdentity(task)) ?? IDLE };
}

function taskIdentity(task: NoteTask): string {
  return JSON.stringify([
    task.path, task.line, task.text, task.completed,
    task.dueDate, task.scheduledDate, task.startDate, task.doneDate,
  ]);
}
