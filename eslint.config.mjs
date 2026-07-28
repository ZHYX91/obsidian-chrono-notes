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
      // Keep callback references safe even when their receiver is discarded.
      "@typescript-eslint/unbound-method": "error",
    },
  },
  {
    files: [
      "src/ui/calendar/chrono-notes-view.tsx",
      "src/ui/settings/periodic-settings-section.ts",
    ],
    rules: {
      // Preserve the Chrono Notes Calendar brand and case-sensitive date patterns.
      "obsidianmd/ui/sentence-case": "off",
    },
  },
]);
