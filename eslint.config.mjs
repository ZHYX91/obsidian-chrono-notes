import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    ignores: [
      "coverage/**",
      "dist/**",
      "node_modules/**",
    ],
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["main.ts", "src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // The current five-section settings UI supports Obsidian 1.12.7.
      // Declarative definitions are evaluated separately for a future minimum.
      "obsidianmd/settings-tab/prefer-setting-definitions": "off",
      // Popout-safe native controls must be created by their ownerDocument.
      // Obsidian's createEl helpers are still used where an Obsidian host owns
      // the element lifecycle.
      "obsidianmd/prefer-create-el": "off",
    },
  },
  {
    files: [
      "src/adapters/obsidian/obsidian-ics-source-reader.ts",
      "src/features/notes/note-index.ts",
    ],
    rules: {
      // These non-UI runtime bridges intentionally work in both Node-based
      // tests and Obsidian. They do not target a popout document.
      "obsidianmd/no-global-this": "off",
    },
  },
  {
    files: [
      "src/ui/calendar/chrono-notes-view.tsx",
      "src/ui/settings/periodic-settings-section.ts",
    ],
    rules: {
      // Preserve the Chrono Notes brand and case-sensitive date patterns.
      "obsidianmd/ui/sentence-case": "off",
    },
  },
]);
