# Phased context mapping for Hippokampus

## Purpose

This document turns the target design in `context-mapping.md` into an incremental adoption plan.

The immediate objective is deliberately small: before extracting business rules from a repository, generate a candidate JSON map that tells the extraction model which business context is likely to own each rule. A human reviews that map before it becomes authoritative.

Hippokampus does not need to solve automatic bounded-context discovery, architecture governance, and context lifecycle during initial onboarding.

## Guiding principle

A context map is a **rule-ownership map**, not a diagram of technical modules.

Its descriptions should answer:

> Which business decisions and policies belong here?

Code layout, services, routes, tables, and dependencies are evidence for that answer. They are not the answer by themselves.

## Phase 1: generate a candidate context map

**Priority: now**

### Goal

Compile the current repository into a small set of candidate business contexts before any rule extraction or human review.

### Inputs

Use the inexpensive signals already available:

- current file and directory tree;
- selected business and architecture documentation;
- conventional-commit PR scopes;
- route, schema, test, and package names visible in the tree.

This phase remains snapshot-first. It does not replay repository history or require dependency, runtime, or database analysis.

### Process

1. Collect repository signals at a fixed commit.
2. Ask the drafting model for the smallest useful set of business contexts.
3. Require each context to describe its policy ownership rather than its technical contents.
4. Generate path patterns that connect the candidate context to all visible implementation layers.
5. Put technical cross-cutting code in `sharedPaths`.
6. Surface uncertain boundaries in `openQuestions` instead of silently deciding them.
7. Save the result as a draft; do not use it as confirmed truth.

### Output

Use the existing context-map structure:

```json
{
  "repo": "owner/repository",
  "ref": "main",
  "commitSha": "abc123",
  "generatedAt": "2026-09-19T00:00:00.000Z",
  "generatedBy": "claude-sonnet-5",
  "status": "draft",
  "contexts": [
    {
      "id": "invoicing",
      "name": "Invoicing",
      "description": "Owns policies deciding when charges and invoices are created, changed, paid, or cancelled; session activity may supply facts but does not own billing outcomes.",
      "status": "proposed",
      "pathPatterns": [
        "apps/**/invoice*/**",
        "packages/**/invoice*.ts"
      ],
      "aliases": ["billing"],
      "signals": [
        "Invoice routes, schema names, tests, and PR scopes appear across several layers."
      ]
    }
  ],
  "sharedPaths": [
    {
      "pattern": "packages/ui/**",
      "reason": "Generic design-system code used by several business contexts."
    }
  ],
  "openQuestions": [
    "Does late-cancellation classification belong to Sessions or only its billing consequence to Invoicing?"
  ]
}
```

### Description standard

The description is the main semantic instruction for the later extraction model.

Use this shape:

> Owns policies that **[decisions and outcomes]**; it may use **[facts supplied by neighboring contexts]**, but does not own **[plausible neighboring responsibility]**.

Avoid descriptions such as:

> Handles invoice-related functionality.

That describes code proximity but does not tell the model where a business rule belongs.

### Definition of done

Phase 1 is complete when:

- the JSON passes the existing schema;
- every context has a stable ID, business name, ownership-oriented description, aliases, evidence, and at least one path pattern;
- shared technical paths are separated from business contexts;
- uncertain boundaries are explicit open questions;
- coverage, overlaps, unused patterns, and unmapped areas can be shown to the reviewer;
- every context and the map remain marked as proposed/draft.

High coverage is useful, but it is not evidence that the boundaries are correct. Phase 1 does not require perfect coverage or perfect boundaries.

## Phase 2: human confirmation and extraction readiness

**Priority: next**

### Goal

Turn the candidate map into the smallest trustworthy artifact required for rule extraction.

### Reviewer actions

For each proposed context, the reviewer may:

- confirm it;
- improve its description;
- rename it while preserving its stable ID;
- add aliases;
- merge it into another context;
- split it into separate policy owners;
- correct its path patterns;
- move technical code to `sharedPaths`;
- answer or defer open questions.

The reviewer should specifically check:

1. Would a product or domain lead recognize this capability?
2. Does the description state the decisions it owns?
3. Is a neighboring context likely to claim the same policy?
4. Do the paths provide enough code evidence without defining the boundary by themselves?
5. Would the extraction model know where to place an ambiguous rule?

### Output

The result is the same JSON structure with:

- approved contexts marked `confirmed`;
- the map marked `confirmed`;
- reviewed descriptions, aliases, and patterns;
- rejected or merged candidates removed;
- unresolved questions retained visibly.

Rule extraction may begin after this phase.

### Rule-assignment contract

During extraction:

- the model must choose a context ID from the confirmed list;
- the context description explains semantic ownership;
- matched paths help determine which contexts are relevant to the change;
- aliases help interpret repository vocabulary;
- the extractor must not create a new context automatically.

If a change appears to introduce a new context, it creates a proposal for later review.

## Phase 3: harden quality from real extraction feedback

**Priority: after the first repositories are operating**

### Goal

Improve the map only where observed assignment failures justify additional complexity.

Add the highest-value recommendations from the research incrementally:

1. Introduce explicit `primary`, `reference`, and `shared` binding roles.
2. Fail unresolved primary-to-primary overlaps.
3. Add compact context cards containing owned decisions, exclusions, language, and authoritative facts.
4. Evaluate a small human-labeled sample using macro-F1, coverage of business-bearing files, and downstream context assignment.
5. Add route and test summaries where layered repositories remain difficult.
6. Add a TypeScript import graph for candidate expansion and boundary diagnostics.
7. Add database read/write ownership when central data layers obscure policy ownership.
8. Compress verbose patterns without changing their matched file set.

Structural signals should explain and challenge confirmed boundaries. They should not automatically replace human ownership decisions.

## Phase 4: lifecycle and organization scale

**Priority: when maps begin changing or span repositories**

### Goal

Keep confirmed maps reliable as repositories, teams, and business capabilities evolve.

Add:

- PR-time drift checks for new unmapped areas, dead patterns, and new overlaps;
- versioned map snapshots tied to commits;
- explicit rename, split, merge, and replacement lineage;
- historical preservation of the context ID used by each extracted rule version;
- an organization-level registry for contexts spanning multiple repositories;
- optional Backstage or architecture-tool adapters;
- API, event, and service relationship evidence across repositories.

These capabilities are unnecessary for proving the initial onboarding flow. They become valuable after confirmed maps and extracted rules have real history.

## What remains invariant across all phases

1. Contexts represent business policy ownership, not technical layers.
2. Generated boundaries are candidates until a person confirms them.
3. Stable context IDs are used for rule assignment.
4. Paths provide deterministic code anchors.
5. Descriptions explain semantic ownership to the extraction model.
6. New contexts are proposed, never created automatically during extraction.
7. The baseline starts from the current repository snapshot.
8. A cross-context rule has one decision-owning context; other contexts supply facts or references.
9. Business rules describe business policy, not technical constraints.

## Practical stopping point

The first usable Hippokampus onboarding flow ends after Phase 2:

> repository signals → candidate JSON → human confirmation → confirmed JSON → rule extraction

Phases 3 and 4 are improvements toward the full design in `context-mapping.md`, not prerequisites for beginning extraction.
