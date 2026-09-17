import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ensureParsed, type MessagesClient, ModelResponseError, toUsage } from "../claude/response";
import { CONTEXT_MAP_MAX_OUTPUT_TOKENS, CONTEXT_TREE_MAX_CHARS, EXTRACTION_EFFORT, MODEL } from "../config";
import type { Usage } from "../extraction/record";
import { buildContextMapPrompt, CONTEXT_MAP_SYSTEM_PROMPT } from "./prompt";
import type { RepoSignals } from "./signals";
import { type ContextMap, type ContextMapDraft, ContextMapDraftSchema } from "./types";

export async function draftContextMap(
  client: MessagesClient,
  signals: RepoSignals,
  now: Date = new Date(),
): Promise<{ map: ContextMap; usage: Usage }> {
  const label = `context map for ${signals.repo}`;
  // Streaming: a max_tokens this high would exceed the SDK's non-streaming request timeout.
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: CONTEXT_MAP_MAX_OUTPUT_TOKENS,
    thinking: { type: "adaptive" },
    output_config: { effort: EXTRACTION_EFFORT, format: zodOutputFormat(ContextMapDraftSchema) },
    system: CONTEXT_MAP_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildContextMapPrompt(signals, CONTEXT_TREE_MAX_CHARS) }],
  });

  const response = await stream.finalMessage().catch((error: unknown) => {
    // The SDK parses structured output itself and throws on cut-off JSON before stop_reason can be checked.
    const detail = error instanceof Error ? error.message : String(error);
    throw new ModelResponseError(
      `${label}: couldn't parse the model's output (${detail}). This usually means it hit the ${CONTEXT_MAP_MAX_OUTPUT_TOKENS}-token output limit.`,
    );
  });

  const draft = ensureParsed(label, response, response.stop_details?.category, CONTEXT_MAP_MAX_OUTPUT_TOKENS);

  return {
    map: toContextMap(draft, {
      repo: signals.repo,
      ref: signals.ref,
      commitSha: signals.commitSha,
      generatedAt: now.toISOString(),
      generatedBy: MODEL,
    }),
    usage: toUsage(response.usage),
  };
}

export function toKebabCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Every drafted context starts as proposed; the map as a whole stays a draft until reviewed. */
export function toContextMap(
  draft: ContextMapDraft,
  meta: Pick<ContextMap, "repo" | "ref" | "commitSha" | "generatedAt" | "generatedBy">,
): ContextMap {
  return {
    ...meta,
    status: "draft",
    contexts: draft.contexts.map((context) => ({
      id: toKebabCase(context.id || context.name),
      name: context.name,
      description: context.description,
      status: "proposed",
      pathPatterns: context.path_patterns,
      aliases: context.aliases,
      signals: context.signals,
    })),
    sharedPaths: draft.shared_paths.map((shared) => ({ pattern: shared.pattern, reason: shared.reason })),
    openQuestions: draft.open_questions,
  };
}
