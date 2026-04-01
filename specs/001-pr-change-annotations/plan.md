# Implementation Plan: PR Change Annotations

**Branch**: `001-pr-change-annotations` | **Date**: 2026-03-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-pr-change-annotations/spec.md`

## Summary

Service that automatically generates intent annotations for each code change block in GitHub PRs, posted as inline review comments via the GitHub Reviews API. The system fetches a PR's unified diff, segments it into semantically coherent `ChangeBlock` units, generates AI-powered "why this change was made" explanations using available context (commit messages, PR description), and submits them as a single batched review via `POST /pulls/{pr}/reviews`. Designed as a CLI tool and GitHub Actions integration, language-agnostic, with structured output distinguishing context-based vs. inferred annotations.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js 20+)
**Primary Dependencies**: `@octokit/rest` (GitHub API), `parse-diff` (unified diff parsing), `@anthropic-ai/sdk` (AI annotation generation)
**Storage**: N/A (stateless per-run)
**Testing**: vitest
**Target Platform**: CLI tool + GitHub Actions
**Project Type**: CLI + CI integration
**Performance Goals**: <30s for 500-line PR (SC-001)
**Constraints**: GitHub API rate limits (~5,000 req/hr authenticated); max ~100 comments per review batch; concurrent LLM calls capped at 5 parallel
**Scale/Scope**: Single PR at a time

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

1. **Intent Transparency** (§I): Core purpose of the project — every annotation answers "What problem does this change solve?" Fully satisfied.
2. **Context Preservation** (§II): System links annotations to commit messages and PR descriptions. Context references are surfaced in annotation output. Fully satisfied.
3. **Diff-Granular Analysis** (§III): Analysis operates at `ChangeBlock` level (hunk or sub-hunk segment), not file level. Over-aggregation is a defect per constitution. Fully satisfied.
4. **Language Agnosticism** (§IV): Diff parsing via `parse-diff` is language-agnostic. AI analysis operates on text diffs. No AST or language-specific dependency required for core functionality. Fully satisfied.
5. **Test-First Development** (§V): TDD enforced — failing tests written before implementation. Integration tests cover annotation accuracy, multi-language diffs, and context linking. Fully satisfied.

## Project Structure

### Documentation (this feature)

```text
specs/001-pr-change-annotations/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── cli-interface.md
│   └── annotation-format.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── diff/          # Diff parsing and block segmentation
├── context/       # Context extraction (commit msgs, PR desc)
├── annotator/     # AI-powered intent annotation generation
├── publisher/     # GitHub Reviews API integration
└── cli/           # CLI entry point

tests/
├── unit/
├── integration/
└── fixtures/      # Sample diffs and expected annotations
```

**Structure Decision**: Single project — CLI tool with clear module separation. No frontend/backend split needed. Each `src/` subdirectory maps directly to a domain concern (diff parsing, context extraction, annotation generation, GitHub publishing, CLI entry).
