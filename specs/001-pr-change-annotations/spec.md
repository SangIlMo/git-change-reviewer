# Feature Specification: PR Change Annotations

**Feature Branch**: `001-pr-change-annotations`
**Created**: 2026-03-31
**Status**: Draft
**Input**: User description: "PR의 file changed에서 AI가 생성한 각 코드 변경 블록에 대해 변경 의도와 이유를 인라인 주석으로 자동 추가하는 서비스"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - PR 변경사항 의도 확인 (Priority: P1)

PR reviewer가 GitHub PR의 "Files changed" 탭을 열면, AI가 생성한 각 코드 변경 블록마다 해당 변경의 의도와 이유가 인라인 주석으로 표시되어 있다. reviewer는 코드 자체뿐 아니라 변경 맥락을 즉시 파악할 수 있다.

**Why this priority**: 프로젝트의 핵심 가치 제안. AI 코드 변경의 의도를 알 수 없는 문제를 직접 해결.

**Independent Test**: PR을 생성한 후 Files changed 탭에서 각 변경 블록에 의도 주석이 존재하는지 확인.

**Acceptance Scenarios**:

1. **Given** AI가 코드를 변경하여 PR이 생성됨, **When** reviewer가 Files changed 탭을 열면, **Then** 각 변경 블록(hunk)에 해당 변경의 의도를 설명하는 인라인 주석이 표시된다.
2. **Given** 하나의 파일에 여러 독립적인 변경이 존재함, **When** reviewer가 해당 파일을 보면, **Then** 각 변경 블록마다 개별적인 의도 설명이 제공된다 (하나의 포괄적 설명이 아님).
3. **Given** 변경 의도를 파악할 수 있는 컨텍스트(커밋 메시지, PR 설명)가 존재함, **When** 주석이 생성되면, **Then** 주석은 해당 컨텍스트를 참조하여 구체적인 이유를 제시한다.

---

### User Story 2 - 다중 언어 PR 지원 (Priority: P2)

PR에 여러 프로그래밍 언어의 파일이 포함되어 있어도, 모든 파일의 변경 블록에 대해 의도 주석이 동일한 품질로 생성된다.

**Why this priority**: 실제 프로젝트는 다중 언어로 구성되며, 특정 언어에서만 작동하면 실용성이 크게 떨어짐.

**Independent Test**: TypeScript, Python, YAML 등 혼합된 PR에서 모든 파일에 주석이 생성되는지 확인.

**Acceptance Scenarios**:

1. **Given** PR에 3개 이상의 서로 다른 언어 파일이 포함됨, **When** 주석 생성이 실행되면, **Then** 모든 파일의 변경 블록에 의도 주석이 생성된다.
2. **Given** 설정 파일(YAML, JSON, TOML 등)이 변경됨, **When** 주석 생성이 실행되면, **Then** 설정 변경의 의도도 코드 변경과 동일하게 설명된다.

---

### User Story 3 - 대규모 PR 처리 (Priority: P2)

500줄 이상의 대규모 PR에서도 각 변경 블록에 대한 의도 주석이 누락 없이, 합리적인 시간 내에 생성된다.

**Why this priority**: 실제 AI 생성 코드는 대규모 변경이 많으며, 이때 리뷰 부담이 가장 크므로 이 기능의 가치가 극대화됨.

**Independent Test**: 500줄 이상 변경이 포함된 PR에서 모든 블록에 주석이 생성되고 타임아웃이 발생하지 않는지 확인.

**Acceptance Scenarios**:

1. **Given** 500줄 이상 변경된 PR, **When** 주석 생성이 실행되면, **Then** 모든 변경 블록에 주석이 생성되며, 전체 처리가 2분 이내에 완료된다.
2. **Given** 50개 이상의 파일이 변경된 PR, **When** 주석 생성이 실행되면, **Then** 파일 수에 관계없이 모든 변경 블록에 주석이 생성된다.

---

### Edge Cases

