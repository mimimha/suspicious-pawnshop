import type { Inventory, OwnedItem } from '@/inventory/inventory';
import type { DailyLedger } from '@/ledger/dailyLedger';
import type { MerchantOffer } from '@/merchant/bagMerchant';
import type { GameState } from '@/state/gameState';
import { fakeDisposalPrice } from '@/item/authenticity';

export interface MerchantSaleResult { item: OwnedItem; salePrice: number; profit: number }

/** 같은 종류 중 가장 먼저 입고된 재고 하나를 상인의 고정 제안가로 판매한다. */
export function sellToMerchant(
  state: GameState,
  inventory: Inventory,
  ledger: DailyLedger,
  offer: MerchantOffer,
): MerchantSaleResult {
  const owned = inventory.items.find((candidate) => candidate.item.id === offer.item.id);
  if (!owned) throw new Error('상인이 원하는 물건을 보유하고 있지 않다.');
  const salePrice = owned.authenticity === 'fake' ? fakeDisposalPrice(owned.item) : offer.price;
  const removed = inventory.remove(owned.instanceId);
  state.earnMoney(salePrice);
  ledger.recordMerchantSale(removed.item.name, salePrice, removed.purchasePrice);
  return { item: removed, salePrice, profit: salePrice - removed.purchasePrice };
}
