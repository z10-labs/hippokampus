import { createHash } from "node:crypto";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ChangeSet } from "../changeset/types";
import { ensureParsed, type MessagesClient, toUsage } from "../claude/response";
import { EXTRACTION_EFFORT, MAX_OUTPUT_TOKENS, MODEL, PROMPT_VERSION } from "../config";
import { contextsForPaths } from "../contexts/coverage";
import type { ContextMap } from "../contexts/types";
import { buildChangeSetPrompt, SYSTEM_PROMPT } from "./prompt";
import type { ExtractionRecord } from "./record";
import { type Extraction, extractionSchemaForContextIds } from "./schema";

export async function extractChangeSet(
  client: MessagesClient,
  changeSet: ChangeSet,
  contextMap: ContextMap,
): Promise<ExtractionRecord> {
  const contexts = contextMap.contexts.filter((context) => context.status === "confirmed");
  const confirmedIds = new Set(contexts.map((context) => context.id));
  const matchedContextIds = contextsForPaths(
    changeSet.files.map((file) => file.path),
    contextMap,
  ).filter((id) => confirmedIds.has(id));
  const extractionSchema = extractionSchemaForContextIds(contexts.map((context) => context.id));
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    thinking: { type: "adaptive" },
    output_config: { effort: EXTRACTION_EFFORT, format: zodOutputFormat(extractionSchema) },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildChangeSetPrompt(changeSet, { contexts, matchedContextIds }) }],
  });

  const extraction = ensureParsed(changeSet.id, response, response.stop_details?.category, MAX_OUTPUT_TOKENS);

  return {
    changeSetId: changeSet.id,
    model: MODEL,
    promptVersion: PROMPT_VERSION,
    extractedAt: new Date().toISOString(),
    stopReason: response.stop_reason ?? "unknown",
    usage: toUsage(response.usage),
    contextMapCommitSha: contextMap.commitSha,
    contextMapGeneratedAt: contextMap.generatedAt,
    contextMapHash: contextMapFingerprint(contextMap),
    matchedContextIds,
    extraction: normaliseExtraction(extraction),
  };
}

export function contextMapFingerprint(contextMap: ContextMap): string {
  return createHash("sha256").update(JSON.stringify(contextMap)).digest("hex");
}

/** Structured outputs can't bound numbers, so confidence is clamped here. */
export function normaliseExtraction(extraction: Extraction): Extraction {
  return {
    ...extraction,
    rules: extraction.rules.map((rule) => ({ ...rule, confidence: Math.min(1, Math.max(0, rule.confidence)) })),
  };
}
