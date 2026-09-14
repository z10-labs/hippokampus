import { describe, expect, test } from "vitest";
import { GhCommitSchema, GhPullRequestSchema, toDirectCommitChangeSet, toPullRequestChangeSet } from "./mappers";

const DIFF = `diff --git a/src/main/java/Payment.java b/src/main/java/Payment.java
--- a/src/main/java/Payment.java
+++ b/src/main/java/Payment.java
@@ -1 +1 @@
+  if (amount <= 0) throw new InvalidAmount();
diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -1 +1 @@
+lock`;

const PR = GhPullRequestSchema.parse({
  number: 5,
  title: "Multi-rail registry",
  body: "Adds PayShap",
  url: "https://github.com/acme/pay/pull/5",
  mergedAt: "2026-04-10T00:00:00Z",
  author: null,
  mergeCommit: { oid: "b9c3b50" },
  reviews: [{ author: { login: "lead" }, state: "APPROVED", submittedAt: "2026-04-09T00:00:00Z", body: "LGTM" }],
  comments: [{ author: { login: "watchman-bot" }, body: "Aligned with strategy", extraField: "ignored" }],
});

describe("toPullRequestChangeSet", () => {
  test("maps PR metadata, reviews and both comment kinds", () => {
    const changeSet = toPullRequestChangeSet("acme/pay", PR, DIFF, [
      { user: null, body: "Should this be >= 0?", path: "src/main/java/Payment.java" },
    ]);

    expect(changeSet).toMatchObject({
      id: "pr-5",
      kind: "pull_request",
      number: 5,
      sha: "b9c3b50",
      author: "unknown",
      reviews: [{ reviewer: "lead", state: "APPROVED", body: "LGTM" }],
      comments: [
        { author: "watchman-bot", kind: "issue_comment", path: null },
        { author: "unknown", kind: "review_comment", path: "src/main/java/Payment.java" },
      ],
    });
  });

  test("keeps source files and records dropped noise", () => {
    const changeSet = toPullRequestChangeSet("acme/pay", PR, DIFF, []);

    expect(changeSet.files.map((f) => f.path)).toEqual(["src/main/java/Payment.java"]);
    expect(changeSet.droppedFiles).toEqual([{ path: "pnpm-lock.yaml", reason: "lockfile" }]);
  });
});

describe("toDirectCommitChangeSet", () => {
  test("splits the commit message into title and description", () => {
    const commit = GhCommitSchema.parse({
      sha: "1cc9624abcdef",
      parents: 1,
      date: "2026-09-13T08:00:00Z",
      message: "ci: cap verdicts\n\nKeeps reviews short.\n",
      author: null,
    });

    expect(toDirectCommitChangeSet("acme/pay", commit, DIFF)).toMatchObject({
      id: "commit-1cc9624",
      kind: "direct_commit",
      number: null,
      url: "https://github.com/acme/pay/commit/1cc9624abcdef",
      title: "ci: cap verdicts",
      description: "Keeps reviews short.",
      author: "unknown",
      reviews: [],
    });
  });
});
