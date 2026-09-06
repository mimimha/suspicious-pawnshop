import type { Inventory, OwnedItem } from '@/inventory/inventory';
import type { DailyLedger } from '@/ledger/dailyLedger';
import type { Market } from '@/market/market';
import type { GameState } from '@/state/gameState';

export interface SaleResult { item: OwnedItem; salePrice: number; profit: number }

/** 판매 대상 확인 후 재고 제거, 현금/장부 반영을 한 흐름으로 수행한다. */
export function sellItem(
  state: GameState,
  inventory: Inventory,
  market: Market,
  ledger: DailyLedger,
  instanceId: string,
): SaleResult {
  const item = inventory.items.find((candidate) => candidate.instanceId === instanceId);
  if (!item) throw new Error('판매할 물건을 재고에서 찾을 수 없다.');
  const salePrice = market.salePrice(item.item, item.authenticity);
  const removed = inventory.remove(instanceId);
  state.earnMoney(salePrice);
  ledger.recordSale(removed.item.name, salePrice, removed.purchasePrice);
  return { item: removed, salePrice, profit: salePrice - removed.purchasePrice };
}
