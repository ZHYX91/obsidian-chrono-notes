const { Plugin, Notice } = require("obsidian");

module.exports = class ChronoAcceptanceProvider extends Plugin {
  onload() {
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
