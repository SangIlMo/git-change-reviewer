<!--
Sync Impact Report
- Version change: N/A → 1.0.0 (initial ratification)
- Added principles: Intent Transparency, Context Preservation, Diff-Granular Analysis, Language Agnosticism, Test-First Development
- Added sections: Quality Standards, Development Workflow, Governance
- Templates requiring updates:
  - `.specify/templates/plan-template.md` ✅ no update needed (generic gates)
  - `.specify/templates/spec-template.md` ✅ no update needed (generic structure)
  - `.specify/templates/tasks-template.md` ✅ no update needed (generic phases)
- Follow-up TODOs: none
-->

# Git Change Reviewer Constitution

## Core Principles

### I. Intent Transparency

Every code change MUST be accompanied by a clear explanation of
*why* it was made, not just *what* changed. AI-generated code
lacks implicit context that human authors carry; this project
exists to bridge that gap. Each line or block annotation MUST
answer: "What problem does this change solve or what goal does
it advance?"

### II. Context Preservation

Change explanations MUST reference the broader context: the
task being implemented, the architectural decision driving the
change, or the bug being fixed. Isolated diffs without context
are insufficient. The system MUST link annotations back to
their originating intent (commit message, PR description, or
AI session context) whenever available.

### III. Diff-Granular Analysis

Analysis MUST operate at the granularity of individual hunks
or logical blocks, not entire files. A single file may contain
multiple unrelated changes with different intents. The system
MUST segment diffs into semantically coherent units and annotate
each independently. Over-aggregation that obscures individual
change rationale is a defect.

### IV. Language Agnosticism

The core analysis engine MUST NOT be coupled to any single
programming language. Diff parsing and annotation logic MUST
work across languages. Language-specific intelligence (e.g.,
AST-aware grouping) MAY be added as optional enhancers but
MUST NOT be required for basic functionality. Technology stack
for the project itself is chosen per convenience.

### V. Test-First Development

TDD is mandatory: write failing tests first, then implement to
pass. Red-Green-Refactor cycle strictly enforced. No feature
merges without corresponding test coverage. Integration tests
MUST cover: annotation accuracy against known diffs, multi-language
diff parsing, and context linking correctness.

## Quality Standards

- All annotations MUST be factual and traceable; speculative
  explanations MUST be explicitly marked as inferred.
- Output formats MUST support both human-readable (inline
  comments) and machine-readable (JSON) representations.
- Performance: annotation of a typical PR (< 500 changed lines)
  MUST complete within 30 seconds.
- Security: no source code or diff content is stored beyond the
  scope of a single analysis session unless explicitly configured.

## Development Workflow

- Conventional Commits enforced for all commit messages.
- Feature branches follow `MMDD/{type}/{name}` naming convention.
- Code review required for all PRs; the tool itself SHOULD be
  used to annotate its own PRs (dogfooding).
- CI pipeline MUST run lint, test, and build gates before merge.

## Governance

This constitution is the supreme authority for project decisions.
All PRs and reviews MUST verify compliance with these principles.

**Amendment process**:
1. Propose change via PR with rationale.
2. Review and discuss with project stakeholders.
3. Update constitution version per semver rules:
   - MAJOR: principle removal or incompatible redefinition.
   - MINOR: new principle or material expansion.
   - PATCH: clarification or wording fix.
4. Update `LAST_AMENDED_DATE` on every change.

**Version**: 1.0.0 | **Ratified**: 2026-03-31 | **Last Amended**: 2026-03-31
