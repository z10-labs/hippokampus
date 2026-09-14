import { existsSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { ChangeSetSchema } from "../changeset/types";
import { EXTRACTION_VARIANT } from "../config";
import { estimateUsd } from "../scoring/cost";
import { jsonFile, readAllJson, repoPaths, writeJson } from "../store/store";
import { mapWithConcurrency } from "../util/concurrency";
import { extractChangeSet } from "./extract";

export interface ExtractionRunOptions {
  repo: string;
  only: readonly string[] | null;
  force: boolean;
  concurrency: number;
}

export async function runExtraction(options: ExtractionRunOptions): Promise<number> {
  assertCredentials();
  const paths = repoPaths(options.repo, EXTRACTION_VARIANT);
  const changeSets = await readAllJson(paths.changeSets, ChangeSetSchema);
  if (changeSets.length === 0) {
    throw new Error(`No change sets in ${paths.changeSets}. Run \`pnpm cli fetch --repo ${options.repo}\` first.`);
  }

  const unknownIds = (options.only ?? []).filter((id) => !changeSets.some((changeSet) => changeSet.id === id));
  if (unknownIds.length > 0) {
    throw new Error(`Unknown change set id(s): ${unknownIds.join(", ")}`);
  }

  const selected = changeSets.filter((changeSet) => options.only === null || options.only.includes(changeSet.id));
  const pending = selected.filter(
    (changeSet) => options.force || !existsSync(jsonFile(paths.extractions, changeSet.id)),
  );
  console.log(`Extracting ${pending.length} change set(s) with ${EXTRACTION_VARIANT}; ${selected.length - pending.length} already done.`);

  const client = new Anthropic();
  const results = await mapWithConcurrency(pending, options.concurrency, async (changeSet) => {
    const record = await extractChangeSet(client, changeSet);
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

function assertCredentials(): void {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new Error("No Anthropic credentials found. Copy .env.example to .env and set ANTHROPIC_API_KEY.");
  }
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "authentication failed; check ANTHROPIC_API_KEY";
  if (error instanceof Anthropic.RateLimitError) return "rate limited after retries; lower --concurrency and rerun";
  if (error instanceof Anthropic.APIError) return `API error ${error.status}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}
