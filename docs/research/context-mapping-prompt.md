# Research task: bounded-context mapping for Hippokampus

## Background
Hippokampus is an early-stage project that builds an **ontology of business rules from code**. Rules
(e.g. "a paid invoice cannot be cancelled") are extracted by an LLM (Claude Sonnet 5) and each rule is
assigned to a **bounded context**: a business capability at the level of a microservice or high-level
module (e.g. Invoicing, Sessions, Tenancy). The context map is what keeps rule assignment consistent
across thousands of extractions.

Working directory: `/Users/dzithendolabs/Documents/z10labs/hippokampus`
- `docs/ontology.drawio`: the ontology diagram (BoundedContext, BusinessRule, RuleVersion, Evidence, ChangeSet…)
- `experiments/rule-extraction/`: TypeScript harness. Read `README.md` first.
  - `src/contexts/`: the context-map feature you're researching (types, signals, prompt, coverage, draft, check)
  - `data/Dzithendo31__tutorspacesmvp-bethel/context-map.json`: the first real draft map (9 contexts)

## Decisions already made (don't re-open them; build on them)
1. **Setup happens once per repo, before any extraction.** A draft map is generated from repo signals
   (file tree, conventional-commit PR scopes, key docs), then a human reviews and confirms it.
2. **Contexts are anchored to code by path patterns (globs)**, so assignment doesn't depend on model wording.
   The model picks a context *id* from the confirmed list. Aliases capture synonyms and old names.
3. **A new context introduced by a PR is only a proposal**: it goes to a review queue (confirm as new,
   merge as an alias, or reject). It is never created automatically.
4. **Snapshot-first, not history replay.** Repo history is unreliable (migrations, squashes, missing PRs),
   so the baseline comes from the current code, one context at a time. Approved diffs keep it current, and
   `git blame` recovers provenance where it exists.
5. Rules must be **business policy**, not technical constraints.

## Current implementation and its results
- `pnpm cli contexts-draft --repo <owner/name>`: one LLM call, ~$0.33 for a ~1k-file repo
- `pnpm cli contexts-check --repo <owner/name>`: free; reports coverage, unmapped directories, overlaps and unused patterns
- On tutorspaces (Next.js + Drizzle monorepo, organised by *layer* not by feature): 9 contexts,
  83% coverage (677 files in a context, 174 shared, 170 unmapped), 29 files in more than one context.
  The model raised 6 open questions (e.g. is the dashboard its own context; split Sessions and Video by
  policy owner or by data location?).
- Known weaknesses: patterns are long, hand-listed file paths; layered repos force feature-name matching
  across layers; overlaps have no resolution rule; there's no evaluation of whether the map is *right*,
  only whether it *covers* files.

## Research questions
Answer each with evidence (papers, tools, docs, real repos) and a recommendation for Hippokampus.

1. **Prior art: discovering bounded contexts from code.**
   - What do DDD practitioners and tools do? Examples to check: context mapping patterns, EventStorming
     and Domain Storytelling outputs, Structurizr/C4, Backstage's software catalog (domains and systems),
     jQAssistant, ArchUnit/dependency-cruiser layer rules.
   - Academic microservice-decomposition work (static coupling, co-change clustering, data-ownership
     analysis, tools like Service Cutter). What signals do they use, and how well do they hold up?
   - Verify every tool or paper you cite actually exists and note whether it's maintained. Don't rely on memory.
2. **Signals beyond what we use.** Rank candidates by value per unit of cost: import/dependency graphs,
   database table ownership (which modules write which tables), co-change history, route and API
   namespaces, CODEOWNERS/team ownership, test folder structure, domain vocabulary in identifiers.
   Which work for *layered* repos, *feature-folder* repos, microservices across *many repos*, and monoliths?
3. **Representing the code→context mapping.** Globs vs. dependency-graph membership vs. explicit
   per-module annotations vs. hybrids. How do we get patterns that survive refactors and stay short?
   How should overlaps be resolved (most specific wins, primary + secondary, shared kernel)?
4. **Evaluating a context map.** How do we measure that a map is *good*, not just covering?
   Candidates: agreement with human-labelled contexts, cohesion/coupling metrics, stability across
   repeated drafts (run-to-run variance), rule-assignment agreement. Propose a cheap evaluation protocol
   we can run on tutorspaces.
5. **Lifecycle.** Detecting drift (new unmapped areas, contexts that stop matching), handling splits,
   merges and renames (versioning, supersedes links), and keeping multi-repo/org-level maps in sync.
   How do existing catalog tools handle this?
6. **Rules that span contexts.** "Late cancellations are billable" reads attendance data but is a billing
   policy. What do DDD and prior work say about owning vs. referencing contexts? Recommend a rule for us.

## Constraints
- **This is research, not implementation.** Don't modify `src/`, the harness or the diagram. You may run
  read-only commands, `contexts-check` (free), and small throwaway scripts in a scratch directory.
- `Dzithendo31/tutorspacesmvp-bethel` is a **private** repo. Don't paste its code into external
  services or public tools. Local analysis and the GitHub CLI (`gh`, already authenticated) are fine.
- Don't run `contexts-draft` or any other paid Claude API call without asking. If an experiment needs
  one (e.g. measuring run-to-run variance), propose it with a cost estimate.
- Separate verified findings from opinion, and cite sources with links.

## Deliverable
Write `docs/research/context-mapping.md` containing:
1. **Summary** (≤ 1 page): the recommended approach for Hippokampus and why.
2. **Findings** per research question, with citations.
3. **Recommended design changes** to `src/contexts/`, ordered by value vs. effort, each mapped to the weakness it fixes.
4. **Evaluation protocol**: a concrete, cheap way to score a map on tutorspaces.
5. **Open questions** that need a decision from the project owner.
