import { TRADE_BALANCE } from '@/config/tradeConfig';
import type { Customer } from '@/trade/customer';
import type { Authenticity } from '@/item/authenticity';
import { SpecialItemInventory } from '@/item/specialItemInventory';

export type TradeStatus = 'Idle' | 'Presenting' | 'Negotiating' | 'Resolved';
export type TradeOutcome = 'purchased' | 'rejected' | 'brokenOff' | 'inventoryFull' | 'attacked' | 'defended' | null;
export type CustomerReaction = 'accepted' | 'almost' | 'unhappy' | 'veryUnhappy';

export class InvalidTradeActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTradeActionError';
  }
}

export class TradeSession {
  private _status: TradeStatus = 'Idle';
  private _customer: Customer | null = null;
  private _round = 0;
  private _lastOffer: number | null = null;
  private _lastReaction: CustomerReaction | null = null;
  private _outcome: TradeOutcome = null;
  private _appraisalResult: Authenticity | null = null;

  get status(): TradeStatus { return this._status; }
  get customer(): Customer | null { return this._customer; }
  get round(): number { return this._round; }
  get lastOffer(): number | null { return this._lastOffer; }
  get lastReaction(): CustomerReaction | null { return this._lastReaction; }
  get outcome(): TradeOutcome { return this._outcome; }
  get appraisalResult(): Authenticity | null { return this._appraisalResult; }
  get canAppraise(): boolean {
    return this._status === 'Presenting' && this._round === 0 && this._appraisalResult === null;
  }

  present(customer: Customer): void {
    if (this._status !== 'Idle') throw new InvalidTradeActionError('대기 상태에서만 손님을 받을 수 있다.');
    this._customer = customer;
    this._status = 'Presenting';
  }

  offer(amount: number, availableMoney: number): CustomerReaction {
    if (this._status !== 'Presenting' && this._status !== 'Negotiating') {
      throw new InvalidTradeActionError('진행 중인 거래에만 가격을 제안할 수 있다.');
    }
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new InvalidTradeActionError('제안가는 0 이상의 정수여야 한다.');
    }
    if (amount > availableMoney) throw new InvalidTradeActionError('보유 현금을 초과할 수 없다.');
    if (this._round >= TRADE_BALANCE.maxRounds) throw new InvalidTradeActionError('제안 횟수를 모두 사용했다.');

    const customer = this._customer!;
    this._round += 1;
    this._lastOffer = amount;
    this._lastReaction = reactionForOffer(amount, customer.minAcceptablePrice);

    if (this._lastReaction === 'accepted') {
      this.resolve('purchased');
    } else if (this._round >= TRADE_BALANCE.maxRounds) {
      this.resolve('brokenOff');
    } else {
      this._status = 'Negotiating';
    }
    return this._lastReaction;
  }

  reject(): void {
    if (this._status !== 'Presenting' && this._status !== 'Negotiating') {
      throw new InvalidTradeActionError('진행 중인 거래만 포기할 수 있다.');
    }
    this.resolve('rejected');
  }

  appraise(items: SpecialItemInventory): Authenticity {
    if (!this.canAppraise || !this._customer) {
      throw new InvalidTradeActionError('첫 가격 제안 전의 감정하지 않은 물건만 감정할 수 있다.');
    }
    items.useAppraisalTicket();
    this._appraisalResult = this._customer.authenticity;
    return this._appraisalResult;
  }

  reset(): void {
    if (this._status !== 'Resolved') throw new InvalidTradeActionError('종료된 거래만 정리할 수 있다.');
    this._status = 'Idle';
    this._customer = null;
    this._round = 0;
    this._lastOffer = null;
    this._lastReaction = null;
    this._outcome = null;
    this._appraisalResult = null;
  }

  /** 가격은 수락됐지만 재고 부족으로 최종 구매가 취소된 상태를 기록한다. */
  markPurchaseFailed(): void {
    if (this._status !== 'Resolved' || this._outcome !== 'purchased') {
      throw new InvalidTradeActionError('수락된 구매만 재고 부족으로 취소할 수 있다.');
    }
    this._outcome = 'inventoryFull';
  }

  endFromRisk(outcome: 'brokenOff' | 'attacked' | 'defended'): void {
    const canOverrideFinalBreakOff = this._status === 'Resolved' && this._outcome === 'brokenOff';
    if (this._status !== 'Presenting' && this._status !== 'Negotiating' && !canOverrideFinalBreakOff) {
      throw new InvalidTradeActionError('진행 중인 거래만 위험 결과로 종료할 수 있다.');
    }
    this.resolve(outcome);
  }

  private resolve(outcome: Exclude<TradeOutcome, null>): void {
    this._status = 'Resolved';
    this._outcome = outcome;
  }
}

export function reactionForOffer(offer: number, minimum: number): CustomerReaction {
  if (offer >= minimum) return 'accepted';
  const ratio = offer / minimum;
  if (ratio >= TRADE_BALANCE.nearAcceptanceRatio) return 'almost';
  if (ratio >= TRADE_BALANCE.complaintRatio) return 'unhappy';
  return 'veryUnhappy';
}
