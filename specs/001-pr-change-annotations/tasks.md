# Tasks: PR Change Annotations

**Input**: Design documents from `/specs/001-pr-change-annotations/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3)
- Exact file paths included in descriptions

## Phase 1: Setup

- [x] T001 Initialize Node.js project with TypeScript 5.x, vitest, and ESLint in `package.json` and `tsconfig.json`
- [x] T002 Create project directory structure: `src/{diff,context,annotator,publisher,cli}`, `tests/{unit,integration,fixtures}`
- [x] T003 [P] Configure vitest in `vitest.config.ts` with coverage thresholds
- [x] T004 [P] Add sample diff fixtures in `tests/fixtures/` (single-file, multi-file, multi-language, rename, delete, binary)

## Phase 2: Foundational

- [x] T005 Define TypeScript interfaces for all entities (DiffFile, DiffHunk, ChangeBlock, ContextSource, IntentAnnotation, ReviewPayload) in `src/types.ts`
- [x] T006 Write unit tests for diff parser in `tests/unit/diff/parser.test.ts` — parse unified diff into DiffFile[] with hunks
- [x] T007 Implement diff parser module in `src/diff/parser.ts` — parse unified diff string into DiffFile[] using parse-diff
- [x] T008 Write unit tests for block segmenter in `tests/unit/diff/segmenter.test.ts` — split hunks into semantic ChangeBlock[]
- [x] T009 Implement block segmenter in `src/diff/segmenter.ts` — group contiguous additions/deletions/modifications into ChangeBlocks
- [x] T010 Write unit tests for context extractor in `tests/unit/context/extractor.test.ts` — extract context from commit messages and PR description
- [x] T011 Implement context extractor in `src/context/extractor.ts` — parse commit messages, PR description, issue refs into ContextSource[]

## Phase 3: User Story 1 — PR 변경사항 의도 확인 (P1)

**Goal**: Reviewer가 PR Files changed에서 각 변경 블록에 의도 주석을 볼 수 있다
**Independent Test**: PR 생성 후 `gcr annotate --dry-run`으로 주석 생성 확인, 실제 게시 후 Files changed에서 인라인 주석 확인

- [x] T012 [US1] Write unit tests for annotator in `tests/unit/annotator/annotator.test.ts` — generate IntentAnnotation for a ChangeBlock given context
- [x] T013 [US1] Implement annotator module in `src/annotator/annotator.ts` — call AI API with block content + context, return structured IntentAnnotation
- [x] T014 [US1] Write unit tests for annotation formatter in `tests/unit/annotator/formatter.test.ts` — format IntentAnnotation into review comment body (context-based vs inferred)
- [x] T015 [US1] Implement annotation formatter in `src/annotator/formatter.ts` — render annotation body per contracts/annotation-format.md
- [x] T016 [US1] Write unit tests for GitHub publisher in `tests/unit/publisher/github.test.ts` — build ReviewPayload and post via Reviews API (mock @octokit/rest)
- [x] T017 [US1] Implement GitHub publisher in `src/publisher/github.ts` — fetch PR diff, post review with inline comments via @octokit/rest
- [x] T018 [US1] Write unit tests for CLI entry point in `tests/unit/cli/cli.test.ts` — parse args, orchestrate pipeline, handle dry-run
- [x] T019 [US1] Implement CLI entry point in `src/cli/index.ts` — wire diff parser → segmenter → context extractor → annotator → publisher per contracts/cli-interface.md
- [x] T020 [US1] Write integration test in `tests/integration/annotate-flow.test.ts` — end-to-end: fixture diff → parsed blocks → mock AI annotations → formatted review payload
- [x] T021 [US1] Add `bin` entry in `package.json` for `gcr` command and verify `gcr annotate --help` works

## Phase 4: User Story 2 — 다중 언어 PR 지원 (P2)

**Goal**: 3+ 언어가 혼합된 PR에서 모든 파일에 주석이 생성된다
**Independent Test**: TypeScript + Python + YAML 혼합 fixture로 모든 파일에 annotation 생성 확인

- [x] T022 [P] [US2] Add multi-language diff fixtures in `tests/fixtures/multi-lang/` (TypeScript, Python, YAML, JSON, Rust, Go mixed)
- [x] T023 [US2] Write tests in `tests/unit/diff/multi-lang.test.ts` — verify parser and segmenter handle all fixture languages correctly
- [x] T024 [US2] Write tests in `tests/unit/annotator/multi-lang.test.ts` — verify annotator produces quality annotations for non-code files (YAML, JSON, TOML, Markdown)
- [x] T025 [US2] Update segmenter in `src/diff/segmenter.ts` if needed — ensure config file changes (YAML, JSON) are segmented meaningfully (key-level vs file-level)
- [x] T026 [US2] Write integration test in `tests/integration/multi-lang-flow.test.ts` — end-to-end with multi-language fixture, verify 90%+ annotation rate across all languages

## Phase 5: User Story 3 — 대규모 PR 처리 (P2)

**Goal**: 500줄+ PR에서 2분 이내에 모든 블록에 주석 생성
**Independent Test**: 500줄+ fixture로 타임아웃 없이 전체 annotation 완료 확인

- [x] T027 [P] [US3] Add large PR fixture in `tests/fixtures/large-pr/` (500+ lines, 50+ files)
- [x] T028 [US3] Write performance test in `tests/integration/large-pr.test.ts` — verify annotation completes within 120s for 500+ line PR
- [x] T029 [US3] Implement concurrent annotation in `src/annotator/annotator.ts` — Promise.allSettled with configurable concurrency limit (default 5)
- [x] T030 [US3] Implement batch publishing in `src/publisher/github.ts` — split into multiple reviews if >100 comments, handle rate limits with retry
- [x] T031 [US3] Add `--concurrency <n>` flag to CLI in `src/cli/index.ts` and update tests

## Phase 6: Polish & Cross-Cutting

- [x] T032 [P] Add error handling for GitHub API failures (auth, not found, rate limit) in `src/publisher/github.ts` with proper exit codes per CLI contract
- [x] T033 [P] Add binary file and generated file (lock files) skip logic in `src/diff/segmenter.ts` with tests
- [x] T034 [P] Add conflict detection (commit message vs actual change mismatch) in `src/annotator/annotator.ts` per edge case spec
- [x] T035 Implement `--format json` dry-run output per contracts/annotation-format.md JSON schema in `src/cli/index.ts`
- [x] T036 Add GitHub Actions workflow definition in `action.yml` for CI integration per quickstart.md
- [x] T037 Write README.md with installation, usage, and configuration documentation

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2. Core flow, MUST complete first
- **US2 (Phase 4)**: Depends on Phase 2. Can run in PARALLEL with US3
- **US3 (Phase 5)**: Depends on Phase 2. Can run in PARALLEL with US2
- **Polish (Phase 6)**: Depends on US1 completion. Can overlap with US2/US3

### Parallel Execution Opportunities

**Within Phase 1**: T003 ∥ T004 (after T001+T002)
**Within Phase 2**: T006+T007 → T008+T009 (sequential pairs, but T010+T011 can parallel with T008+T009)
**Within Phase 3**: T012-T015 (annotator) can parallel with T016-T017 (publisher), then T018-T021 sequential
**Phase 4 ∥ Phase 5**: Entirely parallel after Phase 2
**Within Phase 6**: T032 ∥ T033 ∥ T034 (all independent)

## Implementation Strategy

### MVP (User Story 1 only)
Phases 1 + 2 + 3 → functional `gcr annotate` for standard PRs

### Full Release
Add Phases 4 + 5 + 6 → multi-language support, large PR handling, polish
