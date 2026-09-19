# Rule extraction experiment

**Question:** given an approved code change, can Claude pull out the business rules it introduces, modifies or retires, with precision good enough to build Hippokampus on?

Each extracted rule follows the ontology in [`docs/ontology.drawio`](../../docs/ontology.drawio): a statement, a rule type, a change kind, a condition and outcome, the entities it touches, and verbatim evidence. The unit of work is a **change set**, meaning a merged PR or a commit pushed straight to the default branch.

## Pipeline

| Step | Command | Cost |
|---|---|---|
| 1. Fetch | `pnpm cli fetch --repo owner/name` | Free (GitHub CLI) |
| 2. Extract | `pnpm cli extract --repo owner/name` | Claude API, printed per change set |
| 3. Label | `pnpm cli label --repo owner/name` | Your time |
| 4. Score | `pnpm cli score --repo owner/name` | Free |

- **Fetch** saves each change set to `data/<owner>__<name>/changesets/`, with its description, reviews, comments and diff. Lockfiles, binaries, generated folders and oversized patches are dropped, and each drop is recorded with a reason. It then prints a rough cost estimate before you spend anything.
- **Extract** loads the repository's confirmed context map, matches the changed paths, and sends the complete confirmed context list plus the path candidates and change set to `claude-sonnet-5` (adaptive thinking, `high` effort). The output schema only accepts confirmed context IDs. Results are cached per change set, so re-running only does what's missing. Use `--only pr-3` to try one first.
- **Prompt versions.** Extractions, labels and reports are stored under `<model>/<prompt version>` (see `PROMPT_VERSION` in `src/config.ts`). Bump the version whenever the prompt or schema changes, so iterations can be scored side by side instead of overwriting each other.

### Prompt history

| Version | Change |
|---|---|
| v1 | General business-rule definition. On PR #5 it produced technical constraints as rules (startup validation, HTTP 400 on an unknown provider). |
| v2 | Frames the task as translating code into business policy. Every rule must pass three tests: a business owner decides it, a customer, partner or operator would notice it, and it can be stated without implementation vocabulary. Each rule needs a `business_owner`, and technical findings go into `excluded_technical_changes` instead of becoming rules. The examples come from an unrelated retail domain so they don't leak answers for the repo being scored. |
| v3 | Removes `previous_statement`: extraction only records *that* a rule was modified or retired, and linking it to the earlier rule is left to resolution. Treats display and UX behaviour (layouts, live-updating screens) as technical. |
| v4 | Requires a confirmed repository context map. Changed paths rank likely contexts, every confirmed context card is supplied for semantic ownership, and `bounded_context` is constrained to an exact confirmed ID or `null`. |
- **Label** walks you through every extracted rule in the terminal. Stop with Ctrl+C at any point; progress saves after each change set.
- **Score** writes `data/<repo>/reports/<model>-<date>.md`.

## Setup

```bash
cd experiments/rule-extraction
pnpm install
cp .env.example .env        # then set ANTHROPIC_API_KEY
gh auth status              # fetch uses your GitHub CLI login
pnpm test
```

## Context map (once per repo)

Business rules are assigned to **bounded contexts**: business capabilities at the level of a microservice or high-level module. Each repo gets a context map before any extraction:

```bash
pnpm cli contexts-draft --repo owner/name   # ~$0.35 for a ~1k-file repo: tree + PR scopes + docs → draft map
# review data/<owner>__<name>/context-map.json by hand
pnpm cli contexts-check --repo owner/name   # free: validate and report coverage
```

- **Draft.** Collects every file path on the default branch, the scopes from merged PR titles (`feat(invoicing): …`) and the documents most likely to describe the domain (root README, agent notes, architecture docs). One model call proposes contexts, each with a description, aliases, the evidence behind it and **path patterns**. In layered codebases, patterns match feature names across layers: routes, UI, logic, schema. Cross-cutting technical code goes into `sharedPaths`, and judgement calls go into `openQuestions`.
- **Review.** You are the approval step: rename, merge or split contexts, fix patterns, then set the map's `status` to `confirmed` (and each context's to `confirmed` or `deprecated`). Ids are the stable keys, so rename `name` freely but change `id` deliberately.
- **Pattern syntax.** `*`, `**` and `?` are wildcards and `{a,b}` lists alternatives. Parentheses and square brackets match literally, so Next.js route folders like `(tutor)` and `[id]` are written as-is.
- **Check.** Re-run after every edit. It reports coverage (files in a context or shared, as a share of relevant files), the largest unmapped directories, files claimed by more than one context, and patterns that match nothing (usually typos or stale paths). Run it again later to spot new, unmapped areas of the codebase.

