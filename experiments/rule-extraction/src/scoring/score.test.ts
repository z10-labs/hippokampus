import { describe, expect, test } from "vitest";
import { makeLabel, makeRecord, makeRule } from "../testing/fixtures";
import { computeScorecard, isStale } from "./score";

function scenario() {
  const records = [
    makeRecord({
      changeSetId: "pr-1",
      rules: [
        makeRule({ rule_type: "temporal", confidence: 0.9 }),
        makeRule({ rule_type: "constraint", confidence: 0.6 }),
        makeRule({ rule_type: "computation", confidence: 0.3, statement: "Log every retry." }),
      ],
    }),
    makeRecord({ changeSetId: "pr-2", rules: [] }),
    makeRecord({ changeSetId: "pr-3", rules: [makeRule({ statement: "Use UTC timestamps." })] }),
    makeRecord({ changeSetId: "pr-4", rules: [makeRule()] }),
    makeRecord({ changeSetId: "pr-5" }),
  ];
  const labels = [
    makeLabel({
      changeSetId: "pr-1",
      ruleVerdicts: [
        { ruleIndex: 0, verdict: "correct", note: "" },
        { ruleIndex: 1, verdict: "partial", note: "condition too broad" },
        { ruleIndex: 2, verdict: "wrong", note: "logging detail" },
      ],
      missedRules: ["Refunds over R5000 need approval"],
    }),
    makeLabel({ changeSetId: "pr-2", changesBusinessRules: true, ruleVerdicts: [], missedRules: ["Paid invoices are immutable"] }),
    makeLabel({ changeSetId: "pr-3", changesBusinessRules: false, ruleVerdicts: [{ ruleIndex: 0, verdict: "wrong", note: "" }] }),
    makeLabel({
      changeSetId: "pr-4",
      ruleVerdicts: [
        { ruleIndex: 0, verdict: "correct", note: "" },
        { ruleIndex: 1, verdict: "correct", note: "" },
      ],
    }),
  ];
  return computeScorecard(records, labels);
}

describe("computeScorecard", () => {
  test("counts extracted, labeled and stale change sets", () => {
    expect(scenario().changeSets).toEqual({ extracted: 5, labeled: 3, stale: 1 });
  });

  test("computes strict and lenient rule precision and recall", () => {
    expect(scenario().rules).toEqual({
      extracted: 4,
      correct: 1,
      partial: 1,
      wrong: 2,
      missed: 2,
      strictPrecision: 0.25,
      lenientPrecision: 0.5,
      strictRecall: 0.25,
      lenientRecall: 0.5,
    });
  });

  test("builds the change-set classification confusion matrix", () => {
    expect(scenario().classification).toEqual({
      truePositive: 1,
      falsePositive: 1,
      falseNegative: 1,
      trueNegative: 0,
      precision: 0.5,
      recall: 0.5,
    });
  });

  test("breaks results down by rule type, skipping unused types", () => {
    expect(scenario().byRuleType).toEqual([
      { ruleType: "constraint", extracted: 1, correct: 0, partial: 1, wrong: 0 },
      { ruleType: "computation", extracted: 1, correct: 0, partial: 0, wrong: 1 },
      { ruleType: "temporal", extracted: 2, correct: 1, partial: 0, wrong: 1 },
    ]);
  });

  test("buckets rules by confidence for calibration", () => {
    expect(scenario().calibration).toEqual([
      { bucket: "< 0.5", extracted: 1, correct: 0, accuracy: 0 },
      { bucket: "0.5 – 0.8", extracted: 1, correct: 0, accuracy: 0 },
      { bucket: "≥ 0.8", extracted: 2, correct: 1, accuracy: 0.5 },
    ]);
  });

  test("totals cost across every extraction, labeled or not", () => {
    const card = scenario();

    expect(card.usage.inputTokens).toBe(50_000);
    expect(card.costUsd).toBeCloseTo(0.2);
  });

  test("collects non-correct rules and missed rules for prompt iteration", () => {
    const card = scenario();

    expect(card.reviewNotes.map((note) => [note.changeSetId, note.ruleIndex, note.verdict])).toEqual([
      ["pr-1", 1, "partial"],
      ["pr-1", 2, "wrong"],
      ["pr-3", 0, "wrong"],
    ]);
    expect(card.missedRules).toEqual([
      { changeSetId: "pr-1", description: "Refunds over R5000 need approval" },
      { changeSetId: "pr-2", description: "Paid invoices are immutable" },
    ]);
  });

  test("returns null ratios when there is nothing to score", () => {
    const card = computeScorecard([], []);

    expect(card.rules.strictPrecision).toBeNull();
    expect(card.rules.lenientRecall).toBeNull();
    expect(card.classification.precision).toBeNull();
    expect(card.calibration.every((bucket) => bucket.accuracy === null)).toBe(true);
  });
});

describe("isStale", () => {
  test("flags labels made before the extraction was re-run", () => {
    const record = makeRecord({ extractedAt: "2026-09-15T00:00:00.000Z" });

    expect(isStale(record, makeLabel({ labeledAt: "2026-09-14T00:00:00.000Z" }))).toBe(true);
    expect(isStale(record, makeLabel({ labeledAt: "2026-09-16T00:00:00.000Z" }))).toBe(false);
  });

  test("flags verdicts that point past the extracted rules", () => {
    const label = makeLabel({ ruleVerdicts: [{ ruleIndex: 3, verdict: "correct", note: "" }] });

    expect(isStale(makeRecord(), label)).toBe(true);
  });
});
