import { describe, expect, test } from "vitest";
import { makeBoundedContext, makeContextMap } from "../testing/fixtures";
import { computeCoverage } from "./coverage";
import { renderContextMap, renderCoverage } from "./render";

const MAP = makeContextMap({
  contexts: [
    makeBoundedContext("invoicing", ["apps/web/src/**/invoic*/**"], { aliases: ["billing", "invoices"] }),
    makeBoundedContext("typo", ["apps/web/src/**/invioce/**"]),
  ],
  sharedPaths: [{ pattern: "packages/ui/**", reason: "design system" }],
  openQuestions: ["Is attendance part of invoicing?"],
});

describe("renderContextMap", () => {
  test("shows each context with its patterns, aliases, shared paths and open questions", () => {
    const text = renderContextMap(MAP);

    expect(text).toContain("Context map for acme/tutoring @ abc1234 · draft · 2 context(s)");
    expect(text).toContain("  invoicing · Invoicing [proposed]");
    expect(text).toContain("    paths:   apps/web/src/**/invoic*/**");
    expect(text).toContain("    aliases: billing, invoices");
    expect(text).toContain("    packages/ui/** (design system)");
    expect(text).toContain("    - Is attendance part of invoicing?");
  });
});

describe("renderCoverage", () => {
  test("summarises coverage and warns about contexts and patterns that match nothing", () => {
    const report = computeCoverage(
      ["apps/web/src/app/invoices/page.tsx", "packages/ui/Button.tsx", "apps/web/src/lib/zoom.ts", "README.md"],
      MAP,
    );

    const text = renderCoverage(report);

    expect(text).toContain("Coverage: 67% of 3 relevant files (1 ignored)");
    expect(text).toContain("in a context 1 · shared 1 · unmapped 1 · in more than one context 0");
    expect(text).toMatch(/typo\s+0 {2}⚠ matches no files/);
    expect(text).toContain("Largest unmapped directories:\n  apps/web/src/lib  1");
    expect(text).toContain("Patterns that match no files:\n  typo: apps/web/src/**/invioce/**");
    expect(text).not.toContain("Files in more than one context:");
  });
});
