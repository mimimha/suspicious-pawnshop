export const OFFER_ADJUSTMENT_STEP = 100;

export function adjustOfferAmount(current: number, delta: number): number {
  if (!Number.isSafeInteger(current) || !Number.isSafeInteger(delta)) {
    throw new RangeError('제안가와 증감액은 정수여야 한다.');
  }
  return Math.max(0, current + delta);
}
