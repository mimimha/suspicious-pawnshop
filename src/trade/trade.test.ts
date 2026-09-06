import { describe, expect, it } from 'vitest';
import { reactionForOffer, TradeSession, InvalidTradeActionError } from '@/trade/trade';
import type { Customer } from '@/trade/customer';
import { SpecialItemInventory } from '@/item/specialItemInventory';

const CUSTOMER: Customer = {
  id: 'test', name: '테스트', item: { id: 'item', name: '카메라', category: '전자기기', basePrice: 10_000, artReady: true },
  initialAskingPrice: 12_000, minAcceptablePrice: 10_000, authenticity: 'genuine',
};

function session(): TradeSession {
  const trade = new TradeSession();
  trade.present(CUSTOMER);
  return trade;
}

describe('가격 반응 판정', () => {
  it.each([[10_000, 'accepted'], [9_500, 'almost'], [8_000, 'unhappy'], [5_000, 'veryUnhappy']] as const)(
    '%i원 제안은 %s 반응이다', (offer, reaction) => expect(reactionForOffer(offer, 10_000)).toBe(reaction),
  );
});

describe('거래 상태 기계', () => {
  it('3회차 최종 결렬은 공격 결과로 덮어쓸 수 있다', () => {
    const trade = session();
    trade.offer(1_000, 50_000);
    trade.offer(2_000, 50_000);
    trade.offer(3_000, 50_000);
    expect(trade.outcome).toBe('brokenOff');
    trade.endFromRisk('attacked');
    expect(trade.outcome).toBe('attacked');
  });

  it('첫 제안 전에 감정권을 소비해 결과를 공개하고 라운드는 유지한다', () => {
    const trade = session();
    const items = new SpecialItemInventory();
    items.addAppraisalTicket();
    expect(trade.appraise(items)).toBe('genuine');
    expect(trade.appraisalResult).toBe('genuine');
    expect(trade.round).toBe(0);
    expect(items.appraisalTicketCount).toBe(0);
    expect(() => trade.appraise(items)).toThrow('감정하지 않은');
  });

  it('가격을 한 번 제안한 뒤에는 감정할 수 없다', () => {
    const trade = session();
    const items = new SpecialItemInventory();
    items.addAppraisalTicket();
    trade.offer(8_000, 50_000);
    expect(trade.canAppraise).toBe(false);
    expect(() => trade.appraise(items)).toThrow('첫 가격 제안 전');
    expect(items.appraisalTicketCount).toBe(1);
  });

  it('최저 수용가 이상이면 즉시 구매로 종료한다', () => {
    const trade = session();
    trade.offer(10_000, 50_000);
    expect(trade.status).toBe('Resolved');
    expect(trade.outcome).toBe('purchased');
    expect(trade.round).toBe(1);
  });

  it('세 번 모두 미달이면 결렬되고 네 번째 제안은 거부한다', () => {
    const trade = session();
    trade.offer(5_000, 50_000);
    trade.offer(6_000, 50_000);
    trade.offer(7_000, 50_000);
    expect(trade.outcome).toBe('brokenOff');
    expect(() => trade.offer(10_000, 50_000)).toThrow(InvalidTradeActionError);
  });

  it('진행 중 언제든 포기할 수 있다', () => {
    const trade = session();
    trade.offer(5_000, 50_000);
    trade.reject();
    expect(trade.outcome).toBe('rejected');
  });

  it('보유 현금 초과 제안은 라운드를 소모하지 않는다', () => {
    const trade = session();
    expect(() => trade.offer(50_001, 50_000)).toThrow('보유 현금');
    expect(trade.round).toBe(0);
    expect(trade.status).toBe('Presenting');
  });

  it('종료 결과를 확인한 뒤 Idle로 초기화한다', () => {
    const trade = session();
    trade.reject();
    trade.reset();
    expect(trade.status).toBe('Idle');
    expect(trade.customer).toBeNull();
  });

  it('수락된 구매를 재고 부족 결과로 바꿀 수 있다', () => {
    const trade = session();
    trade.offer(10_000, 50_000);
    trade.markPurchaseFailed();
    expect(trade.outcome).toBe('inventoryFull');
  });
});
