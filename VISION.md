# Almanac

**Almanac generates an index of your repo's docs and keeps it inside `AGENTS.md`, refreshed on every commit.**

That is the whole tool. Not retrieval, not a server, not embeddings, not a skill. A generated list of what documentation exists, injected into the file coding agents already load.

## What it actually does

1. Walk `docs/` for markdown files.
2. For each file, take its path and derive a one-line description from its first heading or first prose line.
3. Write the result into `AGENTS.md` between two machine-managed markers, replacing whatever was there.
4. Optionally re-run on every commit via a pre-commit hook, so the list can never go stale.

The output looks like this:

```
<docs-index>

[Docs Index]
paths: cross-cutting keys live under docs/; a key shown as workspaces/<parent>/<unit>/<rest> lives at <parent>/<unit>/docs/<rest>
docs/adr/:{0007-connection-pooling.md: Why we pool at the proxy, not in the app}
docs/adr/:{0011-event-ordering.md: Ordering guarantees we do and don't provide}
docs/runbooks/:{deploy.md: Steps to ship to production}
docs/runbooks/:{incident.md: First fifteen minutes of an incident}
workspaces/apps/api/:{auth.md: Token lifecycle and refresh semantics}

</docs-index>
```

An agent loads `AGENTS.md`, sees those lines, and opens the one file it needs. That is the entire mechanism.

## The problem

A repo has fifty markdown files an agent would benefit from, and the agent reads none of them, because nothing in its context says they exist. The three common fixes each fail differently:

- **Inline the docs.** Pay full token cost every turn, forever, most of it irrelevant to the task.
- **Wrap them in a skill or retrieval tool.** Add a decision point the model frequently never reaches. Vercel measured this at a 56% non-invocation rate.
- **Let the agent explore.** Works for code, where filenames and imports advertise structure. Fails for docs, where an ADR about connection pooling sits in `docs/records/adr/0007.md` and nothing in the tree suggests reading it.

Writing the index by hand solves it for a week. Then someone adds a doc, nobody updates the block, and the map now lies — worse than no map, because the agent trusts it.

## The thesis

**Show the agent what exists; let it choose what to read.**

The index is the cheap half of retrieval — knowing what's there — hoisted into the system prompt, with the expensive half left on demand. Cost scales with the _number_ of docs, not their size. There is no tool call, no sequencing decision, no invocation that can fail to fire.

Generation is what makes it real. A map regenerated on every commit cannot go stale, and staleness is the only failure mode that matters for an artifact the agent is told to trust.

## Design rules

These are load-bearing. Each traces to a finding in the research section.

- **Generated, never hand-written.** The index lives between machine-managed markers. Prose around it belongs to the human; the block belongs to the tool. Editing it by hand is a mistake the next run corrects.
- **An index, never an overview.** The one artifact measured as actively useless is generated prose describing the repository (ETH). Almanac emits paths and terse labels. The moment it starts explaining the codebase, it has become the thing the research says to delete.
- **Pointers, never contents.** No inlining, no paraphrase, no summarization beyond one line.
- **Flat. One level.** A second routing level gave no improvement and sometimes reduced accuracy (He et al.). No nested index files, no index-of-indexes. Scale is handled by filtering and by scoping nested `AGENTS.md` files, never by adding depth.
- **One doc per line.** Generated blocks get committed, so they must merge. Line-delimited output keeps a doc added on two branches from becoming a conflict.
- **Compression is correctness, not optimization.** Vercel held 100% while compressing 40KB to 8KB; ETH priced a useless context block at +20% inference cost. Every line spends real money.
- **Deterministic and offline.** Descriptions come from the file, not from a model. No API key, no network, no nondeterminism inside a pre-commit hook.
- **Commit time is the enforcement point.** Idempotent, re-stages what it rewrites, safe to run repeatedly.
- **Respect `.gitignore`.** The generator walks the filesystem, so it must ask git what to skip (`git check-ignore --stdin`). A local-only doc must never leak into a committed index.
- **Fail loud.** Missing markers, missing target file, or a failed git invocation stops the run. Never silently emit an empty or partial index — a truncated map reads as "nothing else exists," which is the one lie that matters.

