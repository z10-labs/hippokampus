import type { CoverageReport } from "./coverage";
import type { ContextMap } from "./types";

const pct = (value: number | null): string => (value === null ? "—" : `${Math.round(value * 100)}%`);
const section = (title: string, lines: string[]): string[] => (lines.length === 0 ? [] : ["", title, ...lines]);

export function renderContextMap(map: ContextMap): string {
  return [
    `Context map for ${map.repo} @ ${map.commitSha.slice(0, 7)} · ${map.status} · ${map.contexts.length} context(s)`,
    ...map.contexts.flatMap((context) => [
      "",
      `  ${context.id} · ${context.name} [${context.status}]`,
      `    ${context.description}`,
      `    paths:   ${context.pathPatterns.join(", ")}`,
      ...(context.aliases.length > 0 ? [`    aliases: ${context.aliases.join(", ")}`] : []),
    ]),
    ...section(
      "  Shared (no business context):",
      map.sharedPaths.map((shared) => `    ${shared.pattern} (${shared.reason})`),
    ),
    ...section("  Open questions:", map.openQuestions.map((question) => `    - ${question}`)),
  ].join("\n");
}

export function renderCoverage(report: CoverageReport): string {
  const idWidth = Math.max(8, ...report.perContext.map((context) => context.id.length));

  return [
    `Coverage: ${pct(report.coverage)} of ${report.totalFiles - report.ignored} relevant files (${report.ignored} ignored)`,
    `  in a context ${report.mapped} · shared ${report.sharedOnly} · unmapped ${report.unmapped} · in more than one context ${report.overlapping}`,
    ...section(
      "Files per context:",
      report.perContext.map(
        (context) =>
          `  ${context.id.padEnd(idWidth)} ${String(context.files).padStart(4)}${context.files === 0 ? "  ⚠ matches no files" : ""}`,
      ),
    ),
    ...section(
      "Largest unmapped directories:",
      report.unmappedDirectories.map((entry) => `  ${entry.directory}  ${entry.files}`),
    ),
    ...section(
      "Files in more than one context:",
      report.overlaps.map((overlap) => `  ${overlap.contextIds.join(" + ")}  ${overlap.files} file(s), e.g. ${overlap.example}`),
    ),
    ...section(
      "Patterns that match no files:",
      report.unusedPatterns.map((unused) => `  ${unused.owner}: ${unused.pattern}`),
    ),
  ].join("\n");
}
