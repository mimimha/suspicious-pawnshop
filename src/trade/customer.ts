import {
  CUSTOMER_NAMES,
  RARITY_CONFIG,
  TRADE_BALANCE,
  playableItemsForStage,
  type ItemSeed,
} from '@/config/tradeConfig';
import { determineAuthenticity, type Authenticity } from '@/item/authenticity';
import { CUSTOMER_CONFIG } from '@/config/customerConfig';
import {
  FALLBACK_ITEM_OBSERVATION,
  ITEM_OBSERVATION_BALANCE,
  ITEM_OBSERVATION_CLUES,
  type ItemObservationTone,
} from '@/config/itemObservationConfig';
import {
  CustomerProfileStore,
  trustDiscountRatioAdjustment,
  type CustomerType,
} from '@/customer/customerProfile';

export interface Customer {
  id: string;
  name: string;
  item: ItemSeed;
  initialAskingPrice: number;
  minAcceptablePrice: number;
  /** 감정 전에는 UI에 노출하지 않는 이미 확정된 진위 결과. */
  authenticity: Authenticity;
  type?: CustomerType;
  trust?: number;
  itemConditionClue?: string;
  sellerBehaviorClue?: string;
}

/**
 * 관찰 단서 두 줄을 고른다.
 *
 * 굴림 세 개를 따로 받는다.
 * - `toneRoll`: 물건 단서의 어조(진품 쪽 / 중립 / 가품 쪽)
 * - `itemVariantRoll`: 그 어조 안에서 어떤 관찰 축의 문장을 쓸지
 * - `behaviorVariantRoll`: 손님 관찰 문장
 *
 * 손님 문장까지 `itemVariantRoll`로 고르면 두 줄의 짝이 고정돼, 물건 문장을 보는 것만으로
 * 손님 문장을 알 수 있게 된다. 기본값은 이전 동작(두 줄이 같은 굴림)이라 기존 호출부는 그대로 둔다.
 */
export function customerObservationClues(
  item: ItemSeed,
  type: CustomerType,
  authenticity: Authenticity,
  toneRoll: number,
  itemVariantRoll = 0,
  behaviorVariantRoll = itemVariantRoll,
): Pick<Customer, 'itemConditionClue' | 'sellerBehaviorClue'> {
  const clues = ITEM_OBSERVATION_CLUES[item.id] ?? FALLBACK_ITEM_OBSERVATION;
  return {
    itemConditionClue: pickVariant(clues[observationTone(authenticity, toneRoll)], itemVariantRoll),
    sellerBehaviorClue: pickVariant(
      CUSTOMER_CONFIG.customerBehaviorClues[type], behaviorVariantRoll,
    ),
  };
}

function pickVariant(variants: readonly string[], roll: number): string {
  const normalized = Math.min(0.999, Math.max(0, roll));
  return variants[Math.floor(normalized * variants.length)] ?? variants[0]!;
}

type RandomSource = () => number;

/**
 * 하루 동안 같은 손님과 같은 물건이 다시 나오지 않도록,
 * 오늘 이미 등장한 이름·물건 목록을 받아 추첨에서 제외한다.
 * 남은 후보가 없으면(물건 종류보다 손님 수가 많은 경우) 중복을 허용한다.
 */
