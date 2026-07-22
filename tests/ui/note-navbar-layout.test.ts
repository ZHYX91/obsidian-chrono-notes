import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { readPluginStyles } from "../support/plugin-styles";

const styles = readPluginStyles();
const navbar = readFileSync(
  new URL("../../src/ui/note-navbar/note-navbar.tsx", import.meta.url),
  "utf8",
);

describe("Note Navbar layout", () => {
  it("mounts before the public Markdown content anchor instead of following the private header", () => {
    expect(navbar).toContain('content.insertAdjacentElement("beforebegin", container)');
    expect(navbar).not.toContain("chrono-notes-navbar-mounted");
    expect(navbar).not.toContain('querySelector<HTMLElement>(".view-header")');
  });

  it("centers period and higher-level navigation while keeping the calendar trailing", () => {
    expect(navbar).toContain('className="chrono-notes-navbar-navigation"');
    expect(navbar).toContain('className="chrono-notes-navbar-primary"');
    expect(navbar).toContain('className="chrono-notes-navbar-actions"');
    expect(styles).toMatch(
      /\.chrono-notes-navbar-controls\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto minmax\(0, 1fr\);/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-navbar-navigation\s*\{[^}]*grid-column:\s*2;[^}]*gap:\s*9px;[^}]*justify-self:\s*center;/s,
    );
    expect(styles).toMatch(
      /\.chrono-notes-navbar-actions\s*\{[^}]*grid-column:\s*3;[^}]*justify-self:\s*end;/s,
    );
    expect(styles).not.toMatch(
      /\.chrono-notes-navbar-controls \.chrono-notes-navbar-higher\s*\{[^}]*margin-left:\s*auto;/s,
    );
    const navigation = navbar.slice(
      navbar.indexOf('<div className="chrono-notes-navbar-navigation">'),
      navbar.indexOf('<div className="chrono-notes-navbar-actions">'),
    );
    expect(navigation).toContain('className="chrono-notes-navbar-higher"');
  });

  it("retains icon access to higher notes in narrow editors", () => {
    expect(styles).toMatch(
      /@container \(max-width: 480px\)[\s\S]*?\.chrono-notes-navbar-higher span[^}]*\{[^}]*display:\s*none;/s,
    );
    expect(styles).not.toMatch(
      /@container \(max-width: 480px\)[\s\S]*?\.chrono-notes-navbar-higher\s*\{[^}]*display:\s*none;/s,
    );
  });

  it("keeps phone navigation below fixed host chrome without duplicating content inset", () => {
    expect(styles).toMatch(
      /\.chrono-notes-navbar-container\s*\+\s*\.view-content\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0;/s,
    );
    expect(styles).toMatch(
      /body\.is-phone:is\(\.is-floating-nav, \.auto-full-screen\)[\s\S]*?\.chrono-notes-navbar-container\s*\+\s*\.view-content\s*\{[^}]*--view-top-fade-mask:\s*linear-gradient\(to bottom, #000 0%, #000 1px\);[^}]*--view-top-spacing:\s*0;[^}]*--view-top-spacing-markdown:\s*var\(--size-4-2\);/s,
    );
    expect(styles).toMatch(
      /body\.is-phone:is\(\.is-floating-nav, \.auto-full-screen\)\s+\.chrono-notes-navbar-container\s*\{[^}]*margin-block-start:\s*calc\(\s*var\(--view-header-top-offset, env\(safe-area-inset-top, 0px\)\)\s*\+\s*var\(--view-header-height, 0px\)\s*\);/s,
    );
    expect(styles).toMatch(
      /body\.is-phone\.is-hidden-nav \.chrono-notes-navbar-container\s*\{[^}]*margin-block-start:\s*var\(\s*--safe-area-inset-top,\s*env\(safe-area-inset-top, 0px\)\s*\);/s,
    );
    expect(styles.indexOf("body.is-phone.is-hidden-nav")).toBeGreaterThan(
      styles.indexOf("body.is-phone:is(.is-floating-nav, .auto-full-screen)"),
    );
    expect(styles).not.toContain("chrono-notes-navbar-mounted");
  });

  it("provides mobile touch targets without changing desktop control sizes", () => {
    expect(styles).toMatch(
      /\.chrono-notes-navbar-controls button\s*\{[^}]*height:\s*28px;[^}]*width:\s*28px;/s,
    );
    expect(styles).toMatch(
      /body\.is-mobile \.chrono-notes-navbar-controls button\s*\{[^}]*height:\s*44px;[^}]*min-width:\s*44px;[^}]*width:\s*44px;/s,
    );
    expect(styles).toMatch(
      /body\.is-mobile[\s\S]*?button:is\(\.chrono-notes-navbar-label, \.chrono-notes-navbar-higher\)\s*\{[^}]*width:\s*auto;/s,
    );
    expect(styles).toMatch(
      /body\.is-mobile :is\([\s\S]*?\.chrono-notes-navbar-related-toggle,[\s\S]*?\.chrono-notes-navbar-related-list button[\s\S]*?\)\s*\{[^}]*min-height:\s*44px;/s,
    );
  });

  it("keeps related range-note task progress visible and accessible", () => {
    expect(navbar).toContain("data-task-state={progress.state}");
    expect(navbar).toContain(
      'aria-label={`${t("intervalList.openItem", { title: item.title })}. ${progressLabel}`}',
    );
    expect(navbar).toContain("{dateRange} · {compactProgress}");
    expect(navbar).toContain(
      'title={`${item.title}\\n${dateRange}\\n${progressLabel}`}',
    );
  });
});
