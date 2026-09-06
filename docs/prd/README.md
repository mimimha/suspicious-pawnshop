# PRD

Step별 구현용 PRD를 이 디렉터리에 보관한다.
Step / PRD 번호 체계는 **Notion의 개발 순서와 1:1로 맞춘다.**

## 원본 기획과의 관계

```
Notion  전당포 게임 > 통합 기획서   ← 원본 기획 (Source of Truth, 조회 전용)
   │
   │  필요한 범위만 확인해서 정리
   ↓
docs/prd/step-NN/prd-N-M-*.md       ← 구현 시점의 확정 스냅샷
   │
   ↓
구현 / 검증                          ← 구현은 PRD만 기준으로 한다
```

구현 중에는 PRD를 기준으로 삼는다. Notion을 매번 다시 읽지 않는다.
PRD와 Notion 원본이 어긋나 보이면 임의로 판단하지 말고 사용자에게 확인한다
(handoff `waiting_for_decision`).

## 디렉터리 / 파일 규칙

```
docs/prd/
└─ step-01/
   ├─ prd-1-1-game-state.md
   ├─ prd-1-2-customer-trade.md
   ├─ prd-1-3-inventory.md
   └─ prd-1-4-day-transition.md
```

- 디렉터리: `step-NN/` — Step 번호는 2자리 zero-padding (`step-01`, `step-02`)
- 파일: `prd-<step>-<seq>-<slug>.md` — 번호는 Notion의 `PRD N-M` 표기를 그대로 따르고,
  `<slug>`는 영문 kebab-case로 짧게 붙인다.
- 하나의 PRD는 **독립적으로 구현·검증 가능한 단위**여야 한다.

## Step 1 — 하루 플레이 파이프라인

Notion에 정의된 Step 1의 PRD 구성이다. **아직 작성하지 않았다.**

| PRD | 범위 | 파일명(예정) |
| --- | --- | --- |
| 1-1 | 기본 게임 상태와 하루 진행 | `prd-1-1-game-state.md` |
| 1-2 | 손님 1명의 최소 거래 흐름 | `prd-1-2-customer-trade.md` |
| 1-3 | 구매와 재고 연결 | `prd-1-3-inventory.md` |
| 1-4 | 하루 종료와 다음 날 연결 | `prd-1-4-day-transition.md` |

Step 1의 목표는 세부 완성도가 아니라 **전체 플레이 루프가 실제로 연결되어 동작하는 것**
(Vertical Slice)이다. 이후 Step은 통합 기획서 순서에 맞춰 확장한다.

## Step 2 — 시세와 판매

Step 1 완료 후 사용자 승인으로 다음 핵심 경제 루프를 우선한다.

| PRD | 범위 | 파일명 |
| --- | --- | --- |
| 2-1 | DAY 시작 시세 갱신 및 판매창 | `prd-2-1-market-sales.md` |

## Step 3 — 손님 자동 방문

시세와 판매 루프 다음으로, 수동 개발키에 의존하던 거래를 하루 단위 자동 방문 흐름으로 연결한다.

| PRD | 범위 | 파일명 |
| --- | --- | --- |
| 3-1 | 하루 4~5명 손님 자동 방문 및 영업시간 연결 | `prd-3-1-customer-queue.md` |

## Step 4 — STAGE 종료

STAGE 1의 3일 경제 루프를 보따리 상인과 월세 판정으로 완결한다.

| PRD | 범위 | 파일명 |
| --- | --- | --- |
| 4-1 | DAY 3 보따리 상인과 마지막 재고 판매 | `prd-4-1-bag-merchant.md` |
| 4-2 | 월세 납부와 STAGE 성공·실패 | `prd-4-2-rent-stage-result.md` |

## Step 5 — STAGE 2 위험과 정보

STAGE 1의 완성된 경제 루프 위에 STAGE 2의 진품·가품과 제한된 정보 사용을 단계적으로 추가한다.

| PRD | 범위 | 파일명 |
| --- | --- | --- |
| 5-1 | 진품·가품 생성, 구매 후 공개, 가품 처분가 | `prd-5-1-authenticity-fake-sales.md` |
| 5-2 | 감정권 획득·보유와 거래 전 감정 | `prd-5-2-appraisal-ticket.md` |
| 5-3 | 시세 확인권 구매와 다음 DAY 실제 판매가 확인 | `prd-5-3-market-preview-ticket.md` |
| 5-4 | 손님 유형·신뢰도·조기 결렬 | `prd-5-4-customer-trust-personality.md` |
| 5-5 | 공격·병원비·방어 아이템 | `prd-5-5-attack-hospital-defense.md` |
| 5-6 | 장사 시간 증량 아이템 | `prd-5-6-time-extension-item.md` |
| 5-7 | 전체 물건 풀·희귀도·재고 이동 | `prd-5-7-item-catalog-rarity-inventory-move.md` |

## Step 6 — 통합 플레이테스트 지원

기능 구현 완료 후 STAGE 1~2 전체 흐름과 확률 기능을 빠르게 재현하기 위한 개발 도구다.

| PRD | 범위 | 파일명 |
| --- | --- | --- |
| 6-1 | 개발 전용 통합 플레이테스트 패널 | `prd-6-1-dev-playtest-panel.md` |

## PRD 문서 형식

각 PRD 상단에 출처와 스냅샷 시점을 남긴다.

```markdown
> 출처: Notion `전당포 게임 > 통합 기획서 > <섹션>`
> 스냅샷: YYYY-MM-DD

## 목표
## 범위
## 범위 밖
## 완료 조건
## 밸런스 값 (현재 테스트값)
```

밸런스 수치는 Notion에서 "테스트값" 또는 미확정으로 표시된 경우
PRD에도 **"현재 테스트값"으로 명시**하고, 코드에 고정하지 않고 데이터로 분리한다.
플레이 테스트를 통해 조정한다.

PRD는 지시가 있을 때만 작성한다.
