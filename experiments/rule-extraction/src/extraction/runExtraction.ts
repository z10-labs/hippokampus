import { existsSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { ChangeSetSchema } from "../changeset/types";
import { assertCredentials } from "../claude/credentials";
import { EXTRACTION_VARIANT } from "../config";
import { ContextMapSchema } from "../contexts/types";
import { estimateUsd } from "../scoring/cost";
import { jsonFile, readAllJson, readJson, repoPaths, writeJson } from "../store/store";
import { mapWithConcurrency } from "../util/concurrency";
import { contextMapFingerprint, extractChangeSet } from "./extract";
import { type ExtractionRecord, ExtractionRecordSchema } from "./record";

export interface ExtractionRunOptions {
  repo: string;
  only: readonly string[] | null;
  force: boolean;
  concurrency: number;
}

export async function runExtraction(options: ExtractionRunOptions): Promise<number> {
  assertCredentials();
  const paths = repoPaths(options.repo, EXTRACTION_VARIANT);
  if (!existsSync(paths.contextMap)) {
    throw new Error(`No context map at ${paths.contextMap}. Run \`pnpm cli contexts-draft --repo ${options.repo}\` first.`);
  }
  const [changeSets, contextMap] = await Promise.all([
    readAllJson(paths.changeSets, ChangeSetSchema),
    readJson(paths.contextMap, ContextMapSchema),
  ]);
  if (changeSets.length === 0) {
    throw new Error(`No change sets in ${paths.changeSets}. Run \`pnpm cli fetch --repo ${options.repo}\` first.`);
  }
  if (contextMap.status !== "confirmed") {
    throw new Error(`Context map ${paths.contextMap} is still a draft. Review and confirm it before extraction.`);
  }
  const proposedContexts = contextMap.contexts.filter((context) => context.status === "proposed");
  if (proposedContexts.length > 0) {
    throw new Error(`Confirmed map still has proposed context(s): ${proposedContexts.map((context) => context.id).join(", ")}`);
  }
  if (!contextMap.contexts.some((context) => context.status === "confirmed")) {
    throw new Error(`Context map ${paths.contextMap} has no confirmed contexts.`);
  }

  const unknownIds = (options.only ?? []).filter((id) => !changeSets.some((changeSet) => changeSet.id === id));
  if (unknownIds.length > 0) {
    throw new Error(`Unknown change set id(s): ${unknownIds.join(", ")}`);
  }

  const selected = changeSets.filter((changeSet) => options.only === null || options.only.includes(changeSet.id));
  const contextMapHash = contextMapFingerprint(contextMap);
  const existingRecords = await readAllJson(paths.extractions, ExtractionRecordSchema);
  assertContextMapProvenance(existingRecords, contextMapHash, options.force, options.only);
  const pending = selected.filter(
    (changeSet) => options.force || !existsSync(jsonFile(paths.extractions, changeSet.id)),
  );
  console.log(`Extracting ${pending.length} change set(s) with ${EXTRACTION_VARIANT}; ${selected.length - pending.length} already done.`);

  const client = new Anthropic();
  const results = await mapWithConcurrency(pending, options.concurrency, async (changeSet) => {
    const record = await extractChangeSet(client, changeSet, contextMap);
    await writeJson(jsonFile(paths.extractions, changeSet.id), record);
    console.log(
      `  ✓ ${changeSet.id}: ${record.extraction.rules.length} rule(s) · $${estimateUsd(record.usage).toFixed(3)}`,
    );
    return record;
  });

  const records = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  const failures = results.flatMap((result, index) =>
    result.status === "rejected" ? [`${pending[index]?.id}: ${describeError(result.reason)}`] : [],
  );
  const runUsd = records.reduce((sum, record) => sum + estimateUsd(record.usage), 0);

  console.log(`Done: ${records.length} extracted, ${failures.length} failed, ~$${runUsd.toFixed(2)} this run.`);
  failures.forEach((failure) => console.error(`  ✗ ${failure}`));
  return failures.length === 0 ? 0 : 1;
}

export function assertContextMapProvenance(
  existingRecords: ReadonlyArray<Pick<ExtractionRecord, "changeSetId" | "contextMapHash">>,
  currentHash: string,
  force: boolean,
  only: readonly string[] | null,
): void {
  const mismatchedIds = existingRecords
    .filter((record) => record.contextMapHash !== currentHash)
    .map((record) => record.changeSetId);
  if (mismatchedIds.length === 0) return;
  if (force && only === null) return;

  const action = force
    ? "The map changed, so omit --only and use --force to re-extract every cached v4 record."
    : "Re-run with --force to re-extract every cached v4 record.";
  throw new Error(
    `Cached extraction(s) use a different context map: ${mismatchedIds.join(", ")}. ${action}`,
  );
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "authentication failed; check ANTHROPIC_API_KEY";
  if (error instanceof Anthropic.RateLimitError) return "rate limited after retries; lower --concurrency and rerun";
  if (error instanceof Anthropic.APIError) return `API error ${error.status}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}
