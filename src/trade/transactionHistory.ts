import type { MarketCheckRecord, OwnedItem } from '@/inventory/inventory';

export type SaleChannel = '일반 판매' | '보따리 상인';

export function calculateHoldingDays(
  purchase: { stage: number; day: number },
  sale: { stage: number; day: number },
  daysPerStage: number,
): number {
  const bought = (purchase.stage - 1) * daysPerStage + purchase.day;
  const sold = (sale.stage - 1) * daysPerStage + sale.day;
  return Math.max(0, sold - bought);
}

export interface TransactionHistoryEntry {
  instanceId: string;
  itemName: string;
  purchasePrice: number;
  purchaseStage: number;
  purchaseDay: number;
  authenticityKnown: boolean;
  marketCheck?: MarketCheckRecord;
  salePrice?: number;
  profit?: number;
  holdingDays?: number;
  saleChannel?: SaleChannel;
}

export class TransactionHistory {
  private records: TransactionHistoryEntry[] = [];

  get entries(): readonly TransactionHistoryEntry[] { return this.records.slice(); }
  get soldEntries(): readonly TransactionHistoryEntry[] { return this.records.filter((entry) => entry.salePrice !== undefined); }
  get profitCount(): number { return this.soldEntries.filter((entry) => (entry.profit ?? 0) > 0).length; }
  get lossCount(): number { return this.soldEntries.filter((entry) => (entry.profit ?? 0) < 0).length; }
  get averageProfit(): number {
    return this.soldEntries.length === 0 ? 0
      : Math.round(this.soldEntries.reduce((sum, entry) => sum + (entry.profit ?? 0), 0) / this.soldEntries.length);
  }

  recordPurchase(item: OwnedItem): void {
    const record = item.purchaseRecord;
    this.records.push({
      instanceId: item.instanceId,
      itemName: item.item.name,
      purchasePrice: item.purchasePrice,
      purchaseStage: record?.stage ?? 1,
      purchaseDay: record?.day ?? 1,
      authenticityKnown: record?.authenticityKnown ?? false,
      marketCheck: record?.marketCheck,
    });
  }

  recordMarketCheck(instanceId: string, marketCheck: MarketCheckRecord): boolean {
    const entry = this.records.find((candidate) => candidate.instanceId === instanceId);
    if (!entry) return false;
    entry.marketCheck = { ...marketCheck };
    return true;
  }

  recordSale(item: OwnedItem, salePrice: number, holdingDays: number, saleChannel: SaleChannel): void {
    const entry = this.records.find((candidate) => candidate.instanceId === item.instanceId);
    if (!entry) return;
    entry.salePrice = salePrice;
    entry.profit = salePrice - item.purchasePrice;
    entry.holdingDays = holdingDays;
    entry.saleChannel = saleChannel;
  }

  reset(): void { this.records = []; }
}
