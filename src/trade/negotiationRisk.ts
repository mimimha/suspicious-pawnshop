import { CUSTOMER_CONFIG } from '@/config/customerConfig';
import type { CustomerType } from '@/customer/customerProfile';
import type { CustomerReaction } from '@/trade/trade';

export type NegotiationRiskResult = 'continue' | 'brokenOff' | 'attacked';

export function negotiationRisk(
  stage: number, reaction: Exclude<CustomerReaction, 'accepted'>, round: number,
  trust: number, type: CustomerType, random: () => number = Math.random,
): NegotiationRiskResult {
  const roundRisk = Math.max(0, round - 1) * CUSTOMER_CONFIG.riskPerExtraRound;
  const trustRisk = trust <= 20 ? CUSTOMER_CONFIG.lowTrustRisk : 0;
  const attackMultiplier = attackChanceMultiplier(stage);
  if (attackMultiplier > 0 && CUSTOMER_CONFIG.attackProneTypes.includes(type)) {
    const attackChance = clamp((CUSTOMER_CONFIG.baseAttackChance[reaction]
      + CUSTOMER_CONFIG.attackOffsets[type] + roundRisk + trustRisk) * attackMultiplier);
    if (random() < attackChance) return 'attacked';
  }
  const breakChance = clamp(CUSTOMER_CONFIG.baseBreakOffChance[reaction]
    + CUSTOMER_CONFIG.breakOffOffsets[type] + roundRisk + trustRisk);
  return random() < breakChance ? 'brokenOff' : 'continue';
}

function clamp(value: number): number { return Math.min(1, Math.max(0, value)); }

/** STAGE별 공격 확률 배율. 설정보다 큰 STAGE는 마지막 값을 이어 쓴다. */
export function attackChanceMultiplier(stage: number): number {
  const byStage = CUSTOMER_CONFIG.attackChanceMultiplierByStage;
  const index = Math.min(Math.max(Math.floor(stage), 1), byStage.length) - 1;
  return byStage[index] ?? 0;
}
