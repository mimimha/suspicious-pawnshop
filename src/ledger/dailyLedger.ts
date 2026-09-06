export interface PurchaseEntry {
  type: 'purchase';
  itemName: string;
  amount: number;
}

export interface SaleEntry {
  type: 'sale';
  itemName: string;
  amount: number;
  purchasePrice: number;
}

export interface MerchantSaleEntry {
  type: 'merchantSale';
  itemName: string;
  amount: number;
  purchasePrice: number;
}

export interface RentEntry {
  type: 'rent';
  itemName: '월세';
  amount: number;
}

export interface ItemPurchaseEntry {
  type: 'itemPurchase';
  itemName: string;
  amount: number;
}

export interface HospitalEntry { type: 'hospital'; itemName: '병원비'; amount: number }

export type LedgerEntry = PurchaseEntry | SaleEntry | MerchantSaleEntry | RentEntry | ItemPurchaseEntry | HospitalEntry;

export interface DailyStatement {
  purchaseCount: number;
  purchaseExpense: number;
  itemPurchaseExpense: number;
  hospitalExpense: number;
  saleCount: number;
  salesRevenue: number;
  merchantSaleCount: number;
  merchantSalesRevenue: number;
  realizedProfit: number;
  bestRealizedProfit: number | null;
  worstRealizedProfit: number | null;
  rentExpense: number;
  netCashChange: number;
  openingMoney: number;
  closingMoney: number;
}

/** 하루 동안 실제로 완료된 현금 거래만 기록한다. */
export class DailyLedger {
  private ledgerEntries: LedgerEntry[] = [];

  get entries(): readonly LedgerEntry[] { return this.ledgerEntries.slice(); }
  get purchaseCount(): number { return this.ledgerEntries.filter((entry) => entry.type === 'purchase').length; }
  get purchaseExpense(): number {
    return this.ledgerEntries.reduce((total, entry) => total + (entry.type === 'purchase' ? entry.amount : 0), 0);
  }
  get saleCount(): number { return this.ledgerEntries.filter((entry) => entry.type === 'sale').length; }
  get itemPurchaseExpense(): number {
    return this.ledgerEntries.reduce(
      (total, entry) => total + (entry.type === 'itemPurchase' ? entry.amount : 0), 0,
    );
  }
  get salesRevenue(): number {
    return this.ledgerEntries.reduce((total, entry) => total + (entry.type === 'sale' ? entry.amount : 0), 0);
  }
  get merchantSaleCount(): number {
    return this.ledgerEntries.filter((entry) => entry.type === 'merchantSale').length;
  }
  get merchantSalesRevenue(): number {
    return this.ledgerEntries.reduce(
      (total, entry) => total + (entry.type === 'merchantSale' ? entry.amount : 0), 0,
    );
  }
  get realizedProfits(): number[] {
    return this.ledgerEntries
      .filter((entry): entry is SaleEntry | MerchantSaleEntry => entry.type === 'sale' || entry.type === 'merchantSale')
      .map((entry) => entry.amount - entry.purchasePrice);
  }
  get realizedProfit(): number { return this.realizedProfits.reduce((total, profit) => total + profit, 0); }
  get netCashChange(): number {
    return this.salesRevenue + this.merchantSalesRevenue
      - this.purchaseExpense - this.itemPurchaseExpense - this.hospitalExpense - this.rentExpense;
  }
  get rentExpense(): number {
    return this.ledgerEntries.reduce(
      (total, entry) => total + (entry.type === 'rent' ? entry.amount : 0), 0,
    );
  }
  get hospitalExpense(): number {
    return this.ledgerEntries.reduce(
      (total, entry) => total + (entry.type === 'hospital' ? entry.amount : 0), 0,
    );
  }

  recordPurchase(itemName: string, amount: number): void {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new RangeError('매입 금액은 0 이상의 정수여야 한다.');
    }
    this.ledgerEntries.push({ type: 'purchase', itemName, amount });
  }

  recordSale(itemName: string, amount: number, purchasePrice = 0): void {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new RangeError('판매 금액은 0 이상의 정수여야 한다.');
    }
    this.ledgerEntries.push({ type: 'sale', itemName, amount, purchasePrice });
  }

  recordItemPurchase(itemName: string, amount: number): void {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new RangeError('아이템 구매 금액은 0 이상의 정수여야 한다.');
    }
    this.ledgerEntries.push({ type: 'itemPurchase', itemName, amount });
  }

  recordHospital(amount: number): void {
    if (!Number.isSafeInteger(amount) || amount < 0) throw new RangeError('병원비는 0 이상의 정수여야 한다.');
    this.ledgerEntries.push({ type: 'hospital', itemName: '병원비', amount });
  }

  recordMerchantSale(itemName: string, amount: number, purchasePrice = 0): void {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new RangeError('상인 판매 금액은 0 이상의 정수여야 한다.');
    }
    this.ledgerEntries.push({ type: 'merchantSale', itemName, amount, purchasePrice });
  }

  recordRent(amount: number): void {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new RangeError('월세는 0 이상의 정수여야 한다.');
    }
    if (this.rentExpense > 0) throw new Error('월세는 한 번만 기록할 수 있다.');
    this.ledgerEntries.push({ type: 'rent', itemName: '월세', amount });
  }

  statement(openingMoney: number, closingMoney: number, externalCashAdjustment = 0): DailyStatement {
    if (!Number.isSafeInteger(externalCashAdjustment)) {
      throw new RangeError('외부 현금 조정액은 정수여야 한다.');
    }
    const actualChange = closingMoney - openingMoney - externalCashAdjustment;
    if (actualChange !== this.netCashChange) {
      throw new Error('장부 합계와 실제 현금 변동이 일치하지 않는다.');
    }
    return {
      purchaseCount: this.purchaseCount,
      purchaseExpense: this.purchaseExpense,
      itemPurchaseExpense: this.itemPurchaseExpense,
      hospitalExpense: this.hospitalExpense,
      saleCount: this.saleCount,
      salesRevenue: this.salesRevenue,
      merchantSaleCount: this.merchantSaleCount,
      merchantSalesRevenue: this.merchantSalesRevenue,
      realizedProfit: this.realizedProfit,
      bestRealizedProfit: this.realizedProfits.some((profit) => profit > 0)
        ? Math.max(...this.realizedProfits.filter((profit) => profit > 0)) : null,
      worstRealizedProfit: this.realizedProfits.some((profit) => profit < 0)
        ? Math.min(...this.realizedProfits.filter((profit) => profit < 0)) : null,
      rentExpense: this.rentExpense,
      netCashChange: this.netCashChange,
      openingMoney,
      closingMoney,
    };
  }

  reset(): void { this.ledgerEntries = []; }
}
