import { describe, expect, it } from 'vitest';
import { GameState, type GameState as GameStateType } from '@/state/gameState';
import { Inventory } from '@/inventory/inventory';
import { purchaseItem } from '@/inventory/purchase';
import { STAGE_ONE_ITEMS } from '@/config/tradeConfig';
import { DailyLedger } from '@/ledger/dailyLedger';

const ITEM = STAGE_ONE_ITEMS[0]!;

function stateWithMoney(money: number): GameStateType {
  return new GameState({
    daysPerStage: 3, dayDurationSeconds: 10, startingMoney: money,
    stageRents: [1_000, 2_000], stageProfitGoals: [0, 0], finalDemoStage: 2,
  });
}

describe('purchaseItem', () => {
  it('성공하면 현금 차감과 재고 추가가 함께 일어난다', () => {
    const state = stateWithMoney(20_000);
    const inventory = new Inventory(1);
    const result = purchaseItem(state, inventory, ITEM, 8_000);
    expect(result.success).toBe(true);
    expect(state.money).toBe(12_000);
    expect(inventory.size).toBe(1);
    expect(inventory.items[0]?.purchasePrice).toBe(8_000);
  });

  it('재고가 가득 차면 현금과 재고가 모두 변하지 않는다', () => {
    const state = stateWithMoney(20_000);
    const inventory = new Inventory(1);
    inventory.add(ITEM, 5_000);
    const result = purchaseItem(state, inventory, ITEM, 8_000);
    expect(result).toEqual({ success: false, reason: 'inventoryFull' });
    expect(state.money).toBe(20_000);
    expect(inventory.size).toBe(1);
  });

  it('성공한 구매만 장부에 기록한다', () => {
    const state = stateWithMoney(20_000);
    const inventory = new Inventory(1);
    const ledger = new DailyLedger();
    purchaseItem(state, inventory, ITEM, 8_000, ledger);
    const failed = purchaseItem(state, inventory, ITEM, 5_000, ledger);
    expect(failed.success).toBe(false);
    expect(ledger.purchaseCount).toBe(1);
    expect(ledger.purchaseExpense).toBe(8_000);
  });

  it('DAY가 바뀌어도 자금과 Inventory 객체의 내용은 유지할 수 있다', () => {
    const state = stateWithMoney(20_000);
    const inventory = new Inventory(2);
    purchaseItem(state, inventory, ITEM, 8_000);
    state.openShop();
    state.closeShop();
    state.advanceToNextDay();
    expect(state.money).toBe(12_000);
    expect(inventory.size).toBe(1);
  });

  it('구매한 물건의 진품·가품 결과를 재고 인스턴스에 저장한다', () => {
    const state = stateWithMoney(20_000);
    const inventory = new Inventory(2);
    purchaseItem(state, inventory, ITEM, 3_000, undefined, 'fake');
    purchaseItem(state, inventory, ITEM, 4_000, undefined, 'genuine');
    expect(inventory.items.map((owned) => owned.authenticity)).toEqual(['fake', 'genuine']);
  });
});
