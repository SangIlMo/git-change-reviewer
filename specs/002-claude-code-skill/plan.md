# Implementation Plan: Claude Code PR Annotation Skill Plugin

**Branch**: `002-claude-code-skill` | **Date**: 2026-04-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-claude-code-skill/spec.md`

## Summary

Claude Code marketplace plugin that analyzes PR diffs and posts intent annotations as GitHub PR review comments. Distributed via GitHub repo, installed with `/plugin marketplace add`. Claude Code is the AI engine — no external API keys needed. The plugin consists of a SKILL.md prompt that orchestrates three helper shell scripts (`fetch-context.sh`, `parse-hunks.sh`, `post-review.sh`) using `gh` CLI for all GitHub API interaction.

## Technical Context

**Language/Version**: Markdown (SKILL.md prompt) + Bash (helper scripts)
**Primary Dependencies**: gh CLI (GitHub API), Claude Code (AI engine)
**Storage**: N/A (stateless)
**Testing**: Manual E2E testing (run /annotate-pr on test PRs)
**Target Platform**: Claude Code plugin marketplace
**Project Type**: Claude Code marketplace plugin
**Performance Goals**: <2min for 500-line PR
**Constraints**: GitHub API rate limits, 100 comments per review batch
**Scale/Scope**: Single PR at a time

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

1. **Intent Transparency**: ✅ Core purpose — each annotation explains WHY a change was made, not just WHAT changed.
2. **Context Preservation**: ✅ Annotations reference commit messages and PR description via `fetch-context.sh`.
3. **Diff-Granular Analysis**: ✅ Block-level analysis via `parse-hunks.sh` — not file-level.
4. **Language Agnosticism**: ✅ Works on any text-based diff; no language-specific parsing required.
5. **Test-First Development**: ⚠️ Plugin is primarily a prompt file + shell scripts — traditional TDD does not apply. Validated via E2E testing on real PRs with dry-run mode.

## Project Structure

### Documentation (this feature)

```text
specs/002-claude-code-skill/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
annotate-pr-plugin/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest
├── skills/
│   └── annotate-pr/
│       ├── SKILL.md             # Main skill prompt
│       └── scripts/
│           ├── fetch-context.sh # gh pr diff + metadata
│           ├── parse-hunks.sh   # Split diff into change blocks
│           └── post-review.sh   # Post review comments via gh api
├── LICENSE
├── CHANGELOG.md
└── README.md
```

**Structure Decision**: Plugin package — not a traditional src/ project. The "code" is a SKILL.md prompt that orchestrates shell scripts. No src/, tests/, or lib/ directories are needed. All logic lives in the plugin directory.
