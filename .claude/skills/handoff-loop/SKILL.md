---
name: handoff-loop
description: vive-pawnshop 프로젝트의 handoff 작업 절차. .handoff/task.md 의 지시를 승인된 PRD 범위 안에서 자율적으로 구현·검증·수정하고, state.json / result.md / decision.md 를 갱신한다. handoff 실행, task.md 처리, state.json 갱신, 사용자 결정 필요 판단이 필요할 때 사용한다.
---

# Handoff 자율 작업 절차

## 철학

> 현재 PRD 안에서는 스스로 구현하고 검증한다.
> 기술적 세부사항은 자율적으로 결정한다.
> 기획 / UX / 범위 변경이 필요할 때만 사용자에게 질문한다.

## 대상 파일

| 파일 | 읽기 | 쓰기 |
| --- | --- | --- |
| `CLAUDE.md` | O | X |
| `docs/prd/<현재 PRD>` | O | 지시가 있을 때만 |
| `.handoff/task.md` | O | X (사용자/외부가 쓴다) |
| `.handoff/state.json` | O | O |
| `.handoff/result.md` | O | O |
| `.handoff/decision.md` | O | O |

## 절차

### 0. 준비

1. `CLAUDE.md` 를 읽고 제약을 확인한다.
2. `.handoff/state.json` 을 읽는다. `maxIterations` 와 `currentPrd` 를 확인한다.
3. `.handoff/task.md` 를 읽는다. 지시가 비어 있거나 템플릿 자리표시자뿐이면
   `failed` 로 기록하고 즉시 중단한다.
4. `currentPrd` 가 지정되어 있으면 해당 PRD 문서를 읽는다. 이 문서가 **작업 범위의 경계**다.
5. 착수 시 `state.json` 을 갱신한다:
   `status: "working"`, `iteration: 1`, `currentTask`(task.md 목표 한 줄 요약),
   `needsUserDecision: false`, `lastUpdated`(ISO 8601 UTC).
6. `decision.md` 가 `status: pending` 인데 이번 task 가 그 답변을 담고 있다면,
   답변을 반영한 뒤 `decision.md` 를 `status: none` / "결정 필요 없음" 으로 되돌린다.

### 1. 자율 반복 루프

아래를 **완료 조건을 만족할 때까지** 반복한다. 매 반복마다 `state.json` 의
`iteration` 을 1 증가시킨다.

1. 관련 코드 / 문서를 확인한다.
2. 구현한다.
3. 검증한다 — 테스트 실행, 스크립트 실행, 타입 체크 등 **실제로 실행 가능한 방법**으로.
   실행 가능한 검증 수단이 아직 없다면 무엇을 어떻게 확인했는지 `result.md` 에 명시한다.
   "코드를 읽어 보니 맞다"는 검증이 아니다.
4. 실패하면 원인을 분석한다.
5. 수정한다.
6. task.md 의 완료 조건을 다시 검증한다.

**중단 조건 (먼저 오는 것):**

- 완료 조건 충족 + 플레이 확인 불필요 → `completed`
- 완료 조건 충족 + **실제 플레이 감각 확인 필요** → `ready_for_playtest`
  (판단 기준과 보고 형식은 `playtest-loop` skill을 따른다)
- 사용자 결정 필요 → `waiting_for_decision`
- `iteration > maxIterations` → 아래 규칙에 따라 `waiting_for_decision` 또는 `failed`

### 2. 반복 한도 초과 시

- 남은 문제가 **어떻게 할지 선택**의 문제라면 → `waiting_for_decision` + `decision.md` 작성
- 남은 문제가 **원인 불명 / 환경 문제 / 기술적 막힘**이라면 → `failed`
  + `result.md` 에 시도한 것, 실패 양상, 다음에 확인할 것을 기록

어느 쪽이든 **작업 중인 코드를 되돌리지 않는다.** 진행 상황을 남기고 멈춘다.

### 3. 마무리

1. `.handoff/result.md` 를 파일 내 템플릿 형식으로 덮어쓴다.
2. `.handoff/state.json` 을 최종 상태로 갱신한다 (`status`, `iteration`,
   `needsUserDecision`, `lastUpdated`, `summary`).
3. `waiting_for_decision` 이면 `.handoff/decision.md` 를 `status: pending` 으로
   채운다. 그 외 상태에서는 `status: none` 을 유지한다.
4. `ready_for_playtest` 이면 `result.md` 에 플레이테스트 요청 항목을 함께 쓴다
   (`playtest-loop` skill 참조). `decision.md` 는 건드리지 않는다.

---

## 자율 결정 / 사용자 확인 경계

### 스스로 결정한다 (현재 PRD 범위 안일 때)

- 파일명, 함수명, 변수명
- 내부 구현 방식, 알고리즘 선택
- 작은 리팩터링
- 테스트 보강
- 버그 수정
- 명백한 타입 / 문법 오류 수정
- 기존 규칙 안에서의 코드 구조 선택

이런 결정을 하려고 멈추지 않는다. 결정 근거는 `result.md` 에 한 줄로 남긴다.

### 반드시 멈추고 물어본다

하나라도 해당하면 즉시 `waiting_for_decision`:

- 기존 게임 기획을 변경해야 하는 경우
- UX 나 게임 재미에 영향을 주는 선택
- 서로 충돌하는 요구사항
- 현재 PRD 범위를 넘어서는 기능 추가가 필요한 경우
- 구조적으로 여러 선택지가 있고 향후 개발 방향에 큰 영향을 주는 경우
- 데이터 손실 또는 대규모 리팩터링 가능성이 있는 경우

판단이 애매하면 **멈추는 쪽을 택한다.** 단, 위 목록 어디에도 해당하지 않는데
단순히 확신이 없어서 멈추는 것은 하지 않는다 — 가정을 `result.md` 에 명시하고 진행한다.

### 플레이 감각은 스스로 판정하지 않는다

자동 검증이 통과했다는 이유로 UI 배치·템포·조작감·시각 피드백·재미를
"괜찮다"고 스스로 판정하지 않는다. 이런 요소가 포함된 변경은 `ready_for_playtest`로
넘기고 사용자 확인을 받는다. 상세 기준은 `playtest-loop` skill에 있다.

### PRD 경계

현재 PRD 가 완료되면 **다음 PRD 를 임의로 시작하지 않는다.**

- `state.json` 을 `completed` 로 변경
- `result.md` 작성
- 거기서 멈추고 다음 지시를 기다린다

`docs/prd/` 에 다음 PRD 파일이 이미 있어도 마찬가지다.

---

## state.json 필드

| 필드 | 타입 | 의미 |
| --- | --- | --- |
| `status` | string | `idle` / `working` / `ready_for_playtest` / `completed` / `failed` / `waiting_for_decision` |
| `currentPrd` | string \| null | 작업 기준 PRD 경로 (예: `docs/prd/01-core-loop.md`) |
| `currentTask` | string \| null | 현재 task 의 한 줄 요약 |
| `iteration` | number | 현재 반복 회차 |
| `maxIterations` | number | 반복 한도 (기본 5) |
| `needsUserDecision` | bool | `waiting_for_decision` 일 때만 true |
| `lastUpdated` | string | ISO 8601 UTC (예: `2026-08-17T04:21:09Z`) |
| `summary` | string | 현재 상태를 한두 문장으로 |

`status` 와 `needsUserDecision` 은 항상 일치해야 한다.
`maxIterations` 와 `currentPrd` 는 지시 없이 바꾸지 않는다.
