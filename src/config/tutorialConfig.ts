export const TUTORIAL_CONFIG = {
  enabledStage: 1,
  enabledDay: 1,
  scriptedCustomerCount: 2,
  safeCustomer: {
    name: '토끼', itemId: 'old-radio', askingPrice: 9_000, minimumPrice: 8_000,
  },
  riskyCustomer: {
    name: '늑대', itemId: 'vintage-camera', askingPrice: 18_000, minimumPrice: 13_500,
    warningOffer: 9_000, dangerousOffer: 7_000,
  },
  maskColor: 0x555555,
  maskAlpha: 0.78,
  overlayFadeDurationMilliseconds: 220,
  clueRevealDurationMilliseconds: 180,
  firstCustomerBrightHoldMilliseconds: 280,
  interCustomerBrightPauseMilliseconds: 450,
  secondCustomerSettleMilliseconds: 320,
} as const;
