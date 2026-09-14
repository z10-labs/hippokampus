import { z } from "zod";

export const RULE_TYPES = [
  "constraint",
  "derivation",
  "computation",
  "authorization",
  "state_transition",
  "temporal",
] as const;
export const CHANGE_KINDS = ["introduced", "modified", "retired"] as const;
export const EVIDENCE_KINDS = [
  "diff_hunk",
  "test_assertion",
  "db_constraint",
  "config",
  "feature_flag",
  "review_comment",
  "pr_description",
] as const;

export const EvidenceSchema = z.object({
  kind: z.enum(EVIDENCE_KINDS),
  file: z.string().describe("Repo-relative path, or 'PR' for the description or discussion"),
  symbol: z.string().nullable().describe("Enclosing function, class, constant or column, if identifiable"),
  snippet: z.string().describe("Verbatim excerpt from the input, a few lines at most"),
});

// Field order matters: the model commits to an owner before it writes the statement.
export const ExtractedRuleSchema = z.object({
  business_owner: z
    .string()
    .describe("Business role that decides this policy, e.g. Product, Finance, Operations, Compliance, Customer Support"),
  statement: z.string().describe("One sentence in business language, with no technical vocabulary"),
  rule_type: z.enum(RULE_TYPES),
  // No previous statement: linking a modified or retired rule to its earlier version is a
  // later resolution step against the existing ontology, not something to guess from one diff.
  change_kind: z.enum(CHANGE_KINDS),
  condition: z.string().describe("When the rule applies, in business terms"),
  outcome: z.string().describe("What must happen or be true, in business terms"),
  entities: z.array(z.string()).describe("Business nouns, e.g. Customer, Invoice, Payment"),
  attributes: z.array(z.string()).describe("Business facts about those entities, e.g. Invoice.dueDate"),
  bounded_context: z.string().nullable().describe("Business area, e.g. Billing, Payments"),
  evidence: z.array(EvidenceSchema),
  confidence: z.number().describe("0 to 1: how sure you are the business owner would recognise this as their policy"),
});

// Technical findings get their own list so they aren't forced into rules.
export const ExtractionSchema = z.object({
  changes_business_rules: z.boolean(),
  classification_reason: z.string().describe("One or two sentences explaining the decision"),
  excluded_technical_changes: z
    .array(z.string())
    .describe("Short notes on technical constraints or mechanics deliberately left out of the rules"),
  rules: z.array(ExtractedRuleSchema),
});

export type RuleType = (typeof RULE_TYPES)[number];
export type ExtractedRule = z.infer<typeof ExtractedRuleSchema>;
export type Extraction = z.infer<typeof ExtractionSchema>;
