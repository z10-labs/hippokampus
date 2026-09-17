import { describe, expect, test } from "vitest";
import { CONTEXT_DOC_MAX_CHARS } from "../config";
import { makeRepoSignals } from "../testing/fixtures";
import { buildContextMapPrompt } from "./prompt";

describe("buildContextMapPrompt", () => {
  test("includes scopes, documents and the full file listing", () => {
    const prompt = buildContextMapPrompt(makeRepoSignals(), 10_000);

    expect(prompt).toContain('<repository name="acme/tutoring" commit="abc1234def">');
    expect(prompt).toContain('<pr_scopes titles="3">\ninvoicing: 2\nsessions: 1\n</pr_scopes>');
    expect(prompt).toContain('<document path="README.md">\n# Tutoring platform\n</document>');
    expect(prompt).toContain('listing="every file, grouped by directory"');
    expect(prompt).toContain("apps/web/src/lib/: invoices.ts, sessions.ts");
  });

  test("marks truncated documents explicitly", () => {
    const signals = makeRepoSignals({ docs: [{ path: "docs/huge.md", content: "x".repeat(CONTEXT_DOC_MAX_CHARS + 10) }] });

    const prompt = buildContextMapPrompt(signals, 10_000);

    expect(prompt).toContain('<document path="docs/huge.md" truncated="true">');
    expect(prompt).toContain(`[truncated after ${CONTEXT_DOC_MAX_CHARS} characters]`);
  });

  test("says when the tree is summarised instead of listed", () => {
    const prompt = buildContextMapPrompt(makeRepoSignals({ prTitles: [], docs: [] }), 40);

    expect(prompt).toContain('listing="directories with file counts (too many files to list)"');
    expect(prompt).toContain("<pr_scopes titles=\"0\">\nnone\n</pr_scopes>");
    expect(prompt).toContain("<documents>\nnone\n</documents>");
  });
});
