import { describe, expect, it } from 'vitest';
import {
  AUTHENTICITY_CONFIG, FAKE_RISK_LABELS, fakeRiskByCategory, fakeRiskLabelByCategory,
} from '@/config/authenticityConfig';
import {
  ITEM_CATEGORIES, STAGE_ONE_ITEMS, TRADE_BALANCE, type ItemCategory,
} from '@/config/tradeConfig';
import { determineAuthenticity, fakeDisposalPrice } from '@/item/authenticity';

describe('determineAuthenticity', () => {
  it('STAGE 1부터 카테고리 확률 경계 안이면 가품, 경계부터 진품이다', () => {
    for (const category of ITEM_CATEGORIES) {
      const item = STAGE_ONE_ITEMS.find((candidate) => candidate.category === category)!;
      const chance = AUTHENTICITY_CONFIG.fakeChanceByCategory[category];
      expect(determineAuthenticity(1, item, () => chance - Number.EPSILON)).toBe('fake');
      expect(determineAuthenticity(1, item, () => chance)).toBe('genuine');
    }
  });

  it('가품 처분가는 기준가의 고정 비율를 config 단위로 반올림한다', () => {
    for (const item of STAGE_ONE_ITEMS) {
      expect(fakeDisposalPrice(item)).toBe(Math.round(item.basePrice * AUTHENTICITY_CONFIG.fakeDisposalRatio / 100) * 100);
    }
  });
});

describe('가품 경제 불변식', () => {
  const CATEGORIES = Object.keys(AUTHENTICITY_CONFIG.fakeChanceByCategory) as ItemCategory[];

  /** 시세 평균 배수가 1.0이므로 물건의 기대 가치는 기준가 x (1 - (1-처분비율) x 가품확률)이다. */
  function breakEvenRatio(category: ItemCategory): number {
    const fake = AUTHENTICITY_CONFIG.fakeChanceByCategory[category];
    return 1 - (1 - AUTHENTICITY_CONFIG.fakeDisposalRatio) * fake;
  }

  it('평균 손익분기 매입가는 손님의 일반적인 최저 수용가보다 높다', () => {
    // 이 조건이 깨지면 최저가까지 흥정해도 평균 손해가 되어 거래할수록 돈을 잃는다.
    const meanBreakEven = CATEGORIES.reduce((sum, c) => sum + breakEvenRatio(c), 0) / CATEGORIES.length;
    // 최저 수용가 / 기준가의 일반적인 상한: 최초 제시가 배수 최대 x (최소 할인율 - 신뢰도 보정)
    const typicalFloorRatio = TRADE_BALANCE.initialAskingPriceRatio.max
      * (1 - TRADE_BALANCE.acceptableDiscountRatioByType.normal.min);

    expect(meanBreakEven).toBeGreaterThan(typicalFloorRatio + 0.05);
  });

  it('가품 확률이 높은 카테고리일수록 손익분기 매입가가 낮다', () => {
    const sorted = [...CATEGORIES]
      .sort((a, b) => AUTHENTICITY_CONFIG.fakeChanceByCategory[a] - AUTHENTICITY_CONFIG.fakeChanceByCategory[b]);
    const ratios = sorted.map(breakEvenRatio);

    ratios.forEach((ratio, index) => {
      if (index === 0) return;
      expect(ratio).toBeLessThanOrEqual(ratios[index - 1]!);
    });
  });

  it('모든 카테고리 가품 확률은 0과 0.5 사이다', () => {
    CATEGORIES.forEach((category) => {
      const fake = AUTHENTICITY_CONFIG.fakeChanceByCategory[category];
      expect(fake, category).toBeGreaterThan(0);
      expect(fake, category).toBeLessThan(0.5);
    });
  });
});

describe('위조 위험 정성 등급', () => {
  it('모든 카테고리에 등급이 붙는다', () => {
    const risk = fakeRiskLabelByCategory();

    ITEM_CATEGORIES.forEach((category) => {
      expect(FAKE_RISK_LABELS).toContain(risk[category]);
    });
  });

  it('세 등급이 모두 쓰이고 카테고리가 고르게 나뉜다', () => {
    const risk = fakeRiskLabelByCategory();
    const counts = FAKE_RISK_LABELS.map(
      (label) => ITEM_CATEGORIES.filter((category) => risk[category] === label).length,
    );

    counts.forEach((count) => expect(count).toBeGreaterThan(0));
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it('가품 확률이 높은 카테고리가 더 높은 등급을 받는다', () => {
    const risk = fakeRiskLabelByCategory();
    const rank = (category: ItemCategory) => FAKE_RISK_LABELS.indexOf(risk[category]);

    ITEM_CATEGORIES.forEach((a) => ITEM_CATEGORIES.forEach((b) => {
      const chance = AUTHENTICITY_CONFIG.fakeChanceByCategory;
      if (chance[a] < chance[b]) expect(rank(a), `${a} < ${b}`).toBeLessThanOrEqual(rank(b));
    }));
  });

  it('확률 숫자를 노출하지 않는다', () => {
    const risk = fakeRiskLabelByCategory();

    Object.values(risk).forEach((label) => expect(label).not.toMatch(/[0-9%]/));
  });

  it('화면에 그릴 순서는 위험이 낮은 카테고리부터다', () => {
    const ordered = fakeRiskByCategory();
    const chance = AUTHENTICITY_CONFIG.fakeChanceByCategory;

    ordered.forEach((entry, index) => {
      if (index === 0) return;
      expect(chance[entry.category]).toBeGreaterThanOrEqual(chance[ordered[index - 1]!.category]);
    });
    expect(ordered.map((entry) => entry.category)).toHaveLength(ITEM_CATEGORIES.length);
  });
});
