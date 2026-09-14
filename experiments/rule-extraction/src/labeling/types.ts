import { z } from "zod";

export const VERDICTS = ["correct", "partial", "wrong"] as const;

export const RuleVerdictSchema = z.object({
  ruleIndex: z.number().int().nonnegative(),
  verdict: z.enum(VERDICTS),
  note: z.string(),
});

/** A human's grading of one extraction. */
export const LabelSchema = z.object({
  changeSetId: z.string(),
  model: z.string(),
  changesBusinessRules: z.boolean(),
  ruleVerdicts: z.array(RuleVerdictSchema),
  missedRules: z.array(z.string()),
  labeledAt: z.string(),
});

export type Verdict = (typeof VERDICTS)[number];
export type RuleVerdict = z.infer<typeof RuleVerdictSchema>;
export type Label = z.infer<typeof LabelSchema>;
