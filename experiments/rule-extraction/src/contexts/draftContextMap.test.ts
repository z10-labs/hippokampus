import { describe, expect, test, vi } from "vitest";
import { type MessagesClient, ModelResponseError } from "../claude/response";
import { CONTEXT_MAP_MAX_OUTPUT_TOKENS, MODEL } from "../config";
import { makeRepoSignals } from "../testing/fixtures";
import { draftContextMap, toContextMap, toKebabCase } from "./draftContextMap";
import { ContextMapSchema, type ContextMapDraft } from "./types";

const DRAFT: ContextMapDraft = {
  contexts: [
    {
      id: "Invoicing",
      name: "Invoicing",
      description: "Bills students for attended sessions.",
      path_patterns: ["apps/web/src/**/invoic*/**"],
      aliases: ["billing"],
      signals: ["invoicing scope ×2"],
    },
    {
      id: "",
      name: "Session Scheduling",
      description: "Creates and runs tutoring sessions.",
      path_patterns: ["apps/web/src/**/sessions/**"],
      aliases: [],
      signals: [],
    },
  ],
  shared_paths: [{ pattern: "packages/ui/**", reason: "design system" }],
  open_questions: ["Is attendance its own context?"],
};

const META = {
  repo: "acme/tutoring",
  ref: "main",
  commitSha: "abc1234def",
  generatedAt: "2026-09-15T08:00:00.000Z",
  generatedBy: MODEL,
};

function fakeClient(overrides: Record<string, unknown> = {}, finalMessageError?: Error) {
  const finalMessage = finalMessageError
    ? vi.fn().mockRejectedValue(finalMessageError)
    : vi.fn().mockResolvedValue({
        stop_reason: "end_turn",
        stop_details: null,
        usage: { input_tokens: 15_000, output_tokens: 2_500, cache_creation_input_tokens: null, cache_read_input_tokens: null },
        parsed_output: DRAFT,
        ...overrides,
      });
  const stream = vi.fn().mockReturnValue({ finalMessage });
  return { client: { messages: { stream } } as unknown as MessagesClient, stream };
}

describe("toKebabCase", () => {
  test.each([
    ["Invoicing", "invoicing"],
    ["Session Scheduling", "session-scheduling"],
    ["  Identity & Access ", "identity-access"],
  ])("converts %j to %j", (input, expected) => {
    expect(toKebabCase(input)).toBe(expected);
  });
});

describe("toContextMap", () => {
  test("produces a valid draft map with proposed contexts", () => {
    const map = toContextMap(DRAFT, META);

    expect(ContextMapSchema.parse(map)).toEqual(map);
    expect(map.status).toBe("draft");
    expect(map.contexts.map((context) => [context.id, context.status])).toEqual([
      ["invoicing", "proposed"],
      ["session-scheduling", "proposed"],
    ]);
    expect(map.sharedPaths).toEqual([{ pattern: "packages/ui/**", reason: "design system" }]);
  });
});

describe("draftContextMap", () => {
  test("sends the repo signals to the configured model and returns the map with usage", async () => {
    const { client, stream } = fakeClient();

    const { map, usage } = await draftContextMap(client, makeRepoSignals(), new Date(META.generatedAt));

    const request = stream.mock.calls[0]?.[0];
    expect(request.model).toBe(MODEL);
    expect(request.max_tokens).toBe(CONTEXT_MAP_MAX_OUTPUT_TOKENS);
    expect(request.messages[0].content).toContain('<repository name="acme/tutoring"');
    expect(map).toMatchObject({ repo: "acme/tutoring", commitSha: "abc1234def", generatedAt: META.generatedAt });
    expect(usage).toEqual({ inputTokens: 15_000, outputTokens: 2_500, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 });
  });

  test("raises a ModelResponseError when the model declines", async () => {
    const { client } = fakeClient({ stop_reason: "refusal", stop_details: { category: "cyber" } });

    await expect(draftContextMap(client, makeRepoSignals())).rejects.toBeInstanceOf(ModelResponseError);
  });

  test("explains cut-off JSON as a likely token-limit problem", async () => {
    const { client } = fakeClient({}, new Error("Failed to parse structured output as JSON: Unterminated string"));

    const attempt = draftContextMap(client, makeRepoSignals());

    await expect(attempt).rejects.toBeInstanceOf(ModelResponseError);
    await expect(attempt).rejects.toThrow(`hit the ${CONTEXT_MAP_MAX_OUTPUT_TOKENS}-token output limit`);
  });
});
