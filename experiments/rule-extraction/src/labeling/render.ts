import type { ChangeSet } from "../changeset/types";
import type { ExtractionRecord } from "../extraction/record";
import type { ExtractedRule } from "../extraction/schema";

const SNIPPET_PREVIEW_LINES = 4;
const RULE_LINE = "═".repeat(72);

export const GRADING_GUIDE = `
How to grade
  correct  A real business rule, stated accurately, with the right change kind.
  partial  A real rule, but the statement, condition, change kind or evidence is noticeably off,
           or two separate rules were merged into one.
  wrong    A technical constraint rather than a business rule, or it misreads what the code does.
  missed   A business rule this change introduces, modifies or retires that isn't in the list.
           Check "Excluded as technical" too: a real business rule hiding there counts as missed.

Open the link to read the diff. Labels save after each change set, so you can stop with Ctrl+C and resume.`;

export function renderChangeSetHeader(changeSet: ChangeSet, record: ExtractionRecord, progress: string): string {
  const diffUrl = changeSet.kind === "pull_request" ? `${changeSet.url}/files` : changeSet.url;
  const {
    changes_business_rules: changesRules,
    classification_reason: reason,
    excluded_technical_changes: excluded,
  } = record.extraction;

  return [
    "",
    RULE_LINE,
    `[${progress}] ${changeSet.id} · ${changeSet.title}`,
    diffUrl,
    `${changeSet.files.length} file(s) reviewed · ${changeSet.droppedFiles.length} omitted · ${changeSet.reviews.length} review(s)`,
    `Model: business rules changed? ${changesRules ? "YES" : "no"}. ${reason}`,
    ...(excluded.length > 0 ? ["Excluded as technical:", ...excluded.map((item) => `  - ${item}`)] : []),
    RULE_LINE,
  ].join("\n");
}

export function renderRule(rule: ExtractedRule, index: number): string {
  const evidence = rule.evidence.map((item) => {
    const preview = item.snippet
      .split("\n")
      .slice(0, SNIPPET_PREVIEW_LINES)
      .map((line) => `        │ ${line}`);
    return [`      · ${item.kind} in ${item.file}${item.symbol ? ` (${item.symbol})` : ""}`, ...preview].join("\n");
  });

  return [
    "",
    `  #${index + 1} [${rule.change_kind} · ${rule.rule_type} · owner ${rule.business_owner} · confidence ${rule.confidence.toFixed(2)}]`,
    `  ${rule.statement}`,
    `    when: ${rule.condition}`,
    `    then: ${rule.outcome}`,
    `    entities: ${rule.entities.join(", ") || "none"}`,
    "    evidence:",
    ...evidence,
  ].join("\n");
}
