import { describe, expect, test } from "vitest";
import { baseNameOf, directoryOf, groupBy } from "./collections";

describe("groupBy", () => {
  test("groups by key in first-seen order", () => {
    const groups = groupBy(["apple", "avocado", "banana", "apricot"], (word) => word[0]);

    expect([...groups.entries()]).toEqual([
      ["a", ["apple", "avocado", "apricot"]],
      ["b", ["banana"]],
    ]);
  });
});

describe("path helpers", () => {
  test("split a path into directory and base name", () => {
    expect(directoryOf("apps/web/src/lib/invoices.ts")).toBe("apps/web/src/lib");
    expect(baseNameOf("apps/web/src/lib/invoices.ts")).toBe("invoices.ts");
    expect(directoryOf("README.md")).toBe("");
  });
});
