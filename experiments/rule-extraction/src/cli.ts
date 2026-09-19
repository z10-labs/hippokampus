import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { parseIdList, parsePositiveInt } from "./cli/args";
import { DEFAULT_COMMIT_LIMIT, DEFAULT_CONCURRENCY, DEFAULT_PR_LIMIT, EXTRACTION_VARIANT, MODEL } from "./config";
import { contextsForPaths } from "./contexts/coverage";
import { runContextCheck, runContextDraft } from "./contexts/runContexts";
import { ContextMapSchema } from "./contexts/types";
import { approxPromptTokens } from "./extraction/prompt";
import { runExtraction } from "./extraction/runExtraction";
import { fetchChangeSets } from "./github/fetchChangeSets";
import { runLabeling } from "./labeling/runLabeling";
import { roughExtractionUsd } from "./scoring/cost";
import { runScoring } from "./scoring/runScoring";
import { assertRepo, readJson, repoPaths } from "./store/store";

const USAGE = `Usage: pnpm cli <command> --repo owner/name [options]

Commands
  contexts-draft   Draft the repo's bounded-context map from its tree, PR scopes and docs (~$0.35)
              --force              replace an existing map (discards your edits)
  contexts-check   Validate the edited map and report coverage against the current tree (no API cost)
  fetch     Save merged PRs and direct commits as change sets (no API cost)
              --pr-limit <n>       default ${DEFAULT_PR_LIMIT}
              --commit-limit <n>   default ${DEFAULT_COMMIT_LIMIT}
              --no-direct-commits
  extract   Run ${MODEL} with the confirmed context map; skips change sets already extracted
              --only <id,id>       e.g. pr-3,commit-1cc9624
              --force              re-extract even if a result exists
              --concurrency <n>    default ${DEFAULT_CONCURRENCY}
  label     Grade the extracted rules by hand (resumable)
              --relabel
  score     Compute precision and recall, and write a markdown report`;

const OPTIONS = {
  repo: { type: "string" },
  "pr-limit": { type: "string" },
  "commit-limit": { type: "string" },
  "no-direct-commits": { type: "boolean", default: false },
  only: { type: "string" },
  force: { type: "boolean", default: false },
  concurrency: { type: "string" },
  relabel: { type: "boolean", default: false },
  help: { type: "boolean", default: false },
} as const;

async function main(argv: string[]): Promise<number> {
  if (existsSync(".env")) process.loadEnvFile(".env");

  const [command, ...rest] = argv;
  const { values } = parseArgs({ args: rest, options: OPTIONS, strict: true });

  if (command === undefined || command === "help" || command === "--help" || values.help) {
    console.log(USAGE);
    return 0;
  }
  if (values.repo === undefined) {
    console.error("Missing --repo owner/name\n");
    console.log(USAGE);
    return 1;
  }
  const repo = assertRepo(values.repo);

  switch (command) {
    case "contexts-draft":
      return runContextDraft({ repo, force: values.force });
    case "contexts-check":
      return runContextCheck({ repo });
    case "fetch":
      return runFetch(repo, {
        prLimit: parsePositiveInt(values["pr-limit"], "pr-limit", DEFAULT_PR_LIMIT),
        commitLimit: parsePositiveInt(values["commit-limit"], "commit-limit", DEFAULT_COMMIT_LIMIT),
        includeDirectCommits: !values["no-direct-commits"],
      });
    case "extract":
      return runExtraction({
        repo,
        only: parseIdList(values.only),
        force: values.force,
        concurrency: parsePositiveInt(values.concurrency, "concurrency", DEFAULT_CONCURRENCY),
      });
    case "label":
      return runLabeling({ repo, relabel: values.relabel });
    case "score":
      return runScoring({ repo });
    default:
      console.error(`Unknown command "${command}"\n`);
      console.log(USAGE);
      return 1;
  }
}

async function runFetch(
  repo: string,
  options: { prLimit: number; commitLimit: number; includeDirectCommits: boolean },
): Promise<number> {
  const outDir = repoPaths(repo, MODEL).changeSets;
  console.log(`Fetching merged PRs${options.includeDirectCommits ? " and direct commits" : ""} from ${repo}…`);

  const { changeSets, failures } = await fetchChangeSets({ repo, outDir, ...options });

  const contextMapPath = repoPaths(repo, EXTRACTION_VARIANT).contextMap;
  const contextMap = existsSync(contextMapPath) ? await readJson(contextMapPath, ContextMapSchema) : null;
  const confirmedContexts =
    contextMap?.status === "confirmed"
      ? contextMap.contexts.filter((context) => context.status === "confirmed")
      : [];
  const tokens = changeSets.map((changeSet) =>
    approxPromptTokens(
      changeSet,
      confirmedContexts.length === 0
        ? undefined
        : {
            contexts: confirmedContexts,
            matchedContextIds: contextsForPaths(
              changeSet.files.map((file) => file.path),
              contextMap!,
            ).filter((id) => confirmedContexts.some((context) => context.id === id)),
          },
    ),
  );
  changeSets.forEach((changeSet, index) => {
    console.log(
      `  ${changeSet.id.padEnd(16)} ${String(changeSet.files.length).padStart(3)} files · ${String(changeSet.droppedFiles.length).padStart(2)} omitted · ~${tokens[index]?.toLocaleString("en-US")} tokens · ${changeSet.title.slice(0, 50)}`,
    );
  });
  console.log(`Saved ${changeSets.length} change set(s) to ${outDir}`);
  console.log(`Rough extraction cost with ${MODEL}: ~$${roughExtractionUsd(tokens).toFixed(2)}`);
  failures.forEach((failure) => console.error(`  ✗ ${failure}`));
  return failures.length === 0 ? 0 : 1;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  },
);