## Shape

A single CLI, zero-config for a normal repo.

- `almanac sync` — regenerate the index, write it between the markers, stage the change.
- `almanac check` — same analysis, no writes, non-zero exit on drift. For CI.
- `almanac init` — drop the markers into the target file and optionally wire the pre-commit hook.

Defaults requiring no configuration:

- `AGENTS.md` at repo root is the target.
- `docs/` is indexed.
- `apps/*/docs` and `packages/*/docs` are indexed using their actual repository-relative paths.
- Additional instruction targets are explicit configuration, so Almanac never guesses repository scope from nested files.

Configurable: include/exclude globs, target files, per-target tags, and flat or Liquid output.

Marker matching must anchor to full lines (`/^<docs-index>$/m`), not `indexOf` — otherwise a mention of the marker in surrounding prose splices the block into the wrong place.

## Non-goals

- **Not an alias or symlink manager.** `AGENTS.md` is Linux Foundation-stewarded and read natively by Cursor, Windsurf, Cline, and Codex; Claude Code 2.1.277 reads it when no `CLAUDE.md` is present. Keeping per-tool instruction filenames in sync is a shrinking problem and, where it remains, [farmall](../farmall)'s.
- **Not a multi-platform compiler.** No format conversion, no per-platform mapping, no settings translation. Also farmall.
- **Not a docs site generator.** Almanac indexes markdown where it sits and has no opinion about rendering. That is [ciderpress](../ciderpress)'s job.
- **Not a retrieval server.** No MCP, no runtime, no daemon, no embeddings. Output is a plain committed file, readable by any agent that reads files.
- **Not an author.** It does not write, rewrite, or improve doc prose. Humans own everything outside the markers.

## Risks and limits

- **There is a measured scale ceiling.** LlamaIndex found RAG overtakes filesystem agents on latency and slightly on correctness at 100 documents, decisively at 1000. Corpus2Skill found navigation loses to flat retrieval on open-domain factoid pools. JetBrains reports a million-file monorepo needs a real index for conceptual queries. Almanac targets a repo's `docs/` — tens to low hundreds of files, single-domain, real taxonomy — which sits inside the zone where evidence is strong. The README should say where it stops.
- **Description quality is the ceiling.** A line reading `overview.md: Overview` spends tokens and routes nothing. Almanac cannot fix a badly written doc.
- **A thin docs tree makes this a pure cost increase.** That is the ETH result applied honestly. Repos with few or low-value docs should measure rather than assume.
- **Native tooling may absorb this.** Harnesses could start generating it themselves. Mitigation: output is a plain committed file with no lock-in — deleting Almanac costs one commit.

## Open questions

- **Whether to put a directive inside the block.** Vercel's index carries an inline instruction — `IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning` — and ETH found instructions are reliably followed, suggesting that line does real work. The prior art this concept came from deliberately moved the directive out into human-written instructions, on the theory that a data blob is the wrong place for one. Resolve with an eval, not taste.
- **Description source.** First heading is a good default and a weak signal for a doc titled `Overview`. Optional frontmatter (`description:`) is the escape hatch; prefer it silently or require opting in?
- **Scoping at scale.** Since a second routing level hurts, a large docs tree is handled by narrowing what each instruction file indexes. Where the cut lines fall — by workspace, by depth, by tag — is unresolved.
- **Measuring it.** Almanac should ship an eval harness reproducing a Vercel-style comparison on a user's own repo, and be willing to publish a null result.

---

# The research

Everything below is why the design above is what it is. A new agent building this should not need to re-derive it.

The consistent finding across independent groups over the last eighteen months: **agents route well when shown the territory, and retrieval machinery mostly gets in the way.**

## 1. Vercel — AGENTS.md outperforms skills in our agent evals

