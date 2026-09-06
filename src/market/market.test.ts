import { describe, expect, it } from 'vitest';
import { AUTHENTICITY_CONFIG } from '@/config/authenticityConfig';
import { Market } from '@/market/market';
import { MARKET_CONFIG } from '@/config/marketConfig';
import { ITEM_CATEGORIES, STAGE_ONE_ITEMS } from '@/config/tradeConfig';

describe('Market', () => {
  it.each([0, 0.999999])('난수 %s에서 모든 카테고리가 config 범위 안이다', (random) => {
    const market = new Market(() => random);
    market.updateForDay(1);
    for (const category of ITEM_CATEGORIES) {
      const range = MARKET_CONFIG.ranges[MARKET_CONFIG.categoryTypes[category]];
      expect(market.multiplier(category)).toBeGreaterThanOrEqual(range.min);
      expect(market.multiplier(category)).toBeLessThanOrEqual(range.max);
    }
  });

  it('같은 DAY 중복 갱신은 값을 바꾸지 않는다', () => {
    let value = 0;
    const market = new Market(() => value++ / 100);
    expect(market.updateForDay(1)).toBe(true);
    const before = market.multiplier('전자기기');
    expect(market.updateForDay(1)).toBe(false);
    expect(market.multiplier('전자기기')).toBe(before);
  });

  it('DAY 1은 모든 카테고리가 보통이다', () => {
    const market = new Market(() => 0.5);
    market.updateForDay(1);
    for (const category of ITEM_CATEGORIES) expect(market.trend(category)).toBe('normal');
  });

  it('전날 대비 하락, 보통, 상승을 판정한다', () => {
    const values = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0, 0.55, 1, 0.5, 0.5, 0.5];
    const market = new Market(() => values.shift()!);
    market.updateForDay(1);
    market.updateForDay(2);
    expect(market.trend('전자기기')).toBe('down');
    expect(market.trend('액세서리')).toBe('normal');
    expect(market.trend('수집품')).toBe('up');
  });

  it('판매가를 config 단위로 반올림한다', () => {
    const market = new Market(() => 0.333);
    market.updateForDay(1);
    const price = market.salePrice(STAGE_ONE_ITEMS[0]!);
    expect(price % MARKET_CONFIG.priceRoundingUnit).toBe(0);
  });

  it('가품 판매가는 시세와 무관하게 기준가의 고정 비율다', () => {
    const low = new Market(() => 0);
    const high = new Market(() => 0.999999);
    low.updateForDay(1);
    high.updateForDay(1);
    const item = STAGE_ONE_ITEMS[0]!;
    expect(low.salePrice(item, 'fake')).toBe(item.basePrice * AUTHENTICITY_CONFIG.fakeDisposalRatio);
    expect(high.salePrice(item, 'fake')).toBe(low.salePrice(item, 'fake'));
  });

  it('공개한 다음 DAY 판매가를 다음 갱신에서 그대로 적용한다', () => {
    let value = 0;
    const market = new Market(() => (value++ % 10) / 10);
    market.updateForDay(1);
    const item = STAGE_ONE_ITEMS[0]!;
    const preview = market.nextDaySalePrice(item);
    market.updateForDay(2);
    expect(market.salePrice(item)).toBe(preview);
  });

  it('가품의 다음 DAY 가격도 고정 처분가다', () => {
    const market = new Market(() => 0.9);
    market.updateForDay(1);
    const item = STAGE_ONE_ITEMS[0]!;
    expect(market.nextDaySalePrice(item, 'fake')).toBe(market.salePrice(item, 'fake'));
  });

  it('가품 최근 시세는 진품과 같은 DAY 수를 고정 처분가 수평선으로 반환한다', () => {
    const market = new Market(() => 0.9);
    market.updateForDay(1);
    market.updateForDay(2);
    market.updateForDay(3);
    const item = STAGE_ONE_ITEMS[0]!;
    const fixedPrice = market.salePrice(item, 'fake');

    expect(market.recentSalePrices(item, 'fake')).toEqual([
      fixedPrice, fixedPrice, fixedPrice,
    ]);
    expect(market.recentSalePrices(item, 'fake')).toHaveLength(
      market.recentSalePrices(item, 'genuine').length,
    );
  });
});
