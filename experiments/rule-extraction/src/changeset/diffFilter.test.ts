import { describe, expect, test } from "vitest";
import { filterDiff, MAX_FILE_PATCH_CHARS, noiseReason, splitUnifiedDiff } from "./diffFilter";

const JAVA_DIFF = `diff --git a/src/main/java/Invoice.java b/src/main/java/Invoice.java
index 1111111..2222222 100644
--- a/src/main/java/Invoice.java
+++ b/src/main/java/Invoice.java
@@ -1,3 +1,3 @@
-  static final int DUE_DAYS = 30;
+  static final int DUE_DAYS = 14;`;

const LOCKFILE_DIFF = `diff --git a/package-lock.json b/package-lock.json
index 1111111..2222222 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -1 +1 @@
-"a"
+"b"`;

const BINARY_DIFF = `diff --git a/docs/diagram.bin b/docs/diagram.bin
index 1111111..2222222 100644
Binary files a/docs/diagram.bin and b/docs/diagram.bin differ`;

const RENAME_DIFF = `diff --git a/old/Name.java b/new/Name.java
similarity index 100%
rename from old/Name.java
rename to new/Name.java`;

const file = (path: string, patch = "+x") => ({ path, patch });

describe("splitUnifiedDiff", () => {
  test("splits a multi-file diff into one entry per file", () => {
    const files = splitUnifiedDiff(`${JAVA_DIFF}\n${LOCKFILE_DIFF}\n`);

    expect(files.map((f) => f.path)).toEqual(["src/main/java/Invoice.java", "package-lock.json"]);
    expect(files[0]?.patch).toBe(JAVA_DIFF);
  });

  test("uses the destination path for renames", () => {
    expect(splitUnifiedDiff(RENAME_DIFF)[0]?.path).toBe("new/Name.java");
  });

  test("returns nothing for an empty diff", () => {
    expect(splitUnifiedDiff("")).toEqual([]);
  });
});

describe("noiseReason", () => {
  test.each([
    ["package-lock.json", "lockfile"],
    ["services/api/go.sum", "lockfile"],
    ["web/node_modules/lib/index.js", "generated or vendored directory"],
    ["target/classes/App.class", "generated or vendored directory"],
    ["docs/logo.png", "binary or asset"],
    ["public/app.min.js", "minified or source map"],
  ])("drops %s as %s", (path, reason) => {
    expect(noiseReason(file(path))).toBe(reason);
  });

  test("drops files git reports as binary", () => {
    expect(noiseReason(file("docs/diagram.bin", BINARY_DIFF))).toBe("binary or asset");
  });

  test("drops oversized single-file patches", () => {
    expect(noiseReason(file("src/schema.sql", "x".repeat(MAX_FILE_PATCH_CHARS + 1)))).toMatch(/likely generated/);
  });

  test("keeps source files even inside nested build packages", () => {
    expect(noiseReason(file("src/main/java/com/acme/build/InvoiceBuilder.java"))).toBeNull();
  });
});

describe("filterDiff", () => {
  test("separates reviewable files from noise with a reason", () => {
    const { kept, dropped } = filterDiff(`${JAVA_DIFF}\n${LOCKFILE_DIFF}\n${BINARY_DIFF}`);

    expect(kept.map((f) => f.path)).toEqual(["src/main/java/Invoice.java"]);
    expect(dropped).toEqual([
      { path: "package-lock.json", reason: "lockfile" },
      { path: "docs/diagram.bin", reason: "binary or asset" },
    ]);
  });
});
