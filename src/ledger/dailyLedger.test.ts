import { describe, expect, it } from 'vitest';
import { DailyLedger } from '@/ledger/dailyLedger';

describe('DailyLedger', () => {
  it('여러 구매의 건수, 비용, 현금 변동을 집계한다', () => {
    const ledger = new DailyLedger();
    ledger.recordPurchase('카메라', 8_000);
    ledger.recordPurchase('시계', 5_000);
    expect(ledger.purchaseCount).toBe(2);
    expect(ledger.purchaseExpense).toBe(13_000);
    expect(ledger.netCashChange).toBe(-13_000);
  });

  it('장부 합계와 실제 마감 현금이 일치하는 명세서를 만든다', () => {
    const ledger = new DailyLedger();
    ledger.recordPurchase('카메라', 8_000);
    expect(ledger.statement(50_000, 42_000)).toEqual({
      purchaseCount: 1,
      purchaseExpense: 8_000,
      itemPurchaseExpense: 0,
      hospitalExpense: 0,
      saleCount: 0,
      salesRevenue: 0,
      merchantSaleCount: 0,
      merchantSalesRevenue: 0,
      realizedProfit: 0,
      bestRealizedProfit: null,
      worstRealizedProfit: null,
      rentExpense: 0,
      netCashChange: -8_000,
      openingMoney: 50_000,
      closingMoney: 42_000,
    });
  });

  it('일반 판매와 상인 판매의 실현 손익 범위를 집계한다', () => {
    const ledger = new DailyLedger();
    ledger.recordSale('카메라', 12_000, 8_000);
    ledger.recordMerchantSale('시계', 3_000, 5_000);
    expect(ledger.realizedProfit).toBe(2_000);
    expect(ledger.statement(50_000, 65_000)).toMatchObject({
      realizedProfit: 2_000,
      bestRealizedProfit: 4_000,
      worstRealizedProfit: -2_000,
    });
  });

  it('손실 거래가 없으면 최대 손실을 만들지 않는다', () => {
    const ledger = new DailyLedger();
    ledger.recordSale('카메라', 12_000, 8_000);
    expect(ledger.statement(50_000, 62_000).worstRealizedProfit).toBeNull();
  });

  it('월세를 한 번만 비용으로 기록한다', () => {
    const ledger = new DailyLedger();
    ledger.recordMerchantSale('시계', 30_000);
    ledger.recordRent(25_000);
    expect(ledger.rentExpense).toBe(25_000);
    expect(ledger.netCashChange).toBe(5_000);
    expect(() => ledger.recordRent(25_000)).toThrow('한 번만');
  });

  it('아이템 구매를 물건 매입과 구분해 비용에 포함한다', () => {
    const ledger = new DailyLedger();
    ledger.recordItemPurchase('감정권', 3_000);
    expect(ledger.purchaseCount).toBe(0);
    expect(ledger.itemPurchaseExpense).toBe(3_000);
    expect(ledger.netCashChange).toBe(-3_000);
  });

  it('병원비를 별도 비용으로 집계한다', () => {
    const ledger = new DailyLedger();
    ledger.recordHospital(3_000);
    expect(ledger.hospitalExpense).toBe(3_000);
    expect(ledger.netCashChange).toBe(-3_000);
  });

  it('보따리 상인 판매를 일반 판매와 구분하면서 순변동에 포함한다', () => {
    const ledger = new DailyLedger();
    ledger.recordSale('카메라', 12_000);
    ledger.recordMerchantSale('시계', 9_000);
    expect(ledger.saleCount).toBe(1);
    expect(ledger.merchantSaleCount).toBe(1);
    expect(ledger.salesRevenue).toBe(12_000);
    expect(ledger.merchantSalesRevenue).toBe(9_000);
    expect(ledger.netCashChange).toBe(21_000);
  });

  it('판매 수익에서 매입 비용을 뺀 순변동을 계산한다', () => {
    const ledger = new DailyLedger();
    ledger.recordSale('카메라', 12_000);
    ledger.recordPurchase('시계', 5_000);
    expect(ledger.saleCount).toBe(1);
    expect(ledger.salesRevenue).toBe(12_000);
    expect(ledger.netCashChange).toBe(7_000);
    expect(ledger.statement(50_000, 57_000).closingMoney).toBe(57_000);
  });

  it('장부와 실제 현금 변동이 다르면 명세서를 거부한다', () => {
    const ledger = new DailyLedger();
    ledger.recordPurchase('카메라', 8_000);
    expect(() => ledger.statement(50_000, 40_000)).toThrow('일치하지 않는다');
  });

  it('DEV 지급금 같은 외부 현금 조정은 영업 손익 검증에서 제외한다', () => {
    const ledger = new DailyLedger();
    ledger.recordPurchase('카메라', 8_000);
    const statement = ledger.statement(50_000, 92_000, 50_000);
    expect(statement.netCashChange).toBe(-8_000);
    expect(statement.closingMoney).toBe(92_000);
  });

  it('DAY 시작 판매와 DEV 지급금이 함께 있어도 DAY 진입 현금을 기준으로 정산한다', () => {
    const ledger = new DailyLedger();
    ledger.recordSale('라디오', 12_000, 8_000);
    ledger.recordItemPurchase('시세 수첩', 3_000);

    const statement = ledger.statement(50_000, 109_000, 50_000);

    expect(statement.salesRevenue).toBe(12_000);
    expect(statement.itemPurchaseExpense).toBe(3_000);
    expect(statement.netCashChange).toBe(9_000);
    expect(statement.realizedProfit).toBe(4_000);
  });

  it('STAGE 마지막 DAY의 상인 판매·아이템 구매·월세·DEV 지급금을 함께 정산한다', () => {
    const ledger = new DailyLedger();
    ledger.recordMerchantSale('회중시계', 15_000, 10_000);
    ledger.recordItemPurchase('방어 부적', 6_000);
    ledger.recordRent(24_000);

    const statement = ledger.statement(50_000, 85_000, 50_000);

    expect(statement.merchantSalesRevenue).toBe(15_000);
    expect(statement.itemPurchaseExpense).toBe(6_000);
    expect(statement.rentExpense).toBe(24_000);
    expect(statement.netCashChange).toBe(-15_000);
    expect(statement.realizedProfit).toBe(5_000);
  });

  it('초기화하면 다음 DAY는 빈 장부로 시작한다', () => {
    const ledger = new DailyLedger();
    ledger.recordPurchase('카메라', 8_000);
    ledger.reset();
    expect(ledger.purchaseCount).toBe(0);
    expect(ledger.purchaseExpense).toBe(0);
    expect(ledger.entries).toEqual([]);
  });
});
