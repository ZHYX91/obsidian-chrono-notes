import type { Translator } from "./i18n";

export type OperationErrorCode =
  | "templateMissing"
  | "templaterUnavailable"
  | "templaterIncompatible"
  | "templaterFailed"
  | "targetMissing"
  | "icsVaultFileRequired"
  | "icsEmptySource";

export interface OperationErrorDetails {
  readonly code: OperationErrorCode;
  readonly path?: string;
}

/** Preserve machine-readable context until the current surface chooses its language. */
export class OperationError extends Error {
  override readonly name = "OperationError";
  readonly details: OperationErrorDetails;

  constructor(
    code: OperationErrorCode,
    message: string,
    options: Readonly<{ path?: string; cause?: unknown }> = {},
  ) {
    super(message, { cause: options.cause });
    this.details = Object.freeze({
      code,
      ...(options.path === undefined ? {} : { path: options.path }),
    });
  }
}

export function getOperationErrorDetails(error: unknown): OperationErrorDetails | undefined {
  const visited = new Set<Error>();
  while (error instanceof Error && !visited.has(error)) {
    if (error instanceof OperationError) return error.details;
    visited.add(error);
    error = error.cause;
  }
  return undefined;
}

export function formatOperationError(
  error: unknown,
  t: Translator["t"],
  details = getOperationErrorDetails(error),
): string {
  const message = error instanceof Error ? error.message : String(error);
  if (details === undefined) return message;
  return [
    t(`operationError.${details.code}`, { path: details.path ?? "" }),
    t("operationError.details", { message }),
  ].join("\n");
}
