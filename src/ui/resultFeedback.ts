import { RESULT_FEEDBACK_CONFIG } from '@/config/resultFeedbackConfig';

export type ResultFeedbackKind = 'purchase' | 'genuine' | 'fake' | 'profit' | 'loss' | 'bigProfit' | 'bigLoss';

export function feedbackKindForProfit(profit: number): ResultFeedbackKind {
  if (profit >= RESULT_FEEDBACK_CONFIG.bigProfitThreshold) return 'bigProfit';
  if (profit <= RESULT_FEEDBACK_CONFIG.bigLossThreshold) return 'bigLoss';
  return profit >= 0 ? 'profit' : 'loss';
}

export function feedbackColor(kind: ResultFeedbackKind): string {
  switch (kind) {
    case 'bigProfit': return '#78d493';
    case 'profit': return '#9dcca6';
    case 'fake':
    case 'bigLoss': return '#f06f65';
    case 'loss': return '#df9187';
    case 'purchase':
    case 'genuine': return '#f0d39a';
  }
}
