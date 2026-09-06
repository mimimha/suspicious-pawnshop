import { describe, expect, it } from 'vitest';
import { createCustomer, customerObservationClues } from '@/trade/customer';
import {
  ALL_ITEMS, CUSTOMER_NAMES, PLAYABLE_ITEMS, STAGE_ONE_ITEMS, TRADE_BALANCE,
} from '@/config/tradeConfig';
import { ITEM_OBSERVATION_CLUES } from '@/config/itemObservationConfig';
import { CUSTOMER_CONFIG } from '@/config/customerConfig';

/** STAGE 1에서 실제로 뽑힐 수 있는 물건(아트가 준비되고 stageMin이 1인 것). */
const STAGE_ONE_POOL = PLAYABLE_ITEMS.filter((item) => (item.stageMin ?? 1) <= 1);

function sequence(values: number[]): () => number {
  return () => values.shift() ?? 0;
}

describe('createCustomer authenticity', () => {
  it('STAGE 1부터 고객 생성 시 카테고리 확률로 진위를 확정한다', () => {
    const fake = createCustomer(1, sequence([0, 0, 0, 0, 0, 0, 0]));
    const genuine = createCustomer(1, sequence([0, 0, 0, 0, 0, 0, 0.99]));
    expect(fake.authenticity).toBe('fake');
    expect(genuine.authenticity).toBe('genuine');
  });

  it('진품과 가품 모두 같은 형식의 관찰 정보를 제공한다', () => {
    const item = STAGE_ONE_ITEMS[0]!;
    const genuine = customerObservationClues(item, 'honest', 'genuine', 0.1);
    const fake = customerObservationClues(item, 'fraudster', 'fake', 0.1);

    expect(genuine.itemConditionClue).toBeTruthy();
    expect(genuine.sellerBehaviorClue).toBeTruthy();
    expect(fake.itemConditionClue).toBeTruthy();
    expect(fake.sellerBehaviorClue).toBeTruthy();
  });

  it('관찰 단서는 일치·중립·오해 가능성을 모두 가진다', () => {
    const item = STAGE_ONE_ITEMS[0]!;
    const genuineMatching = customerObservationClues(item, 'normal', 'genuine', 0.1);
    const fakeMatching = customerObservationClues(item, 'normal', 'fake', 0.1);
    const genuineAmbiguous = customerObservationClues(item, 'normal', 'genuine', 0.7);
    const fakeAmbiguous = customerObservationClues(item, 'normal', 'fake', 0.7);
    const genuineMisleading = customerObservationClues(item, 'normal', 'genuine', 0.9);
    const fakeMisleading = customerObservationClues(item, 'normal', 'fake', 0.9);

    expect(genuineMatching.itemConditionClue).not.toBe(fakeMatching.itemConditionClue);
    expect(genuineAmbiguous.itemConditionClue).toBe(fakeAmbiguous.itemConditionClue);
    expect(genuineMisleading.itemConditionClue).toBe(fakeMatching.itemConditionClue);
    expect(fakeMisleading.itemConditionClue).toBe(genuineMatching.itemConditionClue);
  });
});

describe('createCustomer visit order', () => {
  it('오늘 이미 방문한 손님은 이름 추첨에서 모두 제외한다', () => {
    const visited = [CUSTOMER_NAMES[0], CUSTOMER_NAMES[1], CUSTOMER_NAMES[2]];
    const customer = createCustomer(
      1,
      sequence([0, 0, 0, 0, 0, 0]),
      undefined,
      visited,
    );

    expect(visited).not.toContain(customer.name);
    expect(customer.name).toBe(CUSTOMER_NAMES[3]);
  });

  it('오늘 이미 나온 물건은 물건 추첨에서 모두 제외한다', () => {
    const shown = ['old-coin-set', 'antique-lighter'];
    // 굴림이 모두 0이면 희귀도는 common, 그 안에서 첫 후보가 뽑힌다.
    // 카탈로그가 늘어도 깨지지 않도록 기대값을 목록에서 직접 구한다.
    const expected = STAGE_ONE_POOL
      .find((item) => item.rarity === 'common' && !shown.includes(item.id))!;
    const customer = createCustomer(
      1,
      sequence([0, 0, 0, 0, 0, 0]),
      undefined,
      [],
      shown,
    );

    expect(shown).not.toContain(customer.item.id);
    expect(customer.item.id).toBe(expected.id);
  });

  it('후보가 모두 소진되면 중복을 허용해서라도 손님을 만든다', () => {
    const customer = createCustomer(
      1,
      sequence([0, 0, 0, 0, 0, 0]),
      undefined,
      [...CUSTOMER_NAMES],
      STAGE_ONE_POOL.map((item) => item.id),
    );

    expect(customer.name).toBe(CUSTOMER_NAMES[0]);
    expect(STAGE_ONE_POOL.map((item) => item.id)).toContain(customer.item.id);
  });

  it('아트가 없는 물건은 손님이 들고 나오지 않는다', () => {
    const artless = ALL_ITEMS.filter((item) => !item.artReady).map((item) => item.id);
    const drawn = Array.from({ length: 200 }, (_, index) => createCustomer(
      2, sequence([index / 200, index / 200, 0, 0, 0, 0, 0]),
    ).item.id);

    expect(drawn.length).toBe(200);
    artless.forEach((id) => expect(drawn).not.toContain(id));
  });
});

