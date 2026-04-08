# Feature Specification: Checks API Annotation Output Channel

**Feature Branch**: `003-checks-api-annotations`  
**Created**: 2026-04-02  
**Status**: Draft  
**Input**: User description: "GitHub Checks API annotation 출력 채널 추가. 현재 PR Review Comments로 annotation을 게시하면 Conversation 탭에 모든 코멘트가 기록으로 남는 문제가 있다. GitHub Checks API의 check-run annotations를 사용하면 Checks 탭에만 표시되고 Files Changed에서 인라인으로도 보이지만 Conversation은 깨끗하게 유지된다."

## User Scenarios & Testing

### User Story 1 - Post Annotations via Checks API (Priority: P1)

A user runs the annotation tool against a PR and the results appear in the Checks tab and as inline annotations in Files Changed, without adding any entries to the Conversation tab. The PR conversation remains clean with only human discussion.

**Why this priority**: This is the core motivation for the feature — users explicitly want to avoid cluttering the Conversation tab with machine-generated comments.

**Independent Test**: Run the tool with `--output-mode=checks` against a test PR and verify that (1) annotations appear in the Checks tab, (2) annotations appear inline in Files Changed, and (3) the Conversation tab has zero new entries from the tool.

**Acceptance Scenarios**:

1. **Given** a PR with code changes and a valid GitHub Actions token, **When** the user runs the tool with `--output-mode=checks`, **Then** a check run is created with annotations visible in the Checks tab and inline in Files Changed.
2. **Given** a PR with 30 change blocks, **When** the tool posts annotations via Checks API, **Then** the Conversation tab shows no new comments from the tool.
3. **Given** a check run with annotations, **When** a reviewer opens Files Changed, **Then** the annotations appear inline next to the relevant code lines.

---

### User Story 2 - Automatic Fallback on Permission Failure (Priority: P2)

A user runs the tool with `--output-mode=checks` (or the default), but their token lacks Checks API permissions (e.g., a PAT without `repo` scope, or a fine-grained PAT without `Checks: write`). The tool detects the permission error on the first API call and automatically falls back to review comments, informing the user why.

**Why this priority**: Users should not encounter a hard failure due to token permissions — graceful degradation ensures the tool remains usable regardless of token configuration.

**Independent Test**: Run the tool with a token that lacks Checks permissions and verify it falls back to review comments with a clear warning message.

**Acceptance Scenarios**:

1. **Given** a user whose token lacks Checks API permissions, **When** the tool runs with `--output-mode=checks`, **Then** the tool detects the permission error, falls back to review comments, and displays a warning explaining the fallback reason.
2. **Given** a user whose token lacks Checks API permissions, **When** the tool runs with `--output-mode=checks`, **Then** all annotations are still posted successfully via the fallback review comment method.
3. **Given** a token with sufficient permissions (classic PAT with `repo` scope, fine-grained PAT with `Checks: write`, or Actions GITHUB_TOKEN with `checks: write`), **When** the tool runs with `--output-mode=checks`, **Then** annotations are posted via Checks API without fallback.

---

### User Story 3 - Explicit Output Mode Selection (Priority: P3)

A user can explicitly choose the output channel via `--output-mode` flag, selecting between `checks` (default) and `review` to control where annotations appear.

