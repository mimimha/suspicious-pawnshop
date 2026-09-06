export const ITEM_CATEGORIES = [
  '전자기기',
  '액세서리',
  '수집품',
  '생활용품',
  '골동품',
  '취미용품',
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export interface ItemSeed {
  id: string;
  name: string;
  category: ItemCategory;
  basePrice: number;
  /**
   * 아트(`public/assets/items/<id>.webp`)가 준비됐는지.
   * 아트가 없는 물건은 거래 화면·재고·보따리 상인에서 그림 없는 빈칸으로 보이므로
   * 손님 물건 추첨에서 제외한다. 파일을 넣고 이 값을 true로 바꾸면 그대로 등장한다.
   */
  artReady: boolean;
  rarity?: ItemRarity;
  stageMin?: number;
}

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

/**
 * STAGE 1부터 등장하는 물건.
 *
 * 기준가 사다리(현재 테스트값):
 * - common 5,500~10,000 — 시작 자금 55,000으로 여러 개를 굴려 감각을 익히는 구간
 * - uncommon 12,000~18,000 — 한 건이 하루 손익을 좌우하기 시작하는 구간
 * - rare 18,000~32,000 — 자금의 절반 가까이가 묶이는 구간
 * - legendary 34,000~46,000 — 성공하면 STAGE 목표를 한 번에 채우고, 가품이면 크게 다치는 구간
 *
 * 가품 확률은 카테고리로 정하므로(`authenticityConfig`) 기준가가 높은 물건을
 * 가품이 잦은 카테고리(골동품 35%, 액세서리 30%)에 몰아 위험과 보상을 맞췄다.
 */
export const STAGE_ONE_ITEMS: readonly ItemSeed[] = [
  { id: 'antique-lighter', name: '앤티크 라이터', category: '생활용품', basePrice: 6_000, rarity: 'common', artReady: true },
  // 아트 대기 중인 유일한 항목. 파일을 넣으면 artReady만 true로 바꾼다.
  { id: 'silver-spoon-set', name: '은수저 한 벌', category: '생활용품', basePrice: 7_000, rarity: 'common', artReady: false },
  { id: 'old-coin-set', name: '구형 동전 세트', category: '수집품', basePrice: 8_000, rarity: 'common', artReady: true },
  { id: 'mother-of-pearl-hand-mirror', name: '자개 손거울', category: '액세서리', basePrice: 8_500, rarity: 'common', artReady: true },
  { id: 'old-radio', name: '오래된 라디오', category: '취미용품', basePrice: 9_000, rarity: 'common', artReady: true },
  { id: 'brass-compass', name: '놋쇠 나침반', category: '수집품', basePrice: 9_500, rarity: 'common', artReady: true },
  { id: 'pocket-watch', name: '회중시계', category: '액세서리', basePrice: 12_000, rarity: 'uncommon', artReady: true },
  { id: 'clockwork-music-box', name: '태엽 오르골', category: '취미용품', basePrice: 14_000, rarity: 'uncommon', artReady: true },
  // 튜토리얼 2번째 손님이 이 기준가를 전제로 희망가 18,000 / 최저가 13,500을 쓴다.
  // 기준가를 바꿀 때는 tutorialConfig.riskyCustomer도 함께 맞춘다.
  { id: 'vintage-camera', name: '빈티지 카메라', category: '전자기기', basePrice: 18_000, rarity: 'rare', artReady: true },
  { id: 'antique-glasses', name: '앤티크 안경', category: '골동품', basePrice: 25_000, rarity: 'legendary', artReady: true },
];

/**
 * STAGE 2에서 추가되는 물건.
 *
 * STAGE 2는 월세 35,000과 손익 목표 6,000을 함께 채워야 하므로 한 건의 크기가 커야 한다.
 * 그래서 uncommon 이상만 넣고, 최고가 축음기(42,000)를 STAGE 2 전용으로 둔다.
 */
export const STAGE_TWO_ITEMS: readonly ItemSeed[] = [
  { id: 'celadon-teacup', name: '청자 찻잔', category: '골동품', basePrice: 17_000, rarity: 'uncommon', stageMin: 2, artReady: true },
  { id: 'pearl-necklace', name: '진주 목걸이', category: '액세서리', basePrice: 22_000, rarity: 'rare', stageMin: 2, artReady: true },
  { id: 'brass-telescope', name: '놋쇠 망원경', category: '취미용품', basePrice: 24_000, rarity: 'rare', stageMin: 2, artReady: true },
  { id: 'jade-seal', name: '옥 도장', category: '수집품', basePrice: 30_000, rarity: 'rare', stageMin: 2, artReady: true },
  { id: 'gramophone', name: '축음기', category: '전자기기', basePrice: 42_000, rarity: 'legendary', stageMin: 2, artReady: true },
];

/**
 * STAGE 1부터 등장하지만 원래 STAGE 2 전용이었던 물건.
 *
 * 사용자 승인 변경(2026-08-25): STAGE 1 풀이 6종뿐이라 3일 내내 같은 물건이 돌았다.
 * 아트가 있는 9종을 모두 STAGE 1에 열어 즉시 다양성을 확보하고,
 * STAGE 2 전용 자리는 위 `STAGE_TWO_ITEMS`의 신규 물건이 이어받는다.
 */
export const STAGE_ONE_OPENED_ITEMS: readonly ItemSeed[] = [
  { id: 'fountain-pen', name: '만년필', category: '생활용품', basePrice: 15_000, rarity: 'uncommon', artReady: true },
  { id: 'signet-ring', name: '인장 반지', category: '액세서리', basePrice: 28_000, rarity: 'rare', artReady: true },
  // 기준가 35,000은 앤티크 안경(25,000)보다 높은데 rare로 묶여 있어 사다리가 어긋났다. legendary로 옮겼다.
  { id: 'antique-books', name: '고서적', category: '골동품', basePrice: 35_000, rarity: 'legendary', artReady: true },
];

export const ALL_ITEMS: readonly ItemSeed[] = [
  ...STAGE_ONE_ITEMS, ...STAGE_ONE_OPENED_ITEMS, ...STAGE_TWO_ITEMS,
];

/** 아트가 준비돼 실제로 손님이 들고 나올 수 있는 물건. */
export const PLAYABLE_ITEMS: readonly ItemSeed[] = ALL_ITEMS.filter((item) => item.artReady);

export const ITEM_BY_ID: ReadonlyMap<string, ItemSeed> = new Map(
  ALL_ITEMS.map((item) => [item.id, item]),
);

/** 해당 STAGE에서 실제로 등장할 수 있는 물건. 손님 추첨과 DEV 도구가 같은 목록을 쓴다. */
export function playableItemsForStage(stage: number): readonly ItemSeed[] {
  return PLAYABLE_ITEMS.filter((item) => (item.stageMin ?? 1) <= stage);
}

export const RARITY_CONFIG = {
  /**
   * 희귀도 등장 비중. 희귀도를 먼저 뽑고 그 안에서 균등 추첨한다.
   * 전설 5%는 풀이 커질수록 개별 물건이 한 STAGE 내내 한 번도 안 나오는 수준이라
   * 8%로 올렸다(현재 테스트값).
   */
  weights: { common: 0.42, uncommon: 0.30, rare: 0.20, legendary: 0.08 },
} satisfies { weights: Record<ItemRarity, number> };

export const CUSTOMER_NAMES = [
  '토끼', '뱀', '흰고양이', '늑대', '검은고양이', '독수리', '여우',
  '염소', '부엉이', '너구리', '수달', '두루미', '사자',
] as const;

export const TRADE_BALANCE = {
  customerDissolveMilliseconds: 240,
  firstCustomerArrivalDelayMilliseconds: 320,
  maxRounds: 3,
  nearAcceptanceRatio: 0.9,
  complaintRatio: 0.7,
  initialAskingPriceRatio: { min: 1, max: 1.15 },
  /**
   * 손님이 받아들이는 최대 할인율. 최초 제시가에서 이 비율만큼 깎을 수 있다.
   * 가품 확률 평균 23%, 가품 처분 40%를 넣고 계산하면 기준가의 86% 아래로 사야 거래가 이득이다.
   * 기존 8~25%로는 하한이 기준가의 90%라 거래할수록 손해였다(플레이테스트값).
   */
  acceptableDiscountRatioByType: {
    honest: { min: 0.28, max: 0.34 },
    normal: { min: 0.30, max: 0.38 },
    suspicious: { min: 0.32, max: 0.42 },
    fraudster: { min: 0.35, max: 0.45 },
  },
  resultDisplayMilliseconds: 1_800,
  /** 공격 대사를 읽을 시간. 이 시간이 지난 뒤 공격 결과 팝업을 띄운다. */
  attackLineDisplayMilliseconds: 1_700,
  purchaseResultDisplayMilliseconds: 4_000,
  speechCharacterMilliseconds: 45,
  offerHoldInitialDelayMilliseconds: 450,
  offerHoldRepeatMilliseconds: 180,
} as const;
