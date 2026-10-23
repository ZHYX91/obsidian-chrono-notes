import { vi } from "vitest";

/**
 * The pending-file/end-task boundary of Templater 2.25.1. Its create listener
 * checks this set after its delay; end-task deletes the path before notifying
 * all-templates-executed and tearing down the shared function modules.
 * Contract: SilentVoid13/Templater commit 0ffe956a58360aee949df114ded2fd7431447ebb,
 * src/core/Templater.ts (start/end_templater_task and on_file_creation).
 */
export function createTemplaterLifecycle() {
  const files_with_pending_templates = new Set<string>();
  const allTemplatesExecuted = vi.fn();
  const teardown = vi.fn(async () => undefined);
  const end_templater_task = vi.fn(async (path: string) => {
    files_with_pending_templates.delete(path);
    if (files_with_pending_templates.size === 0) {
      allTemplatesExecuted();
      await teardown();
    }
  });
  return { files_with_pending_templates, end_templater_task, allTemplatesExecuted, teardown };
}
