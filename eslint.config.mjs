import { defineConfig } from "eslint/config";
import globals from "globals";
import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

// Plugin-source rules check Obsidian plugin conventions (DOM helpers, styles
// assignment, manifest validity, sentence case). They do not apply to tests,
// benchmarks, or Node scripts, which run outside the Obsidian host.
const PLUGIN_SOURCE_RULES_OFF = Object.fromEntries(
  Object.keys(obsidianmd.rules).map((ruleName) => [`obsidianmd/${ruleName}`, "off"]),
);

// Tests deliberately assert DOM setup through innerHTML and loose typing.
const DOM_SECURITY_RULES_OFF = {
  "no-unsanitized/property": "off",
  "no-unsanitized/method": "off",
  "@microsoft/sdl/no-inner-html": "off",
  "@microsoft/sdl/no-html-method": "off",
  "@microsoft/sdl/no-angular-bypass-sanitizer": "off",
  "@microsoft/sdl/no-angular-sanitization-trusted-urls": "off",
  "@microsoft/sdl/no-angularjs-bypass-sce": "off",
  "@microsoft/sdl/no-angularjs-enable-svg": "off",
  "@microsoft/sdl/no-angularjs-sanitization-whitelist": "off",
  "@microsoft/sdl/no-cookies": "off",
  "@microsoft/sdl/no-document-domain": "off",
  "@microsoft/sdl/no-document-write": "off",
  "@microsoft/sdl/no-electron-node-integration": "off",
  "@microsoft/sdl/no-insecure-random": "off",
  "@microsoft/sdl/no-insecure-url": "off",
  "@microsoft/sdl/no-msapp-exec-unsafe": "off",
  "@microsoft/sdl/no-postmessage-star-origin": "off",
  "@microsoft/sdl/no-unsafe-alloc": "off",
  "@microsoft/sdl/no-winjs-html-unsafe": "off",
};

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
  {
    // Pure domain rules must never reach into host or presentation layers.
    files: ["src/core/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", {
        paths: [
          {
            name: "obsidian",
            message: "src/core must not import the Obsidian host.",
          },
          {
            name: "react",
            message: "src/core must not import React.",
          },
          {
            name: "react-dom",
            message: "src/core must not import React DOM.",
          },
        ],
        patterns: [
          {
            group: ["../app/**", "../../app/**"],
            message: "src/core must not import src/app.",
          },
          {
            group: ["../adapters/**", "../../adapters/**"],
            message: "src/core must not import src/adapters.",
          },
          {
            group: ["../ui/**", "../../ui/**"],
            message: "src/core must not import src/ui.",
          },
          {
            group: ["../features/**", "../../features/**"],
            message: "src/core must not import src/features.",
          },
        ],
      }],
    },
  },
  {
    // Tests, benchmarks, and the Node script declarations use a plain typed
    // ruleset; strict unsafe-typing and binding checks are relaxed because
    // test code intentionally asserts through loose casts and method refs.
    files: ["tests/**/*.ts", "benchmarks/**/*.ts", "scripts/**/*.d.mts"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...PLUGIN_SOURCE_RULES_OFF,
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/unbound-method": "off",
      // Test mocks implement async host interfaces without always awaiting.
      "@typescript-eslint/require-await": "off",
      // Tests intentionally exercise deprecated host hooks (e.g. display()).
      "@typescript-eslint/no-deprecated": "off",
      ...DOM_SECURITY_RULES_OFF,
    },
  },
  {
    // Node scripts run outside Obsidian; give them Node globals and skip
    // browser-host and plugin-source rules.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      ...PLUGIN_SOURCE_RULES_OFF,
      ...DOM_SECURITY_RULES_OFF,
    },
  },
]);