describe('createCustomer negotiation balance', () => {
  it('기본 신뢰도에서 손님 유형별 희망가 할인율을 최저 수용가에 적용한다', () => {
    const minimumDiscount = createCustomer(1, sequence([0, 0, 0, 0, 0, 0, 0]));
    const maximumDiscount = createCustomer(1, sequence([0, 0, 0, 0, 1, 0, 0]));

    expect(minimumDiscount.type).toBe('honest');
    const honestRange = TRADE_BALANCE.acceptableDiscountRatioByType.honest;
    expect(minimumDiscount.initialAskingPrice - minimumDiscount.minAcceptablePrice)
      .toBe(Math.round(minimumDiscount.initialAskingPrice * honestRange.min / 100) * 100);
    expect(maximumDiscount.initialAskingPrice - maximumDiscount.minAcceptablePrice)
      .toBe(Math.round(maximumDiscount.initialAskingPrice * honestRange.max / 100) * 100);
  });

  it('최초 희망가는 기준가의 100~115% 범위다', () => {
    const minimum = createCustomer(1, sequence([0, 0, 0, 0, 0, 0, 0]));
    const maximum = createCustomer(1, sequence([0, 0, 0, 1, 0, 0, 0]));

    expect(minimum.initialAskingPrice).toBe(minimum.item.basePrice);
    expect(maximum.initialAskingPrice).toBe(Math.round(maximum.item.basePrice * 1.15 / 100) * 100);
  });
});

describe('관찰 단서 카탈로그', () => {
  it('카탈로그의 모든 물건이 세 어조의 단서를 갖는다', () => {
    ALL_ITEMS.forEach((item) => {
      const clues = ITEM_OBSERVATION_CLUES[item.id];
      expect(clues, `${item.id} 단서 누락`).toBeDefined();
      (['natural', 'ambiguous', 'suspicious'] as const).forEach((tone) => {
        expect(clues![tone].length, `${item.id} ${tone}`).toBeGreaterThanOrEqual(3);
        clues![tone].forEach((line) => expect(line.trim().length).toBeGreaterThan(0));
      });
    });
  });

  it('같은 어조 안에서도 변형 굴림에 따라 다른 문장이 나온다', () => {
    const item = STAGE_ONE_ITEMS[0]!;
    const lines = [0, 0.5, 0.99].map(
      (variantRoll) => customerObservationClues(item, 'normal', 'genuine', 0.1, variantRoll).itemConditionClue,
    );

    expect(new Set(lines).size).toBe(3);
  });

  it('손님 관찰 단서는 유형마다 여섯 문장을 모두 돌린다', () => {
    const item = STAGE_ONE_ITEMS[0]!;
    const rolls = [0, 0.17, 0.34, 0.51, 0.68, 0.85];

    (['honest', 'normal', 'suspicious', 'fraudster'] as const).forEach((type) => {
      expect(CUSTOMER_CONFIG.customerBehaviorClues[type].length, type).toBe(6);
      const lines = rolls.map(
        (roll) => customerObservationClues(item, type, 'fake', 0.1, 0, roll).sellerBehaviorClue,
      );
      expect(new Set(lines).size, type).toBe(6);
    });
  });

  it('물건 문장과 손님 문장은 굴림이 달라 짝이 고정되지 않는다', () => {
    const item = STAGE_ONE_ITEMS[0]!;
    const sameItemVariant = [0.1, 0.5, 0.9].map(
      (behaviorRoll) => customerObservationClues(item, 'normal', 'genuine', 0.1, 0, behaviorRoll),
    );

    expect(new Set(sameItemVariant.map((c) => c.itemConditionClue)).size).toBe(1);
    expect(new Set(sameItemVariant.map((c) => c.sellerBehaviorClue)).size).toBe(3);
  });

  it('한 판에서 같은 유형 손님이 여러 번 나와도 손님 문장이 한 가지로 굳지 않는다', () => {
    const lines = new Set(
      Array.from({ length: 60 }, (_, index) => createCustomer(
        1, sequence([0, 0, index / 60, 0, 0, index / 60, 0.99]),
      ).sellerBehaviorClue),
    );

    expect(lines.size).toBeGreaterThan(2);
  });

  it('같은 물건이라도 손님마다 단서 문장이 한 가지로 고정되지 않는다', () => {
    const clues = new Set(
      Array.from({ length: 40 }, (_, index) => createCustomer(
        1, sequence([0, 0, index / 40, 0, 0, index / 40, 0.99]),
      ).itemConditionClue),
    );

    expect(clues.size).toBeGreaterThan(1);
  });
});
