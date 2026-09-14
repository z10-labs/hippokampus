import { describe, expect, test } from "vitest";
import { makeLabel, makeRecord, makeRule } from "../testing/fixtures";
import { renderReport } from "./report";
import { computeScorecard } from "./score";

const META = {
  repo: "acme/billing",
  model: "claude-sonnet-5",
  promptVersion: "v2",
  generatedAt: "2026-09-14T12:00:00.000Z",
};

describe("renderReport", () => {
  test("renders headline metrics, notes and missed rules", () => {
    const card = computeScorecard(
      [makeRecord({ rules: [makeRule(), makeRule({ statement: "Retry webhooks 3 times." })] })],
      [
        makeLabel({
          ruleVerdicts: [
            { ruleIndex: 0, verdict: "correct", note: "" },
            { ruleIndex: 1, verdict: "wrong", note: "technical retry policy" },
          ],
          missedRules: ["Refunds need approval"],
        }),
      ],
    );

    const report = renderReport(card, META);

    expect(report).toContain("# Rule extraction scorecard: acme/billing");
    expect(report).toContain("Model `claude-sonnet-5` · prompt v2 ·");
    expect(report).toContain("| Precision | 50% | 50% | 1 correct · 0 partial · 1 wrong of 2 |");
    expect(report).toContain("| Recall | 50% | 50% | 1 missed |");
    expect(report).toContain("| **Model: yes** | 1 | 0 |");
    expect(report).toContain("| temporal | 2 | 1 | 0 | 1 |");
    expect(report).toContain("- **wrong** pr-1 #2: Retry webhooks 3 times. (technical retry policy)");
    expect(report).toContain("- pr-1: Refunds need approval");
  });

  test("shows placeholders when nothing has been scored", () => {
    const report = renderReport(computeScorecard([], []), META);

    expect(report).toContain("| Precision | — | — |");
    expect(report).toContain("## Missed rules\n\nNone.");
  });

  test("warns about stale labels", () => {
    const card = computeScorecard([makeRecord()], [makeLabel({ labeledAt: "2020-01-01T00:00:00.000Z" })]);

    expect(renderReport(card, META)).toContain("1 stale label(s) ignored");
  });
});
