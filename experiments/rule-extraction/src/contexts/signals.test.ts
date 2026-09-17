import { describe, expect, test } from "vitest";
import { countScopes, renderDirectorySummary, renderFileListing, selectDocPaths, summariseTree } from "./signals";

describe("countScopes", () => {
  test("counts conventional-commit scopes, most frequent first", () => {
    const scopes = countScopes([
      "feat(invoicing): send invoices",
      "fix(Invoicing): overdue flag",
      "feat(sessions,attendance): bulk mark",
      "feat(auth)!: drop legacy login",
      "Remove em dashes from copy",
      "chore: bump deps",
    ]);

    expect(scopes).toEqual([
      { scope: "invoicing", count: 2 },
      { scope: "attendance", count: 1 },
      { scope: "auth", count: 1 },
      { scope: "sessions", count: 1 },
    ]);
  });
});

const PATHS = [
  "apps/web/src/lib/sessions.ts",
  "apps/web/src/lib/invoices.ts",
  "apps/web/src/app/api/invoices/route.ts",
  "packages/db/src/schema/invoices.ts",
  "README.md",
];

describe("renderFileListing", () => {
  test("lists every file grouped by sorted directory", () => {
    expect(renderFileListing(PATHS)).toBe(
      [
        "./: README.md",
        "apps/web/src/app/api/invoices/: route.ts",
        "apps/web/src/lib/: invoices.ts, sessions.ts",
        "packages/db/src/schema/: invoices.ts",
      ].join("\n"),
    );
  });
});

describe("renderDirectorySummary", () => {
  test("uses the deepest level that fits the budget", () => {
    // Depth 3 would be 63 characters, so depth 2 (55 characters) is the deepest that fits.
    const summary = renderDirectorySummary(PATHS, 60);

    expect(summary).toBe(["./ (1 files)", "apps/web/ (3 files)", "packages/db/ (1 files)"].join("\n"));
    expect(renderDirectorySummary(PATHS, 20)).toBe(["./ (1 files)", "apps/ (3 files)", "packages/ (1 files)"].join("\n"));
    expect(renderDirectorySummary(PATHS, 10_000)).toContain("apps/web/src/app/api/invoices/ (1 files)");
  });
});

describe("summariseTree", () => {
  test("lists files when they fit and falls back to directories when they don't", () => {
    expect(summariseTree(PATHS, 10_000).mode).toBe("files");

    const summary = summariseTree(PATHS, 100);

    expect(summary.mode).toBe("directories");
    expect(summary.text.length).toBeLessThanOrEqual(100);
  });
});

describe("selectDocPaths", () => {
  const docs = [
    "packages/db/README.md",
    "docs/comms-runtime.md",
    "context/architecture-docs/system-v1.md",
    "claude.md",
    "readMe.md",
    ".claude/agents/watchman.md",
    "apps/web/src/components/Button.md",
    ".github/CODEOWNERS",
  ];

  test("ranks domain-describing documents first and skips agent tooling", () => {
    expect(selectDocPaths(docs, 10)).toEqual([
      "readMe.md",
      ".github/CODEOWNERS",
      "claude.md",
      "context/architecture-docs/system-v1.md",
      "docs/comms-runtime.md",
      "packages/db/README.md",
    ]);
  });

  test("respects the limit", () => {
    expect(selectDocPaths(docs, 2)).toEqual(["readMe.md", ".github/CODEOWNERS"]);
  });
});
