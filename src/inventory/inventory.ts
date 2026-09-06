import { INVENTORY_CONFIG } from '@/config/inventoryConfig';
import type { ItemSeed } from '@/config/tradeConfig';
import type { Authenticity } from '@/item/authenticity';

export interface OwnedItem {
  instanceId: string;
  item: ItemSeed;
  purchasePrice: number;
  authenticity: Authenticity;
  purchaseRecord?: PurchaseRecord;
}

export interface MarketCheckRecord { stage: number; day: number; nextDaySalePrice: number }
export interface PurchaseRecord {
  stage: number;
  day: number;
  authenticityKnown: boolean;
  itemConditionClue?: string;
  sellerBehaviorClue?: string;
  marketCheck?: MarketCheckRecord;
}

export class InventoryFullError extends Error {
  constructor() {
    super('재고 공간이 부족합니다.');
    this.name = 'InventoryFullError';
  }
}

/** Phaser와 독립적으로 보유 물건과 용량만 책임지는 재고. */
export class Inventory {
  private readonly storedItems: OwnedItem[] = [];
  private readonly slotIds: (string | null)[];
  private nextInstanceNumber = 1;

  constructor(private readonly maxCapacity = INVENTORY_CONFIG.capacity) {
    if (!Number.isSafeInteger(maxCapacity) || maxCapacity < 1) {
      throw new RangeError('재고 용량은 1 이상의 정수여야 한다.');
    }
    this.slotIds = Array.from({ length: maxCapacity }, () => null);
  }

  get items(): readonly OwnedItem[] { return this.storedItems.slice(); }
  get slots(): readonly (OwnedItem | null)[] {
    return this.slotIds.map((id) => id
      ? (this.storedItems.find((item) => item.instanceId === id) ?? null) : null);
  }
  get capacity(): number { return this.maxCapacity; }
  get size(): number { return this.storedItems.length; }
  get remainingSlots(): number { return this.maxCapacity - this.size; }
  get isFull(): boolean { return this.size >= this.maxCapacity; }
  canAdd(): boolean { return !this.isFull; }

  add(item: ItemSeed, purchasePrice: number, authenticity: Authenticity = 'genuine', purchaseRecord?: PurchaseRecord): OwnedItem {
    if (!this.canAdd()) throw new InventoryFullError();
    if (!Number.isSafeInteger(purchasePrice) || purchasePrice < 0) {
      throw new RangeError('매입 가격은 0 이상의 정수여야 한다.');
    }
    const owned: OwnedItem = {
      instanceId: `owned-${this.nextInstanceNumber++}`,
      item,
      purchasePrice,
      authenticity,
      purchaseRecord,
    };
    this.storedItems.push(owned);
    const emptySlot = this.slotIds.indexOf(null);
    this.slotIds[emptySlot] = owned.instanceId;
    return owned;
  }

  recordMarketCheck(instanceId: string, marketCheck: MarketCheckRecord): void {
    const owned = this.storedItems.find((item) => item.instanceId === instanceId);
    if (!owned) throw new Error('시세를 기록할 물건을 찾을 수 없다.');
    if (!owned.purchaseRecord) throw new Error('매입 기록이 없는 물건이다.');
    owned.purchaseRecord.marketCheck = marketCheck;
  }

  remove(instanceId: string): OwnedItem {
    const index = this.storedItems.findIndex((item) => item.instanceId === instanceId);
    if (index < 0) throw new Error('재고에서 물건을 찾을 수 없다.');
    const removed = this.storedItems.splice(index, 1)[0]!;
    const slot = this.slotIds.indexOf(instanceId);
    if (slot >= 0) {
      this.slotIds[slot] = null;
      const remainingIds = this.slotIds.filter((id): id is string => id !== null);
      this.slotIds.fill(null);
      remainingIds.forEach((id, remainingIndex) => {
        this.slotIds[remainingIndex] = id;
      });
    }
    return removed;
  }

  moveSlot(firstSlot: number, secondSlot: number): void {
    if (!Number.isSafeInteger(firstSlot) || !Number.isSafeInteger(secondSlot)
      || firstSlot < 0 || secondSlot < 0
      || firstSlot >= this.maxCapacity || secondSlot >= this.maxCapacity) {
      throw new RangeError('이동할 재고 슬롯이 올바르지 않다.');
    }
    if (this.slotIds[firstSlot] === null) throw new Error('선택한 슬롯이 비어 있다.');
    [this.slotIds[firstSlot], this.slotIds[secondSlot]] = [this.slotIds[secondSlot], this.slotIds[firstSlot]];
  }
}
