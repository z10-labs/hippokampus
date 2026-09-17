import picomatch from "picomatch";
import { UNMAPPED_DIRECTORY_DEPTH } from "../config";
import { directoryOf, groupBy } from "../util/collections";
import type { ContextMap } from "./types";

/** Files that carry no business meaning and shouldn't count against coverage. */
export const DEFAULT_IGNORED_PATTERNS: readonly string[] = [
  ".github/**",
  ".claude/**",
  ".agents/**",
  ".vscode/**",
  ".husky/**",
  "**/.*",
  "**/*.md",
  "**/LICENSE*",
  "**/{package-lock.json,pnpm-lock.yaml,yarn.lock}",
  "**/*.{png,jpg,jpeg,gif,svg,ico,webp,woff,woff2,ttf}",
];

const MAX_LISTED = 15;

type Matcher = (filePath: string) => boolean;
const NEVER: Matcher = () => false;

/**
 * Parentheses are literal path characters in many frameworks (Next.js route groups like
 * "(tutor)"), but picomatch reads them as extglob groups. Escape them; use {a,b} for alternatives.
 * Brackets such as "[id]" already fall back to literal matching in picomatch.
 */
export const toLiteralGlob = (pattern: string): string => pattern.replace(/(?<!\\)([()])/g, "\\$1");

const compile = (patterns: readonly string[]): Matcher =>
  patterns.length === 0 ? NEVER : picomatch(patterns.map(toLiteralGlob), { dot: true });

export interface ClassifiedFile {
  path: string;
  contextIds: string[];
  shared: boolean;
  ignored: boolean;
}

export interface CoverageReport {
  totalFiles: number;
  ignored: number;
  mapped: number;
  overlapping: number;
  sharedOnly: number;
  unmapped: number;
  /** (mapped + shared) ÷ relevant files; null when nothing is relevant. */
  coverage: number | null;
  perContext: Array<{ id: string; files: number }>;
  unmappedDirectories: Array<{ directory: string; files: number }>;
  overlaps: Array<{ contextIds: string[]; files: number; example: string }>;
  unusedPatterns: Array<{ owner: string; pattern: string }>;
}

const activeContexts = (map: ContextMap) => map.contexts.filter((context) => context.status !== "deprecated");

export function classifyFiles(
  paths: readonly string[],
  map: ContextMap,
  ignoredPatterns: readonly string[] = DEFAULT_IGNORED_PATTERNS,
): ClassifiedFile[] {
  const contexts = activeContexts(map).map((context) => ({ id: context.id, matches: compile(context.pathPatterns) }));
  const isShared = compile(map.sharedPaths.map((shared) => shared.pattern));
  const isIgnored = compile(ignoredPatterns);

  return paths.map((filePath) => ({
    path: filePath,
    contextIds: contexts.filter((context) => context.matches(filePath)).map((context) => context.id),
    shared: isShared(filePath),
    ignored: isIgnored(filePath),
  }));
}

/** Candidate contexts for a set of changed files, most-touched first. */
export function contextsForPaths(paths: readonly string[], map: ContextMap): string[] {
  const matchedIds = classifyFiles(paths, map, []).flatMap((file) => file.contextIds);
  return [...groupBy(matchedIds, (id) => id).entries()]
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([id]) => id);
}

export function computeCoverage(
  paths: readonly string[],
  map: ContextMap,
  ignoredPatterns: readonly string[] = DEFAULT_IGNORED_PATTERNS,
): CoverageReport {
  const files = classifyFiles(paths, map, ignoredPatterns);
  const relevant = files.filter((file) => !file.ignored);
  const mapped = relevant.filter((file) => file.contextIds.length > 0);
  const overlapping = mapped.filter((file) => file.contextIds.length > 1);
  const sharedOnly = relevant.filter((file) => file.contextIds.length === 0 && file.shared);
  const unmapped = relevant.filter((file) => file.contextIds.length === 0 && !file.shared);

  return {
    totalFiles: files.length,
    ignored: files.length - relevant.length,
    mapped: mapped.length,
    overlapping: overlapping.length,
    sharedOnly: sharedOnly.length,
    unmapped: unmapped.length,
    coverage: relevant.length === 0 ? null : (mapped.length + sharedOnly.length) / relevant.length,
    perContext: activeContexts(map).map((context) => ({
      id: context.id,
      files: mapped.filter((file) => file.contextIds.includes(context.id)).length,
    })),
    unmappedDirectories: largestGroups(unmapped, (file) =>
      directoryOf(file.path).split("/").slice(0, UNMAPPED_DIRECTORY_DEPTH).join("/") || ".",
    ).map(({ key, items }) => ({ directory: key, files: items.length })),
    overlaps: largestGroups(overlapping, (file) => file.contextIds.join(" + ")).map(({ items }) => ({
      contextIds: items[0]?.contextIds ?? [],
      files: items.length,
      example: items[0]?.path ?? "",
    })),
    // Checked against every file: a pattern for ignored files (docs, CI config) is still in use.
    unusedPatterns: findUnusedPatterns(paths, map),
  };
}

function largestGroups<T>(items: readonly T[], keyOf: (item: T) => string): Array<{ key: string; items: T[] }> {
  return [...groupBy(items, keyOf).entries()]
    .map(([key, grouped]) => ({ key, items: grouped }))
    .sort((a, b) => b.items.length - a.items.length || a.key.localeCompare(b.key))
    .slice(0, MAX_LISTED);
}

/** Patterns that match nothing are usually typos or stale after code moved. */
function findUnusedPatterns(paths: readonly string[], map: ContextMap): Array<{ owner: string; pattern: string }> {
  const entries = [
    ...activeContexts(map).flatMap((context) => context.pathPatterns.map((pattern) => ({ owner: context.id, pattern }))),
    ...map.sharedPaths.map((shared) => ({ owner: "shared", pattern: shared.pattern })),
  ];
  return entries.filter(({ pattern }) => !paths.some(compile([pattern])));
}
