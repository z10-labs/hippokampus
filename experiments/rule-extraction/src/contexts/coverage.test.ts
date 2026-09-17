import { describe, expect, test } from "vitest";
import { makeBoundedContext, makeContextMap } from "../testing/fixtures";
import { classifyFiles, computeCoverage, contextsForPaths, toLiteralGlob } from "./coverage";

const MAP = makeContextMap({
  contexts: [
    makeBoundedContext("invoicing", ["apps/web/src/**/invoic*/**", "packages/db/src/schema/invoices.ts"]),
    makeBoundedContext("sessions", ["apps/web/src/**/sessions/**"]),
    makeBoundedContext("legacy", ["old/**"], { status: "deprecated" }),
    makeBoundedContext("typo", ["apps/web/src/**/invioce/**"]),
  ],
  sharedPaths: [{ pattern: "packages/ui/**", reason: "design system" }],
});

const PATHS = [
  "apps/web/src/app/api/invoices/route.ts",
  "apps/web/src/components/invoices/List.tsx",
  "packages/db/src/schema/invoices.ts",
  "apps/web/src/app/api/sessions/[id]/route.ts",
  "apps/web/src/app/api/sessions/[id]/invoices/route.ts",
  "packages/ui/src/Button.tsx",
  "apps/web/src/lib/zoom/client.ts",
  "apps/web/src/lib/zoom/token.ts",
  "old/thing.ts",
  "README.md",
  ".github/workflows/ci.yml",
];

describe("classifyFiles", () => {
  test("matches contexts, shared code and ignored files, skipping deprecated contexts", () => {
    const byPath = new Map(classifyFiles(PATHS, MAP).map((file) => [file.path, file]));

    expect(byPath.get("apps/web/src/app/api/sessions/[id]/invoices/route.ts")?.contextIds).toEqual(["invoicing", "sessions"]);
    expect(byPath.get("packages/ui/src/Button.tsx")).toMatchObject({ contextIds: [], shared: true });
    expect(byPath.get("old/thing.ts")?.contextIds).toEqual([]);
    expect(byPath.get(".github/workflows/ci.yml")?.ignored).toBe(true);
  });
});

describe("path pattern syntax", () => {
  test("escapes unescaped parentheses only", () => {
    expect(toLiteralGlob("apps/web/src/app/(tutor)/**")).toBe("apps/web/src/app/\\(tutor\\)/**");
    expect(toLiteralGlob("apps/web/src/app/\\(tutor\\)/**")).toBe("apps/web/src/app/\\(tutor\\)/**");
  });

  test("matches route-group parentheses and dynamic-segment brackets literally", () => {
    const map = makeContextMap({
      contexts: [
        makeBoundedContext("courses", ["apps/web/src/app/(tutor)/courses/**", "apps/web/src/app/api/courses/[id]/**"]),
      ],
    });

    const files = classifyFiles(
      ["apps/web/src/app/(tutor)/courses/page.tsx", "apps/web/src/app/api/courses/[id]/enroll/route.ts"],
      map,
    );

    expect(files.map((file) => file.contextIds)).toEqual([["courses"], ["courses"]]);
  });
});

describe("computeCoverage", () => {
  const report = computeCoverage(PATHS, MAP);

  test("counts every file into exactly one bucket", () => {
    expect(report).toMatchObject({ totalFiles: 11, ignored: 2, mapped: 5, overlapping: 1, sharedOnly: 1, unmapped: 3 });
    expect(report.coverage).toBeCloseTo(6 / 9);
  });

  test("reports files per active context, including overlaps", () => {
    expect(report.perContext).toEqual([
      { id: "invoicing", files: 4 },
      { id: "sessions", files: 2 },
      { id: "typo", files: 0 },
    ]);
  });

  test("lists the largest unmapped directories and overlapping context pairs", () => {
    expect(report.unmappedDirectories).toEqual([
      { directory: "apps/web/src/lib/zoom", files: 2 },
      { directory: "old", files: 1 },
    ]);
    expect(report.overlaps).toEqual([
      { contextIds: ["invoicing", "sessions"], files: 1, example: "apps/web/src/app/api/sessions/[id]/invoices/route.ts" },
    ]);
  });

  test("flags patterns that match no files", () => {
    expect(report.unusedPatterns).toEqual([{ owner: "typo", pattern: "apps/web/src/**/invioce/**" }]);
  });

  test("doesn't flag patterns whose only matches are ignored files", () => {
    const map = makeContextMap({
      contexts: [makeBoundedContext("docs", ["docs/**"])],
      sharedPaths: [{ pattern: ".github/**", reason: "CI config" }],
    });

    expect(computeCoverage(["docs/guide.md", ".github/workflows/ci.yml"], map).unusedPatterns).toEqual([]);
  });

  test("returns null coverage when every file is ignored", () => {
    expect(computeCoverage(["README.md"], MAP).coverage).toBeNull();
  });
});

describe("contextsForPaths", () => {
  test("orders candidate contexts by how many changed files they own", () => {
    const candidates = contextsForPaths(
      ["apps/web/src/app/api/sessions/[id]/invoices/route.ts", "apps/web/src/app/api/sessions/[id]/route.ts"],
      MAP,
    );

    expect(candidates).toEqual(["sessions", "invoicing"]);
  });
});
