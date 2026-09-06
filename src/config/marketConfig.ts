import type { ItemCategory } from '@/config/tradeConfig';

export const MARKET_CONFIG = {
  ranges: {
    stable: { min: 0.9, max: 1.1 },
    normal: { min: 0.8, max: 1.2 },
    volatile: { min: 0.7, max: 1.3 },
  },
  categoryTypes: {
    생활용품: 'stable',
    전자기기: 'normal',
    취미용품: 'normal',
    액세서리: 'volatile',
    수집품: 'volatile',
    골동품: 'volatile',
  } satisfies Record<ItemCategory, 'stable' | 'normal' | 'volatile'>,
  normalDifference: 0.05,
  priceRoundingUnit: 100,
} as const;
