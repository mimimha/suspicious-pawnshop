import { describe, expect, it } from 'vitest';
import { CUSTOMER_NAMES } from '@/config/tradeConfig';
import {
  CUSTOMER_NEGOTIATION_LINES,
  CUSTOMER_PURCHASE_LINES,
  CUSTOMER_BREAKOFF_LINES,
  CUSTOMER_INVENTORY_FULL_LINES,
  CUSTOMER_REJECTION_LINES,
  customerNegotiationLine,
  customerBreakOffLine,
  customerInventoryFullLine,
  customerPurchaseLine,
  customerRejectionLine,
} from '@/trade/customerDialogue';

describe('customerNegotiationLine', () => {
  it('모든 손님에게 세 단계별 대사 두 개가 있다', () => {
    for (const name of CUSTOMER_NAMES) {
      const lines = CUSTOMER_NEGOTIATION_LINES[name]!;
      for (const reaction of ['almost', 'unhappy', 'veryUnhappy'] as const) {
        expect(lines[reaction]).toHaveLength(2);
        expect(lines[reaction][0]).not.toBe(lines[reaction][1]);
      }
    }
  });

  it('같은 반응도 첫 번째와 두 번째 재흥정에서 겹치지 않는다', () => {
    for (const name of CUSTOMER_NAMES) {
      expect(customerNegotiationLine(name, 'normal', 'almost', 1))
        .not.toBe(customerNegotiationLine(name, 'normal', 'almost', 2));
    }
  });

  it('목록에 없는 손님도 성향별 기본 대사를 사용한다', () => {
    expect(customerNegotiationLine('새 손님', 'honest', 'unhappy', 1)).toContain('가격');
  });

  it('성향 설명 표지를 실제 말풍선 대사 앞에 붙이지 않는다', () => {
    const lines = [
      customerNegotiationLine('토끼', 'honest', 'almost', 1),
      customerNegotiationLine('토끼', 'suspicious', 'almost', 1),
      customerPurchaseLine('토끼', 'fraudster'),
    ];
    for (const line of lines) expect(line).not.toMatch(/^(차분히|담담히|경계하며|재촉하듯) /);
  });

  it('모든 손님에게 외형별 거래 성사 대사가 있다', () => {
    for (const name of CUSTOMER_NAMES) {
      expect(CUSTOMER_PURCHASE_LINES[name]).toBeTruthy();
      expect(customerPurchaseLine(name, 'normal')).toContain('\n');
    }
  });

  it('목록에 없는 손님은 성향별 거래 성사 대사를 사용한다', () => {
    expect(customerPurchaseLine('새 손님', 'honest')).toContain('감사');
    expect(customerPurchaseLine('새 손님', 'fraudster')).toContain('선택');
  });

  it('모든 손님에게 외형별 거래 거절 대사가 있다', () => {
    for (const name of CUSTOMER_NAMES) {
      expect(CUSTOMER_REJECTION_LINES[name]).toBeTruthy();
      expect(customerRejectionLine(name, 'normal')).toContain('\n');
    }
  });

  it('목록에 없는 손님은 성향별 거래 거절 대사를 사용한다', () => {
    expect(customerRejectionLine('새 손님', 'honest')).toContain('아쉽');
    expect(customerRejectionLine('새 손님', 'fraudster')).toContain('기회');
  });

  it('모든 손님에게 서로 다른 외형별 흥정 결렬 대사가 있다', () => {
    const lines = CUSTOMER_NAMES.map((name) => CUSTOMER_BREAKOFF_LINES[name]);
    expect(lines.every(Boolean)).toBe(true);
    expect(new Set(lines).size).toBe(CUSTOMER_NAMES.length);
    for (const name of CUSTOMER_NAMES) expect(customerBreakOffLine(name, 'normal')).toContain('\n');
  });

  it('목록에 없는 손님은 성향별 흥정 결렬 대사를 사용한다', () => {
    expect(customerBreakOffLine('새 손님', 'honest')).toContain('합의');
    expect(customerBreakOffLine('새 손님', 'fraudster')).toContain('가치');
  });

  it('모든 손님에게 서로 다른 재고 부족 반응 대사가 있다', () => {
    const lines = CUSTOMER_NAMES.map((name) => CUSTOMER_INVENTORY_FULL_LINES[name]);
    expect(lines.every(Boolean)).toBe(true);
    expect(new Set(lines).size).toBe(CUSTOMER_NAMES.length);
    for (const name of CUSTOMER_NAMES) expect(customerInventoryFullLine(name, 'normal')).toContain('\n');
  });

  it('목록에 없는 손님은 성향별 재고 부족 대사를 사용한다', () => {
    expect(customerInventoryFullLine('새 손님', 'honest')).toContain('공간');
    expect(customerInventoryFullLine('새 손님', 'suspicious')).toContain('공간');
  });
});
