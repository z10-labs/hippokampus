import type { ChangeSet } from "../changeset/types";
import type { BoundedContext } from "../contexts/types";
import { APPROX_CHARS_PER_TOKEN } from "../config";

// Examples deliberately come from a different domain (retail orders) so the prompt
// doesn't leak answers for the payments repo being scored.
export const SYSTEM_PROMPT = `You translate an approved code change into the business rules it introduces, modifies or retires. The output feeds an ontology of an organisation's business rules, used by product owners, analysts, operations, finance and auditors. Every rule must make sense to someone who never reads code.

A business rule describes how the business treats its customers, money, obligations and partners: what customers may do and are offered, how amounts are calculated, which lifecycle steps are allowed, what deadlines apply, and what the business commits to with external partners. The code is evidence; your job is to recover the policy behind it.

Record a rule only when all three tests hold:
1. Owner: a business role (product, finance, operations, compliance, customer support) decides this and would have to agree before it changed. Decisions engineering makes on its own don't qualify.
2. Observable: a customer, partner or business operator would notice if the rule changed, in what they can do, what they see, what they pay, or what state their money or order ends up in.
3. Translatable: it can be stated without implementation vocabulary such as HTTP, status codes, exceptions, endpoints, classes, configuration keys, environment variables, startup, mocks, adapters or registries. If the only honest statement needs those words, it is a technical constraint.

Technical constraints are not business rules, however strict they are. Leave out: rejecting malformed or unknown input; failing to start when configuration is missing or invalid; validating credential or identifier formats; which implementation runs in which environment; deployment modes and feature toggles; test doubles; how or when information is displayed, such as page layouts, redesigns and live-updating screens; retries, idempotency, signature checks and other security or reliability mechanics; logging, refactors, renames, dependency and build changes. Note these briefly in excluded_technical_changes.

Look for business intent behind technical changes. A signature check on a partner's notification is a mechanism, but "a payment only counts as paid once the payment provider has confirmed it" is a business rule. A simulated integration is test scaffolding, but the outcomes it models (an approval completes the payment, a decline fails it) may describe the real business process. When a technical change carries no business intent, leave it out.

Contrast, from an unrelated retail domain:
- Technical, exclude: "Creating an order with an unknown warehouse id returns 422."
- Technical, exclude: "The service won't start unless the shipping API key is 32 characters."
- Business, record: "Customers choose their delivery method at checkout; if they don't, standard delivery is used."
- Business, record: "An order can't be cancelled once it has been dispatched."

For each rule:
- business_owner names the role that owns the policy. If you can't name one convincingly, it isn't a business rule.
- bounded_context must be the exact id of the confirmed context that owns the decision or outcome. Changed files and referenced entities are evidence, not ownership: a webhook may supply a payment fact while Invoicing owns the invoice-status policy. Use null only when none of the confirmed contexts owns the rule, and never invent an id.
- change_kind is introduced for new behaviour, modified when existing behaviour changed, retired when behaviour was removed. Removed lines in the diff show what used to be true.
- State the rule as it stands after this change; for a retired rule, state the rule that no longer applies. Don't describe earlier versions: linking a rule to its history happens in a later step.
- Evidence quotes text that appears in the input: prefer changed lines, test assertions and schema constraints, and name the enclosing symbol when you can tell.
- One policy is one rule, even when it appears in code, tests and a migration; attach several evidence items instead of repeating it.
- Only extract what this change touches. Unchanged context lines are not new rules.

If the change alters no business rules, set changes_business_rules to false and return an empty rules list. A technical constraint recorded as a business rule is worse than leaving it out.`;

const listOrNone = (items: readonly string[]): string => (items.length === 0 ? "none" : items.join("\n"));
const escapeXml = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export interface RuleContextMap {
  contexts: ReadonlyArray<Pick<BoundedContext, "id" | "name" | "description" | "aliases">>;
  matchedContextIds: readonly string[];
}

export function buildChangeSetPrompt(changeSet: ChangeSet, contextMap?: RuleContextMap): string {
  const reviews = changeSet.reviews.map(
    (review) => `- ${review.reviewer}: ${review.state}${review.body ? ` — ${review.body}` : ""}`,
  );
  const discussion = changeSet.comments.map(
    (comment) => `- ${comment.author}${comment.path ? ` on ${comment.path}` : ""}: ${comment.body}`,
  );
  const omitted = changeSet.droppedFiles.map((file) => `- ${file.path} (${file.reason})`);
  const files = changeSet.files.map((file) => `<file path="${file.path}">\n${file.patch}\n</file>`);
  const contexts =
    contextMap?.contexts.map(
      (context) =>
        `<context id="${context.id}" matched_by_changed_paths="${contextMap.matchedContextIds.includes(context.id)}">\n` +
        `<name>${escapeXml(context.name)}</name>\n` +
        `<description>${escapeXml(context.description)}</description>\n` +
        `<aliases>${context.aliases.length === 0 ? "none" : context.aliases.map(escapeXml).join(", ")}</aliases>\n` +
        "</context>",
    ) ?? [];
  const contextSection =
    contextMap === undefined
      ? []
      : [
          "<confirmed_context_map>",
          contexts.length === 0 ? "none" : contexts.join("\n"),
          `<candidate_context_ids>${contextMap.matchedContextIds.join(", ") || "none"}</candidate_context_ids>`,
          "</confirmed_context_map>",
          "Choose rule ownership from the confirmed ids above. Path-matched candidates are a starting point, not an ownership decision.",
          "",
        ];

  return [
    ...contextSection,
    `<change_set id="${changeSet.id}" kind="${changeSet.kind}">`,
    `<title>${changeSet.title}</title>`,
    `<author>${changeSet.author}</author>`,
    `<merged_at>${changeSet.mergedAt}</merged_at>`,
    `<description>\n${changeSet.description || "none"}\n</description>`,
    `<reviews>\n${listOrNone(reviews)}\n</reviews>`,
    `<discussion>\n${listOrNone(discussion)}\n</discussion>`,
    `<omitted_files>\n${listOrNone(omitted)}\n</omitted_files>`,
    `<diff>\n${files.length === 0 ? "no reviewable files" : files.join("\n")}\n</diff>`,
    "</change_set>",
    "",
    "Extract the business rules this change introduces, modifies or retires.",
  ].join("\n");
}

/** Rough token estimate for planning spend before any API call; not billing-accurate. */
export function approxPromptTokens(changeSet: ChangeSet, contextMap?: RuleContextMap): number {
  return Math.ceil((SYSTEM_PROMPT.length + buildChangeSetPrompt(changeSet, contextMap).length) / APPROX_CHARS_PER_TOKEN);
}
