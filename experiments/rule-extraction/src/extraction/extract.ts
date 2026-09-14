import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ChangeSet } from "../changeset/types";
import { EXTRACTION_EFFORT, MAX_OUTPUT_TOKENS, MODEL, PROMPT_VERSION } from "../config";
import { buildChangeSetPrompt, SYSTEM_PROMPT } from "./prompt";
import type { ExtractionRecord } from "./record";
import { type Extraction, ExtractionSchema } from "./schema";

export class ExtractionError extends Error {
  override name = "ExtractionError";
}

export type MessagesClient = Pick<Anthropic, "messages">;

export async function extractChangeSet(client: MessagesClient, changeSet: ChangeSet): Promise<ExtractionRecord> {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    thinking: { type: "adaptive" },
    output_config: { effort: EXTRACTION_EFFORT, format: zodOutputFormat(ExtractionSchema) },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildChangeSetPrompt(changeSet) }],
  });

  if (response.stop_reason === "refusal") {
    const category = response.stop_details?.category ?? "no category";
    throw new ExtractionError(`${changeSet.id}: the model declined (${category})`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new ExtractionError(`${changeSet.id}: output hit max_tokens (${MAX_OUTPUT_TOKENS}); raise MAX_OUTPUT_TOKENS`);
  }
  if (!response.parsed_output) {
    throw new ExtractionError(`${changeSet.id}: response did not match the extraction schema`);
  }

  return {
    changeSetId: changeSet.id,
    model: MODEL,
    promptVersion: PROMPT_VERSION,
    extractedAt: new Date().toISOString(),
    stopReason: response.stop_reason ?? "unknown",
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
    },
    extraction: normaliseExtraction(response.parsed_output),
  };
}

/** Structured outputs can't bound numbers, so confidence is clamped here. */
export function normaliseExtraction(extraction: Extraction): Extraction {
  return {
    ...extraction,
    rules: extraction.rules.map((rule) => ({ ...rule, confidence: Math.min(1, Math.max(0, rule.confidence)) })),
  };
}
