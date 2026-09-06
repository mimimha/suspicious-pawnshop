import type { Inventory, OwnedItem, PurchaseRecord } from '@/inventory/inventory';
import type { ItemSeed } from '@/config/tradeConfig';
import type { GameState } from '@/state/gameState';
import type { DailyLedger } from '@/ledger/dailyLedger';
import type { Authenticity } from '@/item/authenticity';

export type PurchaseResult =
  | { success: true; ownedItem: OwnedItem }
  | { success: false; reason: 'inventoryFull' };

/** 재고 공간을 먼저 확인해 현금 차감과 재고 추가가 함께 성공하도록 한다. */
export function purchaseItem(
  state: GameState,
  inventory: Inventory,
  item: ItemSeed,
  price: number,
  ledger?: DailyLedger,
  authenticity: Authenticity = 'genuine',
  purchaseRecord?: PurchaseRecord,
): PurchaseResult {
  if (!inventory.canAdd()) return { success: false, reason: 'inventoryFull' };
  state.spendMoney(price);
  const ownedItem = inventory.add(item, price, authenticity, purchaseRecord);
  ledger?.recordPurchase(item.name, price);
  return { success: true, ownedItem };
}
