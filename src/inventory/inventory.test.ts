import { describe, expect, it } from 'vitest';
import { Inventory, InventoryFullError } from '@/inventory/inventory';
import { STAGE_ONE_ITEMS } from '@/config/tradeConfig';

const ITEM = STAGE_ONE_ITEMS[0]!;

describe('Inventory', () => {
  it('빈 상태에서 config 용량과 남은 칸을 노출한다', () => {
    const inventory = new Inventory();
    expect(inventory.size).toBe(0);
    expect(inventory.remainingSlots).toBe(inventory.capacity);
    expect(inventory.isFull).toBe(false);
  });

  it('물건을 추가하면 수량과 남은 칸이 바뀐다', () => {
    const inventory = new Inventory(2);
    const owned = inventory.add(ITEM, 7_000);
    expect(inventory.size).toBe(1);
    expect(inventory.remainingSlots).toBe(1);
    expect(owned.purchasePrice).toBe(7_000);
    expect(owned.authenticity).toBe('genuine');
  });

  it('같은 종류도 서로 다른 인스턴스로 보관한다', () => {
    const inventory = new Inventory(2);
    const first = inventory.add(ITEM, 7_000);
    const second = inventory.add(ITEM, 8_000);
    expect(first.instanceId).not.toBe(second.instanceId);
    expect(inventory.size).toBe(2);
  });

  it('실제로 확인한 다음 DAY 시세만 해당 매입 기록에 남긴다', () => {
    const inventory = new Inventory(1);
    const owned = inventory.add(ITEM, 7_000, 'genuine', {
      stage: 2, day: 1, authenticityKnown: false,
    });
    expect(owned.purchaseRecord?.marketCheck).toBeUndefined();
    inventory.recordMarketCheck(owned.instanceId, { stage: 2, day: 2, nextDaySalePrice: 9_500 });
    expect(inventory.items[0]?.purchaseRecord?.marketCheck).toEqual({
      stage: 2, day: 2, nextDaySalePrice: 9_500,
    });
  });

  it('같은 종류의 진품과 가품을 각각 보관한다', () => {
    const inventory = new Inventory(2);
    inventory.add(ITEM, 7_000, 'genuine');
    inventory.add(ITEM, 3_000, 'fake');
    expect(inventory.items.map((owned) => owned.authenticity)).toEqual(['genuine', 'fake']);
  });

  it('마지막 칸은 추가되고 그 다음 추가는 상태 변화 없이 거부된다', () => {
    const inventory = new Inventory(2);
    inventory.add(ITEM, 7_000);
    inventory.add(ITEM, 8_000);
    const before = inventory.items;
    expect(inventory.isFull).toBe(true);
    expect(() => inventory.add(ITEM, 9_000)).toThrow(InventoryFullError);
    expect(inventory.items).toEqual(before);
  });

  it('외부에서 items 배열을 바꿔도 내부 재고는 변하지 않는다', () => {
    const inventory = new Inventory(2);
    inventory.add(ITEM, 7_000);
    (inventory.items as typeof inventory.items[number][]).pop();
    expect(inventory.size).toBe(1);
  });

  it('instanceId로 특정 물건만 제거한다', () => {
    const inventory = new Inventory(2);
    const first = inventory.add(ITEM, 7_000);
    const second = inventory.add(ITEM, 8_000);
    expect(inventory.remove(first.instanceId)).toEqual(first);
    expect(inventory.items).toEqual([second]);
    expect(() => inventory.remove(first.instanceId)).toThrow('찾을 수 없다');
  });

  it('중간 물건을 제거하면 뒤 물건이 앞 슬롯으로 자동 정렬된다', () => {
    const inventory = new Inventory(4);
    const first = inventory.add(ITEM, 7_000);
    const second = inventory.add(STAGE_ONE_ITEMS[1]!, 8_000);
    const third = inventory.add(STAGE_ONE_ITEMS[2]!, 9_000);

    inventory.remove(second.instanceId);

    expect(inventory.slots).toEqual([first, third, null, null]);
  });

  it('두 재고 위치를 교환해도 물건 데이터가 유지된다', () => {
    const inventory = new Inventory(2);
    const first = inventory.add(ITEM, 7_000);
    const second = inventory.add(STAGE_ONE_ITEMS[1]!, 8_000);
    inventory.moveSlot(0, 1);
    expect(inventory.slots.slice(0, 2)).toEqual([second, first]);
    expect(inventory.items).toEqual([first, second]);
  });

  it('물건을 빈 슬롯으로 옮기고 제거해도 슬롯 상태가 정확하다', () => {
    const inventory = new Inventory(3);
    const first = inventory.add(ITEM, 7_000);
    inventory.moveSlot(0, 2);
    expect(inventory.slots).toEqual([null, null, first]);
    inventory.remove(first.instanceId);
    expect(inventory.slots).toEqual([null, null, null]);
  });

  it('수동으로 옮긴 슬롯이 있어도 제거 후 현재 순서대로 앞에서부터 정렬된다', () => {
    const inventory = new Inventory(4);
    const first = inventory.add(ITEM, 7_000);
    const second = inventory.add(STAGE_ONE_ITEMS[1]!, 8_000);
    const third = inventory.add(STAGE_ONE_ITEMS[2]!, 9_000);
    inventory.moveSlot(0, 3);

    inventory.remove(second.instanceId);

    expect(inventory.slots).toEqual([third, first, null, null]);
  });
});
