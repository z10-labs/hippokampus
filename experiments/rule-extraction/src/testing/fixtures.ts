import type { ChangeSet } from "../changeset/types";
import type { ExtractionRecord, Usage } from "../extraction/record";
import type { ExtractedRule } from "../extraction/schema";
import type { Label } from "../labeling/types";

export function makeRule(overrides: Partial<ExtractedRule> = {}): ExtractedRule {
  return {
    business_owner: "Finance",
    statement: "Invoices are due 14 days after issue.",
    rule_type: "temporal",
    change_kind: "modified",
    condition: "An invoice is issued",
    outcome: "Its due date is 14 days later",
    entities: ["Invoice"],
    attributes: ["Invoice.dueDate"],
    bounded_context: "Billing",
    evidence: [
      {
        kind: "diff_hunk",
        file: "src/main/java/Invoice.java",
        symbol: "Invoice.DUE_DAYS",
        snippet: "-  static final int DUE_DAYS = 30;\n+  static final int DUE_DAYS = 14;",
      },
    ],
    confidence: 0.9,
    ...overrides,
  };
}

export function makeChangeSet(overrides: Partial<ChangeSet> = {}): ChangeSet {
  return {
    id: "pr-1",
    kind: "pull_request",
    repo: "acme/billing",
    number: 1,
    sha: "abc1234def",
    url: "https://github.com/acme/billing/pull/1",
    title: "Shorten invoice due period",
    description: "Finance asked for 14-day terms.",
    author: "dev",
    mergedAt: "2026-03-02T10:00:00Z",
    reviews: [],
    comments: [],
    files: [
      {
        path: "src/main/java/Invoice.java",
        patch: "diff --git a/src/main/java/Invoice.java b/src/main/java/Invoice.java\n-  static final int DUE_DAYS = 30;\n+  static final int DUE_DAYS = 14;",
      },
    ],
    droppedFiles: [],
    ...overrides,
  };
}

const DEFAULT_USAGE: Usage = {
  inputTokens: 10_000,
  outputTokens: 2_000,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
};

export function makeRecord(
  overrides: {
    changeSetId?: string;
    rules?: ExtractedRule[];
    changesBusinessRules?: boolean;
    excludedTechnicalChanges?: string[];
    usage?: Usage;
    extractedAt?: string;
  } = {},
): ExtractionRecord {
  const rules = overrides.rules ?? [makeRule()];
  return {
    changeSetId: overrides.changeSetId ?? "pr-1",
    model: "claude-sonnet-5",
    promptVersion: "v2",
    extractedAt: overrides.extractedAt ?? "2026-09-14T10:00:00.000Z",
    stopReason: "end_turn",
    usage: overrides.usage ?? DEFAULT_USAGE,
    extraction: {
      changes_business_rules: overrides.changesBusinessRules ?? rules.length > 0,
      classification_reason: "Changes invoice terms.",
      excluded_technical_changes: overrides.excludedTechnicalChanges ?? [],
      rules,
    },
  };
}

export function makeLabel(overrides: Partial<Label> = {}): Label {
  return {
    changeSetId: "pr-1",
    model: "claude-sonnet-5",
    changesBusinessRules: true,
    ruleVerdicts: [{ ruleIndex: 0, verdict: "correct", note: "" }],
    missedRules: [],
    labeledAt: "2026-09-14T12:00:00.000Z",
    ...overrides,
  };
}
