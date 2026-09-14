import { z } from "zod";
import { filterDiff } from "../changeset/diffFilter";
import type { ChangeSet } from "../changeset/types";

const GhActorSchema = z.object({ login: z.string() }).nullable();

export const GhPullRequestSchema = z.object({
  number: z.number().int(),
  title: z.string(),
  body: z.string(),
  url: z.string(),
  mergedAt: z.string(),
  author: GhActorSchema,
  mergeCommit: z.object({ oid: z.string() }).nullable(),
  reviews: z.array(
    z.object({
      author: GhActorSchema,
      state: z.string(),
      submittedAt: z.string().nullable(),
      body: z.string(),
    }),
  ),
  comments: z.array(z.object({ author: GhActorSchema, body: z.string() })),
});

export const GhInlineCommentSchema = z.object({
  user: z.string().nullable(),
  body: z.string(),
  path: z.string().nullable(),
});

export const GhCommitSchema = z.object({
  sha: z.string(),
  parents: z.number().int(),
  date: z.string(),
  message: z.string(),
  author: z.string().nullable(),
});

export type GhPullRequest = z.infer<typeof GhPullRequestSchema>;
export type GhInlineComment = z.infer<typeof GhInlineCommentSchema>;
export type GhCommit = z.infer<typeof GhCommitSchema>;

const UNKNOWN_AUTHOR = "unknown";
const loginOf = (actor: { login: string } | null): string => actor?.login || UNKNOWN_AUTHOR;

export function toPullRequestChangeSet(
  repo: string,
  pr: GhPullRequest,
  diff: string,
  inlineComments: readonly GhInlineComment[],
): ChangeSet {
  const { kept, dropped } = filterDiff(diff);

  return {
    id: `pr-${pr.number}`,
    kind: "pull_request",
    repo,
    number: pr.number,
    sha: pr.mergeCommit?.oid ?? "",
    url: pr.url,
    title: pr.title,
    description: pr.body,
    author: loginOf(pr.author),
    mergedAt: pr.mergedAt,
    reviews: pr.reviews.map((review) => ({
      reviewer: loginOf(review.author),
      state: review.state,
      submittedAt: review.submittedAt,
      body: review.body,
    })),
    comments: [
      ...pr.comments.map((comment) => ({
        author: loginOf(comment.author),
        kind: "issue_comment" as const,
        body: comment.body,
        path: null,
      })),
      ...inlineComments.map((comment) => ({
        author: comment.user || UNKNOWN_AUTHOR,
        kind: "review_comment" as const,
        body: comment.body,
        path: comment.path,
      })),
    ],
    files: kept,
    droppedFiles: dropped,
  };
}

export function toDirectCommitChangeSet(repo: string, commit: GhCommit, diff: string): ChangeSet {
  const [title = "", ...body] = commit.message.split("\n");
  const { kept, dropped } = filterDiff(diff);

  return {
    id: `commit-${commit.sha.slice(0, 7)}`,
    kind: "direct_commit",
    repo,
    number: null,
    sha: commit.sha,
    url: `https://github.com/${repo}/commit/${commit.sha}`,
    title,
    description: body.join("\n").trim(),
    author: commit.author || UNKNOWN_AUTHOR,
    mergedAt: commit.date,
    reviews: [],
    comments: [],
    files: kept,
    droppedFiles: dropped,
  };
}
