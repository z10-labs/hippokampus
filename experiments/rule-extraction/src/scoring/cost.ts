import { ASSUMED_OUTPUT_TOKENS_PER_EXTRACTION, PRICE_PER_MTOK } from "../config";
import type { Usage } from "../extraction/record";

const TOKENS_PER_MTOK = 1_000_000;

export const EMPTY_USAGE: Usage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
};

export function estimateUsd(usage: Usage): number {
  return (
    (usage.inputTokens * PRICE_PER_MTOK.input +
      usage.outputTokens * PRICE_PER_MTOK.output +
      usage.cacheCreationInputTokens * PRICE_PER_MTOK.cacheWrite +
      usage.cacheReadInputTokens * PRICE_PER_MTOK.cacheRead) /
    TOKENS_PER_MTOK
  );
}

export function sumUsage(usages: readonly Usage[]): Usage {
  return usages.reduce(
    (total, usage) => ({
      inputTokens: total.inputTokens + usage.inputTokens,
      outputTokens: total.outputTokens + usage.outputTokens,
      cacheCreationInputTokens: total.cacheCreationInputTokens + usage.cacheCreationInputTokens,
      cacheReadInputTokens: total.cacheReadInputTokens + usage.cacheReadInputTokens,
    }),
    EMPTY_USAGE,
  );
}

/** Pre-run planning estimate from approximate prompt sizes; real cost comes from recorded usage. */
export function roughExtractionUsd(promptTokens: readonly number[]): number {
  return estimateUsd({
    ...EMPTY_USAGE,
    inputTokens: promptTokens.reduce((sum, tokens) => sum + tokens, 0),
    outputTokens: promptTokens.length * ASSUMED_OUTPUT_TOKENS_PER_EXTRACTION,
  });
}
