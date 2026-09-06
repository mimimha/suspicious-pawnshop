import { describe, expect, it } from 'vitest';
import { feedbackColor, feedbackKindForProfit } from '@/ui/resultFeedback';

describe('result feedback', () => {
  it('큰 손익은 일반 손익보다 강한 피드백으로 분류한다', () => {
    expect(feedbackKindForProfit(10_000)).toBe('bigProfit');
    expect(feedbackKindForProfit(9_999)).toBe('profit');
    expect(feedbackKindForProfit(-5_000)).toBe('bigLoss');
    expect(feedbackKindForProfit(-4_999)).toBe('loss');
  });

  it('수익과 손실은 서로 다른 색상 체계를 사용한다', () => {
    expect(feedbackColor('bigProfit')).not.toBe(feedbackColor('bigLoss'));
    expect(feedbackColor('fake')).toBe(feedbackColor('bigLoss'));
  });
});
