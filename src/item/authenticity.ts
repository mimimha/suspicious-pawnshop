import { AUTHENTICITY_CONFIG } from '@/config/authenticityConfig';
import type { ItemSeed } from '@/config/tradeConfig';

export type Authenticity = 'genuine' | 'fake';
export type AuthenticityRandomSource = () => number;

export function determineAuthenticity(
  stage: number,
  item: ItemSeed,
  random: AuthenticityRandomSource = Math.random,
  chanceOffset = 0,
): Authenticity {
  if (stage < AUTHENTICITY_CONFIG.startsAtStage) return 'genuine';
  const chance = Math.min(1, Math.max(0, AUTHENTICITY_CONFIG.fakeChanceByCategory[item.category] + chanceOffset));
  return random() < chance ? 'fake' : 'genuine';
}

export function fakeDisposalPrice(item: ItemSeed): number {
  const { fakeDisposalRatio, priceRoundingUnit } = AUTHENTICITY_CONFIG;
  return Math.round((item.basePrice * fakeDisposalRatio) / priceRoundingUnit) * priceRoundingUnit;
}
