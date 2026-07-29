export type SettingsCleanup = () => void;

export function combineSettingsCleanups(
  cleanups: readonly SettingsCleanup[],
): SettingsCleanup {
  let active = true;

  return () => {
    if (!active) return;
    active = false;

    let firstError: Error | null = null;
    for (const cleanup of [...cleanups].reverse()) {
      try {
        cleanup();
      } catch (error) {
        firstError ??= error instanceof Error
          ? error
          : new Error("Settings cleanup failed.", { cause: error });
      }
    }

    if (firstError !== null) throw firstError;
  };
}
