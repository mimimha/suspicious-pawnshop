/** Notion은 샤따 전환 연출만 명시한다. 시간은 플레이테스트용 값이다. */
export const DAY_TRANSITION_CONFIG = {
  shutterDurationMilliseconds: 600,
  shutterLowerDurationMilliseconds: 1_500,
  shutterClosedHoldMilliseconds: 1_000,
  statementTextLineIntervalMilliseconds: 320,
  statementEntranceDurationMilliseconds: 520,
  statementStampDelayMilliseconds: 280,
  statementStampImpactDurationMilliseconds: 280,
  statementStampSettleDurationMilliseconds: 180,
  statementStampShakeDurationMilliseconds: 90,
  // DAY 숫자 전환 총 길이 = hold + swap + settle.
  // 1,040ms에서는 날짜가 바뀐 걸 알아채기 전에 사라져, 새 숫자를 읽을 시간(settle)에
  // 대부분을 얹어 총 1,740ms로 늘렸다(플레이테스트값).
  dayNumberHoldMilliseconds: 360,
  dayNumberSwapDurationMilliseconds: 560,
  dayNumberSettleMilliseconds: 820,
  dayNumberTravelPixels: 46,
  /**
   * 숫자가 움직이기 시작한 뒤 효과음까지의 지연.
   * 0ms(움직임과 동시)는 이르게 들려, 새 숫자가 자리를 잡는 무렵으로 0.5초 늦췄다(플레이테스트값).
   * 전환 시작 기준으로는 360 + 500 = 860ms 지점이고 전환이 끝나는 1,740ms보다 충분히 앞이다.
   */
  dayNumberSwapSoundDelayMilliseconds: 500,
} as const;
