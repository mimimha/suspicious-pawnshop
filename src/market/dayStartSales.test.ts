import { describe, expect, it } from 'vitest';
import { shouldOpenDayStartSales } from '@/market/dayStartSales';

describe('shouldOpenDayStartSales', () => {
  it('새 게임 STAGE 1 DAY 1에 재고가 없으면 판매 단계를 생략한다', () => {
    expect(shouldOpenDayStartSales(1, 1, 0)).toBe(false);
  });

  it('첫날이라도 판매할 재고가 있으면 판매 단계를 연다', () => {
    expect(shouldOpenDayStartSales(1, 1, 1)).toBe(true);
  });

  it('다음 DAY와 STAGE에서는 재고가 비어 있어도 기존 판매 단계를 유지한다', () => {
    expect(shouldOpenDayStartSales(1, 2, 0)).toBe(true);
    expect(shouldOpenDayStartSales(2, 1, 0)).toBe(true);
  });
});
