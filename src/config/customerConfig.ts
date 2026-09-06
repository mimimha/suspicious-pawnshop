import type { CustomerType } from '@/customer/customerProfile';

/**
 * 손님 유형을 이름별로 고정한다.
 *
 * 예전에는 이름의 문자 코드 합을 유형 수(4)로 나눈 나머지로 정했는데, 한글 이름 13개가
 * 모두 나머지 0 또는 1로 떨어져 `suspicious`·`fraudster` 손님이 한 명도 만들어지지 않았다.
 * 그 결과 다음이 전부 죽어 있었다.
 * - 공격: `attackProneTypes`가 두 유형뿐이라 모든 STAGE에서 공격 확률이 0%
 * - 유형별 가품 확률 가중치(+0.1 / +0.2)
 * - 유형별 흥정 수용 폭(`acceptableDiscountRatioByType`)의 위쪽 두 칸
 * - 두 유형 전용 대사와 손님 관찰 단서
 *
 * 유형은 이름별 대사에 이미 성격이 드러나 있으므로 그 대사에 맞춰 직접 지정한다.
 * 늑대는 튜토리얼 두 번째 손님이 `fraudster`로 등장하므로 같은 값으로 맞춘다.
 */
export const CUSTOMER_TYPE_BY_NAME: Record<string, CustomerType> = {
  // 조심스럽고 흠까지 먼저 알려 주는 쪽
  토끼: 'honest',
  수달: 'honest',
  두루미: 'honest',
  부엉이: 'honest',
  // 사무적으로 값만 맞추는 쪽
  흰고양이: 'normal',
  독수리: 'normal',
  염소: 'normal',
  너구리: 'normal',
  // 출처를 캐물으면 말이 바뀌는 쪽
  뱀: 'suspicious',
  검은고양이: 'suspicious',
  사자: 'suspicious',
  // 보증을 앞세워 몰아붙이는 쪽
  늑대: 'fraudster',
  여우: 'fraudster',
};

/** 표에 없는 이름(DEV 호출 등)은 위험 가중치가 없는 유형으로 둔다. */
export const DEFAULT_CUSTOMER_TYPE: CustomerType = 'normal';

export const CUSTOMER_CONFIG = {
  startingTrust: 50,
  trustDiscountRatioAdjustments: [
    { max: 20, adjustment: -0.03 }, { max: 40, adjustment: -0.015 },
    { max: 60, adjustment: 0 }, { max: 80, adjustment: 0.015 }, { max: 100, adjustment: 0.03 },
  ],
  trustChanges: { purchased: 5, excessiveNegotiation: -5 },
  fakeChanceOffsets: { honest: -0.05, normal: 0, suspicious: 0.1, fraudster: 0.2 } satisfies Record<CustomerType, number>,
  breakOffOffsets: { honest: -0.05, normal: 0, suspicious: 0.08, fraudster: 0.12 } satisfies Record<CustomerType, number>,
  attackOffsets: { honest: 0, normal: 0, suspicious: 0.1, fraudster: 0.25 } satisfies Record<CustomerType, number>,
  attackProneTypes: ['suspicious', 'fraudster'] as readonly CustomerType[],
  /**
   * STAGE별 공격 확률 배율. 계산된 공격 확률 전체에 곱한다.
   *
   * 사용자 승인 변경(2026-08-26): 원래는 STAGE 2부터만 공격이 발생했다. STAGE 1에도
   * 위험을 두되 STAGE 2보다 낮게 하려고 배율로 나눴다. STAGE 1의 40%는 확률 곡선의
   * 모양을 유지하면서 세기만 낮춘 값이다(현재 테스트값).
   * 0으로 두면 그 STAGE에서는 공격이 발생하지 않는다.
   * 배열보다 큰 STAGE는 마지막 값을 쓴다.
   */
  attackChanceMultiplierByStage: [0.4, 1] as readonly number[],
  baseBreakOffChance: { almost: 0, unhappy: 0.05, veryUnhappy: 0.15 },
  baseAttackChance: { almost: 0, unhappy: 0, veryUnhappy: 0.1 },
  riskPerExtraRound: 0.08,
  lowTrustRisk: 0.1,
  hospitalCost: 3_000,
  /**
   * 손님 관찰 단서. 물건 단서(`itemObservationConfig`)와 다른 축이다.
   * 물건 단서가 "부위끼리 이야기가 이어지는가"를 묻는 데 비해,
   * 이쪽은 "손님이 물건에 대해 어떤 태도를 보이는가"를 보여 준다.
   *
   * 유형은 이름별로 고정(`CUSTOMER_TYPE_BY_NAME`)이라 문장이 적으면 문장 하나를 유형표처럼
   * 외우고 끝난다. 유형마다 여섯 문장을 돌리고, 여섯 문장이 서로 다른 관찰 축을 쓴다.
   * 1) 질문에 답하는 방식  2) 감정 과정에 대한 반응  3) 값의 근거를 대는 방식
   * 4) 시선과 손짓  5) 시간 압박  6) 물건의 이력을 말하는 방식
   */
  customerBehaviorClues: {
    honest: [
      '손님은 질문에 차분하고 구체적으로 답한다.',
      '손님은 물건의 흠까지 먼저 짚어 알려 준다.',
      '손님은 값을 부르기 전에 사정을 조심스럽게 설명한다.',
      '손님은 물건을 건네며 천천히 보라고 먼저 말한다.',
      '손님은 언제부터 쓰던 물건인지 스스로 이야기한다.',
      '손님은 감정하는 동안 재촉하지 않고 조용히 기다린다.',
    ],
    normal: [
      '손님은 가격표를 살피며 평범하게 기다린다.',
      '손님은 감정하는 손을 별 반응 없이 지켜본다.',
      '손님은 묻는 만큼만 답하고 재촉하지 않는다.',
      '손님은 값이 맞으면 넘기고 아니면 가겠다는 태도다.',
      '손님은 물건을 탁자에 올려 두고 팔짱을 낀 채 기다린다.',
      '손님은 다른 가게 시세를 대며 담담하게 값을 맞춘다.',
    ],
    suspicious: [
      '손님은 출처를 물으면 시선을 피하고 말을 바꾼다.',
      '손님은 특정 부분을 보려 하면 손으로 슬쩍 가린다.',
      '손님은 어디서 얻었는지 물을 때마다 답이 조금씩 달라진다.',
      '손님은 물건을 오래 만지지 못하게 자꾸 되가져간다.',
      '손님은 이야기 도중 문 쪽을 몇 번이나 돌아본다.',
      '손님은 값을 물으면 먼저 얼마를 줄 수 있는지 되묻는다.',
    ],
    fraudster: [
      '손님은 감정을 재촉하며 거래를 빠르게 끝내려 한다.',
      '손님은 묻지 않은 보증 이야기를 먼저 길게 늘어놓는다.',
      '손님은 다른 가게가 더 준다며 결정을 몰아붙인다.',
      '손님은 감정 도구를 꺼내면 그럴 필요 없다며 웃어넘긴다.',
      '손님은 이름난 물건이라 말하면서 근거는 대지 않는다.',
      '손님은 지금 결정하지 않으면 팔지 않겠다고 못을 박는다.',
    ],
  } satisfies Record<CustomerType, readonly string[]>,
} as const;
