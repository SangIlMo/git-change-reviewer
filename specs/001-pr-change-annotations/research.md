# Research: PR Change Annotations

**Date**: 2026-03-31
**Phase**: 0 — Pre-implementation research

---

## 1. GitHub PR Reviews API for Posting Inline Comments

### Decision
Use `POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews` with `event: "COMMENT"` to batch all annotations into a single review submission. Each annotation maps to a `comments[]` entry with `path`, `line` (or `start_line`/`line` range), `side`, and `body`.

### Rationale
- The Reviews API supports multi-comment reviews in a single request, minimizing API calls compared to posting individual PR review comments one-by-one (`POST /pulls/{pull_number}/comments`).
- Inline comments require `position` (deprecated) or the newer `line`/`start_line` + `side` fields (requires `application/vnd.github.v3+json` or `application/vnd.github+json`).
- A single `CreateReview` call posting N comments counts as 1 API request regardless of comment count, which is critical for rate limit management.
- `event: "COMMENT"` submits without approval/rejection semantics, appropriate for annotation-only use.

### Capabilities
- Max comments per review submission: not explicitly capped in API docs, but practical limit is ~100–150 before response size and server processing becomes unreliable. GitHub UI renders all comments.
- `start_line`/`line` (multi-line comment range) supported for `ADDED` side only for additions, `RIGHT`/`LEFT` for diff sides.
- Rate limits: 5,000 requests/hr for authenticated users; 15,000/hr for GitHub Apps. Each `CreateReview` call = 1 request regardless of comment count.
- Secondary rate limits (undocumented): avoid >100 req/min bursts; batch strategy eliminates this concern.

### Alternatives Considered
- **Individual `POST /pulls/{pull_number}/comments`**: Simpler per-comment but uses 1 API request per comment; for a 100-comment PR that's 100 requests vs. 1. Rejected due to rate limit exposure.
- **GitHub Checks API with annotations**: Supports up to 50 annotations per check run update; requires GitHub App (not PAT). Rejected — PAT support is a requirement for ease of use.
- **Issue comments on PR**: Posts to conversation thread, not inline on diff. Rejected — spec requires inline on "Files changed" view.

---

## 2. Diff Parsing Strategies

### Decision
Use the `parse-diff` npm package (or equivalent unified diff parser) for initial hunk extraction, then apply a lightweight semantic segmentation pass to group consecutive changed lines into `ChangeBlock` units based on blank-line gaps and logical proximity.

### Rationale
- **Unified diff format**: GitHub's `GET /repos/{owner}/{repo}/pulls/{pull_number}/files` returns per-file patches in unified diff format. The `patch` field per file contains the raw diff hunks. This is the primary input.
- **`parse-diff`** is a mature, zero-dependency TypeScript-compatible library that parses unified diff text into structured `File[]` → `Chunk[]` → `Change[]` objects. It handles all standard hunk header formats (`@@ -a,b +c,d @@`).
- **Semantic segmentation**: A single hunk may contain multiple logically distinct changes (e.g., a function rename on line 5 and an unrelated bug fix on line 20). A segmentation pass splits hunks into `ChangeBlock` units by detecting gaps in consecutive changed lines (threshold: ≥3 context lines between changed sections = separate block).
- **Line number mapping**: The `parse-diff` library provides `ln1`/`ln2` (old/new line numbers) per change. Used to compute `start_line`/`line` for GitHub API comment placement.

### Alternatives Considered
- **`diff` npm package**: Designed for generating diffs, not parsing them. Rejected.
- **Custom regex parser**: Brittle, maintenance burden. Rejected.
- **AST-based segmentation (tree-sitter)**: Provides function/class boundary awareness for better semantic grouping. Rejected for v1 (violates Language Agnosticism if required; can be added as optional enhancer per constitution §IV).
- **Fetching raw diff via `git diff`**: Requires local clone. Rejected — API-first approach works without checkout.

---

## 3. AI-Powered Code Change Explanation Approaches

