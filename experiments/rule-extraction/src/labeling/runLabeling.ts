import { existsSync } from "node:fs";
import { stdin, stdout } from "node:process";
import { createInterface, type Interface } from "node:readline/promises";
import type { ChangeSet } from "../changeset/types";
import { ChangeSetSchema } from "../changeset/types";
import { EXTRACTION_VARIANT } from "../config";
import { type ExtractionRecord, ExtractionRecordSchema } from "../extraction/record";
import { jsonFile, readAllJson, repoPaths, writeJson } from "../store/store";
import { mapSequential } from "../util/concurrency";
import { GRADING_GUIDE, renderChangeSetHeader, renderRule } from "./render";
import type { Label } from "./types";
import { parseVerdict, parseYesNo } from "./verdict";

export async function runLabeling(options: { repo: string; relabel: boolean }): Promise<number> {
  const paths = repoPaths(options.repo, EXTRACTION_VARIANT);
  const [changeSets, records] = await Promise.all([
    readAllJson(paths.changeSets, ChangeSetSchema),
    readAllJson(paths.extractions, ExtractionRecordSchema),
  ]);
  const changeSetById = new Map(changeSets.map((changeSet) => [changeSet.id, changeSet]));
  const queue = records.filter((record) => options.relabel || !existsSync(jsonFile(paths.labels, record.changeSetId)));

  if (queue.length === 0) {
    console.log(records.length === 0 ? "No extractions yet; run extract first." : "Everything is labeled. Run score, or pass --relabel.");
    return 0;
  }

  console.log(GRADING_GUIDE);
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    await mapSequential(queue, async (record, index) => {
      const changeSet = changeSetById.get(record.changeSetId);
      if (!changeSet) throw new Error(`Change set ${record.changeSetId} is missing; re-run fetch`);

      const label = await labelChangeSet(rl, changeSet, record, `${index + 1}/${queue.length}`);
      await writeJson(jsonFile(paths.labels, changeSet.id), label);
    });
  } finally {
    rl.close();
  }
  console.log("\nAll change sets labeled. Next: pnpm cli score --repo", options.repo);
  return 0;
}

async function labelChangeSet(
  rl: Interface,
  changeSet: ChangeSet,
  record: ExtractionRecord,
  progress: string,
): Promise<Label> {
  console.log(renderChangeSetHeader(changeSet, record, progress));
  if (record.extraction.rules.length === 0) console.log("\n  (no rules extracted)");

  const ruleVerdicts = await mapSequential(record.extraction.rules, async (rule, ruleIndex) => {
    console.log(renderRule(rule, ruleIndex));
    const { verdict, note } = await ask(rl, "  [c]orrect / [p]artial / [w]rong, optional note after a space > ", parseVerdict);
    return { ruleIndex, verdict, note };
  });

  const changesBusinessRules = await ask(rl, "\n  Does this change really alter business rules? [y/n] > ", parseYesNo);
  console.log("  Rules the model missed: one per line, empty line to finish.");
  const missedRules = await askLines(rl);

  return {
    changeSetId: changeSet.id,
    model: record.model,
    changesBusinessRules,
    ruleVerdicts,
    missedRules,
    labeledAt: new Date().toISOString(),
  };
}

async function ask<T>(rl: Interface, prompt: string, parse: (input: string) => T | null): Promise<T> {
  const parsed = parse(await rl.question(prompt));
  if (parsed !== null) return parsed;
  console.log("  Didn't catch that, try again.");
  return ask(rl, prompt, parse);
}

async function askLines(rl: Interface): Promise<string[]> {
  const line = (await rl.question("  + ")).trim();
  return line === "" ? [] : [line, ...(await askLines(rl))];
}
