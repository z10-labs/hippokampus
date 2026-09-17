import { baseNameOf, directoryOf, groupBy } from "../util/collections";

export interface RepoDoc {
  path: string;
  content: string;
}

/** Everything the draft is based on, collected from the repo at one commit. */
export interface RepoSignals {
  repo: string;
  ref: string;
  commitSha: string;
  paths: string[];
  treeTruncated: boolean;
  prTitles: string[];
  docs: RepoDoc[];
}

export interface TreeSummary {
  mode: "files" | "directories";
  text: string;
}

const CONVENTIONAL_TITLE = /^[a-z]+\(([^)]+)\)!?:/i;
const MAX_SUMMARY_DEPTH = 8;

/** Counts conventional-commit scopes ("feat(invoicing): …") across PR titles, most frequent first. */
export function countScopes(titles: readonly string[]): Array<{ scope: string; count: number }> {
  const scopes = titles.flatMap((title) => {
    const scopeList = CONVENTIONAL_TITLE.exec(title.trim())?.[1];
    if (!scopeList) return [];
    return scopeList
      .split(/[,/]/)
      .map((scope) => scope.trim().toLowerCase())
      .filter((scope) => scope !== "");
  });

  return [...groupBy(scopes, (scope) => scope).entries()]
    .map(([scope, occurrences]) => ({ scope, count: occurrences.length }))
    .sort((a, b) => b.count - a.count || a.scope.localeCompare(b.scope));
}

/** Every file, one line per directory: "apps/web/src/lib/: invoices.ts, sessions.ts". */
export function renderFileListing(paths: readonly string[]): string {
  return [...groupBy([...paths].sort(), directoryOf).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([directory, files]) => `${directory || "."}/: ${files.map(baseNameOf).join(", ")}`)
    .join("\n");
}

/** Directory file counts at the deepest level that fits within maxChars. */
export function renderDirectorySummary(paths: readonly string[], maxChars: number): string {
  const renderAtDepth = (depth: number): string =>
    [...groupBy(paths, (filePath) => directoryOf(filePath).split("/").slice(0, depth).join("/")).entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([directory, files]) => `${directory || "."}/ (${files.length} files)`)
      .join("\n");

  const depthsDeepestFirst = Array.from({ length: MAX_SUMMARY_DEPTH }, (_, index) => MAX_SUMMARY_DEPTH - index);
  return depthsDeepestFirst.map(renderAtDepth).find((text) => text.length <= maxChars) ?? renderAtDepth(1);
}

/** Full file listing when it fits; otherwise a directory summary. The mode is reported, never hidden. */
export function summariseTree(paths: readonly string[], maxChars: number): TreeSummary {
  const listing = renderFileListing(paths);
  return listing.length <= maxChars
    ? { mode: "files", text: listing }
    : { mode: "directories", text: renderDirectorySummary(paths, maxChars) };
}

const DOC_PRIORITIES: ReadonlyArray<readonly [RegExp, number]> = [
  [/^readme\.md$/i, 0],
  [/^(\.github\/|docs\/)?codeowners$/i, 1],
  [/^(claude|agents)\.md$/i, 2],
  [/(^|\/)(architecture[^/]*|adrs?|decisions?|domains?|context)\/.*\.md$/i, 3],
  [/(^|\/)(architecture|domain)[^/]*\.md$/i, 3],
  [/^docs\/[^/]+\.md$/i, 4],
  [/^[^/]+\/[^/]+\/readme\.md$/i, 5],
];
const EXCLUDED_DOC_PREFIXES = [".claude/", ".agents/", "node_modules/"];

/** Picks the documents most likely to describe the domain: root README, agent notes, architecture docs. */
export function selectDocPaths(paths: readonly string[], limit: number): string[] {
  return paths
    .filter((filePath) => !EXCLUDED_DOC_PREFIXES.some((prefix) => filePath.startsWith(prefix)))
    .flatMap((filePath) => {
      const priority = DOC_PRIORITIES.find(([pattern]) => pattern.test(filePath))?.[1];
      return priority === undefined ? [] : [{ filePath, priority }];
    })
    .sort((a, b) => a.priority - b.priority || a.filePath.localeCompare(b.filePath))
    .slice(0, limit)
    .map(({ filePath }) => filePath);
}