### Decision
Use a single LLM call per `ChangeBlock` with a structured prompt that includes: (1) the change block diff, (2) available context sources (commit message, PR description, issue links), and (3) a schema instruction for structured JSON output (`intent`, `source_type`, `confidence`).

### Rationale
- **Per-block LLM calls**: Each `ChangeBlock` gets its own focused prompt. This produces higher-quality, targeted explanations compared to sending the entire diff in one prompt.
- **Context injection**: Commit message and PR description are prepended as system context. When present, they dramatically improve explanation quality by anchoring the "why" rather than the AI inferring from code alone.
- **Structured output**: Requesting JSON output (`{intent, source_type, confidence}`) enables programmatic handling of confidence levels and source attribution, satisfying FR-005.
- **Batching optimization**: For large PRs (>20 blocks), use `Promise.allSettled` with concurrency limiting (max 5 parallel LLM calls) to stay within 30s target (SC-001).
- **Model choice**: Use a fast, capable model (e.g., `claude-haiku-3-5` for speed, `claude-sonnet-4-5` for quality). Configuration should be user-selectable.

### Prompt Strategy
```
System: You are analyzing a code change to explain its intent.
Context: [commit message] [PR description]
Task: Explain WHY this change was made (not what changed).
Output: JSON {intent: string, source_type: "context"|"inferred", confidence: "high"|"medium"|"low"}

Change block:
[unified diff of the block]
```

### Alternatives Considered
- **Single LLM call for entire PR diff**: Cheaper but loses block-level granularity; violates constitution §III (Diff-Granular Analysis). Rejected.
- **Rule-based explanations**: Pattern matching (e.g., "added null check" → "prevents null pointer exception"). Too shallow for meaningful explanations. Rejected as standalone approach; may supplement as fallback.
- **Embedding similarity against commit messages**: Semantic search to find the most relevant commit message for a block. Complex setup (embedding model + vector ops) for marginal gain. Deferred to v2.
- **Claude Code session context**: Spec explicitly excludes this for v1 (Assumptions section). Excluded.

---

## 4. Technology Stack Decision

### Decision
TypeScript 5.x on Node.js 20+, using `@octokit/rest` for GitHub API, `parse-diff` for diff parsing, `@anthropic-ai/sdk` for AI, `vitest` for testing, distributed as a CLI via `npm` and a GitHub Actions action.

### Rationale
- **TypeScript**: Strong typing for complex domain objects (DiffFile, ChangeBlock, ReviewPayload). Excellent GitHub API ecosystem (`@octokit/rest` is GitHub's official client). First-class async/await for concurrent LLM calls.
- **Node.js 20+**: LTS, native fetch, excellent npm ecosystem. Fast startup for CLI use.
- **`@octokit/rest`**: Official GitHub REST client with TypeScript types. Handles auth, pagination, and retry automatically.
- **`parse-diff`**: Lightweight (3KB), TypeScript-compatible, well-maintained unified diff parser.
- **`@anthropic-ai/sdk`**: Official Anthropic client; supports streaming and structured output.
- **`vitest`**: Fast, ESM-native, TypeScript-first. Better DX than Jest for modern TypeScript projects.
- **Language agnosticism**: Diff parsing is language-agnostic by design; AI analysis works on any text diff. Satisfies constitution §IV.

### Constraints Addressed
- GitHub API rate limits (5,000 req/hr): batched review creation (1 request per PR, regardless of annotation count).
- Max ~100 comments per review: `--max-comments` flag with default 50, chunked review submissions for larger PRs.
- <30s for 500-line PR: concurrent LLM calls (max 5 parallel) + fast model selection.

### Alternatives Considered
- **Python**: Good AI/ML ecosystem, but weaker GitHub API typing and slower CLI startup vs Node. Rejected.
- **Go**: Fast, single binary, but fewer diff parsing libs and worse LLM SDK support. Rejected.
- **Deno**: ESM-native and secure, but GitHub Actions integration is less mature. Deferred.
