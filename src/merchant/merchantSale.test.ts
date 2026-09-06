import { describe, expect, it } from 'vitest';
import { AUTHENTICITY_CONFIG } from '@/config/authenticityConfig';
import { GAME_BALANCE } from '@/config/gameBalance';
import { STAGE_ONE_ITEMS } from '@/config/tradeConfig';
import { Inventory } from '@/inventory/inventory';
import { DailyLedger } from '@/ledger/dailyLedger';
import { sellToMerchant } from '@/merchant/merchantSale';
import { GameState } from '@/state/gameState';

const ITEM = STAGE_ONE_ITEMS[0]!;
const OFFER = { item: ITEM, price: 27_000 };

describe('sellToMerchant', () => {
  it('같은 종류 중 가장 먼저 입고된 하나만 제거하고 현금과 장부를 반영한다', () => {
    const state = new GameState(GAME_BALANCE);
    const inventory = new Inventory();
    const ledger = new DailyLedger();
    const first = inventory.add(ITEM, 9_000);
    const second = inventory.add(ITEM, 10_000);
    const result = sellToMerchant(state, inventory, ledger, OFFER);
    expect(result.item).toEqual(first);
    expect(inventory.items).toEqual([second]);
    expect(state.money).toBe(GAME_BALANCE.startingMoney + OFFER.price);
    expect(ledger.merchantSaleCount).toBe(1);
    expect(ledger.merchantSalesRevenue).toBe(OFFER.price);
  });

  it('일치 재고가 없으면 아무 상태도 바꾸지 않는다', () => {
    const state = new GameState(GAME_BALANCE);
    const inventory = new Inventory();
    const ledger = new DailyLedger();
    expect(() => sellToMerchant(state, inventory, ledger, OFFER)).toThrow('보유하고 있지 않다');
    expect(state.money).toBe(GAME_BALANCE.startingMoney);
    expect(inventory.size).toBe(0);
    expect(ledger.entries).toEqual([]);
  });

  it('가품은 상인 제안가 대신 기준가의 고정 비율로 판매한다', () => {
    const state = new GameState(GAME_BALANCE);
    const inventory = new Inventory();
    const ledger = new DailyLedger();
    inventory.add(ITEM, 9_000, 'fake');
    const result = sellToMerchant(state, inventory, ledger, OFFER);
    expect(result.salePrice).toBe(ITEM.basePrice * AUTHENTICITY_CONFIG.fakeDisposalRatio);
    expect(state.money).toBe(GAME_BALANCE.startingMoney + ITEM.basePrice * AUTHENTICITY_CONFIG.fakeDisposalRatio);
  });
});
