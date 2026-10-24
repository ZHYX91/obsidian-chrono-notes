import { Window } from "happy-dom";
import { installObsidianDomFactories } from "../setup/obsidian-dom";
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => ({
  Modal: class {
    readonly contentEl = fixtureDocument.createElement("div");
    readonly titleEl = { setText: vi.fn() };
  },
  Setting: class {
    setName() { return this; }
    addToggle() { return this; }
    addButton() { return this; }
  },
}));
import { ConfirmPeriodicNoteModal } from "../../src/ui/modals/confirm-periodic-note-modal";
import { createTranslator } from "../../src/shared/i18n";

const fixtureDocument = new Window().document as unknown as Document;
installObsidianDomFactories(fixtureDocument);

it("shows the primary path and each larger-period creation or preservation target", () => {
  const modal = new ConfirmPeriodicNoteModal({} as never, "Daily/2026-10-20.md", createTranslator("en", "en-US"), [
    { noteType: "monthly", path: "Months/2026-10.md", exists: true },
    { noteType: "yearly", path: "Years/2026.md", exists: false },
  ]);
  modal.onOpen();
  expect(modal.contentEl.querySelector("p")?.textContent).toBe("Daily/2026-10-20.md");
  expect([...modal.contentEl.querySelectorAll("li")].map((entry) => entry.textContent)).toEqual([
    "Months/2026-10.md — Keep existing", "Years/2026.md — Create",
  ]);
});
