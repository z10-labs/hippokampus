import type { Scorecard } from "./score";

export interface ReportMeta {
  repo: string;
  model: string;
  promptVersion: string;
  generatedAt: string;
}

const pct = (value: number | null): string => (value === null ? "—" : `${Math.round(value * 100)}%`);
const table = (header: string[], rows: string[][]): string[] => [
  `| ${header.join(" | ")} |`,
  `|${header.map(() => "---").join("|")}|`,
  ...rows.map((row) => `| ${row.join(" | ")} |`),
];
const bulletsOrNone = (items: string[]): string[] => (items.length === 0 ? ["None."] : items);

export function renderReport(card: Scorecard, meta: ReportMeta): string {
  return [
    ...headerSection(card, meta),
    ...rulesSection(card),
    ...classificationSection(card),
    ...breakdownSection(card),
    ...costSection(card),
    ...notesSection(card),
  ].join("\n");
}

function headerSection(card: Scorecard, meta: ReportMeta): string[] {
  const { extracted, labeled, stale } = card.changeSets;
  const staleNote = stale > 0 ? ` ${stale} stale label(s) ignored; re-run \`label --relabel\`.` : "";
  return [
    `# Rule extraction scorecard: ${meta.repo}`,
    "",
    `Model \`${meta.model}\` · prompt ${meta.promptVersion} · generated ${meta.generatedAt} · ${labeled} of ${extracted} change sets labeled.${staleNote}`,
    "",
  ];
}

function rulesSection(card: Scorecard): string[] {
  const r = card.rules;
  return [
    "## Rules",
    "",
    ...table(
      ["Metric", "Strict", "Lenient", "Counts"],
      [
        ["Precision", pct(r.strictPrecision), pct(r.lenientPrecision), `${r.correct} correct · ${r.partial} partial · ${r.wrong} wrong of ${r.extracted}`],
        ["Recall", pct(r.strictRecall), pct(r.lenientRecall), `${r.missed} missed`],
      ],
    ),
    "",
    "Strict counts only *correct* rules as hits; lenient also counts *partial* ones.",
    "",
  ];
}

function classificationSection(card: Scorecard): string[] {
  const c = card.classification;
  return [
    "## Does the change alter business rules?",
    "",
    ...table(
      ["", "Human: yes", "Human: no"],
      [
        ["**Model: yes**", String(c.truePositive), String(c.falsePositive)],
        ["**Model: no**", String(c.falseNegative), String(c.trueNegative)],
      ],
    ),
    "",
    `Precision ${pct(c.precision)} · recall ${pct(c.recall)}`,
    "",
  ];
}

function breakdownSection(card: Scorecard): string[] {
  return [
    "## By rule type",
    "",
    ...table(
      ["Type", "Extracted", "Correct", "Partial", "Wrong"],
      card.byRuleType.map((row) => [row.ruleType, String(row.extracted), String(row.correct), String(row.partial), String(row.wrong)]),
    ),
    "",
    "## Confidence calibration",
    "",
    ...table(
      ["Model confidence", "Rules", "Correct", "Accuracy"],
      card.calibration.map((row) => [row.bucket, String(row.extracted), String(row.correct), pct(row.accuracy)]),
    ),
    "",
  ];
}

function costSection(card: Scorecard): string[] {
  const u = card.usage;
  return [
    "## Cost",
    "",
    `${u.inputTokens.toLocaleString("en-US")} input and ${u.outputTokens.toLocaleString("en-US")} output tokens across ${card.changeSets.extracted} extraction(s): about $${card.costUsd.toFixed(2)}.`,
    "",
  ];
}

function notesSection(card: Scorecard): string[] {
  return [
    "## Wrong and partial rules",
    "",
    ...bulletsOrNone(
      card.reviewNotes.map(
        (item) => `- **${item.verdict}** ${item.changeSetId} #${item.ruleIndex + 1}: ${item.statement}${item.note ? ` (${item.note})` : ""}`,
      ),
    ),
    "",
    "## Missed rules",
    "",
    ...bulletsOrNone(card.missedRules.map((item) => `- ${item.changeSetId}: ${item.description}`)),
    "",
  ];
}
