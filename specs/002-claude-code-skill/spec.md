# Feature Specification: Claude Code PR Annotation Skill

**Feature Branch**: `002-claude-code-skill`
**Created**: 2026-04-02
**Status**: Draft
**Input**: User description: "PR 변경사항을 분석하여 각 코드 블록의 변경 의도를 GitHub PR review comment로 게시하는 Claude Code slash command skill로 전환"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Slash Command로 PR 주석 달기 (Priority: P1)

개발자가 Claude Code에서 `/annotate-pr 123`을 실행하면, PR #123의 각 변경 블록에 대한 의도 주석이 GitHub PR의 Files changed 탭에 인라인 review comment로 게시된다. 별도의 API 키나 설치 과정 없이, Claude Code 구독만으로 바로 사용 가능하다.

**Why this priority**: 핵심 가치 제안. 설치/설정 없이 slash command 하나로 즉시 사용 가능한 경험.

**Independent Test**: Claude Code에서 `/annotate-pr <PR번호>`를 실행하고, GitHub PR Files changed에서 인라인 주석 확인.

**Acceptance Scenarios**:

1. **Given** GitHub PR이 존재하고 Claude Code에서 작업 중, **When** `/annotate-pr 123`을 실행하면, **Then** PR의 각 변경 블록에 의도 주석이 review comment로 게시된다.
2. **Given** 하나의 파일에 여러 독립적 변경이 있음, **When** skill이 실행되면, **Then** 각 블록마다 개별 의도 설명이 제공된다.
3. **Given** 커밋 메시지와 PR 설명이 존재함, **When** 주석이 생성되면, **Then** 해당 컨텍스트를 참조하여 구체적 이유를 제시한다.
4. **Given** PR 번호 없이 실행, **When** `/annotate-pr`만 실행하면, **Then** 현재 브랜치의 열린 PR을 자동 탐지하여 처리한다.

---

### User Story 2 - Dry-run 미리보기 (Priority: P2)

개발자가 실제 게시 전에 어떤 주석이 달릴지 미리 확인할 수 있다.

**Why this priority**: 실수로 불필요한 주석이 게시되는 것을 방지. 사용자 신뢰 확보.

**Independent Test**: `/annotate-pr 123 --dry-run` 실행 후 터미널에 주석 목록이 출력되고 GitHub에는 아무것도 게시되지 않음을 확인.

**Acceptance Scenarios**:

1. **Given** PR이 존재함, **When** `/annotate-pr 123 --dry-run`을 실행하면, **Then** 주석 내용이 터미널에 출력되고 GitHub에는 게시되지 않는다.
2. **Given** dry-run 결과를 확인 후, **When** 사용자가 게시를 승인하면, **Then** 해당 주석이 그대로 GitHub에 게시된다.

---

### User Story 3 - 대규모 PR 처리 (Priority: P2)

500줄 이상의 대규모 PR에서도 모든 변경 블록에 주석이 누락 없이 생성된다.

**Why this priority**: AI 생성 코드는 대규모 변경이 많으며, 이때 리뷰 부담이 가장 큼.

**Independent Test**: 500줄+ PR에서 skill 실행 후 모든 블록에 주석이 존재하는지 확인.

**Acceptance Scenarios**:

1. **Given** 500줄+ 변경 PR, **When** skill이 실행되면, **Then** 모든 변경 블록에 주석이 생성된다.
2. **Given** 100개 이상의 review comment가 필요한 PR, **When** skill이 실행되면, **Then** 여러 review로 분할하여 모든 주석이 게시된다.

---

### Edge Cases

