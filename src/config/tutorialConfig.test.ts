import { describe, expect, it } from 'vitest';
import { TUTORIAL_CONFIG } from '@/config/tutorialConfig';
import { CUSTOMER_QUEUE_CONFIG } from '@/config/customerQueueConfig';

describe('STAGE 1 DAY 1 tutorial balance', () => {
  it('두 명의 튜토리얼 뒤 세 명의 일반 손님이 남는다', () => {
    expect(CUSTOMER_QUEUE_CONFIG.customersPerDayByStage[0]).toBe(5);
    expect(TUTORIAL_CONFIG.scriptedCustomerCount).toBe(2);
    expect(CUSTOMER_QUEUE_CONFIG.customersPerDayByStage[0] - TUTORIAL_CONFIG.scriptedCustomerCount).toBe(3);
  });

  it('첫 튜토리얼 손님의 최초 제시가는 9,000원으로 고정된다', () => {
    expect(TUTORIAL_CONFIG.safeCustomer.askingPrice).toBe(9_000);
  });

  it('두 번째 연습 제안가는 최저 수락가의 70% 미만이다', () => {
    expect(TUTORIAL_CONFIG.riskyCustomer.dangerousOffer)
      .toBeLessThan(TUTORIAL_CONFIG.riskyCustomer.minimumPrice * 0.7);
  });

  it('튜토리얼 디졸브는 조작을 기다리게 하지 않는 짧은 시간이다', () => {
    expect(TUTORIAL_CONFIG.overlayFadeDurationMilliseconds).toBeGreaterThanOrEqual(150);
    expect(TUTORIAL_CONFIG.overlayFadeDurationMilliseconds).toBeLessThanOrEqual(300);
  });

  it('관찰 단서는 다음 단계에서 빠르게 나타난다', () => {
    expect(TUTORIAL_CONFIG.clueRevealDurationMilliseconds).toBeLessThanOrEqual(250);
  });
});
