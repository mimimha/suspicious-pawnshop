export const ITEM_SHOP_CONFIG = {
  startingAppraisalTicketCount: 1,
  appraisalTicketPrice: 3_000,
  appraisalTicketStockPerVisit: 1,
  marketPreviewTicketPrice: 3_000,
  marketPreviewTicketStockPerVisit: 1,
  defenseItemPrice: 3_000,
  timeExtensionItemPrice: 3_000,
  timeExtensionSeconds: 30,
  consumableStockPerVisit: 1,
} as const;

export type SpecialItemKey = 'appraisal' | 'market' | 'time' | 'defense';

export const SPECIAL_ITEM_PRESENTATION = {
  appraisal: {
    name: '감정 도구',
    description: '첫 제안 전에 손님 물건의 진품·가품을 확인합니다.',
    texture: 'special-item-appraisal',
  },
  market: {
    name: '시세 수첩',
    description: '판매창에서 선택한 매입품의\n내일 판매가를 확인합니다.',
    texture: 'special-item-market',
  },
  time: {
    name: '모래시계',
    description: '영업 중 사용하면 그날 영업 시간이 30초 늘어납니다.',
    texture: 'special-item-time',
  },
  defense: {
    name: '방어 부적',
    description: '사용하면 다음 공격 1회를 막은 뒤 해제됩니다.',
    texture: 'special-item-defense',
  },
} as const satisfies Record<SpecialItemKey, {
  name: string;
  description: string;
  texture: string;
}>;
