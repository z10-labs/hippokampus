import { z } from "zod";

export const DiffFileSchema = z.object({
  path: z.string(),
  patch: z.string(),
});

export const DroppedFileSchema = z.object({
  path: z.string(),
  reason: z.string(),
});

export const ReviewSchema = z.object({
  reviewer: z.string(),
  state: z.string(),
  submittedAt: z.string().nullable(),
  body: z.string(),
});

export const CommentSchema = z.object({
  author: z.string(),
  kind: z.enum(["review_comment", "issue_comment"]),
  body: z.string(),
  path: z.string().nullable(),
});

/** One approved unit of change: a merged PR, or a commit pushed straight to the default branch. */
export const ChangeSetSchema = z.object({
  id: z.string(),
  kind: z.enum(["pull_request", "direct_commit"]),
  repo: z.string(),
  number: z.number().int().nullable(),
  sha: z.string(),
  url: z.string(),
  title: z.string(),
  description: z.string(),
  author: z.string(),
  mergedAt: z.string(),
  reviews: z.array(ReviewSchema),
  comments: z.array(CommentSchema),
  files: z.array(DiffFileSchema),
  droppedFiles: z.array(DroppedFileSchema),
});

export type DiffFile = z.infer<typeof DiffFileSchema>;
export type DroppedFile = z.infer<typeof DroppedFileSchema>;
export type ChangeSet = z.infer<typeof ChangeSetSchema>;
