import { describe, expect, it } from 'vitest';
import { AUTHENTICITY_CONFIG } from '@/config/authenticityConfig';
import { Inventory } from '@/inventory/inventory';
import { DailyLedger } from '@/ledger/dailyLedger';
import { Market } from '@/market/market';
import { sellItem } from '@/market/sale';
import { GameState } from '@/state/gameState';
import { STAGE_ONE_ITEMS } from '@/config/tradeConfig';

describe('sellItem', () => {
  it('해당 재고만 제거하고 현금과 장부를 판매가만큼 증가시킨다', () => {
    const state = new GameState({
      daysPerStage: 3, dayDurationSeconds: 10, startingMoney: 1_000,
      stageRents: [1_000, 2_000], stageProfitGoals: [0, 0], finalDemoStage: 2,
    });
    const inventory = new Inventory(2);
    const sold = inventory.add(STAGE_ONE_ITEMS[0]!, 7_000);
    const kept = inventory.add(STAGE_ONE_ITEMS[1]!, 5_000);
    const ledger = new DailyLedger();
    const market = new Market(() => 0.5);
    market.updateForDay(1);
    const result = sellItem(state, inventory, market, ledger, sold.instanceId);
    expect(inventory.items.map((item) => item.instanceId)).toEqual([kept.instanceId]);
    expect(state.money).toBe(1_000 + result.salePrice);
    expect(ledger.salesRevenue).toBe(result.salePrice);
    expect(result.profit).toBe(result.salePrice - 7_000);
  });

  it('같은 물건은 두 번 판매할 수 없다', () => {
    const state = new GameState();
    const inventory = new Inventory(1);
    const owned = inventory.add(STAGE_ONE_ITEMS[0]!, 7_000);
    const ledger = new DailyLedger();
    const market = new Market(() => 0.5);
    market.updateForDay(1);
    sellItem(state, inventory, market, ledger, owned.instanceId);
    expect(() => sellItem(state, inventory, market, ledger, owned.instanceId)).toThrow('찾을 수 없다');
  });

  it('가품은 시세 대신 기준가의 고정 비율로 판매한다', () => {
    const state = new GameState();
    const inventory = new Inventory(1);
    const item = STAGE_ONE_ITEMS[0]!;
    const owned = inventory.add(item, 7_000, 'fake');
    const ledger = new DailyLedger();
    const market = new Market(() => 0.999999);
    market.updateForDay(1);
    const result = sellItem(state, inventory, market, ledger, owned.instanceId);
    expect(result.salePrice).toBe(item.basePrice * AUTHENTICITY_CONFIG.fakeDisposalRatio);
  });
});
