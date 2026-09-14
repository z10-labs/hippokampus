import { describe, expect, test, vi } from "vitest";
import { MODEL, PROMPT_VERSION } from "../config";
import { makeChangeSet, makeRule } from "../testing/fixtures";
import { ExtractionError, extractChangeSet, type MessagesClient, normaliseExtraction } from "./extract";

const PARSED = {
  changes_business_rules: true,
  classification_reason: "Changes terms.",
  excluded_technical_changes: ["Rejects malformed invoice ids"],
  rules: [makeRule()],
};

function fakeClient(overrides: Record<string, unknown> = {}) {
  const parse = vi.fn().mockResolvedValue({
    stop_reason: "end_turn",
    stop_details: null,
    usage: { input_tokens: 1200, output_tokens: 300, cache_creation_input_tokens: null, cache_read_input_tokens: 50 },
    parsed_output: PARSED,
    ...overrides,
  });
  return { client: { messages: { parse } } as unknown as MessagesClient, parse };
}

describe("extractChangeSet", () => {
  test("sends the change set to the configured model and records usage", async () => {
    const { client, parse } = fakeClient();

    const record = await extractChangeSet(client, makeChangeSet());

    const request = parse.mock.calls[0]?.[0];
    expect(request.model).toBe(MODEL);
    expect(request.thinking).toEqual({ type: "adaptive" });
    expect(request.messages[0].content).toContain("Shorten invoice due period");
    expect(record).toMatchObject({
      changeSetId: "pr-1",
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      stopReason: "end_turn",
      usage: { inputTokens: 1200, outputTokens: 300, cacheCreationInputTokens: 0, cacheReadInputTokens: 50 },
      extraction: PARSED,
    });
  });

  test.each([
    [{ stop_reason: "refusal", stop_details: { category: "cyber" } }, /declined \(cyber\)/],
    [{ stop_reason: "refusal", stop_details: null }, /declined \(no category\)/],
    [{ stop_reason: "max_tokens" }, /max_tokens/],
    [{ parsed_output: null }, /did not match/],
  ])("throws an ExtractionError for %o", async (overrides, message) => {
    const { client } = fakeClient(overrides);

    const attempt = extractChangeSet(client, makeChangeSet());

    await expect(attempt).rejects.toBeInstanceOf(ExtractionError);
    await expect(attempt).rejects.toThrow(message);
  });
});

describe("normaliseExtraction", () => {
  test("clamps confidence into 0..1 without mutating the input", () => {
    const input = { ...PARSED, rules: [makeRule({ confidence: 1.4 }), makeRule({ confidence: -0.2 })] };

    const output = normaliseExtraction(input);

    expect(output.rules.map((rule) => rule.confidence)).toEqual([1, 0]);
    expect(input.rules[0]?.confidence).toBe(1.4);
  });
});
