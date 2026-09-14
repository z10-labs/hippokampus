import { z } from "zod";
import type { ChangeSet } from "../changeset/types";
import { jsonFile, writeJson } from "../store/store";
import { mapWithConcurrency } from "../util/concurrency";
import { gh, ghJson, ghJsonLines } from "./gh";
import {
  GhCommitSchema,
  GhInlineCommentSchema,
  GhPullRequestSchema,
  toDirectCommitChangeSet,
  toPullRequestChangeSet,
} from "./mappers";

const FETCH_CONCURRENCY = 4;
const PR_FIELDS = "number,title,body,url,mergedAt,author,mergeCommit,reviews,comments";
const INLINE_COMMENT_JQ = ".[] | {user: .user.login, body, path}";
const COMMIT_JQ =
  ".[] | {sha, parents: (.parents | length), date: .commit.author.date, message: .commit.message, author: (.author.login // .commit.author.name)}";

export interface FetchOptions {
  repo: string;
  outDir: string;
  prLimit: number;
  commitLimit: number;
  includeDirectCommits: boolean;
}

export interface FetchSummary {
  changeSets: ChangeSet[];
  failures: string[];
}

interface Outcome {
  name: string;
  result: PromiseSettledResult<ChangeSet | null>;
}

export async function fetchChangeSets(options: FetchOptions): Promise<FetchSummary> {
  const prOutcomes = await fetchPullRequests(options.repo, options.prLimit);
  const commitOutcomes = options.includeDirectCommits
    ? await fetchDirectCommits(options.repo, options.commitLimit)
    : [];
  const outcomes = [...prOutcomes, ...commitOutcomes];

  const changeSets = outcomes.flatMap(({ result }) =>
    result.status === "fulfilled" && result.value !== null ? [result.value] : [],
  );
  await Promise.all(changeSets.map((changeSet) => writeJson(jsonFile(options.outDir, changeSet.id), changeSet)));

  const failures = outcomes.flatMap(({ name, result }) =>
    result.status === "rejected" ? [`${name}: ${errorMessage(result.reason)}`] : [],
  );
  return { changeSets, failures };
}

async function fetchPullRequests(repo: string, limit: number): Promise<Outcome[]> {
  const prs = await ghJson(
    ["pr", "list", "-R", repo, "--state", "merged", "--limit", String(limit), "--json", PR_FIELDS],
    z.array(GhPullRequestSchema),
  );

  const results = await mapWithConcurrency(prs, FETCH_CONCURRENCY, async (pr) => {
    const [diff, inlineComments] = await Promise.all([
      gh(["pr", "diff", String(pr.number), "-R", repo]),
      ghJsonLines(
        ["api", "--paginate", `repos/${repo}/pulls/${pr.number}/comments`, "--jq", INLINE_COMMENT_JQ],
        GhInlineCommentSchema,
      ),
    ]);
    return toPullRequestChangeSet(repo, pr, diff, inlineComments);
  });

  return results.map((result, index) => ({ name: `PR #${prs[index]?.number}`, result }));
}

/** Commits on the default branch that no pull request is associated with. */
async function fetchDirectCommits(repo: string, limit: number): Promise<Outcome[]> {
  const branch = (await gh(["repo", "view", repo, "--json", "defaultBranchRef", "--jq", ".defaultBranchRef.name"])).trim();
  const commits = await ghJsonLines(
    ["api", "--paginate", `repos/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=100`, "--jq", COMMIT_JQ],
    GhCommitSchema,
  );
  const candidates = commits.slice(0, limit).filter((commit) => commit.parents <= 1);

  const results = await mapWithConcurrency(candidates, FETCH_CONCURRENCY, async (commit) => {
    const linkedPrs = Number((await gh(["api", `repos/${repo}/commits/${commit.sha}/pulls`, "--jq", "length"])).trim());
    if (linkedPrs > 0) return null;

    const diff = await gh(["api", `repos/${repo}/commits/${commit.sha}`, "-H", "Accept: application/vnd.github.diff"]);
    return toDirectCommitChangeSet(repo, commit, diff);
  });

  return results.map((result, index) => ({ name: `commit ${candidates[index]?.sha.slice(0, 7)}`, result }));
}

const errorMessage = (reason: unknown): string => (reason instanceof Error ? reason.message : String(reason));
