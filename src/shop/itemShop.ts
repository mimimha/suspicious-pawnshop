import { ITEM_SHOP_CONFIG, SPECIAL_ITEM_PRESENTATION } from '@/config/itemShopConfig';
import { SpecialItemInventory } from '@/item/specialItemInventory';
import { DailyLedger } from '@/ledger/dailyLedger';
import { GameState } from '@/state/gameState';

export function shouldOpenItemShop(_stage: number, _day: number, _daysPerStage: number): boolean {
  return true;
}

export class ItemShopVisit {
  private appraisalPurchased = 0;
  private marketPreviewPurchased = 0;
  private defensePurchased = 0;
  private timeExtensionPurchased = 0;

  constructor(private readonly stock = ITEM_SHOP_CONFIG.appraisalTicketStockPerVisit) {}

  get remainingStock(): number { return this.stock - this.appraisalPurchased; }
  get remainingMarketPreviewStock(): number {
    return ITEM_SHOP_CONFIG.marketPreviewTicketStockPerVisit - this.marketPreviewPurchased;
  }
  get remainingDefenseStock(): number { return ITEM_SHOP_CONFIG.consumableStockPerVisit - this.defensePurchased; }
  get remainingTimeExtensionStock(): number {
    return ITEM_SHOP_CONFIG.consumableStockPerVisit - this.timeExtensionPurchased;
  }

  buyAppraisalTicket(
    state: GameState,
    items: SpecialItemInventory,
    ledger: DailyLedger,
  ): void {
    if (this.remainingStock <= 0) throw new Error('이번 방문의 감정권을 이미 구매했다.');
    if (state.money < ITEM_SHOP_CONFIG.appraisalTicketPrice) throw new Error('현금이 부족하다.');
    state.spendMoney(ITEM_SHOP_CONFIG.appraisalTicketPrice);
    items.addAppraisalTicket();
    ledger.recordItemPurchase(SPECIAL_ITEM_PRESENTATION.appraisal.name, ITEM_SHOP_CONFIG.appraisalTicketPrice);
    this.appraisalPurchased += 1;
  }

  buyMarketPreviewTicket(
    state: GameState,
    items: SpecialItemInventory,
    ledger: DailyLedger,
  ): void {
    if (this.remainingMarketPreviewStock <= 0) throw new Error('이번 방문의 시세 확인권을 이미 구매했다.');
    if (state.money < ITEM_SHOP_CONFIG.marketPreviewTicketPrice) throw new Error('현금이 부족하다.');
    state.spendMoney(ITEM_SHOP_CONFIG.marketPreviewTicketPrice);
    items.addMarketPreviewTicket();
    ledger.recordItemPurchase(SPECIAL_ITEM_PRESENTATION.market.name, ITEM_SHOP_CONFIG.marketPreviewTicketPrice);
    this.marketPreviewPurchased += 1;
  }

  buyDefenseItem(state: GameState, items: SpecialItemInventory, ledger: DailyLedger): void {
    this.buyConsumable(state, items, ledger, SPECIAL_ITEM_PRESENTATION.defense.name, ITEM_SHOP_CONFIG.defenseItemPrice,
      this.remainingDefenseStock, () => items.addDefenseItem());
    this.defensePurchased += 1;
  }

  buyTimeExtensionItem(state: GameState, items: SpecialItemInventory, ledger: DailyLedger): void {
    this.buyConsumable(state, items, ledger, SPECIAL_ITEM_PRESENTATION.time.name, ITEM_SHOP_CONFIG.timeExtensionItemPrice,
      this.remainingTimeExtensionStock, () => items.addTimeExtensionItem());
    this.timeExtensionPurchased += 1;
  }

  private buyConsumable(
    state: GameState, items: SpecialItemInventory, ledger: DailyLedger,
    name: string, price: number, stock: number, add: () => void,
  ): void {
    void items;
    if (stock <= 0) throw new Error(`이번 방문의 ${name}을 이미 구매했다.`);
    if (state.money < price) throw new Error('현금이 부족하다.');
    state.spendMoney(price);
    add();
    ledger.recordItemPurchase(name, price);
  }
}
