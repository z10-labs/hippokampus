import type Anthropic from "@anthropic-ai/sdk";
import type { Usage } from "../extraction/record";

export type MessagesClient = Pick<Anthropic, "messages">;

export class ModelResponseError extends Error {
  override name = "ModelResponseError";
}

/** Returns the schema-validated output, or explains why the model didn't produce one. */
export function ensureParsed<T>(
  label: string,
  response: { stop_reason: string | null; parsed_output: T | null },
  refusalCategory: string | null | undefined,
  maxTokens: number,
): T {
  if (response.stop_reason === "refusal") {
    throw new ModelResponseError(`${label}: the model declined (${refusalCategory ?? "no category"})`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new ModelResponseError(`${label}: output hit max_tokens (${maxTokens}); raise MAX_OUTPUT_TOKENS`);
  }
  if (response.parsed_output === null) {
    throw new ModelResponseError(`${label}: response did not match the expected schema`);
  }
  return response.parsed_output;
}

export function toUsage(usage: Anthropic.Usage): Usage {
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
  };
}
