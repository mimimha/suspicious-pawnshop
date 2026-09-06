---
name: playtest-loop
description: 실제 플레이 감각(UI 배치, 템포, 조작감, 시각 피드백, 재미)에 영향을 주는 변경을 자동 검증만으로 completed 처리하지 않고, state.json 을 ready_for_playtest 로 두고 사용자에게 localhost 확인을 요청하는 절차. 게임 기능 구현 후 사용자 플레이 확인이 필요한지 판단할 때 사용한다.
---

# 플레이테스트 루프

## 역할 경계

| skill | 담당 |
| --- | --- |
| `handoff-loop` | 구현 / 자동 검증 / 반복 한도 / 의사결정 상태 관리 |
| `playtest-loop` | **자동 검증 통과 이후**, 사람이 직접 플레이해야 판단 가능한 부분의 사용자 검증 |

`handoff-loop`의 자율 반복을 대체하지 않는다. 그 루프가 끝난 **직후**에 이어 붙는다.

```
handoff-loop (구현 → 자동 검증 → 수정 → 재검증)
        ↓  자동 검증 통과
    플레이 감각에 영향을 주는가?
        ├─ 아니오 → completed
        └─ 예     → ready_for_playtest  ← 여기부터 playtest-loop
```

## 언제 ready_for_playtest 로 멈추는가

자동 테스트가 통과했더라도, 변경이 아래에 해당하면 **completed 로 끝내지 않는다.**

- UI 배치
- 버튼 반응
- 애니메이션 속도
- 손님 등장 템포
- 거래 템포
- 조작감
- 시각적 피드백
- 게임 흐름의 답답함 / 속도감
- 재미에 영향을 주는 요소

판단 기준은 단순하다. **"코드가 맞게 도는가"로는 답할 수 없고 "해보니 어떤가"로만 답할 수 있는 부분이 있으면** `ready_for_playtest`다.

반대로 아래는 그대로 `completed`로 끝낸다.

- 내부 로직 / 데이터 구조 변경으로 화면에 드러나지 않는 것
- 문서, 설정, 스크립트 변경
- 자동 테스트로 완전히 판정되는 계산·상태 전이

## 절차

### 1. 자동 검증까지 마친다

`handoff-loop`의 반복 루프를 정상적으로 끝낸다. 자동 검증이 실패한 상태에서
`ready_for_playtest`로 넘기지 않는다. 그건 `failed`다.

### 2. state.json 갱신

```
status            : "ready_for_playtest"
needsUserDecision : false
lastUpdated       : ISO 8601 UTC
summary           : 무엇을 확인받아야 하는지 한 줄
```

`needsUserDecision`은 **false**다. 이건 기획 의사결정이 아니라 플레이 확인 요청이다.
기획·UX 방향 자체를 결정해야 한다면 그건 `waiting_for_decision`이고 `decision.md` 대상이다.

### 3. result.md 에 플레이테스트 항목 작성

`result.md`의 기본 형식에 더해 아래를 포함한다.

```markdown
## 플레이테스트 요청

Playtest URL:
http://localhost:5173

### 이번 구현 내용
- (무엇을 만들었는지)

### 자동 검증 결과
- (실행한 테스트/명령과 결과)

### 직접 확인해야 할 항목
1. 영업 시작 버튼 반응
2. 손님 등장 속도
3. 거래 종료 후 다음 상태 전환
4. UI가 답답하지 않은지

### 알려진 제한사항
- (미구현 부분, 임시 처리, 알고 있는 어색한 지점)
```

확인 항목은 **번호를 붙여 구체적으로** 쓴다. "전반적으로 확인해 주세요"는 요청이 아니다.
사용자가 항목 번호로 피드백을 줄 수 있어야 한다.

Playtest URL 은 실제로 띄우는 개발 서버 주소를 적는다. 서버 실행 명령이 필요하면
함께 적는다 (예: `npm run dev`).

### 4. 여기서 멈춘다

`ready_for_playtest` 상태로 종료한다. 사용자 확인 없이 스스로 `completed`로 바꾸지 않는다.

## 사용자 피드백 이후

다음 handoff 의 `task.md`에 피드백이 담겨 온다.

### 수정 요청인 경우

```
ready_for_playtest → working
```

`state.json`을 `working`으로 되돌리고 `iteration`을 이어서 증가시킨다.
수정 후 자동 검증을 다시 하고, 여전히 플레이 확인이 필요하면 **다시 `ready_for_playtest`**로 돌아간다.
이 왕복은 `maxIterations` 한도를 공유한다. 한도를 넘기면 `handoff-loop`의 규칙대로 중단한다.

### 승인인 경우

```
ready_for_playtest → completed
```

`result.md`에 승인 사실과 최종 상태를 기록하고 종료한다.
현재 PRD가 끝났더라도 다음 PRD를 임의로 시작하지 않는다.

## 상태 전이 요약

```
idle
 └→ working ─┬→ ready_for_playtest ─┬→ working (수정 피드백)
             │                      └→ completed (승인)
             ├→ completed (플레이 확인 불필요)
             ├→ waiting_for_decision (기획/UX 결정 필요)
             └→ failed (기술적 막힘 / 반복 한도 초과)
```
