import { describe, expect, it } from 'vitest';
import { BAG_MERCHANT_CONFIG } from '@/config/bagMerchantConfig';
import { STAGE_ONE_ITEMS } from '@/config/tradeConfig';
import { BagMerchant } from '@/merchant/bagMerchant';

describe('BagMerchant', () => {
  it('보유 후보 전체에 중복 없는 40~180% 범위의 100원 단위 제안가를 만든다', () => {
    const merchant = new BagMerchant(BAG_MERCHANT_CONFIG, () => 0.5);
    merchant.startVisit(STAGE_ONE_ITEMS);
    expect(merchant.offers).toHaveLength(STAGE_ONE_ITEMS.length);
    expect(new Set(merchant.offers.map((offer) => offer.item.id)).size).toBe(STAGE_ONE_ITEMS.length);
    for (const offer of merchant.offers) {
      expect(offer.price).toBeGreaterThanOrEqual(offer.item.basePrice * 0.4);
      expect(offer.price).toBeLessThanOrEqual(offer.item.basePrice * 1.8);
      expect(offer.price % 100).toBe(0);
    }
  });

  it('방문 중 제안을 고정하고 종료 뒤 다시 시작하지 못한다', () => {
    const merchant = new BagMerchant(BAG_MERCHANT_CONFIG, () => 0);
    merchant.startVisit(STAGE_ONE_ITEMS);
    const offers = merchant.offers;
    expect(merchant.offers).toEqual(offers);
    merchant.finishVisit();
    expect(merchant.status).toBe('finished');
    expect(() => merchant.startVisit(STAGE_ONE_ITEMS)).toThrow('한 번만');
  });

  it('보유 종류가 5개보다 적거나 없어도 방문하고 가진 종류만 제안한다', () => {
    const merchant = new BagMerchant(BAG_MERCHANT_CONFIG, () => 0);
    merchant.startVisit(STAGE_ONE_ITEMS.slice(0, 4));
    expect(merchant.offers).toHaveLength(4);

    const emptyMerchant = new BagMerchant(BAG_MERCHANT_CONFIG, () => 0);
    emptyMerchant.startVisit([]);
    expect(emptyMerchant.offers).toEqual([]);
  });

  it('동일한 물건을 여러 개 보유해도 종류별 제안은 하나만 만든다', () => {
    const merchant = new BagMerchant(BAG_MERCHANT_CONFIG, () => 0);
    merchant.startVisit([STAGE_ONE_ITEMS[0]!, STAGE_ONE_ITEMS[0]!, STAGE_ONE_ITEMS[1]!]);
    expect(merchant.offers.map((offer) => offer.item.id)).toHaveLength(2);
  });
});