**Why this priority**: Some users may prefer review comments (e.g., for visibility in email notifications or when using third-party review tools that don't integrate with Checks). Preserving choice ensures backward compatibility.

**Independent Test**: Run the tool with `--output-mode=review` and verify annotations appear as PR review comments (existing behavior).

**Acceptance Scenarios**:

1. **Given** no `--output-mode` flag specified, **When** the tool runs, **Then** it defaults to `checks` mode.
2. **Given** `--output-mode=review` specified, **When** the tool runs, **Then** annotations are posted as PR review comments (existing behavior).
3. **Given** an invalid `--output-mode` value, **When** the tool runs, **Then** it displays an error listing valid options and exits.

---

### Edge Cases

- What happens when the Checks API rate limit is exceeded? The tool should retry with backoff, similar to the existing review comment retry logic.
- What happens when a check run has more than 50 annotations? The Checks API limits annotations to 50 per API call — the tool must batch annotations across multiple update calls.
- What happens when the token has Checks API write permission but the repository has restricted check run creation? The tool should detect the permission error and fall back to review comments.
- What happens when the user re-runs the tool on the same PR? A new check run should be created (not updating the old one), so annotation history is preserved per run.

## Requirements

### Functional Requirements

- **FR-001**: System MUST support posting annotations via GitHub Checks API as check-run annotations.
- **FR-002**: System MUST support posting annotations via PR review comments (existing behavior).
- **FR-003**: System MUST accept an `--output-mode` flag with values `checks` (default) and `review`.
- **FR-004**: System MUST default to `checks` mode when no `--output-mode` is specified.
- **FR-005**: System MUST attempt Checks API first (regardless of token type), detect permission errors (403/insufficient permissions), and automatically fall back to review comment mode with a user-visible warning.
- **FR-006**: System MUST batch check-run annotations to respect the 50-annotations-per-call limit of the Checks API.
- **FR-007**: System MUST handle Checks API rate limits with retry and backoff logic.
- **FR-008**: System MUST create a check run with a descriptive name (e.g., "PR Change Annotations") and summary including annotation counts.
- **FR-009**: System MUST map each annotation to the correct file path and line range in the check-run annotation format, using `notice` severity level for all annotations regardless of confidence level.
- **FR-010**: System MUST preserve the existing `--dry-run` behavior regardless of output mode.

### Key Entities

- **Check Run**: Represents a single execution of the annotation tool, containing a name, status, conclusion, summary, and a list of annotations.
- **Check Run Annotation**: An individual annotation attached to a specific file path and line range within a check run, containing the intent explanation text.
- **Output Mode**: The user's selected output channel (`checks` or `review`), determining how annotations are delivered to GitHub.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Annotations posted via Checks mode produce zero entries in the PR Conversation tab.
- **SC-002**: Annotations posted via Checks mode are visible inline in the Files Changed view for all annotated lines.
- **SC-003**: Users with unsupported tokens receive a fallback experience with 100% of annotations still posted via review comments.
- **SC-004**: Annotation posting via Checks API handles PRs with up to 200 change blocks without failure (batching across multiple API calls).
- **SC-005**: Existing review comment mode continues to work identically when explicitly selected with `--output-mode=review`.

## Clarifications

### Session 2026-04-02

- Q: 기본 output mode를 실행 환경에 따라 다르게 할까요? → A: 항상 `checks` 기본값 — 환경 무관하게 checks 시도, 실패 시 review fallback
- Q: Check run annotation의 severity level을 어떻게 매핑할까요? → A: 모두 `notice` — intent annotation은 정보 제공 목적이므로 경고 수준 불필요

## Assumptions

- GitHub Checks API annotations appear inline in the Files Changed view (confirmed by GitHub documentation).
- **Only GitHub App installation tokens can create/update check runs.** Classic PATs, fine-grained PATs, `gh` CLI OAuth tokens, and standard `GITHUB_TOKEN` in Actions cannot write check runs. This means checks mode will only work in CI with a GitHub App token or via `actions/github-script` with a GitHub App.
- In practice, local usage (Claude Code skill via `gh` CLI) will always fall back to review comments. Checks mode is primarily useful in CI (GitHub Actions with a GitHub App token).
- The Checks API annotation format supports `notice`, `warning`, and `failure` annotation levels. All intent annotations use `notice`.
- The Checks API limits annotations to 50 per API call (both create and update). Annotations are appended with each update call, enabling batching.
- The existing annotation analysis logic (intent detection, confidence scoring) remains unchanged — only the output delivery mechanism changes.
- The current working implementation is the Claude Code marketplace plugin (`plugins/annotate-pr/`), not the TypeScript CLI (spec 001, not yet built). This feature targets the plugin first.
