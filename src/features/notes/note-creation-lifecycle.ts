import { OperationError } from "../../shared/operation-error";

/** An old runtime may finish dispatched I/O, but must not start another step. */
export function assertNoteCreationActive(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new OperationError(
      "noteCreationStopped",
      "Note creation stopped because the plugin runtime was disposed; already created files were kept.",
    );
  }
}
