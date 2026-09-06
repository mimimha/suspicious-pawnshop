import { describe, expect, it } from 'vitest';
import { attackChanceMultiplier, negotiationRisk } from '@/trade/negotiationRisk';
import { CUSTOMER_CONFIG } from '@/config/customerConfig';

describe('negotiationRisk', () => {
  it('STAGE 1에서도 위험 성향 손님은 공격할 수 있다', () => {
    expect(negotiationRisk(1, 'veryUnhappy', 3, 0, 'fraudster', () => 0)).toBe('attacked');
  });
  it('STAGE 2 위험 성향의 강한 불만은 공격할 수 있다', () => {
    expect(negotiationRisk(2, 'veryUnhappy', 1, 50, 'fraudster', () => 0)).toBe('attacked');
  });
  it('STAGE 1 공격 확률은 STAGE 2보다 낮다', () => {
    // 같은 입력에서 STAGE 2만 통과하는 굴림이 존재해야 STAGE 1이 더 낮다는 뜻이다.
    const onlyStageTwo = 0.2;
    expect(negotiationRisk(1, 'veryUnhappy', 1, 50, 'fraudster', () => onlyStageTwo))
      .not.toBe('attacked');
    expect(negotiationRisk(2, 'veryUnhappy', 1, 50, 'fraudster', () => onlyStageTwo))
      .toBe('attacked');
  });
  it('STAGE 1·2 어디서도 일반·정직형 손님은 공격하지 않는다', () => {
    ([1, 2] as const).forEach((stage) => {
      expect(negotiationRisk(stage, 'veryUnhappy', 3, 0, 'honest', () => 0)).not.toBe('attacked');
      expect(negotiationRisk(stage, 'veryUnhappy', 3, 0, 'normal', () => 0)).not.toBe('attacked');
    });
  });
  it('위험 확률을 벗어난 경우 거래를 계속한다', () => {
    expect(negotiationRisk(2, 'almost', 1, 50, 'honest', () => 0.99)).toBe('continue');
  });
});

describe('attackChanceMultiplier', () => {
  it('STAGE별 배율을 그대로 돌려준다', () => {
    expect(attackChanceMultiplier(1)).toBe(CUSTOMER_CONFIG.attackChanceMultiplierByStage[0]);
    expect(attackChanceMultiplier(2)).toBe(CUSTOMER_CONFIG.attackChanceMultiplierByStage[1]);
  });

  it('STAGE 1 배율은 STAGE 2보다 낮고 0보다 크다', () => {
    expect(attackChanceMultiplier(1)).toBeGreaterThan(0);
    expect(attackChanceMultiplier(1)).toBeLessThan(attackChanceMultiplier(2));
  });

  it('설정 범위를 벗어난 STAGE는 양 끝 값을 이어 쓴다', () => {
    expect(attackChanceMultiplier(0)).toBe(attackChanceMultiplier(1));
    expect(attackChanceMultiplier(9)).toBe(attackChanceMultiplier(2));
  });
});
