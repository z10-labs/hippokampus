import { CONTEXT_DOC_MAX_CHARS } from "../config";
import { countScopes, type RepoSignals, summariseTree } from "./signals";

// Examples use a retail domain so they don't steer naming for the repos being mapped.
export const CONTEXT_MAP_SYSTEM_PROMPT = `You draft a bounded-context map for a codebase. The map is used to assign business rules, extracted from code changes, to the business area that owns them, so it must reflect business capabilities rather than code structure. A person reviews and edits your draft before it is used.

A bounded context is a business capability with its own language, data and policies, at the level of a microservice or a high-level module: for example Ordering, Fulfilment, Pricing or Customer Accounts. Technical layers (api, components, lib, database, jobs) and shared infrastructure are not contexts.

How to work:
- Use every signal together: the file tree, PR title scopes with their counts, database schema file names and the documentation excerpts. Documentation that describes the domain or architecture outweighs folder names.
- Aim for the smallest set of contexts a product lead would recognise, usually between 4 and 12. Merge areas that share data and a policy owner; keep areas apart when they have different owners or vocabulary. When a boundary is a judgement call, say so in open_questions instead of deciding silently.
- PR scopes are naming hints, not answers. Scopes such as ci, ui, db, infra, e2e or deps describe technical work.
- In layered codebases one context spans several layers: routes, UI, domain logic, schema, tests, jobs and emails. Write path_patterns that cover each layer where the context's code lives, usually by matching the feature name across directories, for example "apps/web/src/**/order*/**" and "packages/db/src/schema/order*.ts". Patterns are globs relative to the repo root, matched with dot files enabled: *, ** and ? are wildcards and {a,b} lists alternatives, while parentheses and square brackets match literally, so write route folders such as "(admin)" or "[id]" exactly as they appear. Avoid patterns broad enough to catch unrelated names.
- Put cross-cutting technical code in shared_paths with a reason: design system, database client and migration tooling, build and CI config, generic utilities, test harnesses.
- Identity, access and tenancy can be a business context when they carry policy, such as who may join or which roles may act, rather than only authentication plumbing.
- ids are short, stable kebab-case names. aliases list the other names the area goes by: PR scopes, folder names, synonyms from the docs.
- signals are brief notes on the evidence for each context, so the reviewer can check your reasoning.`;

const TREE_MODE_LABELS = {
  files: "every file, grouped by directory",
  directories: "directories with file counts (too many files to list)",
} as const;

export function buildContextMapPrompt(signals: RepoSignals, treeMaxChars: number): string {
  const scopes = countScopes(signals.prTitles);
  const tree = summariseTree(signals.paths, treeMaxChars);
  const documents = signals.docs.map((doc) => {
    const truncated = doc.content.length > CONTEXT_DOC_MAX_CHARS;
    const body = truncated
      ? `${doc.content.slice(0, CONTEXT_DOC_MAX_CHARS)}\n[truncated after ${CONTEXT_DOC_MAX_CHARS} characters]`
      : doc.content;
    return `<document path="${doc.path}"${truncated ? ' truncated="true"' : ""}>\n${body}\n</document>`;
  });

  return [
    `<repository name="${signals.repo}" commit="${signals.commitSha}">`,
    `<pr_scopes titles="${signals.prTitles.length}">`,
    scopes.length === 0 ? "none" : scopes.map(({ scope, count }) => `${scope}: ${count}`).join("\n"),
    "</pr_scopes>",
    "<documents>",
    documents.length === 0 ? "none" : documents.join("\n"),
    "</documents>",
    `<file_tree files="${signals.paths.length}" listing="${TREE_MODE_LABELS[tree.mode]}">`,
    tree.text,
    "</file_tree>",
    "</repository>",
    "",
    "Draft the bounded-context map for this repository.",
  ].join("\n");
}
