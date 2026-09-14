import type { DiffFile, DroppedFile } from "./types";

const DIFF_HEADER = /^diff --git a\/(.+?) b\/(.+)$/;

/** Single-file patches above this size are almost always generated (schemas, fixtures, bundles). */
export const MAX_FILE_PATCH_CHARS = 80_000;

const LOCKFILES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "gradle.lockfile",
  "Cargo.lock",
  "poetry.lock",
  "Pipfile.lock",
  "go.sum",
  "composer.lock",
  "Gemfile.lock",
]);
const TOP_LEVEL_GENERATED_DIRS = ["dist/", "build/", "target/", ".next/", "vendor/", "coverage/", ".gradle/"];
const ASSET_EXTENSION = /\.(png|jpe?g|gif|svg|ico|webp|pdf|woff2?|ttf|eot|jar|zip|gz|mp4|mov)$/i;
const MINIFIED = /\.(min\.(js|css)|map)$/i;
const BINARY_MARKER = /^(Binary files .* differ|GIT binary patch)$/m;

export function splitUnifiedDiff(diff: string): DiffFile[] {
  const lines = diff.split("\n");
  const starts = lines.flatMap((line, index) => (DIFF_HEADER.test(line) ? [index] : []));

  return starts.map((start, n) => {
    const end = starts[n + 1] ?? lines.length;
    const header = DIFF_HEADER.exec(lines[start] ?? "");
    return {
      path: header?.[2] ?? "",
      patch: lines.slice(start, end).join("\n").trimEnd(),
    };
  });
}

/** Why a file carries no business meaning, or null when it should be reviewed. */
export function noiseReason(file: DiffFile): string | null {
  const fileName = file.path.split("/").pop() ?? file.path;

  if (LOCKFILES.has(fileName)) return "lockfile";
  if (file.path.includes("node_modules/")) return "generated or vendored directory";
  if (TOP_LEVEL_GENERATED_DIRS.some((dir) => file.path.startsWith(dir))) {
    return "generated or vendored directory";
  }
  if (ASSET_EXTENSION.test(file.path) || BINARY_MARKER.test(file.patch)) return "binary or asset";
  if (MINIFIED.test(file.path)) return "minified or source map";
  if (file.patch.length > MAX_FILE_PATCH_CHARS) {
    return `patch over ${MAX_FILE_PATCH_CHARS} chars (likely generated)`;
  }
  return null;
}

export function filterDiff(diff: string): { kept: DiffFile[]; dropped: DroppedFile[] } {
  const classified = splitUnifiedDiff(diff).map((file) => ({ file, reason: noiseReason(file) }));

  return {
    kept: classified.flatMap(({ file, reason }) => (reason === null ? [file] : [])),
    dropped: classified.flatMap(({ file, reason }) => (reason === null ? [] : [{ path: file.path, reason }])),
  };
}
