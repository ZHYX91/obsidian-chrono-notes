import { assertNoteCreationActive } from "./note-creation-lifecycle";

export interface NoteCreationConfirmationDecision {
  readonly confirmed: boolean;
  readonly suppressFutureConfirmation: boolean;
}

export function createNoteCreationConfirmationDecision(
  confirmed: boolean,
  suppressFutureConfirmation: boolean,
): NoteCreationConfirmationDecision {
  return Object.freeze({
    confirmed,
    suppressFutureConfirmation: confirmed && suppressFutureConfirmation,
  });
}

export async function resolveNoteCreationConfirmation(
  requestDecision: () => Promise<NoteCreationConfirmationDecision>,
  suppressFutureConfirmation: () => Promise<void>,
  signal?: AbortSignal,
): Promise<boolean> {
  assertNoteCreationActive(signal);
  const decision = await requestDecision();
  assertNoteCreationActive(signal);
  if (!decision.confirmed) return false;
  if (decision.suppressFutureConfirmation) await suppressFutureConfirmation();
  assertNoteCreationActive(signal);
  return true;
}
