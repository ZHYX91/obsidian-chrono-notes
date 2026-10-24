export type TaskWriteWarning = "editor-reported-error" | "save-not-confirmed";

export interface TaskWriteFeedback {
  readonly warning?: TaskWriteWarning;
}

export interface TaskUiFeedback {
  readonly message: string | null;
  readonly level: "error" | "warning" | null;
}

/** A failed transaction is classified by its observed editor result, never replayed. */
export class TaskWriteError extends Error {
  override readonly name = "TaskWriteError";

  constructor(
    readonly outputState: "not-applied" | "unconfirmed",
    path: string,
    options?: ErrorOptions,
  ) {
    super(`Markdown task update could not be verified (${outputState}): ${path}`, options);
  }
}
