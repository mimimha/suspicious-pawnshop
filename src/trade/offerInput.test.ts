import { describe, expect, it } from 'vitest';
import { adjustOfferAmount, OFFER_ADJUSTMENT_STEP } from '@/trade/offerInput';

describe('제안가 증감', () => {
  it('위·아래 조작은 정확히 100원씩 움직인다', () => {
    expect(adjustOfferAmount(10_000, OFFER_ADJUSTMENT_STEP)).toBe(10_100);
    expect(adjustOfferAmount(10_000, -OFFER_ADJUSTMENT_STEP)).toBe(9_900);
  });

  it('제안가는 0원 아래로 내려가지 않는다', () => {
    expect(adjustOfferAmount(0, -OFFER_ADJUSTMENT_STEP)).toBe(0);
    expect(adjustOfferAmount(50, -OFFER_ADJUSTMENT_STEP)).toBe(0);
  });
});
