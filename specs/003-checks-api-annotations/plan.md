# Implementation Plan: Checks API Annotation Output Channel

**Branch**: `003-checks-api-annotations` | **Date**: 2026-04-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-checks-api-annotations/spec.md`

## Summary

Add a Checks API output channel to the annotation tool so annotations appear in the Checks tab and Files Changed (inline) without cluttering the PR Conversation tab. The tool defaults to `checks` mode, attempts the Checks API, and automatically falls back to review comments when the token lacks permissions. This feature targets the Claude Code marketplace plugin (`plugins/annotate-pr/`) as the primary implementation.

## Technical Context

**Language/Version**: Bash (sh-compatible) for scripts, Markdown for skill prompt
**Primary Dependencies**: `gh` CLI (GitHub API), `jq` (JSON processing)
**Storage**: N/A (stateless)
**Testing**: Manual E2E via dry-run + live PR testing
**Target Platform**: macOS/Linux (Claude Code environments), GitHub Actions CI
**Project Type**: Claude Code marketplace plugin
**Performance Goals**: Same as existing — annotation of a typical PR (<500 lines) within 30 seconds
**Constraints**: Checks API requires GitHub App token; all other tokens fall back to review comments
**Scale/Scope**: Same as existing — up to 200 change blocks per PR

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Intent Transparency | Pass | Annotations still explain *why* changes were made |
| II. Context Preservation | Pass | Context sources preserved in annotation body |
| III. Diff-Granular Analysis | Pass | Block-level analysis unchanged |
| IV. Language Agnosticism | Pass | Output channel is language-independent |
| V. Test-First Development | Pass | Dry-run testing + live E2E validation planned |

**Quality Standards**:
- Factual/traceable annotations: Unchanged
- Human + machine readable: Unchanged (markdown body in both modes)
- Performance <30s: Unchanged
- No data retention: Unchanged

**Post-Phase 1 Re-check**: All gates still pass. The Checks API output is an additive delivery mechanism; core analysis logic is untouched.

## Project Structure

### Documentation (this feature)

```text
specs/003-checks-api-annotations/
├── plan.md              # This file
├── research.md          # Phase 0: API research + token permissions
├── data-model.md        # Phase 1: CheckRun entities + mapping
├── quickstart.md        # Phase 1: Usage guide
├── contracts/
│   └── checks-api-interface.md  # Phase 1: Script interface + API flow
└── checklists/
    └── requirements.md  # Spec quality validation
```

### Source Code (changes to existing plugin)

```text
plugins/annotate-pr/
├── commands/
│   └── annotate-pr.md        # MODIFY: Add --output-mode parsing + checks flow
└── scripts/
    ├── fetch-context.sh       # UNCHANGED
    ├── parse-hunks.sh         # UNCHANGED
    ├── post-review.sh         # UNCHANGED (fallback path)
    └── post-checks.sh         # NEW: Checks API publisher
```

**Structure Decision**: No new directories. One new script (`post-checks.sh`) added alongside existing scripts. The skill prompt (`annotate-pr.md`) is modified to support output mode selection and orchestrate the checks-then-fallback flow.

## Implementation Phases

### Phase 1: post-checks.sh Script

Create `plugins/annotate-pr/scripts/post-checks.sh`:

1. Accept `REPO`, `PR_NUMBER`, `HEAD_SHA` as arguments
2. Read JSON annotation array from stdin
3. Transform annotations to Checks API format (`path`, `start_line`, `end_line`, `annotation_level: notice`, `title`, `message`)
4. Create check run via `gh api POST /repos/{repo}/check-runs` with `status: in_progress` and first batch (≤50 annotations)
5. For remaining batches: `gh api PATCH /repos/{repo}/check-runs/{id}` with next 50
6. Finalize: `PATCH` with `status: completed`, `conclusion: neutral`, summary
7. Handle errors: exit 3 on 403/permission denied, exit 4 on rate limit, exit 2 on auth failure

### Phase 2: Skill Prompt Modification

Modify `plugins/annotate-pr/commands/annotate-pr.md`:

1. **Arguments section**: Parse `--output-mode=checks|review` from arguments (default: `checks`)
2. **Step 4 (Output Results)**: Branch on output mode:
   - If `checks`: pipe annotations through `post-checks.sh`; on exit code 3, warn and retry with `post-review.sh`
   - If `review`: use `post-review.sh` (existing behavior)
3. **Dry-run**: Show `[Output Mode: checks]` or `[Output Mode: review]` in dry-run header
4. **Error handling table**: Add checks-specific exit codes

### Phase 3: Testing & Validation

1. Dry-run test with `--output-mode=checks` — verify annotation format includes `title` field
2. Dry-run test with `--output-mode=review` — verify existing behavior unchanged
3. Live test in CI with GitHub App token — verify annotations appear in Checks tab
4. Live test locally with `gh` CLI — verify fallback to review comments with warning
5. Test with >50 annotations — verify batching works correctly

## Complexity Tracking

No constitution violations requiring justification.
