const { Plugin, Notice } = require("obsidian");

module.exports = class ChronoAcceptanceProvider extends Plugin {
  onload() {
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
