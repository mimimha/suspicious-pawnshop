import { describe, expect, it } from 'vitest';
import { GAME_BALANCE } from '@/config/gameBalance';
import { ITEM_SHOP_CONFIG } from '@/config/itemShopConfig';
import { SpecialItemInventory } from '@/item/specialItemInventory';
import { DailyLedger } from '@/ledger/dailyLedger';
import { ItemShopVisit, shouldOpenItemShop } from '@/shop/itemShop';
import { GameState } from '@/state/gameState';

function createStageTwoState(): GameState {
  const state = new GameState({
    daysPerStage: 1,
    dayDurationSeconds: 1,
    startingMoney: GAME_BALANCE.startingMoney,
    stageRents: [0, 0],
    stageProfitGoals: [0, 0],
    finalDemoStage: 2,
  });
  state.openShop();
  state.closeShop();
  state.settleRent();
  state.advanceToNextStage();
  return state;
}

describe('item shop', () => {
  it('모든 STAGE의 모든 DAY 종료 후 연다', () => {
    expect(shouldOpenItemShop(1, 1, 3)).toBe(true);
    expect(shouldOpenItemShop(1, 3, 3)).toBe(true);
    expect(shouldOpenItemShop(2, 1, 3)).toBe(true);
    expect(shouldOpenItemShop(2, 2, 3)).toBe(true);
    expect(shouldOpenItemShop(2, 3, 3)).toBe(true);
  });

  it('방문당 한 장만 사고 현금·보유량·장부를 한 번 변경한다', () => {
    const state = createStageTwoState();
    const items = new SpecialItemInventory();
    const ledger = new DailyLedger();
    const visit = new ItemShopVisit();
    visit.buyAppraisalTicket(state, items, ledger);
    expect(state.money).toBe(GAME_BALANCE.startingMoney - ITEM_SHOP_CONFIG.appraisalTicketPrice);
    expect(items.appraisalTicketCount).toBe(1);
    expect(ledger.itemPurchaseExpense).toBe(ITEM_SHOP_CONFIG.appraisalTicketPrice);
    expect(() => visit.buyAppraisalTicket(state, items, ledger)).toThrow('이미 구매했다');
  });

  it('STAGE 1부터 감정권을 구매할 수 있다', () => {
    const state = new GameState();
    const items = new SpecialItemInventory();
    const ledger = new DailyLedger();

    new ItemShopVisit().buyAppraisalTicket(state, items, ledger);
    expect(state.money).toBe(GAME_BALANCE.startingMoney - ITEM_SHOP_CONFIG.appraisalTicketPrice);
    expect(items.appraisalTicketCount).toBe(1);
    expect(ledger.itemPurchaseExpense).toBe(ITEM_SHOP_CONFIG.appraisalTicketPrice);
  });

  it('현금이 부족하면 어느 상태도 변경하지 않는다', () => {
    const state = createStageTwoState();
    state.spendMoney(state.money - 2_000);
    const items = new SpecialItemInventory();
    const ledger = new DailyLedger();
    expect(() => new ItemShopVisit().buyAppraisalTicket(state, items, ledger)).toThrow('현금이 부족');
    expect(state.money).toBe(2_000);
    expect(items.appraisalTicketCount).toBe(0);
    expect(ledger.entries).toEqual([]);
  });

  it('같은 방문에서 두 종류를 각각 한 장씩 구매한다', () => {
    const state = createStageTwoState();
    const items = new SpecialItemInventory();
    const ledger = new DailyLedger();
    const visit = new ItemShopVisit();
    visit.buyAppraisalTicket(state, items, ledger);
    visit.buyMarketPreviewTicket(state, items, ledger);
    expect(items.appraisalTicketCount).toBe(1);
    expect(items.marketPreviewTicketCount).toBe(1);
    expect(ledger.itemPurchaseExpense).toBe(6_000);
    expect(() => visit.buyMarketPreviewTicket(state, items, ledger)).toThrow('이미 구매했다');
  });

  it('방어와 시간 증량 아이템도 품목별 한 개 구매한다', () => {
    const state = createStageTwoState();
    const items = new SpecialItemInventory();
    const ledger = new DailyLedger();
    const visit = new ItemShopVisit();
    visit.buyDefenseItem(state, items, ledger);
    visit.buyTimeExtensionItem(state, items, ledger);
    expect(items.defenseItemCount).toBe(1);
    expect(items.timeExtensionItemCount).toBe(1);
    expect(ledger.itemPurchaseExpense).toBe(6_000);
  });

  it('STAGE 1부터 감정 도구와 방어 아이템을 각각 구매할 수 있다', () => {
    const state = new GameState();
    const items = new SpecialItemInventory();
    const ledger = new DailyLedger();
    const visit = new ItemShopVisit();

    visit.buyAppraisalTicket(state, items, ledger);
    visit.buyDefenseItem(state, items, ledger);

    expect(state.money).toBe(GAME_BALANCE.startingMoney - 6_000);
    expect(items.appraisalTicketCount).toBe(1);
    expect(items.defenseItemCount).toBe(1);
    expect(ledger.itemPurchaseExpense).toBe(6_000);
  });

  it('STAGE 1부터 시세 수첩과 모래시계도 각각 구매할 수 있다', () => {
    const state = new GameState();
    const items = new SpecialItemInventory();
    const ledger = new DailyLedger();
    const visit = new ItemShopVisit();

    visit.buyMarketPreviewTicket(state, items, ledger);
    visit.buyTimeExtensionItem(state, items, ledger);

    expect(state.money).toBe(GAME_BALANCE.startingMoney - 6_000);
    expect(items.marketPreviewTicketCount).toBe(1);
    expect(items.timeExtensionItemCount).toBe(1);
    expect(ledger.itemPurchaseExpense).toBe(6_000);
  });
});
