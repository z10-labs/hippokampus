import { describe, expect, test } from "vitest";
import { makeBoundedContext, makeChangeSet } from "../testing/fixtures";
import { approxPromptTokens, buildChangeSetPrompt, SYSTEM_PROMPT } from "./prompt";

describe("buildChangeSetPrompt", () => {
  test("includes metadata, description and every reviewable file", () => {
    const prompt = buildChangeSetPrompt(makeChangeSet());

    expect(prompt).toContain('<change_set id="pr-1" kind="pull_request">');
    expect(prompt).toContain("<title>Shorten invoice due period</title>");
    expect(prompt).toContain("Finance asked for 14-day terms.");
    expect(prompt).toContain('<file path="src/main/java/Invoice.java">');
    expect(prompt).toContain("+  static final int DUE_DAYS = 14;");
  });

  test("marks empty sections explicitly", () => {
    const prompt = buildChangeSetPrompt(makeChangeSet({ description: "", files: [] }));

    expect(prompt).toContain("<description>\nnone\n</description>");
    expect(prompt).toContain("<reviews>\nnone\n</reviews>");
    expect(prompt).toContain("<diff>\nno reviewable files\n</diff>");
  });

  test("lists reviews, discussion and omitted files", () => {
    const prompt = buildChangeSetPrompt(
      makeChangeSet({
        reviews: [{ reviewer: "lead", state: "APPROVED", submittedAt: null, body: "Confirmed with Finance" }],
        comments: [{ author: "qa", kind: "review_comment", body: "Edge case?", path: "Invoice.java" }],
        droppedFiles: [{ path: "pnpm-lock.yaml", reason: "lockfile" }],
      }),
    );

    expect(prompt).toContain("- lead: APPROVED — Confirmed with Finance");
    expect(prompt).toContain("- qa on Invoice.java: Edge case?");
    expect(prompt).toContain("- pnpm-lock.yaml (lockfile)");
  });

  test("includes every confirmed context and highlights path candidates", () => {
    const prompt = buildChangeSetPrompt(makeChangeSet(), {
      contexts: [
        makeBoundedContext("invoicing", [], {
          status: "confirmed",
          name: "Billing & Invoicing",
          description: "Owns invoice terms < 30 days & lifecycle decisions.",
          aliases: ["billing & collections"],
        }),
        makeBoundedContext("payments", [], {
          status: "confirmed",
          description: "Owns payment-attempt outcomes.",
        }),
      ],
      matchedContextIds: ["invoicing"],
    });

    expect(prompt).toContain('<context id="invoicing" matched_by_changed_paths="true">');
    expect(prompt).toContain("<name>Billing &amp; Invoicing</name>");
    expect(prompt).toContain("<description>Owns invoice terms &lt; 30 days &amp; lifecycle decisions.</description>");
    expect(prompt).toContain("<aliases>billing &amp; collections</aliases>");
    expect(prompt).toContain('<context id="payments" matched_by_changed_paths="false">');
    expect(prompt).toContain("<candidate_context_ids>invoicing</candidate_context_ids>");
  });
});

describe("approxPromptTokens", () => {
  test("grows with the size of the diff", () => {
    const small = approxPromptTokens(makeChangeSet());
    const large = approxPromptTokens(makeChangeSet({ files: [{ path: "a.java", patch: "x".repeat(35_000) }] }));

    expect(small).toBeGreaterThan(SYSTEM_PROMPT.length / 4);
    expect(large - small).toBeGreaterThan(9_000);
  });

  test("includes confirmed context cards when supplied", () => {
    const changeSet = makeChangeSet();
    const withoutMap = approxPromptTokens(changeSet);
    const withMap = approxPromptTokens(changeSet, {
      contexts: [
        makeBoundedContext("invoicing", [], {
          description: "Owns invoice lifecycle and commercial terms. ".repeat(20),
        }),
      ],
      matchedContextIds: ["invoicing"],
    });

    expect(withMap).toBeGreaterThan(withoutMap);
  });
});