**Source:** <https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals> (Jude Gao)
**Type:** Industry eval, blog-published.

The single most direct evidence for Almanac. Tested against Next.js 16 APIs deliberately absent from model training data (`use cache`, `connection()`, `forbidden()`), across four conditions:

| Condition                                | Build | Lint | Test | Overall          |
| ---------------------------------------- | ----- | ---- | ---- | ---------------- |
| Baseline (no docs)                       | 84%   | 95%  | 63%  | **53%**          |
| Skill, default behavior                  | 84%   | 89%  | 58%  | **53%** (+0pp)   |
| Skill + explicit invocation instructions | 95%   | 100% | 84%  | **79%** (+26pp)  |
| Compressed docs index in `AGENTS.md`     | 100%  | 100% | 100% | **100%** (+47pp) |

Key findings:

- **The skill was never invoked in 56% of cases.** The failure was the trigger layer, not the knowledge layer.
- Explicit instructions improved invocation but made results **prompt-fragile** — subtle wording changes produced large behavioral swings. One phrasing ("You MUST invoke the skill") caused the agent to anchor on doc patterns and ignore project context entirely; another ("Explore project first, then invoke skill") worked. Same skill, same docs.
- **~40KB of docs compressed to an 8KB index with no loss** — still 100%. Full contents were never doing the work.
- Their three stated mechanisms: no decision point about whether to look something up, consistent availability on every turn, no sequencing question about docs-first vs. explore-first.

Their index format, verbatim:

```
[Next.js Docs Index]|root: ./.next-docs
|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning
|01-app/01-getting-started:{01-installation.mdx,02-project-structure.mdx,...}
|01-app/02-building-your-application/01-routing:{01-defining-routes.mdx,...}
```

**Authors' own caveats:** skills work better for "vertical, action-specific workflows that users explicitly trigger"; results are scoped to their hardened eval suite targeting framework knowledge gaps.

**Implications for Almanac:** the core format (path → files, one line per directory), the compression discipline, and the open question about whether to include the inline `IMPORTANT:` directive.

## 2. Gloaguen et al. — Evaluating AGENTS.md (ETH Zürich / LogicStar)

**Source:** <https://arxiv.org/abs/2602.11988> — arXiv:2602.11988, submitted 12 Feb 2026, revised 23 Jun 2026
**Authors:** Thibaud Gloaguen, Niels Mündler, Mark Müller, Veselin Raychev, Martin Vechev
**Type:** Peer-reviewable preprint. The most rigorous study in this space.

**Setup:** AGENTBENCH — 138 task instances from 12 real repositories that already had developer-written context files, drawn from ~5,700 pull requests; plus SWE-bench Lite. Four agent configurations (Claude Code/Sonnet 4.5, Codex/GPT-5.2, Codex/GPT-5.1 Mini, Qwen Code/Qwen3-30B) across three conditions: no context file, LLM-generated, human-written.

**Abstract, verbatim:**

> "A widespread practice in software development is to tailor coding agents to repositories using context files, such as AGENTS.md. Although this practice is strongly encouraged by agent developers, there is currently no rigorous investigation into whether such context files are actually effective for real-world tasks. In this work, we study this question and evaluate coding agents' task completion performance in two complementary settings: established SWE-bench tasks from popular repositories, with LLM-generated context files, and a novel collection of issues from repositories containing developer-committed context files. Surprisingly, we find that providing context files does not generally improve task success rates, while increasing inference cost by over 20% on average. This observation holds across different LLMs, coding agents, and for both LLM-generated and developer-committed context files. Specifically, we find that while instructions in the context files are well followed by coding agents, repository overviews, although popular and recommended by model providers, are not helpful. We conclude that while context files are useful for specifying non-standard coding practices, any attempts to improve performance should be rigorously evaluated before deployment."

