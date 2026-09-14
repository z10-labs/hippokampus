import { describe, expect, test } from "vitest";
import { makeChangeSet, makeRecord, makeRule } from "../testing/fixtures";
import { renderChangeSetHeader, renderRule } from "./render";

describe("renderChangeSetHeader", () => {
  test("links to the PR files view and shows the model's classification", () => {
    const header = renderChangeSetHeader(makeChangeSet(), makeRecord(), "2/9");

    expect(header).toContain("[2/9] pr-1 · Shorten invoice due period");
    expect(header).toContain("https://github.com/acme/billing/pull/1/files");
    expect(header).toContain("business rules changed? YES");
    expect(header).not.toContain("Excluded as technical");
  });

  test("links straight to a direct commit", () => {
    const changeSet = makeChangeSet({ kind: "direct_commit", url: "https://github.com/acme/billing/commit/abc" });

    const header = renderChangeSetHeader(changeSet, makeRecord({ rules: [] }), "1/1");

    expect(header).toContain("https://github.com/acme/billing/commit/abc\n");
    expect(header).toContain("business rules changed? no");
  });

  test("lists what the model excluded as technical so the grader can spot hidden rules", () => {
    const record = makeRecord({ excludedTechnicalChanges: ["Rejects unknown provider names", "Startup credential checks"] });

    const header = renderChangeSetHeader(makeChangeSet(), record, "1/1");

    expect(header).toContain("Excluded as technical:\n  - Rejects unknown provider names\n  - Startup credential checks");
  });
});

describe("renderRule", () => {
  test("shows the owner, condition, outcome and a truncated evidence preview", () => {
    const snippet = ["l1", "l2", "l3", "l4", "l5", "l6"].join("\n");
    const rule = makeRule({ evidence: [{ kind: "test_assertion", file: "InvoiceTest.java", symbol: null, snippet }] });

    const text = renderRule(rule, 0);

    expect(text).toContain("#1 [modified · temporal · owner Finance · confidence 0.90]");
    expect(text).toContain("when: An invoice is issued");
    expect(text).toContain("then: Its due date is 14 days later");
    expect(text).toContain("· test_assertion in InvoiceTest.java\n");
    expect(text).toContain("│ l4");
    expect(text).not.toContain("│ l5");
  });

  test("numbers rules from one and marks missing entities", () => {
    const text = renderRule(makeRule({ change_kind: "introduced", entities: [] }), 2);

    expect(text).toContain("#3 [introduced");
    expect(text).toContain("entities: none");
  });
});
