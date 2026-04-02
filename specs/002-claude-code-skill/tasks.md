# Tasks: Claude Code PR Annotation Plugin

**Input**: Design documents from `/specs/002-claude-code-skill/`
**Prerequisites**: plan.md (required), spec.md (required), contracts/ (required)

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3)
- Exact file paths included

## Phase 1: Setup

- [x] T001 Create plugin directory structure: `.claude-plugin/`, `skills/annotate-pr/scripts/`
- [x] T002 [P] Create `.claude-plugin/plugin.json` per contracts/plugin-manifest.md
- [x] T003 [P] Create `LICENSE` file (MIT)
- [x] T004 [P] Create `CHANGELOG.md` with initial v1.0.0 entry

## Phase 2: Foundational — Helper Scripts

- [x] T005 Implement `skills/annotate-pr/scripts/fetch-context.sh` — fetch PR diff via `gh pr diff`, PR metadata via `gh pr view`, commit messages via `gh api`. Output JSON to stdout per contracts/script-interfaces.md
- [x] T006 Implement `skills/annotate-pr/scripts/parse-hunks.sh` — read unified diff from stdin, split into semantic change blocks as JSON array. Skip binary files, lock files (package-lock.json, yarn.lock, etc.), generated files (*.min.js, *.map). Per contracts/script-interfaces.md
- [x] T007 Implement `skills/annotate-pr/scripts/post-review.sh` — read JSON review comments from stdin, post via `gh api` as PR review. Handle >100 comments by splitting into multiple reviews. Retry on rate limit (429/403). Per contracts/script-interfaces.md
- [x] T008 Verify all scripts are executable (`chmod +x`) and test each independently with sample data

## Phase 3: User Story 1 — Slash Command로 PR 주석 달기 (P1)

**Goal**: `/annotate-pr 123` 실행 → PR Files changed에 인라인 주석 게시
**Test**: 실제 PR에서 `/annotate-pr <number>` 실행 후 Files changed에서 주석 확인

- [x] T009 [US1] Write `skills/annotate-pr/SKILL.md` with YAML frontmatter (name: annotate-pr, user-invocable: true, disable-model-invocation: true, allowed-tools: Bash(gh *) Bash(bash *), argument-hint: "[PR-number] [--dry-run]") per contracts/skill-interface.md
- [x] T010 [US1] Write SKILL.md prompt body — orchestration instructions for Claude: (1) parse arguments (PR number or auto-detect via `gh pr view --json number`), (2) call fetch-context.sh, (3) call parse-hunks.sh, (4) analyze each change block and generate IntentAnnotation, (5) format annotations per contracts/annotation-format.md, (6) call post-review.sh
- [x] T011 [US1] Add annotation analysis instructions to SKILL.md — for each change block: determine if context-based (commit msg/PR desc references the change) or inferred (code analysis only), detect conflicts (commit msg doesn't match actual change), format with appropriate confidence tag
- [x] T012 [US1] Add auto-detect logic to SKILL.md — when no PR number given, use `gh pr view --json number -q .number` to find current branch's open PR
- [x] T013 [US1] E2E validation — run `/annotate-pr` on a test PR with `--dry-run` to verify full pipeline works

## Phase 4: User Story 2 — Dry-run 미리보기 (P2)

**Goal**: `--dry-run` 시 GitHub에 게시하지 않고 터미널에 주석 출력
**Test**: `/annotate-pr 123 --dry-run` 실행 후 터미널 출력 확인, GitHub에 주석 없음 확인

- [x] T014 [US2] Add dry-run handling to SKILL.md — detect `--dry-run` flag in arguments, skip post-review.sh call, instead output formatted annotations to user with file path, line range, and annotation body
- [x] T015 [US2] Add dry-run summary to SKILL.md — after displaying annotations, show summary: total blocks analyzed, annotations generated, blocks skipped (with reasons)

## Phase 5: User Story 3 — 대규모 PR 처리 (P2)

**Goal**: 500줄+ PR에서 모든 블록에 주석 생성, 100+ comments 시 분할 게시
**Test**: 대규모 PR에서 실행 후 모든 블록에 주석 존재 확인

- [x] T016 [US3] Add progress reporting to SKILL.md — for large PRs, show progress ("Analyzing file 15/50: src/service.ts...")
- [x] T017 [US3] Verify post-review.sh handles >100 comments — test with large payload, confirm multiple reviews are posted
- [x] T018 [US3] Add rate limit awareness to SKILL.md — if post-review.sh reports rate limit, inform user and suggest retry timing

## Phase 6: Polish & Distribution

- [x] T019 [P] Write `README.md` at plugin root — installation, usage, examples, how it works, annotation types
- [x] T020 [P] Remove 001 npm CLI code — delete `src/`, `tests/`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `node_modules/`, `dist/`, `action.yml` and related files that are no longer needed
- [x] T021 [P] Update `.gitignore` for plugin structure (remove node_modules patterns, add any plugin-specific ignores)
- [x] T022 Verify plugin structure matches marketplace requirements — validate plugin.json, SKILL.md frontmatter, script permissions
- [x] T023 E2E validation on real PR — run full flow (not dry-run) on a test PR, verify comments appear in Files changed

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 directory structure
- **US1 (Phase 3)**: Depends on Phase 2 scripts — core flow
- **US2 (Phase 4)**: Depends on US1 SKILL.md — adds dry-run branch
- **US3 (Phase 5)**: Depends on US1 + Phase 2 post-review.sh — adds progress + batching
- **Polish (Phase 6)**: Depends on US1 completion

### Parallel Opportunities

**Within Phase 1**: T002 ∥ T003 ∥ T004 (after T001)
**Within Phase 2**: T005 ∥ T006 ∥ T007 (independent scripts), then T008
**Phase 4 ∥ Phase 5**: Can run in parallel after US1
**Within Phase 6**: T019 ∥ T020 ∥ T021 (independent files)

## Implementation Strategy

### MVP (User Story 1 only)
Phases 1 + 2 + 3 → working `/annotate-pr` command

### Full Release
Add Phases 4 + 5 + 6 → dry-run, large PR support, cleanup, distribution ready
