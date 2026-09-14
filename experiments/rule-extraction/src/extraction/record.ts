import { z } from "zod";
import { ExtractedRuleSchema, ExtractionSchema } from "./schema";

const tokenCount = z.number().int().nonnegative();

export const UsageSchema = z.object({
  inputTokens: tokenCount,
  outputTokens: tokenCount,
  cacheCreationInputTokens: tokenCount,
  cacheReadInputTokens: tokenCount,
});

// Reading side only: fields added in later prompt versions default so older records still load.
// The strict ExtractionSchema stays the one sent to the model.
const StoredExtractionSchema = ExtractionSchema.extend({
  excluded_technical_changes: z.array(z.string()).default([]),
  rules: z.array(ExtractedRuleSchema.extend({ business_owner: z.string().default("unspecified") })),
});

export const ExtractionRecordSchema = z.object({
  changeSetId: z.string(),
  model: z.string(),
  promptVersion: z.string().default("v1"),
  extractedAt: z.string(),
  stopReason: z.string(),
  usage: UsageSchema,
  extraction: StoredExtractionSchema,
});

export type Usage = z.infer<typeof UsageSchema>;
export type ExtractionRecord = z.infer<typeof ExtractionRecordSchema>;
