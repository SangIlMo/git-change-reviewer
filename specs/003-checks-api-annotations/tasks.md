# Tasks: Checks API Annotation Output Channel

**Input**: Design documents from `/specs/003-checks-api-annotations/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Constitution mandates Test-First Development. Tests are included as E2E dry-run validation tasks within each user story phase.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Plugin scripts**: `plugins/annotate-pr/scripts/`
- **Skill prompt**: `plugins/annotate-pr/commands/annotate-pr.md`

---

## Phase 1: Setup

**Purpose**: No new project setup needed — extending existing plugin infrastructure.

- [x] T001 Verify existing plugin scripts work by running `/annotate-pr --dry-run` on an open PR

**Checkpoint**: Existing plugin confirmed working.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the Checks API publisher script that all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Create `post-checks.sh` script at `plugins/annotate-pr/scripts/post-checks.sh` implementing the Checks API publisher:
  - Accept `REPO`, `PR_NUMBER`, `HEAD_SHA` as positional arguments
  - Read JSON annotation array from stdin (same format as `post-review.sh` plus `title` field)
  - Transform annotations to Checks API format: `path`, `start_line`, `end_line`, `annotation_level: notice`, `title`, `message`
  - Create check run via `gh api repos/{repo}/check-runs --method POST` with `name: "PR Change Annotations"`, `head_sha`, `status: in_progress`, first batch of ≤50 annotations in `output.annotations`
  - For remaining batches: `gh api repos/{repo}/check-runs/{id} --method PATCH` with next ≤50 annotations
  - Finalize: PATCH with `status: completed`, `conclusion: neutral`, summary text with annotation counts
  - Exit codes: 0 (success), 2 (auth failure), 3 (permission denied / 403 on check-run creation), 4 (rate limit exhausted)
  - Handle rate limiting with 3 retries and exponential backoff (same pattern as `post-review.sh`)

- [x] T003 Test `post-checks.sh` manually against a test PR with a GitHub App token to verify check run creation and annotation appearance in Checks tab and Files Changed

**Checkpoint**: `post-checks.sh` independently creates check runs with annotations via Checks API.

---

## Phase 3: User Story 1 — Post Annotations via Checks API (Priority: P1) 🎯 MVP

**Goal**: Annotations appear in Checks tab and Files Changed without cluttering Conversation tab.

**Independent Test**: Run `/annotate-pr <PR> --output-mode=checks` with a GitHub App token and verify annotations appear in Checks tab, Files Changed inline, and Conversation tab is clean.

### Implementation for User Story 1

- [x] T004 [US1] Modify skill prompt argument parsing section in `plugins/annotate-pr/commands/annotate-pr.md` to parse `--output-mode=checks|review` from arguments (default: `checks`)

- [x] T005 [US1] Modify skill prompt Step 3 (Analyze Change Blocks) in `plugins/annotate-pr/commands/annotate-pr.md` to include `title` field in the comments array: map source_type to title labels — "Intent (Context)", "Intent (Inferred)", "Intent (Conflict)"

- [x] T006 [US1] Modify skill prompt Step 4 (Output Results) in `plugins/annotate-pr/commands/annotate-pr.md` to branch on output mode:
  - If `checks`: pipe annotations through `post-checks.sh` (with `title` field in JSON)
  - If `review`: use `post-review.sh` (existing behavior, strip `title` field)
  - In dry-run mode: show `[Output Mode: checks]` or `[Output Mode: review]` in header

- [x] T007 [US1] Modify skill prompt error handling table in `plugins/annotate-pr/commands/annotate-pr.md` to add checks-specific exit codes (exit 3: permission denied with fallback suggestion)

- [x] T008 [US1] E2E validation: Run `/annotate-pr <PR> --dry-run --output-mode=checks` and verify dry-run output shows correct format with title fields and output mode header

**Checkpoint**: User Story 1 complete — annotations can be posted via Checks API with the `--output-mode=checks` flag.

---

## Phase 4: User Story 2 — Automatic Fallback on Permission Failure (Priority: P2)

**Goal**: When Checks API fails due to token permissions, automatically fall back to review comments with a warning.

**Independent Test**: Run `/annotate-pr <PR> --output-mode=checks` with a `gh` CLI token (not a GitHub App token) and verify it falls back to review comments with a warning message.

### Implementation for User Story 2

- [x] T009 [US2] Modify skill prompt Step 4 in `plugins/annotate-pr/commands/annotate-pr.md` to add fallback logic: when `post-checks.sh` exits with code 3 (permission denied), display warning "Checks API not available for this token. Falling back to review comments." and re-post annotations via `post-review.sh`

- [x] T010 [US2] Ensure `post-checks.sh` correctly returns exit code 3 on 403/resource-not-accessible errors (not exit 1) to distinguish permission failures from other errors

- [x] T011 [US2] E2E validation: Run `/annotate-pr <PR> --output-mode=checks` with local `gh` CLI token and verify fallback to review comments with appropriate warning message

**Checkpoint**: User Story 2 complete — fallback works transparently for users without GitHub App tokens.

---

## Phase 5: User Story 3 — Explicit Output Mode Selection (Priority: P3)

**Goal**: Users can explicitly choose between `checks` and `review` output modes.

**Independent Test**: Run `/annotate-pr <PR> --output-mode=review` and verify annotations appear as PR review comments (identical to previous behavior).

### Implementation for User Story 3

- [x] T012 [US3] Modify skill prompt argument parsing in `plugins/annotate-pr/commands/annotate-pr.md` to validate `--output-mode` value and show error for invalid values (e.g., `--output-mode=invalid` → "Invalid output mode. Valid values: checks, review")

- [x] T013 [US3] E2E validation: Run `/annotate-pr <PR> --output-mode=review --dry-run` and verify output matches existing review comment format (no title field, no output mode changes)

- [x] T014 [US3] E2E validation: Run `/annotate-pr <PR> --output-mode=invalid` and verify error message is displayed

**Checkpoint**: All user stories complete — both output modes work correctly with validation.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and CI integration.

- [x] T015 [P] Update `plugins/annotate-pr/commands/annotate-pr.md` argument-hint in frontmatter to include `--output-mode` option: `"[PR-number] [--dry-run] [--output-mode=checks|review]"`

- [x] T016 [P] Update quickstart.md at `specs/003-checks-api-annotations/quickstart.md` with final tested usage examples and any corrections from E2E testing

- [x] T017 Run full validation: `/annotate-pr <PR> --dry-run` (default mode) and `/annotate-pr <PR> --dry-run --output-mode=review` to confirm both paths work end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — verify existing plugin works
- **Foundational (Phase 2)**: Depends on Phase 1 — creates `post-checks.sh`
- **User Story 1 (Phase 3)**: Depends on Phase 2 — modifies skill prompt to use `post-checks.sh`
- **User Story 2 (Phase 4)**: Depends on Phase 3 — adds fallback logic on top of checks flow
- **User Story 3 (Phase 5)**: Depends on Phase 3 — adds validation on top of mode parsing
- **Polish (Phase 6)**: Depends on Phases 3-5

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational (Phase 2) — No dependencies on other stories
- **User Story 2 (P2)**: Depends on User Story 1 — Fallback requires checks flow to exist first
- **User Story 3 (P3)**: Depends on User Story 1 — Validation requires mode parsing to exist first
- **User Story 2 & 3**: Can proceed in parallel after User Story 1 is complete

### Within Each User Story

- Skill prompt modifications are sequential (same file)
- E2E validation runs after implementation tasks

### Parallel Opportunities

- T015 and T016 (Polish) can run in parallel
- After US1 is complete: US2 and US3 can proceed in parallel (US2 modifies Step 4 fallback, US3 modifies argument validation — different sections of the prompt)

---

## Parallel Example: After User Story 1

```bash
# After Phase 3 is complete, these can run in parallel:

# User Story 2 (fallback logic):
Task: "T009 [US2] Add fallback logic to Step 4 in annotate-pr.md"
Task: "T010 [US2] Verify post-checks.sh exit code 3 handling"

# User Story 3 (validation):
Task: "T012 [US3] Add --output-mode validation in annotate-pr.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Verify existing plugin
2. Complete Phase 2: Create `post-checks.sh`
3. Complete Phase 3: User Story 1 — Checks API posting
4. **STOP and VALIDATE**: Test with GitHub App token in CI
5. Ship if working

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Add User Story 1 → Checks API works → Ship MVP
3. Add User Story 2 → Fallback works → Ship
4. Add User Story 3 → Validation works → Ship
5. Polish → Documentation updated → Final ship

---

## Notes

- All task modifications target the same skill prompt file (`annotate-pr.md`) — sequential execution within each story
- `post-checks.sh` is the only new file; all other changes are modifications
- E2E testing requires an actual PR — use an existing open PR or create a test PR
- GitHub App token is needed for full Checks API testing (local `gh` CLI will trigger fallback path)