export function createCustomer(
  stage = 1, random: RandomSource = Math.random, profiles = new CustomerProfileStore(),
  usedCustomerNames: readonly string[] = [],
  usedItemIds: readonly string[] = [],
): Customer {
  const item = pickCustomerItem(stage, random, usedItemIds);
  const nextCustomerNames = CUSTOMER_NAMES.filter((name) => !usedCustomerNames.includes(name));
  const name = pick(nextCustomerNames.length > 0 ? nextCustomerNames : CUSTOMER_NAMES, random);
  const askingRatio = between(
    TRADE_BALANCE.initialAskingPriceRatio.min,
    TRADE_BALANCE.initialAskingPriceRatio.max,
    random,
  );
  const initialAskingPrice = roundToHundred(item.basePrice * askingRatio);
  const profile = profiles.profile(name);
  const discountRatioRange = TRADE_BALANCE.acceptableDiscountRatioByType[profile.type];
  const acceptableDiscountRatio = between(discountRatioRange.min, discountRatioRange.max, random)
    + trustDiscountRatioAdjustment(profile.trust);
  const minAcceptablePrice = Math.min(
    roundToHundred(initialAskingPrice * (1 - acceptableDiscountRatio)),
    initialAskingPrice - 100,
  );

  const id = `${name}-${item.id}-${Math.floor(random() * 1_000_000)}`;
  const authenticity = determineAuthenticity(stage, item, random, CUSTOMER_CONFIG.fakeChanceOffsets[profile.type]);
  return {
    id,
    name,
    item,
    initialAskingPrice,
    minAcceptablePrice,
    authenticity,
    type: profile.type,
    trust: profile.trust,
    ...customerObservationClues(
      item, profile.type, authenticity,
      determineClueRoll(id, TONE_ROLL_SEED),
      determineClueRoll(id, ITEM_VARIANT_ROLL_SEED),
      determineClueRoll(id, BEHAVIOR_VARIANT_ROLL_SEED),
    ),
  };
}

/**
 * 어조·물건 문장·손님 문장은 서로 독립적으로 나와야 한다.
 * 문자 코드 합만 쓰면 씨앗을 바꿔도 값이 일정하게 밀려 세 값이 붙어 다니므로,
 * 씨앗을 초깃값으로 넣고 곱셈을 섞어 흩는다.
 */
const TONE_ROLL_SEED = 17;
const ITEM_VARIANT_ROLL_SEED = 8_191;
const BEHAVIOR_VARIANT_ROLL_SEED = 65_521;

function determineClueRoll(id: string, seed: number): number {
  let hash = seed;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) % 100_003;
  return (hash % 1_000) / 1_000;
}

function observationTone(authenticity: Authenticity, clueRoll: number): ItemObservationTone {
  const normalizedRoll = Math.min(0.999, Math.max(0, clueRoll));
  if (normalizedRoll < ITEM_OBSERVATION_BALANCE.matchingToneChance) {
    return authenticity === 'genuine' ? 'natural' : 'suspicious';
  }
  if (normalizedRoll < ITEM_OBSERVATION_BALANCE.matchingToneChance
    + ITEM_OBSERVATION_BALANCE.ambiguousToneChance) return 'ambiguous';
  return authenticity === 'genuine' ? 'suspicious' : 'natural';
}

function pickCustomerItem(
  stage: number, random: RandomSource, usedItemIds: readonly string[] = [],
): ItemSeed {
  const roll = random();
  let cumulative = 0;
  let rarity: keyof typeof RARITY_CONFIG.weights = 'common';
  for (const candidate of Object.keys(RARITY_CONFIG.weights) as (keyof typeof RARITY_CONFIG.weights)[]) {
    cumulative += RARITY_CONFIG.weights[candidate];
    if (roll < cumulative) { rarity = candidate; break; }
  }
  // 아트가 없는 물건은 거래 화면에서 그림 없이 뜨므로 등장 가능한 목록에서만 뽑는다.
  const stageItems = playableItemsForStage(stage);
  const nonRepeatingItems = stageItems.filter((item) => !usedItemIds.includes(item.id));
  const availableItems = nonRepeatingItems.length > 0 ? nonRepeatingItems : stageItems;
  const rarityItems = availableItems.filter((item) => item.rarity === rarity);
  return pick(rarityItems.length > 0 ? rarityItems : availableItems, random);
}

function pick<T>(values: readonly T[], random: RandomSource): T {
  return values[Math.min(values.length - 1, Math.floor(random() * values.length))]!;
}

function between(min: number, max: number, random: RandomSource): number {
  return min + (max - min) * random();
}

function roundToHundred(value: number): number {
  return Math.max(100, Math.round(value / 100) * 100);
}
