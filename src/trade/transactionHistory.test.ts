import { describe, expect, it } from 'vitest';
import { calculateHoldingDays, TransactionHistory } from '@/trade/transactionHistory';
import { Inventory } from '@/inventory/inventory';
import { STAGE_ONE_ITEMS } from '@/config/tradeConfig';

describe('TransactionHistory', () => {
  it('보유일을 매입 DAY부터 판매 DAY까지 경과한 날짜 차이로 계산한다', () => {
    expect(calculateHoldingDays({ stage: 1, day: 1 }, { stage: 1, day: 2 }, 3)).toBe(1);
    expect(calculateHoldingDays({ stage: 1, day: 2 }, { stage: 1, day: 2 }, 3)).toBe(0);
    expect(calculateHoldingDays({ stage: 1, day: 3 }, { stage: 2, day: 1 }, 3)).toBe(1);
  });

  it('매입 정보와 판매 결과를 같은 기록에서 비교한다', () => {
    const inventory = new Inventory(1);
    const owned = inventory.add(STAGE_ONE_ITEMS[0]!, 10_000, 'genuine', {
      stage: 1, day: 1, authenticityKnown: true,
    });
    const history = new TransactionHistory();
    history.recordPurchase(owned);
    history.recordSale(owned, 18_000, 1, '일반 판매');
    expect(history.entries[0]).toMatchObject({ salePrice: 18_000, profit: 8_000, holdingDays: 1 });
    expect(history.averageProfit).toBe(8_000);
    expect(history.profitCount).toBe(1);
    expect(history.lossCount).toBe(0);
  });

  it('시세 확인 정보가 판매 후에도 같은 거래 기록에 남는다', () => {
    const inventory = new Inventory(1);
    const owned = inventory.add(STAGE_ONE_ITEMS[0]!, 10_000, 'genuine', {
      stage: 1, day: 1, authenticityKnown: false,
    });
    const history = new TransactionHistory();
    history.recordPurchase(owned);
    history.recordMarketCheck(owned.instanceId, { stage: 1, day: 2, nextDaySalePrice: 19_000 });
    history.recordSale(owned, 18_000, 1, '일반 판매');

    expect(history.entries[0]?.marketCheck).toEqual({
      stage: 1, day: 2, nextDaySalePrice: 19_000,
    });
  });
});

describe('기록 목록 표시 순서', () => {
  /** 시세 장부는 이 목록의 마지막 5건을 위에서 아래로 그린다. */
  function visibleRows(history: TransactionHistory): string[] {
    return history.entries.slice(-5).map((entry) => entry.itemName);
  }

  function purchase(history: TransactionHistory, index: number): void {
    const inventory = new Inventory(1);
    const owned = inventory.add(
      { ...STAGE_ONE_ITEMS[0]!, name: `물건${index}` }, 1_000, 'genuine',
      { stage: 1, day: 1, authenticityKnown: false },
    );
    history.recordPurchase(owned);
  }

  it('기록은 오래된 순으로 쌓인다', () => {
    const history = new TransactionHistory();
    [1, 2, 3].forEach((index) => purchase(history, index));

    expect(visibleRows(history)).toEqual(['물건1', '물건2', '물건3']);
  });

  it('다섯 줄이 꽉 차면 맨 위가 밀려 나가고 새 기록이 맨 아래에 들어간다', () => {
    const history = new TransactionHistory();
    [1, 2, 3, 4, 5].forEach((index) => purchase(history, index));
    expect(visibleRows(history)).toEqual(['물건1', '물건2', '물건3', '물건4', '물건5']);

    purchase(history, 6);

    // 물건1이 사라지고 나머지가 한 칸씩 올라가며 물건6이 마지막 줄에 들어간다.
    expect(visibleRows(history)).toEqual(['물건2', '물건3', '물건4', '물건5', '물건6']);
  });

  it('여러 건이 더 들어와도 항상 최근 다섯 건만 순서대로 남는다', () => {
    const history = new TransactionHistory();
    Array.from({ length: 9 }, (_, index) => index + 1).forEach((index) => purchase(history, index));

    expect(visibleRows(history)).toEqual(['물건5', '물건6', '물건7', '물건8', '물건9']);
  });
});

