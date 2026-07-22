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
): Promise<boolean> {
  const decision = await requestDecision();
  if (!decision.confirmed) return false;
  if (decision.suppressFutureConfirmation) await suppressFutureConfirmation();
  return true;
}
