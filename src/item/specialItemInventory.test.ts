import { describe, expect, it } from 'vitest';
import { SpecialItemInventory } from '@/item/specialItemInventory';

describe('SpecialItemInventory', () => {
  it('지정한 시작 감정권 수량을 보유한다', () => {
    expect(new SpecialItemInventory(1).appraisalTicketCount).toBe(1);
  });
  it('0개로 시작하며 구매와 사용 수량을 관리한다', () => {
    const items = new SpecialItemInventory();
    expect(items.appraisalTicketCount).toBe(0);
    items.addAppraisalTicket();
    items.useAppraisalTicket();
    expect(items.appraisalTicketCount).toBe(0);
  });

  it('없는 감정권은 사용할 수 없다', () => {
    expect(() => new SpecialItemInventory().useAppraisalTicket()).toThrow('보유한 감정권이 없다.');
  });

  it('시세 확인권을 감정권과 별도로 관리한다', () => {
    const items = new SpecialItemInventory();
    items.addAppraisalTicket();
    items.addMarketPreviewTicket();
    items.useMarketPreviewTicket();
    expect(items.appraisalTicketCount).toBe(1);
    expect(items.marketPreviewTicketCount).toBe(0);
    expect(() => items.useMarketPreviewTicket()).toThrow('시세 확인권');
  });

  it('방어와 시간 증량 아이템을 서로 독립적으로 소비한다', () => {
    const items = new SpecialItemInventory();
    items.addDefenseItem();
    items.addTimeExtensionItem();
    items.useDefenseItem();
    expect(items.defenseItemCount).toBe(0);
    expect(items.timeExtensionItemCount).toBe(1);
    items.useTimeExtensionItem();
    expect(items.timeExtensionItemCount).toBe(0);
  });
});
