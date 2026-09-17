import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ChangeSet } from "../changeset/types";
import { ensureParsed, type MessagesClient, toUsage } from "../claude/response";
import { EXTRACTION_EFFORT, MAX_OUTPUT_TOKENS, MODEL, PROMPT_VERSION } from "../config";
import { buildChangeSetPrompt, SYSTEM_PROMPT } from "./prompt";
import type { ExtractionRecord } from "./record";
import { type Extraction, ExtractionSchema } from "./schema";

export async function extractChangeSet(client: MessagesClient, changeSet: ChangeSet): Promise<ExtractionRecord> {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    thinking: { type: "adaptive" },
    output_config: { effort: EXTRACTION_EFFORT, format: zodOutputFormat(ExtractionSchema) },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildChangeSetPrompt(changeSet) }],
  });

  const extraction = ensureParsed(changeSet.id, response, response.stop_details?.category, MAX_OUTPUT_TOKENS);

  return {
    changeSetId: changeSet.id,
    model: MODEL,
    promptVersion: PROMPT_VERSION,
    extractedAt: new Date().toISOString(),
    stopReason: response.stop_reason ?? "unknown",
    usage: toUsage(response.usage),
    extraction: normaliseExtraction(extraction),
  };
}

/** Structured outputs can't bound numbers, so confidence is clamped here. */
export function normaliseExtraction(extraction: Extraction): Extraction {
  return {
    ...extraction,
    rules: extraction.rules.map((rule) => ({ ...rule, confidence: Math.min(1, Math.max(0, rule.confidence)) })),
  };
}
