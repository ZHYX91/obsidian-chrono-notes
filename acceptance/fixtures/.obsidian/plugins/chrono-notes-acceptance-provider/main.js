const { Plugin, Notice } = require("obsidian");

module.exports = class ChronoAcceptanceProvider extends Plugin {
  onload() {
    // Explicit synthetic input preparation only; no product actions or verdicts.
    this.addCommand({
      id: "prepare-audit-task-link-dates",
      name: "Prepare audit task link dates",
      callback: async () => {
        const folder = "Audit task links";
        try {
          if (await this.app.vault.adapter.exists(folder)) {
            new Notice(`Audit fixture folder already exists: ${folder}. Use a fresh disposable Vault.`);
            return;
          }
          const fixtures = {
            "Audit task links.md": [
              "# Audit task link dates",
              "",
              "Keep this header and the tail sentinel unchanged.",
              "",
              "- [ ] Destination date [[📅 2026-11-02|会议笔记]] 📅 2026-11-05",
              "- [ ] Markdown label [📅 2026-11-05](<Audit task destination.md> \"📅 2026-11-02\")",
              "- [ ] Wiki alias [[📅 2026-11-02|📅 2026-11-05]]",
              "- [ ] Boundary marker 📅 [report](Audit task destination.md) 2026-11-05; deadline 📅 2026-11-07",
              "- [ ] Shared target only [[📅 2026-11-02]]",
              "",
              "Tail audit sentinel.",
              "",
            ].join("\n"),
            "📅 2026-11-02.md": [
              "This synthetic link destination must remain reachable after task rescheduling.",
              "",
            ].join("\n"),
            "Audit task destination.md": [
              "This synthetic note is the explicit Markdown link destination.",
              "",
            ].join("\n"),
          };
          await this.app.vault.createFolder(folder);
          for (const [name, content] of Object.entries(fixtures)) {
            await this.app.vault.create(`${folder}/${name}`, content);
          }
          new Notice(`Prepared synthetic audit inputs in ${folder}; inspect them through the product UI.`);
        } catch (error) {
          new Notice(`Audit fixture preparation failed: ${String(error)}`);
        }
      },
    });
    // Explicit lifecycle setup only. Creation and prompt decisions remain UI actions.
    this.addCommand({
      id: "prepare-lifecycle-reload",
      name: "Prepare lifecycle reload in 30 seconds",
      callback: () => {
        if (this.lifecycleReloadTimer) {
          new Notice("A lifecycle reload is already armed.");
          return;
        }
        const armedAt = new Date().toISOString();
        new Notice("Chrono Notes lifecycle reload armed for 30 seconds.");
        this.lifecycleReloadTimer = window.setTimeout(async () => {
          this.lifecycleReloadTimer = null;
          const observation = {
            armedAt,
            firedAt: new Date().toISOString(),
            dialogText: document.querySelector(".modal-content")?.textContent ?? null,
            activePathBefore: this.app.workspace.getActiveFile()?.path ?? null,
            loadedBefore: Boolean(this.app.plugins.getPlugin("chrono-notes")),
          };
          try {
            await this.app.plugins.disablePlugin("chrono-notes");
            observation.disabledAt = new Date().toISOString();
            observation.loadedAfterDisable = Boolean(this.app.plugins.getPlugin("chrono-notes"));
            await this.app.plugins.enablePlugin("chrono-notes");
            observation.enabledAt = new Date().toISOString();
            observation.loadedAfterEnable = Boolean(this.app.plugins.getPlugin("chrono-notes"));
            observation.activePathAfter = this.app.workspace.getActiveFile()?.path ?? null;
          } catch (error) {
            observation.error = String(error);
          }
          await this.app.vault.adapter.write(`Chrono lifecycle ${armedAt.replaceAll(":", "-")}.json`, JSON.stringify(observation, null, 2));
          new Notice("Chrono Notes lifecycle reload observation saved.");
        }, 30000);
      },
    });
    this.register(() => window.clearTimeout(this.lifecycleReloadTimer));
    this.addCommand({
      id: "prepare-opening-calendar",
      name: "Prepare opening calendar",
      callback: async () => {
        const plugin = this.app.plugins.getPlugin("chrono-notes");
        await plugin.activateCalendarView({ year: 2026, month: 8, day: 31 });
      },
    });
    // Explicit input preparation only. Tested note creation still uses product UI.
    for (const [stage, template, day] of [
      ["context", "Context", 17],
      ["slow", "Slow", 20],
      ["failure", "Failure", 23],
      ["missing", "Missing", 24],
      ["cascade", "Context", 25],
    ]) {
      this.addCommand({
        id: `prepare-templater-${stage}`,
        name: `Prepare Templater ${stage}`,
        callback: async () => {
          const plugin = this.app.plugins.getPlugin("chrono-notes");
          const templater = this.app.plugins.getPlugin("templater-obsidian");
          if (!plugin || !templater) {
            new Notice("Prepared Templater dependency is unavailable.");
            return;
          }
          Object.assign(templater.settings, {
            templates_folder: "Templates",
            trigger_on_file_creation_mode: "folder",
            folder_templates: ["Daily", "Calendar/Range Notes"].map((folder) => ({
              folder, template: "Templates/Templater Automatic.md",
            })),
          });
          this.app.saveLocalStorage("templater-local-settings", {
            ...this.app.loadLocalStorage("templater-local-settings"),
            trigger_on_file_creation: true,
          });
          plugin.settings.templateEngine = "templater";
          plugin.settings.periodicNotes.daily.templatePath = `Templates/Templater ${template}.md`;
          plugin.settings.rangeNotes.templatePath = `Templates/Templater ${template}.md`;
          plugin.settings.cascadeLargerNotes = stage === "cascade";
          await plugin.saveSettings();
          await plugin.activateCalendarView({ year: 2026, month: 10, day });
        },
      });
    }
    this.addCommand({
      id: "prepare-ics-source-list",
      name: "Prepare ICS source list",
      callback: async () => {
        const plugin = this.app.plugins.getPlugin("chrono-notes");
        if (!plugin?.settings?.ics || typeof plugin.saveSettings !== "function") {
          new Notice("Chrono Notes ICS fixture is unavailable.");
          return;
        }
        plugin.settings.ics = {
          enabled: false,
          sources: Array.from({ length: 35 }, (_, index) =>
            `Calendars/Sources/${String(index + 1).padStart(2, "0")}.ics`),
        };
        await plugin.saveSettings();
      },
    });
    this.addCommand({
      id: "prepare-january-2029-calendar",
      name: "Prepare January 2029 calendar",
      callback: async () => {
        const plugin = this.app.plugins.getPlugin("chrono-notes");
        if (typeof plugin?.activateCalendarView !== "function") {
          new Notice("Chrono Notes calendar fixture is unavailable.");
          return;
        }
        await plugin.activateCalendarView({ year: 2029, month: 1, day: 3 });
      },
    });
  }
};
