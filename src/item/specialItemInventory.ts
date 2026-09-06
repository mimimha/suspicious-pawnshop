export class SpecialItemInventory {
  private appraisalTickets: number;
  private marketPreviewTickets = 0;
  private defenseItems = 0;
  private timeExtensionItems = 0;

  constructor(startingAppraisalTickets = 0) {
    if (!Number.isSafeInteger(startingAppraisalTickets) || startingAppraisalTickets < 0) {
      throw new RangeError('시작 감정권 수량은 0 이상의 정수여야 한다.');
    }
    this.appraisalTickets = startingAppraisalTickets;
  }

  get appraisalTicketCount(): number { return this.appraisalTickets; }
  get marketPreviewTicketCount(): number { return this.marketPreviewTickets; }
  get defenseItemCount(): number { return this.defenseItems; }
  get timeExtensionItemCount(): number { return this.timeExtensionItems; }

  addAppraisalTicket(amount = 1): void {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new RangeError('추가 수량은 1 이상의 정수여야 한다.');
    }
    this.appraisalTickets += amount;
  }

  useAppraisalTicket(): void {
    if (this.appraisalTickets <= 0) throw new Error('보유한 감정권이 없다.');
    this.appraisalTickets -= 1;
  }

  addMarketPreviewTicket(amount = 1): void {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new RangeError('추가 수량은 1 이상의 정수여야 한다.');
    }
    this.marketPreviewTickets += amount;
  }

  useMarketPreviewTicket(): void {
    if (this.marketPreviewTickets <= 0) throw new Error('보유한 시세 확인권이 없다.');
    this.marketPreviewTickets -= 1;
  }

  addDefenseItem(): void { this.defenseItems += 1; }
  useDefenseItem(): void {
    if (this.defenseItems <= 0) throw new Error('보유한 방어 아이템이 없다.');
    this.defenseItems -= 1;
  }
  addTimeExtensionItem(): void { this.timeExtensionItems += 1; }
  useTimeExtensionItem(): void {
    if (this.timeExtensionItems <= 0) throw new Error('보유한 시간 증량 아이템이 없다.');
    this.timeExtensionItems -= 1;
  }
}