## Testing the complete flow on another repository

Use the exact same `owner/repository` spelling for every command. It determines the local data directory, so changing capitalization between commands creates a separate dataset.

### 1. Draft the context map

```bash
REPO="owner/repository"
pnpm cli contexts-draft --repo "$REPO"
```

This makes one paid model call. The resulting `data/<owner>__<repository>/context-map.json` remains a draft and every generated context remains proposed.

### 2. Peer-review and confirm the map

Give the candidate map and repository to a second agent. The reviewer should check whether every context owns coherent business policies, challenge technical areas presented as contexts, rewrite ambiguous descriptions, and propose merges or splits. Apply accepted corrections, then set the map's `status` and each accepted context's `status` to `confirmed`.

The peer-review step is currently performed outside the CLI; confirmation is never automatic.

```bash
pnpm cli contexts-check --repo "$REPO"
```

Do not continue until the command shows a confirmed map with acceptable coverage, overlaps, unmapped areas and open questions. `extract` refuses to run against a draft map or proposed contexts.

### 3. Fetch a small evaluation sample

```bash
pnpm cli fetch \
  --repo "$REPO" \
  --pr-limit 10 \
  --commit-limit 10
```

Fetching is free. It saves the change sets and prints a rough extraction-cost estimate that includes the confirmed context cards.

### 4. Extract one business-heavy change

Choose a fetched PR that is likely to contain business policy:

```bash
pnpm cli extract \
  --repo "$REPO" \
  --only pr-123 \
  --concurrency 1
```

Prompt v4 loads the confirmed map, ranks contexts whose path patterns match the changed files, supplies every confirmed context description to the model, and constrains `bounded_context` to an exact confirmed ID or `null`. The extraction record stores the map commit, map fingerprint and matched context IDs for provenance.

### 5. Peer-review the extraction

Give the second agent:

- the confirmed `context-map.json`;
- the fetched `changesets/pr-123.json`;
- the corresponding `extractions/claude-sonnet-5/v4/pr-123.json`;
- the extraction policy in `src/extraction/prompt.ts`.

The reviewer checks business-vs-technical classification, rule atomicity, accuracy, change kind, evidence, context ownership and missed rules. This review is not yet persisted by a CLI command.

### 6. Run and grade the remaining sample

```bash
pnpm cli extract --repo "$REPO"
pnpm cli label --repo "$REPO"
pnpm cli score --repo "$REPO"
```

If the confirmed map changes after any v4 extraction, the CLI rejects mixed map provenance. Re-run the complete fetched set with `--force` and without `--only` so every cached v4 record uses the same map.

## Grading guide

| Verdict | Meaning |
|---|---|
| **correct** | A real business rule, stated accurately, with the right change kind |
| **partial** | A real rule, but the statement, condition, change kind or evidence is noticeably off, or two rules were merged |
| **wrong** | Not a business rule (a technical detail), or it misreads the code |
| **missed** | A business rule the change touches that isn't in the list; type one line each |

Decide *missed* by reading the diff yourself before looking too hard at the model's list, so its answer doesn't anchor you.

## Metrics

- **Rule precision:** correct ÷ extracted (strict); (correct + partial) ÷ extracted (lenient).
- **Rule recall:** correct ÷ (correct + partial + missed) (strict); (correct + partial) ÷ the same (lenient). Recall is only as good as your *missed* notes.
- **Classification:** how well the model decides whether a change touches business rules at all. This decides how much noise a future PR bot would produce.
- **Calibration:** accuracy by the model's own confidence. If ≥ 0.8 is reliably right, confidence can gate auto-confirmation.

## Caveats for `dzithendo31/payme`

- **Small sample.** About 10 merged PRs plus a handful of direct commits. That's enough to validate the pipeline and read the failure modes, not to trust a precision number to ±10%.
- **No approval signal.** No PR has a formal review, so this run tests *extraction from merged changes*, not the "approved" part of the hypothesis.
- **Grader bias.** You wrote the code and you grade it. That's good for recall (you know the rules) but watch for generous verdicts.
- **Large PRs.** PR #3 (70 files) and #5 (26 files) mix many rules together, so expect them to be the hardest cases.

## Not in this experiment (yet)

- Resolving rules *across* change sets. A `modified` or `retired` rule needs to be matched to the existing rule it replaces, creating a `supersedes` link on the RuleVersion. That means looking up candidates by entity, context and statement similarity before or after extraction, and deciding what to do when no earlier rule exists (for example, history from before tracking began). Merging duplicates is part of the same step.
- Batch API runs (50% cheaper, slower) for large repos.
- Comparing models.
