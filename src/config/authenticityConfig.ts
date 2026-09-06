import { ITEM_CATEGORIES, type ItemCategory } from '@/config/tradeConfig';

export const AUTHENTICITY_CONFIG = {
  startsAtStage: 1,
  /**
   * 카테고리별 가품 확률.
   *
   * 사용자 승인 변경(2026-08-26): 기존 값(0.10~0.35, 평균 23%)에서 일괄 0.7배로 낮췄다.
   * 가품 손실이 완주율의 실제 병목이었다. 시세 평균 배수가 1.0이라 물건의 기대 가치는
   * `기준가 x (1 - (1 - 처분비율) x 가품확률)`이고, 평균 가품 23%에서는 손익분기 매입가가
   * 기준가의 86%(최초 제시가의 80%)였다. 즉 제시가의 80~100%를 부르는 플레이는 모두
   * 평균 손해였고, 그 구간이 전부 손님이 즉시 수락하는 무저항 구간이라 배울 수가 없었다.
   * 평균 16%로 낮추면 손익분기가 제시가의 84%로 올라가 손해 구간이 20pp에서 16pp로 줄고,
   * '보통' 플레이(제시가 75%) 완주율이 41%에서 69%로 오른다.
   *
   * 처분 비율(0.4)은 그대로 둬서 가품 한 건의 타격은 유지했다. 더 드물지만 여전히 아프다.
   * 이 값을 되돌리면 완주율이 다시 40%대로 떨어진다.
   */
  fakeChanceByCategory: {
    생활용품: 0.07,
    전자기기: 0.13,
    취미용품: 0.14,
    수집품: 0.18,
    액세서리: 0.21,
    골동품: 0.25,
  } satisfies Record<ItemCategory, number>,
  /** 가품 처분가 = 기준가 x 이 비율. 10%는 실수 1회로 STAGE가 끝나 40%로 조정(플레이테스트값). */
  fakeDisposalRatio: 0.4,
  priceRoundingUnit: 100,
} as const;

/** 시세 장부에 보여 줄 위조 위험 등급. 낮은 쪽부터 순서대로다. */
export const FAKE_RISK_LABELS = ['드묾', '보통', '잦음'] as const;

export type FakeRiskLabel = (typeof FAKE_RISK_LABELS)[number];

/**
 * 카테고리별 위조 위험을 정성 등급으로 바꾼다.
 *
 * 숫자를 그대로 노출하지 않는 이유: 물건의 값과 진위를 추측하는 것이 이 게임의 핵심이라
 * 확률을 알려 주면 계산으로 바뀐다. 반면 "골동품은 위조가 잦다"는 전당포 주인의 일반 상식이고,
 * 이게 없으면 카테고리별 편차(정직형 x 생활용품 2% ~ 사기형 x 골동품 45%)가 순수 시행착오가 된다.
 *
 * 절대 기준선 대신 카테고리를 확률 순으로 줄 세워 세 등급으로 나눈다.
 * 경계에 걸친 값이 확률을 조금 조정할 때마다 등급을 넘나드는 것을 막고,
 * 등급이 항상 "다른 카테고리에 비해"라는 뜻을 유지하게 하기 위함이다.
 */
export interface CategoryFakeRisk { category: ItemCategory; label: FakeRiskLabel }

/** 위험이 낮은 카테고리부터 등급을 붙여 돌려준다. 화면에 이 순서로 그리면 등급이 한눈에 읽힌다. */
export function fakeRiskByCategory(): readonly CategoryFakeRisk[] {
  const ordered = [...ITEM_CATEGORIES].sort((a, b) => {
    const difference = AUTHENTICITY_CONFIG.fakeChanceByCategory[a]
      - AUTHENTICITY_CONFIG.fakeChanceByCategory[b];
    // 확률이 같으면 카테고리 선언 순서로 갈라 결과가 흔들리지 않게 한다.
    return difference !== 0 ? difference : ITEM_CATEGORIES.indexOf(a) - ITEM_CATEGORIES.indexOf(b);
  });
  const perBand = ordered.length / FAKE_RISK_LABELS.length;
  return ordered.map((category, index) => ({
    category,
    label: FAKE_RISK_LABELS[Math.min(FAKE_RISK_LABELS.length - 1, Math.floor(index / perBand))]!,
  }));
}

export function fakeRiskLabelByCategory(): Record<ItemCategory, FakeRiskLabel> {
  return Object.fromEntries(
    fakeRiskByCategory().map(({ category, label }) => [category, label]),
  ) as Record<ItemCategory, FakeRiskLabel>;
}

