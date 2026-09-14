import path from "node:path";
import { EXTRACTION_VARIANT, MODEL, PROMPT_VERSION } from "../config";
import { ExtractionRecordSchema } from "../extraction/record";
import { LabelSchema } from "../labeling/types";
import { readAllJson, repoPaths, writeText } from "../store/store";
import { renderReport } from "./report";
import { computeScorecard } from "./score";

export async function runScoring(options: { repo: string }): Promise<number> {
  const paths = repoPaths(options.repo, EXTRACTION_VARIANT);
  const [records, labels] = await Promise.all([
    readAllJson(paths.extractions, ExtractionRecordSchema),
    readAllJson(paths.labels, LabelSchema),
  ]);

  const card = computeScorecard(records, labels);
  if (card.changeSets.labeled === 0) {
    console.log(`No labeled extractions for ${EXTRACTION_VARIANT} yet; run label first.`);
    return 1;
  }

  const generatedAt = new Date().toISOString();
  const report = renderReport(card, { repo: options.repo, model: MODEL, promptVersion: PROMPT_VERSION, generatedAt });
  const reportPath = path.join(paths.reports, `${MODEL}-${PROMPT_VERSION}-${generatedAt.slice(0, 10)}.md`);
  await writeText(reportPath, report);

  console.log(report);
  console.log(`Saved ${reportPath}`);
  return 0;
}
