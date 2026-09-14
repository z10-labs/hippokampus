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
- **Extract** sends each change set to `claude-sonnet-5` (adaptive thinking, `high` effort) with a schema-constrained output. Results are cached per change set, so re-running only does what's missing. Use `--only pr-3` to try one first.
- **Prompt versions.** Extractions, labels and reports are stored under `<model>/<prompt version>` (see `PROMPT_VERSION` in `src/config.ts`). Bump the version whenever the prompt or schema changes, so iterations can be scored side by side instead of overwriting each other.

### Prompt history

| Version | Change |
|---|---|
| v1 | General business-rule definition. On PR #5 it produced technical constraints as rules (startup validation, HTTP 400 on an unknown provider). |
| v2 | Frames the task as translating code into business policy. Every rule must pass three tests: a business owner decides it, a customer, partner or operator would notice it, and it can be stated without implementation vocabulary. Each rule needs a `business_owner`, and technical findings go into `excluded_technical_changes` instead of becoming rules. The examples come from an unrelated retail domain so they don't leak answers for the repo being scored. |
| v3 | Removes `previous_statement`: extraction only records *that* a rule was modified or retired, and linking it to the earlier rule is left to resolution. Treats display and UX behaviour (layouts, live-updating screens) as technical. |
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
