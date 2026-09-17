import { z } from "zod";

const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** What the model returns when drafting a map. Strict: sent as the structured-output schema. */
export const ContextMapDraftSchema = z.object({
  contexts: z.array(
    z.object({
      id: z.string().describe("Short, stable kebab-case identifier"),
      name: z.string().describe("Business name a product lead would use"),
      description: z.string().describe("One sentence: the business capability and the policies it owns"),
      path_patterns: z
        .array(z.string())
        .describe("Globs relative to the repo root covering every layer where this context's code lives"),
      aliases: z.array(z.string()).describe("Other names for this area: PR scopes, folder names, synonyms"),
      signals: z.array(z.string()).describe("Brief notes on the repo evidence behind this context"),
    }),
  ),
  shared_paths: z.array(
    z.object({
      pattern: z.string(),
      reason: z.string().describe("Why this code belongs to no single business context"),
    }),
  ),
  open_questions: z.array(z.string()).describe("Decisions the reviewer should make"),
});

export const CONTEXT_STATUSES = ["proposed", "confirmed", "deprecated"] as const;

export const BoundedContextSchema = z.object({
  id: z.string().regex(KEBAB_CASE, "context ids must be kebab-case"),
  name: z.string().min(1),
  description: z.string(),
  status: z.enum(CONTEXT_STATUSES),
  pathPatterns: z.array(z.string().min(1)).min(1, "each context needs at least one path pattern"),
  aliases: z.array(z.string()),
  signals: z.array(z.string()),
});

/** The reviewed, human-editable map stored at data/<repo>/context-map.json. */
export const ContextMapSchema = z
  .object({
    repo: z.string(),
    ref: z.string(),
    commitSha: z.string(),
    generatedAt: z.string(),
    generatedBy: z.string(),
    status: z.enum(["draft", "confirmed"]),
    contexts: z.array(BoundedContextSchema),
    sharedPaths: z.array(z.object({ pattern: z.string().min(1), reason: z.string() })),
    openQuestions: z.array(z.string()),
  })
  .superRefine((map, ctx) => {
    const ids = map.contexts.map((context) => context.id);
    ids.forEach((id, index) => {
      if (ids.indexOf(id) !== index) {
        ctx.addIssue({ code: "custom", path: ["contexts", index, "id"], message: `duplicate context id "${id}"` });
      }
    });
  });

export type ContextMapDraft = z.infer<typeof ContextMapDraftSchema>;
export type BoundedContext = z.infer<typeof BoundedContextSchema>;
export type ContextMap = z.infer<typeof ContextMapSchema>;
