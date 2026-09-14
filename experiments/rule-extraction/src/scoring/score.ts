import type { ExtractionRecord, Usage } from "../extraction/record";
import { type ExtractedRule, RULE_TYPES, type RuleType } from "../extraction/schema";
import type { Label, Verdict } from "../labeling/types";
import { estimateUsd, sumUsage } from "./cost";

export const CONFIDENCE_BUCKETS = [
  { label: "< 0.5", min: 0, max: 0.5 },
  { label: "0.5 – 0.8", min: 0.5, max: 0.8 },
  { label: "≥ 0.8", min: 0.8, max: Number.POSITIVE_INFINITY },
] as const;

export interface Tally {
  extracted: number;
  correct: number;
  partial: number;
  wrong: number;
}

export interface Confusion {
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  trueNegative: number;
}

export interface Scorecard {
  changeSets: { extracted: number; labeled: number; stale: number };
  rules: Tally & {
    missed: number;
    strictPrecision: number | null;
    lenientPrecision: number | null;
    strictRecall: number | null;
    lenientRecall: number | null;
  };
  classification: Confusion & { precision: number | null; recall: number | null };
  byRuleType: ReadonlyArray<Tally & { ruleType: RuleType }>;
  calibration: ReadonlyArray<{ bucket: string; extracted: number; correct: number; accuracy: number | null }>;
  usage: Usage;
  costUsd: number;
  reviewNotes: ReadonlyArray<{ changeSetId: string; ruleIndex: number; verdict: Verdict; statement: string; note: string }>;
  missedRules: ReadonlyArray<{ changeSetId: string; description: string }>;
}

interface GradedRule {
  changeSetId: string;
  ruleIndex: number;
  rule: ExtractedRule;
  verdict: Verdict;
  note: string;
}

const EMPTY_TALLY: Tally = { extracted: 0, correct: 0, partial: 0, wrong: 0 };
const EMPTY_CONFUSION: Confusion = { truePositive: 0, falsePositive: 0, falseNegative: 0, trueNegative: 0 };

export const ratio = (numerator: number, denominator: number): number | null =>
  denominator === 0 ? null : numerator / denominator;

const addVerdict = (tally: Tally, verdict: Verdict): Tally => ({
  ...tally,
  extracted: tally.extracted + 1,
  [verdict]: tally[verdict] + 1,
});

/** A label no longer matches its extraction when the extraction was re-run after grading. */
export function isStale(record: ExtractionRecord, label: Label): boolean {
  const ruleCount = record.extraction.rules.length;
  return (
    label.labeledAt < record.extractedAt ||
    label.ruleVerdicts.length !== ruleCount ||
    label.ruleVerdicts.some((verdict) => verdict.ruleIndex >= ruleCount)
  );
}

export function computeScorecard(records: readonly ExtractionRecord[], labels: readonly Label[]): Scorecard {
  const labelById = new Map(labels.map((label) => [label.changeSetId, label]));
  const labeledRecords = records.flatMap((record) => {
    const label = labelById.get(record.changeSetId);
    return label ? [{ record, label }] : [];
  });
  const pairs = labeledRecords.filter(({ record, label }) => !isStale(record, label));
  const graded = pairs.flatMap(({ record, label }) =>
    label.ruleVerdicts.map(
      (verdict): GradedRule => ({
        changeSetId: record.changeSetId,
        ruleIndex: verdict.ruleIndex,
        rule: record.extraction.rules[verdict.ruleIndex] as ExtractedRule,
        verdict: verdict.verdict,
        note: verdict.note,
      }),
    ),
  );
  const missedRules = pairs.flatMap(({ record, label }) =>
    label.missedRules.map((description) => ({ changeSetId: record.changeSetId, description })),
  );
  const usage = sumUsage(records.map((record) => record.usage));

  return {
    changeSets: { extracted: records.length, labeled: pairs.length, stale: labeledRecords.length - pairs.length },
    rules: scoreRules(graded, missedRules.length),
    classification: scoreClassification(pairs),
    byRuleType: RULE_TYPES.map((ruleType) => ({
      ruleType,
      ...graded.filter((item) => item.rule.rule_type === ruleType).reduce((t, item) => addVerdict(t, item.verdict), EMPTY_TALLY),
    })).filter((row) => row.extracted > 0),
    calibration: CONFIDENCE_BUCKETS.map((bucket) => {
      const inBucket = graded.filter((item) => item.rule.confidence >= bucket.min && item.rule.confidence < bucket.max);
      const correct = inBucket.filter((item) => item.verdict === "correct").length;
      return { bucket: bucket.label, extracted: inBucket.length, correct, accuracy: ratio(correct, inBucket.length) };
    }),
    usage,
    costUsd: estimateUsd(usage),
    reviewNotes: graded
      .filter((item) => item.verdict !== "correct")
      .map(({ changeSetId, ruleIndex, verdict, rule, note }) => ({ changeSetId, ruleIndex, verdict, statement: rule.statement, note })),
    missedRules,
  };
}

function scoreRules(graded: readonly GradedRule[], missed: number): Scorecard["rules"] {
  const tally = graded.reduce((t, item) => addVerdict(t, item.verdict), EMPTY_TALLY);
  const hits = tally.correct + tally.partial;
  // Partial rules are real rules, so they belong to the ground truth either way.
  const groundTruth = hits + missed;

  return {
    ...tally,
    missed,
    strictPrecision: ratio(tally.correct, tally.extracted),
    lenientPrecision: ratio(hits, tally.extracted),
    strictRecall: ratio(tally.correct, groundTruth),
    lenientRecall: ratio(hits, groundTruth),
  };
}

function scoreClassification(
  pairs: ReadonlyArray<{ record: ExtractionRecord; label: Label }>,
): Scorecard["classification"] {
  const confusion = pairs.reduce<Confusion>((counts, { record, label }) => {
    const predicted = record.extraction.changes_business_rules;
    const actual = label.changesBusinessRules;
    const key: keyof Confusion = predicted
      ? actual ? "truePositive" : "falsePositive"
      : actual ? "falseNegative" : "trueNegative";
    return { ...counts, [key]: counts[key] + 1 };
  }, EMPTY_CONFUSION);

  return {
    ...confusion,
    precision: ratio(confusion.truePositive, confusion.truePositive + confusion.falsePositive),
    recall: ratio(confusion.truePositive, confusion.truePositive + confusion.falseNegative),
  };
}