- PR 번호 없이 실행 시 → 현재 브랜치의 열린 PR 자동 탐지, 없으면 에러 메시지
- 바이너리 파일 변경 → 스킵하고 사유 표시
- lock 파일 등 자동 생성 파일 → 스킵
- 커밋 메시지와 실제 변경 불일치 → "[Conflict]" 태그로 불일치 명시
- gh CLI 미설치 또는 미인증 → 명확한 에러 메시지와 해결 방법 안내
- GitHub API rate limit → 진행 상황 표시 후 대기/재시도

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Plugin은 GitHub repository 기반 marketplace plugin으로 배포되며, 사용자는 `/plugin marketplace add owner/repo`로 설치할 수 있어야 한다
- **FR-002**: 사용자는 `/annotate-pr <PR번호>` 또는 `/annotate-pr` (자동 탐지)로 실행할 수 있어야 한다
- **FR-003**: Skill은 `gh pr diff`로 PR diff를 가져오고, `gh pr view`로 PR 메타데이터(설명, 커밋 메시지)를 수집해야 한다
- **FR-004**: 각 변경 블록(hunk 내 의미적 단위)에 대해 변경 의도를 분석하고 설명을 생성해야 한다
- **FR-005**: 추론 기반 설명과 컨텍스트 기반 설명을 명확히 구분해야 한다 (Inferred vs Context 태그)
- **FR-006**: `gh api`를 통해 GitHub PR Reviews API로 인라인 review comment를 게시해야 한다
- **FR-007**: `--dry-run` 옵션으로 게시 없이 미리보기를 지원해야 한다
- **FR-008**: 바이너리 파일, lock 파일, 자동 생성 파일은 자동으로 스킵해야 한다
- **FR-009**: 100개 초과 comment 시 여러 review로 분할 게시해야 한다
- **FR-010**: 별도의 API 키나 npm 패키지 설치 없이 Claude Code 구독만으로 동작해야 한다
- **FR-011**: Plugin은 plugin.json manifest, SKILL.md, helper scripts로 구성된 디렉토리 구조를 가져야 한다
- **FR-012**: SKILL.md는 YAML frontmatter를 포함해야 하며, user-invocable: true, disable-model-invocation: true, allowed-tools: Bash(gh *), argument-hint: "[PR-number] [--dry-run]"을 명시해야 한다

### Key Entities

- **변경 블록(Change Block)**: diff 내 의미적으로 독립된 코드 변경 단위
- **의도 주석(Intent Annotation)**: 변경 이유 설명. 출처(Context/Inferred/Conflict), 신뢰도 포함
- **Plugin 패키지**: plugin.json manifest + skills/annotate-pr/SKILL.md + scripts/ — marketplace 배포 단위

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 설치 과정 없이 파일 하나 추가만으로 5초 이내에 사용 시작 가능
- **SC-002**: 500줄 이하 PR의 주석 생성이 2분 이내에 완료된다
- **SC-003**: 변경 블록의 95% 이상에 대해 의도 주석이 생성된다
- **SC-004**: PR reviewer의 80% 이상이 주석이 코드 변경 이해에 도움이 되었다고 평가
- **SC-005**: 추론 기반과 컨텍스트 기반 주석이 명확히 구분되어 신뢰도 즉시 판단 가능

## Clarifications

### Session 2026-04-02

- Q: 배포 채널은? → A: GitHub repository 기반 marketplace plugin (`/plugin marketplace add owner/repo`)
- Q: Plugin 디렉토리 구조는? → A: SKILL.md + scripts/ (helper shell scripts 분리)
- Q: SKILL.md frontmatter 설정은? → A: 사용자 명시 호출만 (user-invocable: true, disable-model-invocation: true)

## Assumptions

- 사용자는 Claude Code가 설치되어 있고 활성 구독이 있다
- gh CLI가 설치되어 있고 GitHub에 인증되어 있다
- PR은 GitHub에서 호스팅된다
- Claude Code의 slash command 기능(.claude/commands/)을 사용한다
- v1에서는 AI 세션 컨텍스트(대화 내역)는 활용하지 않으며, diff + 커밋 메시지 + PR 설명만 사용한다
- 이 plugin은 GitHub repository로 배포되며, 사용자는 `/plugin marketplace add`와 `/plugin install`로 설치한다
