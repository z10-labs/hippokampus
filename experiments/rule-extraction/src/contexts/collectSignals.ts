import { z } from "zod";
import { CONTEXT_DOC_LIMIT } from "../config";
import { gh, ghJson } from "../github/gh";
import { type RepoSignals, selectDocPaths } from "./signals";

const TreeSchema = z.object({
  truncated: z.boolean(),
  tree: z.array(z.object({ path: z.string(), type: z.string() })),
});

const encodeRepoPath = (filePath: string): string => filePath.split("/").map(encodeURIComponent).join("/");

export interface RepoTree {
  ref: string;
  commitSha: string;
  truncated: boolean;
  paths: string[];
}

/** Every file path on the default branch's latest commit. */
export async function fetchRepoTree(repo: string): Promise<RepoTree> {
  const ref = (await gh(["repo", "view", repo, "--json", "defaultBranchRef", "--jq", ".defaultBranchRef.name"])).trim();
  const commitSha = (await gh(["api", `repos/${repo}/commits/${encodeURIComponent(ref)}`, "--jq", ".sha"])).trim();
  const tree = await ghJson(["api", `repos/${repo}/git/trees/${commitSha}?recursive=1`], TreeSchema);

  return {
    ref,
    commitSha,
    truncated: tree.truncated,
    paths: tree.tree.filter((entry) => entry.type === "blob").map((entry) => entry.path),
  };
}

export async function collectSignals(repo: string, prTitleLimit: number): Promise<RepoSignals> {
  const tree = await fetchRepoTree(repo);

  const [prTitles, docs] = await Promise.all([
    ghJson(
      ["pr", "list", "-R", repo, "--state", "merged", "--limit", String(prTitleLimit), "--json", "title"],
      z.array(z.object({ title: z.string() })),
    ).then((prs) => prs.map((pr) => pr.title)),
    Promise.all(
      selectDocPaths(tree.paths, CONTEXT_DOC_LIMIT).map(async (docPath) => ({
        path: docPath,
        content: await gh([
          "api",
          `repos/${repo}/contents/${encodeRepoPath(docPath)}?ref=${tree.commitSha}`,
          "-H",
          "Accept: application/vnd.github.raw",
        ]),
      })),
    ),
  ]);

  return {
    repo,
    ref: tree.ref,
    commitSha: tree.commitSha,
    paths: tree.paths,
    treeTruncated: tree.truncated,
    prTitles,
    docs,
  };
}