- 바이너리 파일이 변경된 경우 어떻게 처리하는가? → 바이너리 파일은 "바이너리 파일 변경됨" 표시만 하고 의도 주석 생략
- 파일 삭제만 있는 경우? → 삭제 이유를 설명하는 주석 생성
- 빈 커밋 메시지/PR 설명인 경우? → 코드 diff 자체를 분석하여 추론된 의도를 "[추론]" 태그와 함께 표시
- 동일 파일의 rename + 내용 변경? → rename 사실과 내용 변경 의도를 각각 별도로 설명
- 컨텍스트 정보가 충돌하는 경우(커밋 메시지와 실제 변경이 불일치)? → 불일치를 명시하고 코드 기반 분석 결과를 우선 표시

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 PR의 각 변경 블록(hunk)을 의미적으로 독립된 단위로 분할하여 분석해야 한다
- **FR-002**: 시스템은 각 변경 블록에 대해 "왜 이 변경이 필요한가"를 설명하는 인라인 주석을 생성해야 한다
- **FR-003**: 시스템은 커밋 메시지, PR 설명, 관련 이슈 등 가용한 컨텍스트를 활용하여 주석 품질을 높여야 한다
- **FR-004**: 시스템은 프로그래밍 언어에 관계없이 모든 텍스트 기반 파일의 변경을 분석해야 한다
- **FR-005**: 시스템은 추론 기반 설명과 컨텍스트 기반 설명을 명확히 구분하여 표시해야 한다
- **FR-006**: 시스템은 바이너리 파일 변경에 대해서는 주석 생성을 건너뛰어야 한다
- **FR-007**: 시스템은 파일 삭제, 이름 변경 등 특수 변경 유형에 대해서도 적절한 의도 설명을 제공해야 한다
- **FR-008**: 시스템은 GitHub Pull Request Reviews API를 통해 PR의 "Files changed" 뷰에 인라인 review comment로 주석을 게시해야 한다

### Key Entities

- **변경 블록(Change Block)**: diff에서 의미적으로 독립된 코드 변경 단위. 하나의 hunk 또는 hunk 내 논리적 세그먼트
- **의도 주석(Intent Annotation)**: 변경 블록에 대한 설명. 출처(컨텍스트/추론), 변경 이유, 관련 컨텍스트 참조를 포함
- **컨텍스트 소스(Context Source)**: 주석 생성에 활용되는 정보원. 커밋 메시지, PR 설명, 이슈 링크, 코드 diff 자체 등

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 500줄 이하 PR의 주석 생성이 30초 이내에 완료된다
- **SC-002**: 변경 블록의 95% 이상에 대해 의도 주석이 생성된다
- **SC-003**: PR reviewer의 80% 이상이 주석이 코드 변경 이해에 도움이 되었다고 평가한다
- **SC-004**: 3개 이상 언어가 혼합된 PR에서도 주석 생성 성공률이 90% 이상이다
- **SC-005**: 추론 기반 주석과 컨텍스트 기반 주석이 명확히 구분되어, 사용자가 주석의 신뢰도를 즉시 판단할 수 있다

## Clarifications

### Session 2026-03-31

- Q: 의도 주석을 GitHub PR review comment로 게시할 것인지, 별도 UI/리포트로 제공할 것인지? → A: GitHub PR review comment로 게시. Reviews API를 통해 Files changed 탭에 인라인으로 표시.

## Assumptions

- PR은 GitHub에서 호스팅되며, GitHub의 PR review 기능을 통해 주석이 표시된다
- AI가 코드를 생성할 때의 세션 컨텍스트(예: Claude Code 대화 내역)는 v1에서는 활용하지 않으며, 커밋 메시지와 PR 설명만 사용한다
- 사용자는 주석 생성을 수동으로 트리거하거나, CI/CD 파이프라인에서 자동 실행할 수 있다
- 바이너리 파일 및 자동 생성 파일(lock files 등)은 주석 대상에서 제외된다
- 주석 언어는 PR 설명 또는 저장소 기본 언어 설정을 따른다