**Other reported findings:** LLM-generated files reduced success in 5 of 8 settings (-0.5% on SWE-bench Lite, -2% on AGENTbench); inference cost up over 20%; more steps per task; human-written files roughly +4% over none; over-obedience measured directly — when a context file mentioned `uv`, agents used it 1.6× per task versus <0.01× when unmentioned; stronger generator models did not produce better context files.

**Why this is not a refutation of Almanac.** It reads like one until you look at what was in the files. ETH measured hand-written prose describing the codebase — content the agent derives anyway by reading code, hence redundant. Almanac emits neither prose nor a codebase description; it emits paths to documents holding knowledge that is **not** inferable from source (decisions, conventions, runbooks, external API behavior). That is precisely the "non-standard practices" carve-out the paper recommends limiting context files to. Different artifacts, compatible findings.

**What it contributes:** a price tag (+20% inference cost for a block that doesn't earn its place), the anchoring hazard (1.6× tool adoption from a mere mention), and a hard rule — no generated overviews, ever.

## 3. He, Zhao, Wang, Chen — Is Progressive Disclosure All You Need for Long-Context Agents?

**Source:** <https://arxiv.org/abs/2607.17598> — arXiv:2607.17598, submitted 20 Jul 2026
**Type:** Controlled empirical study.

Compared three approaches — raw-document navigation, Agent Skills packs with progressive disclosure, and classical hybrid retrievers — across **three agent frameworks and three model families** on InfiniteBench.

Findings:

- **Single documents:** progressive-disclosure gains were **zero** when agents already had strong built-in retrieval. Benefits appeared only where agents struggled with raw documents.
- **Multiple documents:** raw-document navigation _collapses_; one level of progressive disclosure degrades more slowly and pulls ahead.
- **A second routing level gave no improvement and sometimes reduced accuracy.**
- Conclusion: progressive disclosure **"buys context, not intelligence"** — essential only when the corpus exceeds the agent's navigation capacity.

**Implications for Almanac:** this is the single most actionable finding for the build. **One flat level. Do not nest indexes.** It also sets honest expectations — the index does not make an agent smarter; it stops a capable agent from being blind. And it explains why Almanac targets docs rather than code: agents navigate code well on their own.

## 4. Sun, Wei, Hsieh — Don't Retrieve, Navigate (Corpus2Skill)

**Source:** <https://arxiv.org/abs/2604.14572> — arXiv:2604.14572 (cs.IR), posted 16 Apr 2026. Code: <https://github.com/dukesun99/Corpus2Skill>
**Type:** Preprint with released implementation. The closest academic analogue to Almanac.

Distills a corpus **offline** into a hierarchical skill directory the agent navigates at serve time: iterative clustering, LLM-written summaries at each level, materialized as a tree of `SKILL.md` files with document IDs at the leaves. At query time the agent walks the tree with `ls`/`cat` and fetches documents by ID — with **no vector DB, no BM25 index, and no embedding model at serve time**.

**Result:** improves answer quality and grounding over single-shot dense, hybrid, hierarchical-retrieval, and agentic RAG baselines on an enterprise customer-support benchmark, at moderate cost.

**Their stated motivation is Almanac's thesis:** RAG treats the model as a passive consumer of search results, so it never sees how the corpus is organized or what it hasn't yet retrieved — which limits backtracking and combining scattered evidence. Making the organization _visible_ lets the agent reason about where to look.

**Their own limits:** a ten-subset generalization study found corpus navigation is **not** a universal replacement for retrieval. It consistently helps on single-domain corpora with a recoverable topical taxonomy; flat retrieval remains preferable on open-domain factoid pools and homogeneous collections.

**Implications for Almanac:** strong independent validation that a generated, visible map beats retrieval — and a clear statement of where that holds. A repo's `docs/` is a single-domain corpus with a recoverable taxonomy, which is the winning case.

## 5. Anthropic — Claude Code dropped vector search

**Sources:** Latent Space podcast with Boris Cherny (May 2025); Cherny on X, 1 Feb 2026 <https://x.com/bcherny/status/2017824286489383315>; [Pragmatic Engineer interview](https://newsletter.pragmaticengineer.com/p/building-claude-code-with-boris-cherny)
**Type:** Practitioner report, not a controlled study.

Anthropic removed the embedding pipeline, local vector DB, and chunking heuristics from Claude Code in May 2025, replacing them with `grep`/`glob` filesystem tools. Cherny on the podcast: agentic search _"outperformed everything. By a lot. And this was surprising."_ On X:

> "Early versions of Claude Code used RAG + a local vector db, but we found pretty quickly that agentic search generally works better. It is also simpler and doesn't have the same issues around security, privacy, staleness, and reliability."

Cursor, Windsurf, Cline, Devin, and Sourcegraph Amp subsequently dropped vectors for tool-driven search.

**Caveat, stated by Cherny himself:** the evaluation was largely "internal vibes" with some internal benchmarks. Treat as a strong directional signal from a team with unmatched deployment data, not as a measured result.

**Implications for Almanac:** the industry consensus is that agents navigate rather than retrieve. Note that _staleness_ is named as a core reason indexes were abandoned — which is exactly why Almanac regenerates on every commit rather than maintaining a side index.

## 6. Subramanian et al. — Keyword search is all you need (AAAI 2026, Amazon)

**Source:** <https://arxiv.org/abs/2602.23368> — arXiv:2602.23368, first submitted 19 Dec 2025. [Amazon Science listing](https://www.amazon.science/publications/keyword-search-is-all-you-need-achieving-rag-level-performance-without-vector-databases-using-agentic-tool-use)
**Authors:** Shreyas Subramanian, Adewale Akinfaderin, Yanyan Zhang, Ishan Singh, Mani Khanuja, Sandeep Singh, Maira Ladeira Tanke
**Type:** Peer-reviewed, AAAI 2026.

Systematic comparison of RAG systems against tool-augmented agents with only basic keyword search, evaluated LLM-as-judge. **Result: tool-based keyword search within an agentic framework attains over 90% of traditional RAG's performance metrics with no standing vector database** — simpler, cheaper, and particularly useful when the knowledge base updates frequently.

**Note on numbers:** a widely circulated "94.5% faithfulness" figure is secondary commentary, not the paper's own headline. The paper's claim is ">90% of performance metrics." Cite the latter.

## 7. LlamaIndex — Did filesystem tools kill vector search?

**Source:** <https://www.llamaindex.ai/blog/did-filesystem-tools-kill-vector-search> (Jan 2026)
**Type:** Vendor benchmark. Read with the vendor's incentives in mind — notably, the result partly cuts _against_ their own product.

Hybrid dense+sparse RAG (LlamaParse, Chonkie, OpenAI, FastEmbed, Qdrant) vs. an `fs-explorer` agent with read/grep/navigate/PDF-parse tools.

**5-document corpus:**

| Metric      | Filesystem agent | RAG       |
| ----------- | ---------------- | --------- |
| Correctness | **8.4**/10       | 6.4/10    |
| Relevance   | **9.6**/10       | 8.0/10    |
| Speed       | 11.17s           | **7.36s** |

**At scale:** at 100 papers, RAG won on speed and slightly on correctness, relevance comparable. At 1000 papers, RAG substantially won on latency with slightly better correctness and equal relevance.

**Their conclusion:** filesystem tools excel on smaller corpora; RAG scales to millions of documents.

**Implications for Almanac:** this is the clearest statement of the ceiling. The crossover is somewhere around 100 documents for a full-content agentic search loop. Almanac is cheaper than that loop — it front-loads the map instead of exploring — but the lesson stands: this design targets a bounded docs tree, and the tool should be honest about it.

## 8. SWE-bench trajectory

**Type:** Longitudinal leaderboard evidence, widely reported.

The October 2023 baseline was RAG — chunk, embed, retrieve top-k, generate patch — at **1.96%**. SWE-agent replaced retrieval with navigation tools (`open_file`, `scroll_down`, `edit_lines`) and reached **12.47%**. By 2026 the Verified leaderboard is dominated by agentic systems above **80%**, and none of the top entries rely on vector retrieval over the target repo.

**Implication:** the shift from retrieval to navigation is the defining architectural change of the period, not a one-off result.

## 9. The dissenting view

**JetBrains**, building for coding agents over very large monorepos (citing a million-file IntelliJ monorepo), concludes the opposite: `grep`/keyword search is insufficient for abstract or conceptual queries, and a purpose-built RAG index is required.

**Plausible reconciliation:** navigation suffices for concrete and lexical queries, and for corpora with a recoverable taxonomy; embedding retrieval is needed for "find by meaning" queries with no lexical anchor at monorepo scale. Corpus2Skill's generalization study points the same way.

**Implication:** Almanac should not claim to replace code search or scale to a monorepo's entire content. It indexes a docs tree.

## Evidence quality, stated honestly

Ranked by rigor:

1. **Strongest:** Gloaguen et al. (controlled, multi-agent, multi-model, real repos) and Subramanian et al. (AAAI-reviewed). Note that the most rigorous study is the _most skeptical_ one.
2. **Strong:** He et al. (three frameworks × three model families, controlled depth ablation), Sun et al. (released code, generalization study, states its own limits).
3. **Directional:** LlamaIndex (vendor, small N), Vercel (single framework, blog-published, adoption interest), SWE-bench trajectory (confounded by many simultaneous advances).
4. **Anecdotal but high-signal:** Anthropic/Cherny, self-described as "internal vibes."

**The honest summary:** the direction of the evidence is consistent and comes from independent groups, but no study has tested _exactly_ Almanac's artifact — a generated, flat, terse pointer index to a repo's own docs, held current by a commit hook. Vercel is closest and is the weakest methodologically. This is a well-supported bet, not a proven result, and Almanac should ship an eval harness that lets a user verify it on their own repo.

---

## The name

An almanac is the reference a farm keeps on the shelf and consults — tables, dates, and pointers, terse by design, never read cover to cover. That is the artifact this tool generates and the way an agent is meant to use it.

## Why it wins

Everyone writing an `AGENTS.md` today is hand-writing the artifact ETH measured as useless — a repository overview — and nobody is generating the one Vercel measured at 100%, because writing it by hand is tedious and it rots in a week. The evidence that agents route well given a map is now broad and independent: Anthropic's own harness, the SWE-bench trajectory, Corpus2Skill, Amazon, LlamaIndex. What's missing isn't the idea. It's a boring tool that keeps the map true on every commit.

No runtime, no format migration, no state outside the repo. A team can adopt it, and drop it, in one commit.

## References

- Vercel — [AGENTS.md outperforms skills in our agent evals](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)
- Gloaguen, Mündler, Müller, Raychev, Vechev — [Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?](https://arxiv.org/abs/2602.11988), arXiv:2602.11988
- He, Zhao, Wang, Chen — [Is Progressive Disclosure All You Need for Long-Context Agents?](https://arxiv.org/abs/2607.17598), arXiv:2607.17598
- Sun, Wei, Hsieh — [Don't Retrieve, Navigate: Distilling Enterprise Knowledge into Navigable Agent Skills for QA and RAG](https://arxiv.org/abs/2604.14572), arXiv:2604.14572 · [code](https://github.com/dukesun99/Corpus2Skill)
- Subramanian et al. — [Keyword search is all you need](https://arxiv.org/abs/2602.23368), arXiv:2602.23368, AAAI 2026
- LlamaIndex — [Did filesystem tools kill vector search?](https://www.llamaindex.ai/blog/did-filesystem-tools-kill-vector-search)
- Cherny — [on agentic search vs. RAG](https://x.com/bcherny/status/2017824286489383315) · [Pragmatic Engineer interview](https://newsletter.pragmaticengineer.com/p/building-claude-code-with-boris-cherny)
- Anthropic — [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- Anthropic — [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Claude Code CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) — 2.1.277, native `AGENTS.md` fallback
