# Bounded-context mapping for Hippokampus

Research date: 2026-09-15

## Scope and evidence standard

This report treats a Hippokampus context map as a **rule-ownership map**: it should say which business model and policy authority owns a rule, then connect that semantic decision to code. A microservice, package, route, table, or team is evidence for a boundary, not proof of one. This is consistent with Evans's definition of a bounded context as the boundary within which a particular model applies, including its organizational and physical manifestations ([DDD Reference](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf)), and with Fowler's distinction between the different models that can exist for the same real-world concept ([Bounded Context](https://martinfowler.com/bliki/BoundedContext.html)).

Statements under **Verified findings** come from the linked primary documentation, papers, repositories, or local read-only inspection. Statements under **Recommendation for Hippokampus** are design judgments based on that evidence.

The current `src/contexts/` implementation means `experiments/rule-extraction/src/contexts/` in this repository. The research brief supplied the Tutorspaces result—9 contexts, 83% coverage, 29 overlaps—but did not identify the source commit. It is treated as a reported baseline. The referenced `context-map.json` was not present in this checkout, so its individual bindings could not be independently rerun or inspected. No paid model calls were made.

## Summary

Keep the decisions already made: generate one draft before extraction, require human confirmation, use stable context IDs and deterministic path bindings, propose rather than auto-create new contexts, and start from a current snapshot. The main change should be to turn the existing file-coverage map into an **evidence-backed context registry**.

The recommended discovery stack is:

1. Establish semantic candidates from authoritative business documents, domain language, business journeys, API operations, tests, and PR vocabulary.
2. Use cheap structural signals—routes, imports, database writes, workspace modules, and tests—to connect those candidates across layers.
3. Have the model cite the evidence for every candidate, uncertainty, and proposed binding.
4. Have a human confirm a context card containing purpose, owned decisions, language, exclusions, authoritative facts, and relationships—not just its name and paths.
5. Compile the confirmed result to deterministic path bindings at a commit and continuously check drift.

Globs should remain Hippokampus's portable, reviewable source of truth, but they should become typed bindings. Every rule-bearing file should have **one primary owning context**. It may have zero or more secondary/reference contexts. Generic infrastructure may be `shared`; genuinely shared business models should instead be recorded as an explicit Shared Kernel relationship. Two primary matches should fail validation and enter review. “Most specific glob wins” is unsuitable because path depth does not establish business authority.

For Tutorspaces, the highest-value additions are route/API namespaces, an import graph seeded from confirmed paths, database **write** ownership, and behavioral tests. Local inspection found 1,061 files, including 913 TypeScript files, 286 TypeScript test/spec files, 105 API route handlers, 68 files under the database schema directory, and nine package manifests. There is no CODEOWNERS file. Of 193 merged PRs, 178 use conventional scopes, so scopes are unusually useful in this repository but should remain naming evidence rather than labels.

Do not optimize context boundaries from coupling alone. Academic decomposition work is useful but primarily finds technically cohesive service candidates. A 2023 systematic review found inconsistent metrics, few shared benchmarks, strong Java bias, and continued dependence on expert judgment ([Abgaz et al.](https://doi.org/10.1109/TSE.2023.3287297)). Hippokampus should use structural metrics as warnings and explanations around a human semantic decision, not as an automatic context generator.

Evaluate the map on a small human-labeled gold set and on its downstream purpose. For Tutorspaces, label a stratified sample—104 files if the restored map confirms nine contexts—score primary-context macro-F1 and business-bearing coverage, then test context candidate recall on three business PRs per confirmed context. Treat unresolved primary overlaps and undocumented multi-context table writers as hard failures. Keep dependency cohesion, data ownership, pattern count, and drift as diagnostics so that one giant context cannot “win” by gaming a single coupling score.

When a rule spans contexts, assign exactly one owner: the context that owns the decision or outcome. Record other contexts as fact sources or references. “Late cancellations are billable” belongs to Invoicing/Billing if that context decides the charge; Sessions/Attendance supplies the cancellation fact. If a sentence actually contains two independently governed policies, split it into related rules.

## 1. Prior art: discovering bounded contexts from code

### 1.1 Practitioner discovery and modeling methods

#### Context Mapping and the Bounded Context Canvas

**Verified findings**

- Context Mapping documents bounded contexts and their relationships—Shared Kernel, Customer/Supplier, Conformist, Anti-Corruption Layer, Open Host Service, Published Language, and related patterns. It can be applied to an existing landscape, but it presupposes that candidate contexts have been identified ([DDD Crew Context Mapping](https://github.com/ddd-crew/context-mapping), [Context Mapper context-map reference](https://contextmapper.org/docs/context-map/)).
- The Bounded Context Canvas records a context's purpose, ubiquitous language, business decisions, inbound/outbound messages, collaborators, assumptions, verification metrics, and open questions ([DDD Crew canvas](https://github.com/ddd-crew/bounded-context-canvas)).
- The DDD Crew repositories were last pushed in August 2026.

**Recommendation for Hippokampus**

Use a compact machine-readable version of the Canvas as the human confirmation form. At minimum, add:

- `purpose`
- `ownedDecisions` or `policyAreas`
- `authoritativeFacts`
- `language` (important terms and local meanings)
- `exclusions` (plausible responsibilities the context does not own)
- `relationships` (upstream/downstream, Shared Kernel, ACL, Published Language)
- `ownerTeam`, when known

These fields directly support rule assignment. A one-sentence description and aliases are not enough to distinguish close candidates such as Sessions, Attendance, Video Integration, and Invoicing.

Treat the DDD Crew repositories as maintained knowledge artifacts rather than runtime dependencies.

#### EventStorming and Domain Storytelling

**Verified findings**

- EventStorming is a collaborative business-domain exploration method. Big Picture EventStorming exposes inconsistencies, hotspots, terminology, systems, pivotal events, and **emerging** bounded contexts; process-level work adds commands, policies, actors, read models, and alternatives ([official EventStorming site](https://www.eventstorming.com/), [DDD Crew glossary](https://github.com/ddd-crew/eventstorming-glossary-cheat-sheet)). Its output is candidate semantic structure, not an automatically final context map.
- Domain Storytelling elicits concrete stories from domain experts and groups cohesive activities. The method's authors show “Offering” as a candidate context that may be implemented as either a module or microservice ([Hofer and Schwentner excerpt](https://www.informit.com/articles/article.aspx?p=3124864)).
- The open-source Domain Storytelling modeler formerly called `domain-story-modeler` is now [WPS/egon.io](https://github.com/WPS/egon.io); release 3.2.1 was published in June 2026.

**Recommendation for Hippokampus**

Do not require workshop artifacts, because Hippokampus must work on repositories that do not have them. If they exist, rank them above folders and coupling. Parse their vocabulary, activities, actors, events, and policies into context signals. Present them to the reviewer as evidence rather than translating every swimlane or event directly into a context.

#### Context Mapper

**Verified findings**

- Context Mapper's CML represents strategic DDD and context relationships and can derive models from use cases/user stories ([paper](https://doi.org/10.1007/978-3-030-67445-8_11), [documentation](https://contextmapper.org/docs/home/)).
- Its reverse-engineering prototype finds Spring Boot applications through annotations and relationships through Docker Compose; it derives aggregates from REST endpoints and entities from endpoint types ([reverse-engineering documentation](https://contextmapper.org/docs/reverse-engineering/), [Lakeside Mutual example](https://github.com/ContextMapper/context-map-discovery/tree/master/Examples/LakesideMutual)). This recovers declared application/deployment structure; it does not prove that each Spring application is one coherent business model.
- It also supports current-model split/merge refactorings by feature and owner ([architectural refactorings](https://contextmapper.org/docs/architectural-refactorings/)).
- Maintenance is currently low: `context-mapper-dsl` last released 6.12.0 in August 2024 and was last pushed in July 2025; `context-map-discovery` last released 1.4.0 in August 2024. Neither repository is archived, but they should not be treated as actively evolving dependencies as of this research date.

**Recommendation for Hippokampus**

Borrow three ideas, not the implementation:

1. pluggable discovery strategies;
2. explicit context relationships with semantic validation;
3. split/merge operations as reviewed transformations.

Keep the TypeScript-native harness and repository-neutral signal model.

#### C4 and Structurizr

**Verified findings**

- C4 describes software systems, containers, components, and code. A C4 container is an application or data store; a component is a grouping of functionality inside a container. Bounded Context is not a C4 abstraction level ([C4 overview](https://c4model.com/), [container diagram](https://c4model.com/diagrams/container), [component definition](https://c4model.com/abstractions/component)).
- Structurizr is models-as-code for C4 and supports relationships, documentation, ADRs, custom elements, groups, tags, and includes ([Structurizr DSL](https://docs.structurizr.com/dsl), [language reference](https://docs.structurizr.com/dsl/language)). It is active; the repository was pushed on the research date and the latest application release was `v2026.06.28`.

**Recommendation for Hippokampus**

Treat C4/Structurizr as evidence of physical boundaries and dependencies. Import tagged custom elements or groups when users deliberately model contexts, but do not infer context identity from “container” or “component” alone.

#### Backstage Software Catalog

**Verified findings**

- Backstage models Components, APIs, Resources, Systems, Domains, Groups, and ownership. Its documentation describes a Domain as a grouping that shares terminology, domain models, metrics, KPIs, business purpose, or documentation—that is, a bounded context ([system model](https://backstage.io/docs/features/software-catalog/system-model/)).
- Entity descriptors are source-controlled and identify owner, lifecycle, system/domain membership, provided/consumed APIs, and dependencies ([descriptor format](https://backstage.io/docs/features/software-catalog/descriptor-format/), [relations](https://backstage.io/docs/features/software-catalog/well-known-relations/)).
- The GitHub provider can crawl an organization and ingest matching catalog descriptors ([GitHub Discovery](https://backstage.io/docs/integrations/github/discovery/)).
- Backstage was active on the research date and released 1.55.0 that day.

**Recommendation for Hippokampus**

Add an optional Backstage importer. A declared `Domain` is strong evidence, while Systems and Components are code/deployment anchors within or across that domain. Preserve Backstage entity references as external IDs, but require Hippokampus confirmation because catalog quality is organization-dependent.

#### jQAssistant, ArchUnit, dependency-cruiser, Spring Modulith, and Nx

**Verified findings**

- [jQAssistant](https://jqassistant.github.io/jqassistant/current/) scans software into a Neo4j graph, enriches it with concepts, and validates user-defined Cypher constraints. Core 2.9.1 was released in February 2026. Its [TypeScript plugin](https://github.com/jqassistant-plugin/jqassistant-typescript-plugin) released 1.4.4 in March 2026.
- [ArchUnit](https://www.archunit.org/userguide/html/000_Index.html) tests Java package/class dependencies, layers, slices, cycles, and architecture metrics. Version 1.5.0 was released in August 2026.
- [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) emits and validates JavaScript/TypeScript dependency graphs, including path restrictions, cycles, orphans, and instability-related rules ([rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md)). Version 18.3.1 was released in September 2026.
- [Spring Modulith](https://docs.spring.io/spring-modulith/reference/verification.html) discovers explicit application modules and verifies no module cycles, API-only access, and allowed dependencies. Version 2.1.1 was released in August 2026.
- [Nx](https://nx.dev/docs/features/enforce-module-boundaries) attaches tags such as `scope:*` and `type:*` to projects and enforces allowed dependencies. Version 22.7.12 was released in September 2026.

These tools validate or document an architecture supplied by package conventions, annotations, paths, or tags. They do not independently discover business language or policy ownership.

**Recommendation for Hippokampus**

Use the lightweight native graph for common languages and import data from these tools when already configured. For TypeScript, dependency-cruiser output is a lower-cost first integration than adopting Neo4j/jQAssistant. Treat Spring Modulith annotations and Nx `scope:*` tags as high-confidence explicit bindings.

### 1.2 Academic and tool-assisted decomposition

#### What signals prior work uses

**Verified findings**

- A 2023 systematic review of 35 primary studies separates model/domain, static code, dynamic/log, and version/evolution inputs. Static data was the most common individual input (42.9%). Graphs were the most common representation (51.4%), and classes were the dominant unit. The review found no approach combining all input classes, no standardized metrics or benchmarks, and a strong Java bias: 68.6% of reviewed studies evaluated Java applications ([Abgaz et al.](https://doi.org/10.1109/TSE.2023.3287297)).
- An independent 2024 comparison ran eight decomposition tools on four Java/Spring systems with reference decompositions and developer interviews. No signal or tool worked best for every application; metric scores could reward incomplete or implausible partitions; static-analysis limitations omitted substantial code; and the authors concluded that iterative developer involvement remains necessary ([Wang et al.](https://doi.org/10.1145/3691620.3695504), [replication artifacts](https://resess.github.io/artifacts/MicroserviceToolStudy/)).
- Service Cutter converts domain entities (“nanoentities”), use cases, ownership, consistency, security, volatility, storage, and related criteria into a weighted graph and clusters it. Its catalogue lists 16 criteria, including semantic proximity, identity/lifecycle commonality, shared ownership, consistency constraints, and volatility; mutability and network-traffic similarity are marked not implemented ([Gysel et al.](https://doi.org/10.1007/978-3-319-44482-6_12), [criteria catalogue](https://github.com/ServiceCutter/ServiceCutter/wiki/Coupling-Criteria)). Validation used two approximately 20-entity examples; some generated cuts were unreasonable. The original [Service Cutter repository](https://github.com/ServiceCutter/ServiceCutter) explicitly says it is no longer maintained and its build is broken. The successor library's last release was in 2020, and Context Mapper disabled the integration in 2023 due to its old Log4j dependency ([6.10 release notes](https://contextmapper.org/news/2023/11/24/v6.10.0-released/)).
- Mazlami, Cito, and Leitner construct alternative graphs from co-change (“logical”), identifier/content similarity (“semantic”), and shared contributors, then cluster candidate services. Their evaluation uses custom technical and team-size metrics rather than a human bounded-context gold standard ([ICWS 2017 paper](https://doi.org/10.1109/ICWS.2017.61)).
- Mono2Micro clusters Java classes from runtime traces labeled by business use cases. It was evaluated on four open-source and three proprietary systems and compared with four baselines using five decomposition metrics; 21 practitioners were surveyed ([Kalia et al.](https://doi.org/10.1145/3468264.3473915)). The [replication repository](https://github.com/kaliaanup/Mono2Micro-FSE-2021) contains datasets and converters, not the tool source, and has not been updated since 2021.
- A database-first technique mapped 198 tables and business functions in a 750-KLOC banking system, producing a graph with 1,942 vertices and table-access edges. This is strong evidence that data access can connect layered code to business areas, but the paper is one industrial case and begins with manually identified subsystems ([Levcovitz et al.](https://doi.org/10.48550/arXiv.1605.03175)).
- A static-versus-dynamic study collected entity **read**, **write**, access, and sequence relationships. Neither technique consistently outperformed the other on its two systems; dynamic collection required more effort and had coverage limitations. In one production trace, only 44% of controllers were exercised despite collecting 490 GB over three weeks ([Andrade, Santos, and Rito Silva](https://arxiv.org/html/2204.11844)).
- A 2024 study clustered 326 OpenAPI endpoints and compared them with expert labels. Its best configurations achieved ARI and NMI above 0.75, while silhouette scores remained below 0.3; the authors still required human configuration and verification ([OpenAPI decomposition study](https://doi.org/10.1109/ICAIIC60209.2024.10463497)).
- A domain-driven industrial case took the opposite sequence: domain analysis and ubiquitous-language work identified candidate contexts first, then static dependencies and runtime traces mapped and refined them in a lottery monolith. This is the closest evidence for Hippokampus's semantic-first design, but it remains one qualitative case rather than a controlled benchmark ([Krause et al.](https://doi.org/10.1109/ICSA-C50368.2020.00011)).

#### How well the signals hold up

**Verified synthesis**

- Static dependencies are cheap and broad but describe possible technical coupling, including framework and shared-utility edges.
- Dynamic traces describe exercised journeys but are incomplete unless workloads or tests cover the business behavior.
- Co-change can recover hidden coupling, but reviewed studies do not establish it as sufficient on its own; it also inherits commit quality, team boundaries, squashes, and mixed-change noise.
- Semantic similarity helps align vocabulary, but generic identifiers and duplicated language can merge models that have different meanings.
- Data access, especially writes and transactions, is closer to consistency and authority than raw imports, but central repositories and generic data clients can hide the caller that owns the decision.
- Most published evaluations optimize technical service decomposition—not whether each cluster has one coherent language and policy authority.

**Recommendation for Hippokampus**

Use automated decomposition as **triangulation**:

- semantic/business evidence proposes contexts;
- paths create deterministic bindings;
- imports, writes, and tests reveal missing or suspicious bindings;
- humans decide semantic ownership.

Do not import Service Cutter as a dependency or let a clustering objective create confirmed contexts.

## 2. Signals beyond the current implementation

### 2.1 Value-per-cost ranking

The ranking below is for Hippokampus's purpose—consistent business-rule ownership—not for extracting deployable microservices.

| Rank | Signal | Value / cost | Best fit | Principal failure mode | Recommendation |
|---|---|---|---|---|---|
| 1 | Route and API namespaces, including operation verbs | High / low | Layered web repos, monoliths, API services | Routes can be transport aliases or combine orchestration from several contexts | Collect automatically; weight mutations and explicit business verbs above layout/page files |
| 2 | Import/dependency graph seeded from confirmed context anchors | High / low–medium | Layered and feature repos | Framework, barrel, type-only, and shared-utility edges create false cohesion | Use to expand/review bindings and measure boundary health, never as sole owner |
| 3 | Database table **write** ownership and transactional co-access | Very high / medium–high | Data-heavy monoliths and layered repos | Repository abstractions, raw SQL, stored procedures, and dynamic query builders obscure ownership | Add after route/import signals; keep reads and writes separate |
| 4 | Behavioral test location, names, fixtures, and exercised entry points | Medium–high / low | Tutorspaces-like repos with strong tests | Tests may mirror technical layers or test several contexts together | Use as policy vocabulary and workflow evidence; do not map test folders wholesale |
| 5 | Domain vocabulary in identifiers, route segments, schema names, and test titles | Medium / low | Layered repos and poorly modularized monoliths | Polysemy, generic terms, CRUD names, and copied types | Use TF-IDF/token co-occurrence or embeddings only around human/route seeds; show terms as evidence |
| 6 | CODEOWNERS or team ownership | Medium / very low when present | Multi-team monorepos and multi-repo organizations | Ownership can be operational rather than business-semantic and can be stale | Import as supporting evidence; never create a context from a team alone |
| 7 | Co-change history | Medium–low / medium | Mature repos with clean, scoped changes | Squashes, migrations, formatting, mixed PRs, young history, and reorganizations | Optional diagnostic only, consistent with snapshot-first |

Additional high-value signals for multi-repo systems are package/service manifests, Backstage catalog entities, OpenAPI/protobuf schemas, event topics, deployment manifests, and service-to-service calls. They replace the single-repository import graph at the organization boundary.

### 2.2 Applicability by repository shape

| Signal | Layered monorepo | Feature-folder repo | Many microservice repos | Traditional monolith |
|---|---|---|---|---|
| Routes/API operations | Strong cross-layer seeds | Strong confirmation | Strong public-contract evidence | Strong if web/API based |
| Imports/calls | Strong bridge across layers | Strong boundary check | Weak across repository boundaries unless call graphs are added | Strong |
| Table writes/transactions | Strong | Strong | Strong if ownership is observable centrally; otherwise per service | Strong |
| Tests | Strong when behavior-named | Strong | Medium; tests are distributed | Medium–strong |
| Identifier vocabulary | Strong but noisy | Medium | Medium across contracts | Strong but noisy |
| CODEOWNERS/team | Medium | Medium | Strong organization-level evidence | Depends on team structure |
| Co-change | Medium at best | Medium | Weak across repos without organization-wide joins | Medium at best |
| Catalog/API/event graph | Medium | Medium | Very strong | Medium |

### 2.3 Tutorspaces-specific evidence

**Verified local findings**

- 1,061 files: 913 TypeScript, 286 TypeScript test/spec files, 105 API route handlers, 68 files under the database schema directory, and nine package manifests.
- No CODEOWNERS file.
- 178 of 193 merged PR titles have conventional scopes. The scopes include both business terms and technical terms, confirming that the existing prompt is right to filter rather than trust them.
- The canonical context area contains a business source file without a Markdown extension, while its index says the business document should be read first. `selectDocPaths()` currently restricts domain/context documents to `.md`, so it does not collect that source.
- The repository has centralized schema and shared data-client code, so file location alone will over-assign “database” or `shared`; callers and write operations are needed to recover business ownership.

**Recommendation for Hippokampus**

Implement signals in this order:

1. Follow a bounded number of local links/read-order references from selected authoritative docs, and accept small text files without extensions.
2. Parse route segments and methods into an entry-point index.
3. Build a TypeScript import graph, distinguishing runtime, type-only, test, and external edges.
4. Link tests to production files and extract business vocabulary from test titles and identifiers.
5. Add table read/write analysis after the cheaper signals have been evaluated.

## 3. Representing code-to-context mappings

### 3.1 Options

| Representation | Strengths | Weaknesses | Suitable role |
|---|---|---|---|
| Globs | Portable, deterministic, understandable, cheap, work without builds | Refactor-sensitive; verbose in layered repos; accidental overlaps | Confirmed source of truth |
| Dependency-graph membership | Connects code across layers; supports cohesion/coupling checks | Tool/language specific; hub nodes and cycles; graph can change after innocuous refactors | Candidate expansion and validation |
| Explicit module annotations/tags | Stable intent, close to code, reviewable in PRs | Requires modifying or already structuring target repos; adoption burden; can become stale | Highest-confidence optional input |
| Exact file manifest | Unambiguous at one commit; easy to diff | Large and immediately stale after moves | Generated snapshot/cache, not authored map |
| Catalog entities | Strong for ownership and multi-repo systems | Coarse; dependent on catalog discipline | Organization-level context and component anchor |
| Hybrid | Separates semantic authority from structural evidence | More schema and explanation work | Recommended |

### 3.2 Recommended hybrid

Keep globs authoritative, but replace untyped `pathPatterns: string[]` with conceptual **bindings**:

```json
{
  "include": ["apps/web/src/**/invoice*"],
  "exclude": ["apps/web/src/**/invoice-icon*"],
  "role": "primary",
  "source": "human",
  "reason": "Implements invoice lifecycle and charging decisions"
}
```

Roles:

- `primary`: the context owns business decisions implemented by the file;
- `reference`: the file consumes or coordinates with the context but does not own its policy;
- `shared-technical`: generic infrastructure with no business owner;
- `shared-kernel`: jointly governed business model, valid only when a Shared Kernel relation names the participating contexts.

The stored map remains human-readable. At `commitSha`, Hippokampus expands it to an exact generated manifest and records a hash. That manifest supports fast extraction, drift diffs, and reproducibility without becoming the authored source.

### 3.3 Shorter and more durable patterns

1. **Root bindings first.** If a workspace package, service, or feature directory is coherent, bind its root and use exclusions rather than listing files.
2. **Reusable path sets.** Define repository-level layer roots once (for example application routes, domain libraries, database schema, tests) and let a context supply feature tokens or suffixes. Compile these to ordinary globs before use.
3. **Equivalent-set minimization.** Given a hand-listed draft, generate candidate compressed globs and accept only candidates that match exactly the same files at the draft commit. Show newly captured files separately on future checks.
4. **Optional marker/import support.** If a repository already has Spring Modulith, Nx tags, Backstage descriptors, package metadata, or a Hippokampus sidecar at a module root, import that explicit identity and compile its location to path bindings.
5. **Move assistance.** Use Git rename detection in the PR drift check to propose binding updates. Never change the stable context ID because a directory moved.

Pattern count alone is not a quality objective. A few broad false-positive patterns are worse than a longer accurate map.

### 3.4 Overlap resolution

**Recommendation**

1. A relevant file may have at most one `primary` context.
2. It may have multiple `reference` contexts.
3. A `shared-technical` file must have no primary owner.
4. A `shared-kernel` match must name at least two contexts and an explicit Shared Kernel relationship.
5. Two primary matches are an error and review item; extraction receives no silently selected owner.
6. An exact human override may resolve a small exceptional set, but it must include a reason.
7. Do not use “most specific wins.” Specificity is a path property, not a business-ownership property.

For a changeset, `contextsForPaths()` should return evidence-rich candidates: primary files touched, reference files touched, rule-bearing likelihood, and why each context was suggested. File counts can rank candidates but should not decide rule ownership.

## 4. Evaluating whether a map is good

### 4.1 What each metric answers

**Human agreement**

- Primary-context precision/recall/F1 answers whether rule-bearing code is assigned to the expected owner.
- Macro-F1 prevents a large Sessions context from hiding poor small-context performance.
- If multiple secondary labels are permitted, report exact match and mean Jaccard separately. Multi-label agreement is not equivalent to ordinary single-label agreement; chance-corrected variants are preferable for repeated research datasets ([Marchal et al.](https://aclanthology.org/2022.coling-1.322/)).

**Partition similarity and draft stability**

- Adjusted Rand Index (ARI) compares two single-label partitions, ignores label-name permutations, scores identical partitions as 1, and adjusts random agreement toward 0 ([scikit-learn ARI](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.adjusted_rand_score.html)).
- Adjusted Mutual Information (AMI) is also chance-adjusted and is useful when context counts differ ([scikit-learn AMI](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.adjusted_mutual_info_score.html)).
- Neither handles `shared`, `unmapped`, or genuine multi-label semantics automatically; calculate them only on a declared single-primary subset.

**Structural fitness**

- Internal-edge ratio, cross-context edge count, cycles, and dependency modularity reveal technical leakage.
- Table-writer concentration reveals conflicting state authority.
- These metrics are diagnostics, not semantic truth. A single giant context has perfect external coupling, so coupling cannot be the primary score.

**Downstream utility**

- `owner@1`: the expected rule-owning context is the first candidate from changed paths.
- `owner@k`: the expected owner appears anywhere in the candidates supplied to the extractor.
- Extracted-rule context accuracy: the confirmed rule owner equals the model-selected context ID.
- Ambiguity rate: the extractor receives more than one plausible primary owner without enough context-card evidence to choose.

**Maintainability**

- number of authored patterns per 100 mapped files;
- dead patterns and newly unmapped business-bearing files;
- classification churn after renames;
- unresolved questions and primary overlaps;
- time required for human confirmation.

### 4.2 Recommended score model

Use a scorecard with hard gates rather than one coupling objective.

The main 0–100 quality score should be:

- 60 points: macro-F1 for primary context on the human-labeled, business-bearing sample;
- 25 points: `owner@1` on the business-PR sample;
- 15 points: coverage of human-labeled business-bearing files.

Hard gates:

- zero unresolved `primary + primary` overlaps;
- zero confirmed contexts without an owned decision/policy area;
- no table with confirmed writes from several primary contexts unless documented as intentional;
- every map is tied to a commit and has no dead required binding.

Report but do not blend into the score:

- `owner@k`;
- dependency cut/internal-edge ratios and cross-context cycles;
- table read/write matrix;
- shared-code precision;
- ARI/AMI across repeat drafts;
- pattern density and review time.

This separation prevents technical cohesion from compensating for incorrect business ownership.
Preserve every component and hard-gate result in the report; never accept a map from the total score alone.

## 5. Lifecycle and organization-level maps

### 5.1 Drift

**Verified findings**

- Backstage continuously processes source-controlled entities. When an entity is no longer emitted by a source, it becomes orphaned and is deleted by default unless configured to be kept ([entity lifecycle](https://backstage.io/docs/features/software-catalog/life-of-an-entity), [catalog configuration](https://backstage.io/docs/features/software-catalog/configuration/)).
- Backstage's GitHub provider periodically discovers descriptors across an organization, demonstrating a scalable pull-based organization catalog ([GitHub Discovery](https://backstage.io/docs/integrations/github/discovery/)).
- Backstage's externally meaningful identity is the complete entity reference, not its generated UID ([entity references](https://backstage.io/docs/features/software-catalog/references/), [descriptor warning](https://backstage.io/docs/features/software-catalog/descriptor-format/)).
- Backstage reconciles current catalog entities, but its standard model has no rename, split, or merge lineage. Because the entity reference includes `kind`, `namespace`, and `name`, a name change is an identity change unless an integration supplies its own migration convention.

**Recommendation for Hippokampus**

Run a free incremental check on every PR and a full scheduled check:

- changed relevant file has no primary/shared classification;
- changed file changes primary context unexpectedly;
- primary overlap introduced;
- pattern now matches nothing;
- context has no rule-bearing anchors;
- new route, table, package, event, or service has no context evidence;
- table gains a writer from another context;
- cross-context dependency cycle appears;
- map commit falls behind default branch.

Drift creates proposals, never automatic contexts.

### 5.2 Rename, split, and merge

Use append-only map snapshots and stable lineage:

- **Rename:** same context ID; old names become aliases.
- **Split:** deprecate the old ID and create new IDs with `splitFrom`; old rules keep their historical owner unless a reviewed migration reclassifies them.
- **Merge:** deprecate old IDs and create or select a successor with `mergedFrom`; do not erase old ownership.
- **Replacement:** use `supersededBy`/`supersedes` links and effective commit/time.
- Never reuse a deprecated ID for a different model.

Store `mapVersion`, `validFromCommit`, `validToCommit`, `reviewedAt`, and reviewer identity. A RuleVersion should retain the context ID valid when it was extracted. Query-time lineage may roll historical contexts into a current view without rewriting provenance.

Represent lineage as a transition record with arrays of predecessor and successor IDs, transition type, effective commit, and rationale. A many-to-many record handles both splits and merges without overloading a single `supersedes` pointer.

Context Mapper proves that split-by-feature, split-by-owner, and merge transformations are practical current-model operations, but Hippokampus additionally needs historical lineage because rules and evidence outlive the current architecture.

### 5.3 Multi-repo and organization scope

Use two levels:

1. an organization context registry with globally stable context IDs, purpose, language, owner, lifecycle, and context relationships;
2. repository maps containing only local code bindings and references to those global IDs.

An organization crawler can discover repo maps similarly to Backstage's GitHub provider. It should detect:

- duplicate IDs with conflicting definitions;
- one context intentionally spanning several repositories;
- APIs/events whose provider or consumer context is unknown;
- orphaned repository bindings;
- repo-local proposed contexts awaiting organization review.

Repository boundaries are component evidence. They must not force one context per repository or prevent one context from spanning repositories.

## 6. Rules that span contexts

### Verified findings

- DDD keeps each context's model internally consistent and makes inter-context translation explicit through context-map relationships, Published Languages, and Anti-Corruption Layers ([DDD Reference](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf), [DDD Crew Context Mapping](https://github.com/ddd-crew/context-mapping)).
- The Bounded Context Canvas places “key business rules, policies and decisions” inside one context while separately recording inbound/outbound commands, events, and queries ([canvas](https://github.com/ddd-crew/bounded-context-canvas)).
- Microsoft gives the concrete example that a `DeliveryCompleted` fact published by Shipping can be consumed by Accounts to trigger invoicing: the fact and the responding policy remain in different bounded contexts ([tactical DDD guidance](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/tactical-domain-driven-design)).
- Context Mapper can model coordination across application services in several contexts, while requiring declared context relationships ([application/process layer](https://contextmapper.org/docs/application-and-process-layer/)).

### Recommendation for Hippokampus

Use this ownership rule:

> A business rule belongs to the context with authority to decide or enforce its outcome. Facts it reads remain owned by the contexts authoritative for those facts.

Represent:

- one `ownerContextId`;
- zero or more `contextReferences`, each with a role such as `fact-source`, `policy-trigger`, `command-target`, or `read-model`;
- the referenced fact/message and, when known, its Published Language or API/event contract;
- evidence files from any number of contexts.

Example:

- Sessions/Attendance owns the fact that a cancellation occurred at a particular time relative to the session.
- Invoicing owns whether that fact makes an item billable.
- The rule “Late cancellations are billable” therefore has Invoicing as owner and Sessions/Attendance as `fact-source`.

Do not assign two owners merely because a rule reads two contexts. If two authorities can independently change different parts of the sentence, split it into two rules and relate them with `dependsOn`, `triggers`, or `derivedFrom`. Create a new process context only when domain experts identify a durable, independently governed business capability—not simply because an orchestration crosses boundaries.

## Recommended design changes to `src/contexts/`

Ordered by expected value relative to effort:

1. **Define primary/reference/shared binding roles and fail unresolved primary overlaps.**  
   Value: very high. Effort: low–medium.  
   Fixes: 29 unexplained overlaps; no ownership resolution; file counts deciding candidate order.

2. **Add context decision cards to the schema and confirmation workflow.**  
   Value: very high. Effort: medium.  
   Add purpose, owned decisions, authoritative facts, language, exclusions, owner, and relationships.  
   Fixes: no semantic test of whether a context is right; close contexts are distinguished only by wording and paths.

3. **Add a gold-label/evaluation format and a free `contexts-evaluate` score.**  
   Value: very high. Effort: low–medium.  
   Compute primary macro-F1, business-bearing coverage, shared precision, overlap defects, and PR `owner@1/@k`.  
   Fixes: coverage is currently the only quality signal.

4. **Improve document discovery and evidence provenance.**  
   Value: high. Effort: low.  
   Follow bounded local links/read-order references from authoritative docs; accept small text files without extensions; record source path and authority for every inferred signal.  
   Fixes: Tutorspaces's canonical business document is currently missed; model `signals` are free text rather than traceable evidence.

5. **Collect and summarize routes, tests, schema/table names, and package manifests before drafting.**  
   Value: high. Effort: medium.  
   Group route operations and tests by vocabulary and show cross-layer occurrences to the model.  
   Fixes: long hand-listed paths; layered repositories; raw trees spend tokens without expressing roles.

6. **Add equivalent-set glob minimization, include/exclude bindings, and a generated matched-file snapshot.**  
   Value: high. Effort: medium.  
   Fixes: verbose patterns, false positives, refactor fragility, and inability to explain classification changes.

7. **Add a TypeScript import graph as validation and candidate expansion.**  
   Value: high for current target. Effort: medium.  
   Distinguish runtime/type/test edges and downweight known hubs.  
   Fixes: feature code scattered across routes, UI, logic, schema, and tests.

8. **Version maps and contexts with lineage and drift diffs.**  
   Value: high. Effort: medium.  
   Add map versions, effective commits, aliases for renames, and split/merge/supersedes links.  
   Fixes: stale patterns, future renames/splits/merges, historical rule provenance.

9. **Add context relationships and cross-context rule-reference support.**  
   Value: high. Effort: medium.  
   Fixes: spanning-rule ambiguity; no representation of fact suppliers, Published Languages, ACLs, or Shared Kernels.

10. **Add database read/write and transaction analysis.**  
    Value: very high. Effort: high and framework-specific.  
    Begin with Drizzle patterns, preserve unknown/dynamic cases, and distinguish schema location from write caller.  
    Fixes: data ownership is not measured; central database layers obscure policy owners.

11. **Import explicit architecture metadata.**  
    Value: medium–high. Effort: medium.  
    Support Backstage Domains/Systems, Nx tags, package metadata, Spring Modulith annotations, and optional sidecar markers through adapters.  
    Fixes: pattern maintenance and organization-level reuse.

12. **Add an organization registry and repository discovery.**  
    Value: high at multi-repo scale. Effort: high.  
    Fixes: duplicate context definitions and contexts spanning several repositories.

13. **Keep co-change as an opt-in diagnostic.**  
    Value: low–medium. Effort: medium.  
    Require a minimum history size, ignore bulk/mechanical changes, and report confidence.  
    Fixes: little for the current snapshot baseline; useful only where history quality is demonstrated.

## Cheap Tutorspaces evaluation protocol

### Inputs

- Restore the existing confirmed/draft `context-map.json`.
- Freeze the current default-branch SHA and export every relevant file's primary, reference, shared, overlap, or unmapped classification.
- Do not run `contexts-draft`.

### Step 1: build a stratified gold sample

Have the project owner label:

- all 29 currently overlapping files;
- 20 unmapped files, stratified across the largest unmapped directories;
- five mapped files per confirmed context, sampled across route, business logic, schema/data, UI, and test layers where available;
- 10 shared files, sampled from different shared patterns.

If the restored map confirms the reported nine contexts, this produces 29 + 20 + (5 × 9) + 10 = 104 files. Recalculate the mapped portion if its context count differs.

For each file record:

- `kind`: `business-bearing`, `shared-technical`, `technical-local`, or `unclear`;
- exactly one expected primary context when business-bearing;
- optional reference contexts;
- one-sentence evidence;
- reviewer confidence.

Resolve `unclear` items through the six existing open questions rather than forcing labels. Keep them out of F1 and report their rate.

Estimated human effort: 90–150 minutes if the reviewer knows the repository.

If a second domain-aware reviewer is available, have them independently label a blinded 25% stratified subset. Report raw agreement and Cohen's kappa before adjudication; use disagreement to refine the context cards, not as an automatic map rejection threshold ([Cohen](https://doi.org/10.1177/001316446002000104)).

### Step 2: score semantic ownership

Calculate:

- primary accuracy and macro-F1 on decisive business-bearing items;
- business-bearing coverage;
- exact and Jaccard agreement for reference labels;
- shared precision;
- primary-overlap defect rate;
- per-context confusion pairs.

Apply the 60/25/15 quality score after Step 3. Use these proposed initial targets as project thresholds, not literature-derived facts:

- macro-F1 at least 0.85;
- business-bearing coverage at least 0.95;
- zero unresolved primary overlaps;
- no context below 0.70 recall.

### Step 3: test downstream PR assignment

Select three merged PRs per confirmed context from clearly business-scoped PRs—27 if the restored map confirms nine contexts. Exclude dependency, CI, formatting, and pure refactor PRs. If a context has fewer than three suitable PRs, use all available PRs and report the shortfall. The owner labels the expected decision-owning context from the PR description and diff before viewing Hippokampus candidates.

Run the free path classifier and calculate:

- `owner@1`;
- `owner@k`;
- no-candidate rate;
- multi-primary ambiguity rate.

Proposed initial targets:

- `owner@1` at least 0.85;
- `owner@k` at least 0.95;
- no-candidate rate below 0.05.

This tests the context map's intended downstream use without paying for extraction. Once real extracted rules exist, replace PR-level labels with rule-level labels.

### Step 4: structural diagnostics

Locally produce:

- TypeScript runtime import internal-edge ratio by context;
- top cross-context dependency pairs and cycles;
- table read/write matrix by primary context;
- table-writer concentration;
- patterns per 100 mapped files, dead patterns, and exact-file exceptions.

Review the top 20 cross-context edges and every multi-context writer manually. Do not fail merely for high read coupling; fail undocumented competing writes or a dependency that contradicts the confirmed context relationship.

### Step 5: compare revisions

After fixing the map:

- rerun the same gold sample and PR set;
- require no regression in macro-F1 or `owner@1`;
- report how many authored patterns changed and how many files changed classification;
- keep the sample and labels as a permanent regression fixture.

### Optional paid stability experiment

With approval, run two additional drafts at approximately $0.33 each (about $0.66 total beyond the existing draft), using the observed per-draft estimate supplied for this roughly 1,000-file repository; record actual token usage and cost because the estimate will vary with prompt and output size. Align proposed contexts manually by purpose/aliases, expand each map to file labels at the same SHA, and report:

- context count and unmatched-context rate;
- ARI/AMI on singly assigned files;
- per-file exact agreement;
- Jaccard overlap of each aligned context's matched files;
- open-question overlap.

Do not include stability in the acceptance score until at least three drafts exist. A stable but consistently wrong map is still wrong.

## Open questions for the project owner

1. Should `shared` be restricted to technical infrastructure, with all shared business code requiring an explicit Shared Kernel relationship?
2. Will every rule-bearing file be required to have one primary context, or may some orchestration-only files intentionally have references but no owner?
3. Must a context have at least one documented owned decision, authoritative fact, and exclusion before it can be confirmed?
4. Are context IDs repository-scoped today, and if so, what is the migration path to organization-global IDs when one context spans several repositories?
5. On a split, should historical rules stay attached to the retired context by default, with optional reviewed reclassification, or must every old rule be migrated immediately?
6. Who is authorized to confirm maps and context lifecycle proposals: repository maintainer, product owner, domain expert, or a combination?
7. May Hippokampus repositories opt into explicit sidecar/module annotations, or must mapping remain entirely out-of-repo and inference-based?
8. What level of pattern complexity is acceptable before a context must use an explicit module marker or reviewed exact-file exceptions?
9. Should context relationships be mandatory at confirmation, or added incrementally when the first cross-context rule or dependency is observed?
10. Is the optional two-run, approximately $0.66 stability experiment worth running after the human gold set is established?
11. Where should the missing Tutorspaces `context-map.json` be restored so that the stated baseline and the evaluation fixture are reproducible?
