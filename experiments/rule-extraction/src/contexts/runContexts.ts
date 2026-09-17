import { existsSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { assertCredentials } from "../claude/credentials";
import { CONTEXT_PR_TITLE_LIMIT, CONTEXT_TREE_MAX_CHARS, EXTRACTION_VARIANT } from "../config";
import { estimateUsd } from "../scoring/cost";
import { readJson, repoPaths, writeJson } from "../store/store";
import { collectSignals, fetchRepoTree } from "./collectSignals";
import { computeCoverage } from "./coverage";
import { draftContextMap } from "./draftContextMap";
import { renderContextMap, renderCoverage } from "./render";
import { summariseTree } from "./signals";
import { ContextMapSchema } from "./types";

export async function runContextDraft(options: { repo: string; force: boolean }): Promise<number> {
  assertCredentials();
  const { contextMap: mapPath } = repoPaths(options.repo, EXTRACTION_VARIANT);
  if (existsSync(mapPath) && !options.force) {
    throw new Error(`${mapPath} already exists and may contain your edits. Pass --force to replace it.`);
  }

  console.log(`Collecting signals from ${options.repo}…`);
  const signals = await collectSignals(options.repo, CONTEXT_PR_TITLE_LIMIT);
  const treeMode = summariseTree(signals.paths, CONTEXT_TREE_MAX_CHARS).mode;
  console.log(
    `  ${signals.paths.length} files (${treeMode === "files" ? "full listing" : "directory summary"}) · ${signals.prTitles.length} PR titles · docs: ${signals.docs.map((doc) => doc.path).join(", ") || "none"}`,
  );
  if (signals.treeTruncated) {
    console.warn("  Warning: GitHub truncated the file tree, so the draft may miss parts of the repo.");
  }

  console.log("Drafting the context map…");
  const { map, usage } = await draftContextMap(new Anthropic(), signals);
  await writeJson(mapPath, map);

  console.log(`\n${renderContextMap(map)}\n`);
  console.log(renderCoverage(computeCoverage(signals.paths, map)));
  console.log(`\nDraft saved to ${mapPath} (~$${estimateUsd(usage).toFixed(3)}).`);
  console.log(
    `Review it: rename, merge or split contexts, fix patterns, set "status": "confirmed". Then run: pnpm cli contexts-check --repo ${options.repo}`,
  );
  return 0;
}

export async function runContextCheck(options: { repo: string }): Promise<number> {
  const { contextMap: mapPath } = repoPaths(options.repo, EXTRACTION_VARIANT);
  if (!existsSync(mapPath)) {
    throw new Error(`No context map at ${mapPath}. Run \`pnpm cli contexts-draft --repo ${options.repo}\` first.`);
  }

  const [map, tree] = await Promise.all([readJson(mapPath, ContextMapSchema), fetchRepoTree(options.repo)]);

  console.log(`${renderContextMap(map)}\n`);
  if (tree.commitSha !== map.commitSha) {
    console.log(`Map drafted at ${map.commitSha.slice(0, 7)}; checking against ${tree.ref} @ ${tree.commitSha.slice(0, 7)}.\n`);
  }
  console.log(renderCoverage(computeCoverage(tree.paths, map)));
  if (map.status === "draft") {
    console.log('\nThe map is still a draft. Set "status": "confirmed" once you have reviewed it.');
  }
  return 0;
}
